import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

const ACCESS_KEY = 'tms_access';
const REFRESH_KEY = 'tms_refresh';

export const tokens = {
  get access() {
    return localStorage.getItem(ACCESS_KEY);
  },
  get refresh() {
    return localStorage.getItem(REFRESH_KEY);
  },
  set(access: string, refresh: string) {
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

/** Server envelope: { code, message, data }. */
interface Envelope<T> {
  code: number;
  message: string;
  data: T;
  fields?: Record<string, string[]>;
}

export class ApiError extends Error {
  status: number;
  fields?: Record<string, string[]>;
  constructor(message: string, status: number, fields?: Record<string, string[]>) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

export const http: AxiosInstance = axios.create({ baseURL: BASE_URL });

http.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const t = tokens.access;
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});

let refreshing: Promise<string> | null = null;

async function doRefresh(): Promise<string> {
  const rt = tokens.refresh;
  if (!rt) throw new ApiError('未登录', 401);
  const res = await axios.post<Envelope<{ accessToken: string; refreshToken: string }>>(
    `${BASE_URL}/auth/refresh`,
    { refreshToken: rt },
  );
  const { accessToken, refreshToken } = res.data.data;
  tokens.set(accessToken, refreshToken);
  return accessToken;
}

http.interceptors.response.use(
  (res) => res,
  async (error: AxiosError<Envelope<unknown>>) => {
    const status = error.response?.status ?? 0;
    const original = error.config as InternalAxiosRequestConfig & { _retried?: boolean };

    // try a single refresh on 401
    if (status === 401 && original && !original._retried && tokens.refresh) {
      original._retried = true;
      try {
        refreshing = refreshing ?? doRefresh();
        const newToken = await refreshing;
        refreshing = null;
        original.headers.Authorization = `Bearer ${newToken}`;
        return http(original);
      } catch {
        refreshing = null;
        tokens.clear();
        if (location.pathname !== '/login') location.assign('/login');
      }
    }

    const body = error.response?.data;
    if (status >= 400) {
      // eslint-disable-next-line no-console
      console.error('[api]', status, error.config?.method?.toUpperCase(), error.config?.url, body ?? error.message);
    }
    throw new ApiError(body?.message ?? error.message ?? '请求失败', status, body?.fields);
  },
);

/** Unwraps the { data } envelope. */
export async function unwrap<T>(p: Promise<{ data: Envelope<T> }>): Promise<T> {
  const res = await p;
  return res.data.data;
}
