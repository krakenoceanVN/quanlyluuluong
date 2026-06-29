import { useMemo, useState } from 'react';
import { App, Card, DatePicker, Empty, Input, Space, Switch, Table, Tag } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs, { type Dayjs } from 'dayjs';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import PageHead from '../components/PageHead';
import EditableText from '../components/EditableText';
import { getTraffic, updateAd, updateLinkAd } from '../api/endpoints';
import { ApiError } from '../api/client';
import { fmt, useDebounce } from '../hooks';
import type { TrafficLink } from '../types';

export default function QueryPage() {
  const qc = useQueryClient();
  const { message } = App.useApp();
  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs().subtract(6, 'day'), dayjs()]);
  const [linkName, setLinkName] = useState('');
  const [adName, setAdName] = useState('');
  const debLink = useDebounce(linkName);
  const debAd = useDebounce(adName);

  const from = range[0].format('YYYY-MM-DD');
  const to = range[1].format('YYYY-MM-DD');

  const { data, isFetching } = useQuery({
    queryKey: ['traffic', from, to, debAd],
    queryFn: () => getTraffic({ from, to, adKeyword: debAd || undefined }),
  });

  const patch = useMutation({
    mutationFn: (v: { linkId: string; adId: string; status: boolean }) =>
      updateLinkAd(v.linkId, v.adId, { status: v.status }),
    onSuccess: () => {
      message.success('已保存');
      qc.invalidateQueries();
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '保存失败'),
  });

  // 备注 = ad.description → ghi vào quảng cáo, đồng bộ mọi nơi
  const saveDesc = useMutation({
    mutationFn: (v: { adId: string; description: string }) =>
      updateAd(v.adId, { description: v.description }),
    onSuccess: () => {
      message.success('已保存');
      qc.invalidateQueries();
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '保存失败'),
  });

  const links = useMemo(() => {
    const all = data?.links ?? [];
    if (!debLink) return all;
    const kw = debLink.toLowerCase();
    return all.filter((l) => l.name.toLowerCase().includes(kw));
  }, [data, debLink]);

  const makeColumns = (linkId: string) => [
    { title: '序列', dataIndex: 'seq', width: 60, align: 'center' as const },
    { title: '名称', dataIndex: 'name', render: (v: string) => <b>{v}</b> },
    { title: '链接', dataIndex: 'targetUrl', render: (v: string) => <span className="url-text">{v}</span> },
    { title: '权重', dataIndex: 'weight', align: 'right' as const, width: 80 },
    { title: '限流', dataIndex: 'dailyLimit', align: 'right' as const, width: 100, render: fmt },
    { title: '本期总量', dataIndex: 'total', align: 'right' as const, width: 110, render: (v: number) => <b>{fmt(v)}</b> },
    {
      title: '上期总量（后退1天）',
      dataIndex: 'prevTotal',
      align: 'right' as const,
      width: 130,
      render: (v: number) => <span style={{ color: '#8a91a5' }}>{fmt(v)}</span>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 70,
      align: 'center' as const,
      render: (v: boolean, r: TrafficLink['ads'][number]) => (
        <Switch
          size="small"
          checked={v}
          loading={patch.isPending}
          onChange={(checked) => patch.mutate({ linkId, adId: r.adId, status: checked })}
        />
      ),
    },
    {
      title: '备注（= 广告描述 · 跨链接同步）',
      dataIndex: 'note',
      render: (v: string, r: TrafficLink['ads'][number]) => (
        <EditableText
          value={v}
          width={180}
          maxLength={200}
          onSave={(description) => saveDesc.mutate({ adId: r.adId, description })}
        />
      ),
    },
  ];

  return (
    <>
      <PageHead
        title="数据查询"
        crumb="复合搜索：时间区间 × 广告单链接 × 广告"
        extra={
          <Space wrap>
            <DatePicker.RangePicker
              value={range}
              onChange={(v) => v && v[0] && v[1] && setRange([v[0], v[1]])}
              allowClear={false}
            />
            <Input.Search placeholder="广告单名称" allowClear value={linkName} onChange={(e) => setLinkName(e.target.value)} style={{ width: 180 }} />
            <Input.Search placeholder="广告名称" allowClear value={adName} onChange={(e) => setAdName(e.target.value)} style={{ width: 180 }} />
          </Space>
        }
      />
      {links.length === 0 && !isFetching ? (
        <Card>
          <Empty description="未找到匹配结果，调整日期或关键词后重试" />
        </Card>
      ) : (
        links.map((l: TrafficLink) => (
          <Card
            key={l.id}
            style={{ marginBottom: 18 }}
            title={
              <Space wrap>
                <span>{l.name}</span>
                <span className="url-text">{l.url}</span>
              </Space>
            }
            extra={
              <Space wrap size={16}>
                <span>
                  <Tag color="purple">本期 {from} ~ {to}</Tag>
                  <b style={{ fontFamily: 'var(--mono)' }}>{fmt(l.rangeTotal)}</b>
                </span>
                <span style={{ color: '#8a91a5' }}>
                  <Tag>上期 {data?.prevFrom} ~ {data?.prevTo}</Tag>
                  {fmt(l.prevRangeTotal)}
                  {l.prevRangeTotal > 0 && (
                    <span style={{ marginLeft: 6 }}>
                      ({l.rangeTotal >= l.prevRangeTotal ? '+' : ''}
                      {Math.round(((l.rangeTotal - l.prevRangeTotal) / l.prevRangeTotal) * 100)}%)
                    </span>
                  )}
                </span>
              </Space>
            }
          >
            <div style={{ height: 200, marginBottom: 14 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={l.series} margin={{ top: 6, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef0f5" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d: string) => d.slice(5)} />
                  <YAxis tick={{ fontSize: 11 }} width={48} tickFormatter={(v: number) => (v >= 1000 ? `${v / 1000}k` : `${v}`)} />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Line type="monotone" dataKey="count" stroke="#7b6cf0" strokeWidth={2} dot={{ r: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            {l.ads.length ? (
              <Table rowKey="adId" size="small" pagination={false} columns={makeColumns(l.id)} dataSource={l.ads} />
            ) : (
              <Empty description="此广告单暂无广告" />
            )}
          </Card>
        ))
      )}
    </>
  );
}
