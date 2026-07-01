import { useState } from 'react';
import { Card, DatePicker, Empty, Switch, Table, Tag, App } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs, { type Dayjs } from 'dayjs';
import PageHead from '../components/PageHead';
import { getDashboard, updateLinkAd } from '../api/endpoints';
import { fmt } from '../hooks';
import { naturalCompare } from '../utils/sort';
import type { DashboardLink } from '../types';

export default function HomePage() {
  const [date, setDate] = useState<Dayjs>(dayjs());
  const dateStr = date.format('YYYY-MM-DD');
  const isToday = dateStr === dayjs().format('YYYY-MM-DD');
  const qc = useQueryClient();
  const { message } = App.useApp();

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', dateStr],
    queryFn: () => getDashboard(dateStr),
    refetchInterval: isToday ? 5000 : false,
  });

  const toggle = useMutation({
    mutationFn: (v: { linkId: string; adId: string; status: boolean }) =>
      updateLinkAd(v.linkId, v.adId, { status: v.status }),
    onSuccess: () => {
      message.success('状态已更新');
      qc.invalidateQueries(); // đồng bộ mọi trang cho cùng một quảng cáo
    },
    onError: () => message.error('更新失败'),
  });

  const columns = (link: DashboardLink) => [
    { title: '序列', dataIndex: 'seq', width: 60, align: 'center' as const },
    { title: '名称', dataIndex: 'name', render: (v: string) => <b>{v}</b> },
    { title: '链接', dataIndex: 'targetUrl', render: (v: string) => <span className="url-text">{v}</span> },
    { title: '权重', dataIndex: 'weight', align: 'right' as const, width: 80 },
    { title: '限流', dataIndex: 'dailyLimit', align: 'right' as const, width: 100, render: fmt },
    { title: '日流', dataIndex: 'today', align: 'right' as const, width: 100, render: (v: number) => <b>{fmt(v)}</b> },
    {
      title: '状态',
      dataIndex: 'status',
      width: 80,
      align: 'center' as const,
      render: (v: boolean, r: DashboardLink['ads'][number]) => (
        <Switch
          size="small"
          checked={v}
          loading={toggle.isPending}
          onChange={(checked) => toggle.mutate({ linkId: link.id, adId: r.adId, status: checked })}
        />
      ),
    },
    { title: '备注', dataIndex: 'note' },
  ];

  return (
    <>
      <PageHead
        title="首页"
        crumb="在线广告单链接 · 实时流量总览"
        extra={<DatePicker value={date} onChange={(d) => d && setDate(d)} allowClear={false} />}
      />
      {(data?.links ?? [])
        .slice()
        .sort((a, b) => naturalCompare(a.name, b.name))
        .map((link) => (
          <Card
            key={link.id}
            style={{ marginBottom: 18 }}
            title={
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                <span>{link.name}</span>
                <span className="url-text">{link.url}</span>
              </div>
            }
            extra={
              <div style={{ display: 'flex', gap: 18, fontSize: 12, color: '#8a91a5' }}>
                <span className="kpi">
                  昨日总量 <b>{link.ads.length ? fmt(link.yesterdayTotal) : '—'}</b>
                </span>
                <span className="kpi">
                  {isToday && <span className="live-dot" />}
                  {isToday ? '今日实时' : '当日总量'}{' '}
                  <b style={{ color: '#2fb3c4' }}>{link.ads.length ? fmt(link.todayTotal) : '—'}</b>
                </span>
              </div>
            }
          >
            {link.ads.length ? (
              <Table
                rowKey="linkAdId"
                size="small"
                pagination={false}
                columns={columns(link)}
                dataSource={link.ads}
              />
            ) : (
              <Empty description="此广告单暂无广告 · 前往「链接管理」添加" />
            )}
          </Card>
        ))}
      {!isLoading && (data?.links?.length ?? 0) === 0 && (
        <Card>
          <Empty description="暂无在线广告单链接">
            <Tag color="purple">在「链接管理」上线链接后将在此展示</Tag>
          </Empty>
        </Card>
      )}
    </>
  );
}
