import { http, unwrap, tokens } from './client';
import type {
  Ad,
  AuditRow,
  AuthUser,
  DashboardLink,
  LinkAdRow,
  LinkDetail,
  LinkRow,
  Paginated,
  Tracker,
  TrafficLink,
} from '../types';

// ── Auth ──
export async function login(username: string, password: string) {
  const data = await unwrap<{ accessToken: string; refreshToken: string; user: AuthUser }>(
    http.post('/auth/login', { username, password }),
  );
  tokens.set(data.accessToken, data.refreshToken);
  return data.user;
}
export const getMe = () => unwrap<AuthUser>(http.get('/auth/me'));

// ── Trackers ──
export const listTrackers = (params: { page: number; pageSize: number; keyword?: string }) =>
  unwrap<Paginated<Tracker>>(http.get('/trackers', { params }));
export const createTracker = (body: { name: string; description?: string; code?: string }) =>
  unwrap<Tracker>(http.post('/trackers', body));
export const updateTracker = (
  id: string,
  body: { name?: string; description?: string; code?: string },
) => unwrap<Tracker>(http.patch(`/trackers/${id}`, body));
export const deleteTracker = (id: string) => unwrap(http.delete(`/trackers/${id}`));

// ── Ads ──
export const listAds = (params: { page: number; pageSize: number; keyword?: string }) =>
  unwrap<Paginated<Ad>>(http.get('/ads', { params }));
export const createAd = (body: { name: string; targetUrl: string; description?: string }) =>
  unwrap<Ad>(http.post('/ads', body));
export const updateAd = (
  id: string,
  body: { name?: string; targetUrl?: string; description?: string },
) => unwrap<Ad>(http.patch(`/ads/${id}`, body));
export const setAdStatus = (id: string, status: boolean) =>
  unwrap<Ad>(http.patch(`/ads/${id}/status`, { status }));
export const deleteAd = (id: string) => unwrap(http.delete(`/ads/${id}`));
export const adLinks = (id: string) =>
  unwrap<{ id: string; name: string; description: string; status: boolean }[]>(
    http.get(`/ads/${id}/links`),
  );

// ── Links ──
export const listLinks = (params: { page: number; pageSize: number; keyword?: string }) =>
  unwrap<Paginated<LinkRow>>(http.get('/links', { params }));
export const getLink = (id: string) => unwrap<LinkDetail>(http.get(`/links/${id}`));
export const createLink = (body: {
  name: string;
  description?: string;
  note?: string;
  shortCode?: string;
  trackerIds?: string[];
}) => unwrap<LinkRow>(http.post('/links', body));
export const updateLink = (
  id: string,
  body: { name?: string; description?: string; note?: string; trackerIds?: string[] },
) => unwrap<LinkRow>(http.patch(`/links/${id}`, body));
export const setLinkStatus = (id: string, status: boolean) =>
  unwrap<LinkRow>(http.patch(`/links/${id}/status`, { status }));
export const deleteLink = (id: string) => unwrap(http.delete(`/links/${id}`));
export const getLinkAds = (id: string) => unwrap<LinkAdRow[]>(http.get(`/links/${id}/ads`));
export const replaceLinkAds = (id: string, adIds: string[]) =>
  unwrap<LinkAdRow[]>(http.put(`/links/${id}/ads`, { adIds }));
export const updateLinkAd = (
  linkId: string,
  adId: string,
  body: { weight?: number; dailyLimit?: number; note?: string; status?: boolean },
) => unwrap<unknown>(http.patch(`/links/${linkId}/ads/${adId}`, body));

// ── Reports ──
export const getDashboard = (date?: string) =>
  unwrap<{ date: string; links: DashboardLink[] }>(http.get('/dashboard', { params: { date } }));
export const getTraffic = (params: {
  from?: string;
  to?: string;
  linkId?: string;
  adKeyword?: string;
}) => unwrap<{ from: string; to: string; links: TrafficLink[] }>(http.get('/traffic', { params }));

// ── Audit ──
export const listAudit = (params: {
  page: number;
  pageSize: number;
  module?: string;
  from?: string;
  to?: string;
}) => unwrap<Paginated<AuditRow>>(http.get('/audit-logs', { params }));
