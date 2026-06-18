import { useState } from 'react';
import { Card, DatePicker, Select, Space, Table, Tag, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import dayjs, { type Dayjs } from 'dayjs';
import PageHead from '../components/PageHead';
import { listAudit } from '../api/endpoints';
import type { AuditRow } from '../types';

const ACTION_LABEL: Record<string, string> = {
  create: '新建',
  update: '修改',
  delete: '删除',
  online: '上线',
  offline: '下线',
  'replace-ads': '调整广告组成',
  'update-ad': '修改广告配置',
};

const FIELD_LABEL: Record<string, string> = {
  name: '名称',
  description: '描述',
  note: '备注',
  code: '统计代码',
  targetUrl: '投放链接',
  weight: '权重',
  dailyLimit: '量级',
  status: '状态',
};

function fmtVal(key: string, v: unknown): string {
  if (key === 'status') return v ? '在线' : '下线';
  if (v === '' || v === null || v === undefined) return '（空）';
  return String(v);
}

interface Change {
  label: string;
  from: string;
  to: string;
}

function diffFields(before: Record<string, unknown> = {}, after: Record<string, unknown> = {}): Change[] {
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  const out: Change[] = [];
  for (const k of keys) {
    if (JSON.stringify(before?.[k]) !== JSON.stringify(after?.[k])) {
      out.push({ label: FIELD_LABEL[k] ?? k, from: fmtVal(k, before?.[k]), to: fmtVal(k, after?.[k]) });
    }
  }
  return out;
}

function describe(row: AuditRow): { title: string; changes?: Change[] } {
  const d = (row.detail ?? {}) as Record<string, any>;
  const name: string = d.name ?? d.adName ?? '';
  const quoted = name ? `「${name}」` : '';
  switch (row.action) {
    case 'create':
      return { title: `新建${quoted}` };
    case 'delete':
      return { title: `删除${quoted}` };
    case 'online':
      return { title: `上线${quoted}` };
    case 'offline':
      return { title: `下线${quoted}` };
    case 'replace-ads':
      return { title: `调整${quoted}广告组成：新增 ${d.added ?? 0} · 移除 ${d.removed ?? 0}` };
    case 'update':
      return { title: `修改${quoted}`, changes: diffFields(d.before, d.after) };
    case 'update-ad':
      return { title: `修改广告「${d.adName ?? ''}」配置`, changes: diffFields(d.before, d.after) };
    default:
      return { title: `${ACTION_LABEL[row.action] ?? row.action}${quoted}` };
  }
}

export default function LogsPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [module, setModule] = useState<string | undefined>();
  const [range, setRange] = useState<[Dayjs, Dayjs] | null>(null);

  const { data, isFetching } = useQuery({
    queryKey: ['audit', page, pageSize, module, range?.[0]?.format('YYYY-MM-DD'), range?.[1]?.format('YYYY-MM-DD')],
    queryFn: () =>
      listAudit({
        page,
        pageSize,
        module,
        from: range?.[0]?.format('YYYY-MM-DD'),
        to: range?.[1]?.format('YYYY-MM-DD'),
      }),
  });

  const columns = [
    { title: '时间', dataIndex: 'time', width: 180, render: (v: string) => <span className="mono">{dayjs(v).format('YYYY-MM-DD HH:mm:ss')}</span> },
    { title: '操作人', dataIndex: 'operator', width: 100, render: (v: string) => <b>{v}</b> },
    { title: '模块', dataIndex: 'module', width: 120, render: (v: string) => <Tag color="purple">{v}</Tag> },
    {
      title: '操作内容',
      dataIndex: 'action',
      render: (_v: string, r: AuditRow) => {
        const d = describe(r);
        return (
          <Space direction="vertical" size={2}>
            <span>{d.title}</span>
            {d.changes?.map((c, i) => (
              <Typography.Text key={i} type="secondary" style={{ fontSize: 12 }}>
                {c.label}：{c.from} <span style={{ color: '#7b6cf0' }}>→</span> {c.to}
              </Typography.Text>
            ))}
          </Space>
        );
      },
    },
  ];

  return (
    <>
      <PageHead
        title="操作日志"
        crumb="记录所有写操作，便于审计回溯"
        extra={
          <Space wrap>
            <Select
              allowClear
              placeholder="按模块筛选"
              style={{ width: 150 }}
              value={module}
              onChange={(v) => {
                setModule(v);
                setPage(1);
              }}
              options={[
                { value: '链接管理', label: '链接管理' },
                { value: '广告管理', label: '广告管理' },
                { value: '统计管理', label: '统计管理' },
              ]}
            />
            <DatePicker.RangePicker
              value={range}
              onChange={(v) => {
                setRange(v && v[0] && v[1] ? [v[0], v[1]] : null);
                setPage(1);
              }}
            />
          </Space>
        }
      />
      <Card>
        <Table
          rowKey="id"
          loading={isFetching}
          columns={columns}
          dataSource={data?.items ?? []}
          expandable={{
            expandedRowRender: (r) => (
              <pre style={{ margin: 0, fontSize: 12, whiteSpace: 'pre-wrap', color: '#8a91a5' }}>
                {JSON.stringify(r.detail, null, 2)}
              </pre>
            ),
            rowExpandable: (r) => r.detail != null,
          }}
          pagination={{
            current: page,
            pageSize,
            total: data?.total ?? 0,
            showSizeChanger: true,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
          }}
        />
      </Card>
    </>
  );
}
