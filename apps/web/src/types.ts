export interface AuthUser {
  id: string;
  username: string;
  role: 'ADMIN' | 'OPERATOR';
}

export interface UserRow {
  id: string;
  username: string;
  role: 'ADMIN' | 'OPERATOR';
  createdAt: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Tracker {
  id: string;
  name: string;
  description: string;
  code: string;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Ad {
  id: string;
  name: string;
  targetUrl: string;
  description: string;
  status: boolean;
  usageCount: number;
}

export interface LinkRow {
  id: string;
  name: string;
  description: string;
  note: string;
  shortCode: string;
  url: string;
  status: boolean;
  adCount: number;
}

export interface LinkAdRow {
  linkAdId: string;
  adId: string;
  name: string;
  targetUrl: string;
  weight: number;
  dailyLimit: number;
  note: string;
  status: boolean;
  today: number;
  adStatus?: boolean;
}

export interface LinkDetail {
  id: string;
  name: string;
  description: string;
  note: string;
  shortCode: string;
  url: string;
  status: boolean;
  trackers: { id: string; name: string; description: string }[];
  ads: LinkAdRow[];
}

export interface DashboardLink {
  id: string;
  name: string;
  url: string;
  yesterdayTotal: number;
  todayTotal: number;
  ads: {
    seq: number;
    linkAdId: string;
    adId: string;
    name: string;
    targetUrl: string;
    weight: number;
    dailyLimit: number;
    today: number;
    status: boolean;
    note: string;
  }[];
}

export interface TrafficLink {
  id: string;
  name: string;
  url: string;
  rangeTotal: number;
  prevRangeTotal: number;
  ads: {
    seq: number;
    adId: string;
    name: string;
    targetUrl: string;
    weight: number;
    dailyLimit: number;
    status: boolean;
    note: string;
    total: number;
    prevTotal: number;
  }[];
  series: { date: string; count: number }[];
}

export interface AuditRow {
  id: string;
  time: string;
  operator: string;
  module: string;
  action: string;
  detail: unknown;
}
