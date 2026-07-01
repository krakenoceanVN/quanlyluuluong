import { useEffect, useState } from 'react';
import { App, Button, Card, Empty, Popconfirm, Space, Switch, Table, Tag, Transfer, Typography } from 'antd';
import { ArrowLeftOutlined, SortAscendingOutlined, SortDescendingOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import PageHead from '../components/PageHead';
import EditableText from '../components/EditableText';
import { getLink, listAds, replaceLinkAds } from '../api/endpoints';
import { ApiError } from '../api/client';
import { fmt } from '../hooks';
import { naturalCompare } from '../utils/sort';

/** Local draft row — weight/dailyLimit may be null (mới thêm, chưa nhập) → hiển thị "—". */
interface DraftRow {
  adId: string;
  name: string;
  targetUrl: string;
  weight: number;
  dailyLimit: number;
  note: string; // = ad.description
  status: boolean;
}

export default function LinkEditPage() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { message } = App.useApp();
  const [transferOpen, setTransferOpen] = useState(false);
  const [targetKeys, setTargetKeys] = useState<string[]>([]);
  const [sortAsc, setSortAsc] = useState(true);
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [dirty, setDirty] = useState(false);
  const [attempted, setAttempted] = useState(false);

  const { data: link, isFetching } = useQuery({
    queryKey: ['link', id],
    queryFn: () => getLink(id),
    enabled: !!id,
  });

  // nạp draft từ server khi chưa có thay đổi cục bộ (tránh ghi đè lúc đang sửa)
  useEffect(() => {
    if (link && !dirty) {
      setRows(
        link.ads.map((a) => ({
          adId: a.adId,
          name: a.name,
          targetUrl: a.targetUrl,
          weight: a.weight,
          dailyLimit: a.dailyLimit,
          note: a.note,
          status: a.status,
        })),
      );
    }
  }, [link, dirty]);

  const allAds = useQuery({
    queryKey: ['ads-all'],
    queryFn: () => listAds({ page: 1, pageSize: 1000 }),
    enabled: transferOpen,
  });

  const save = useMutation({
    mutationFn: (items: DraftRow[]) =>
      replaceLinkAds(
        id,
        items.map((r) => ({
          adId: r.adId,
          weight: r.weight,
          dailyLimit: r.dailyLimit,
          status: r.status,
          note: r.note,
        })),
      ),
    onSuccess: () => {
      message.success('广告单已保存');
      setDirty(false);
      setAttempted(false);
      qc.invalidateQueries();
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '保存失败'),
  });

  const updateRow = (adId: string, patch: Partial<DraftRow>) => {
    setRows((rs) => rs.map((r) => (r.adId === adId ? { ...r, ...patch } : r)));
    setDirty(true);
  };
  const removeRow = (adId: string) => {
    setRows((rs) => rs.filter((r) => r.adId !== adId));
    setDirty(true);
  };

  const openTransfer = () => {
    setTargetKeys(rows.map((r) => r.adId));
    setTransferOpen(true);
  };
  const applyTransfer = () => {
    const adMap = new Map((allAds.data?.items ?? []).map((a) => [a.id, a]));
    const next: DraftRow[] = targetKeys.map((adId) => {
      const existing = rows.find((r) => r.adId === adId);
      if (existing) return existing; // giữ nguyên dòng cũ
      const ad = adMap.get(adId);
      // dòng mới: weight/量级 để TRỐNG (null), không auto-fill
      return {
        adId,
        name: ad?.name ?? adId,
        targetUrl: ad?.targetUrl ?? '',
        weight: 0,
        dailyLimit: 0,
        note: ad?.description ?? '',
        status: true,
      };
    });
    setRows(next);
    setDirty(true);
    setTransferOpen(false);
  };

  const numParse = (raw: string): string | null => {
    if (!raw.trim()) return '0';
    const n = parseInt(raw.replace(/[^\d]/g, ''), 10);
    if (isNaN(n) || n < 0) {
      message.error('请输入不小于 0 的整数');
      return null;
    }
    return String(n);
  };

  const isWeightBad = (r: DraftRow) => !(typeof r.weight === 'number' && r.weight >= 0);
  const isLimitBad = (r: DraftRow) => !(typeof r.dailyLimit === 'number' && r.dailyLimit >= 0);

  const onSubmit = () => {
    setAttempted(true);
    const bad = rows.filter((r) => isWeightBad(r) || isLimitBad(r));
    if (bad.length) {
      message.error('请为所有广告填写「权重」与「量级」（不小于 0 的整数）后再提交');
      return;
    }
    save.mutate(rows);
  };

  const columns = [
    { title: '序列', width: 60, align: 'center' as const, render: (_: unknown, __: DraftRow, i: number) => i + 1 },
    { title: '名称（不可修改）', dataIndex: 'name', render: (v: string) => <b>{v}</b> },
    { title: '链接（不可修改）', dataIndex: 'targetUrl', render: (v: string) => <span className="url-text">{v}</span> },
    {
      title: '权重',
      dataIndex: 'weight',
      width: 110,
      align: 'right' as const,
      render: (v: number, r: DraftRow) => (
        <EditableText
          value={v}
          width={80}
          align="right"
          placeholder="0"
          parse={numParse}
          invalid={attempted && isWeightBad(r)}
          onSave={(w) => updateRow(r.adId, { weight: Number(w) })}
        />
      ),
    },
    {
      title: '量级',
      dataIndex: 'dailyLimit',
      width: 130,
      align: 'right' as const,
      render: (v: number, r: DraftRow) => (
        <EditableText
          value={v}
          width={100}
          align="right"
          placeholder="0"
          parse={numParse}
          display={(x) => fmt(Number(x))}
          invalid={attempted && isLimitBad(r)}
          onSave={(l) => updateRow(r.adId, { dailyLimit: Number(l) })}
        />
      ),
    },
    {
      title: '备注（= 广告描述 · 跨链接同步）',
      dataIndex: 'note',
      render: (v: string, r: DraftRow) => (
        <EditableText value={v} width={180} maxLength={200} onSave={(note) => updateRow(r.adId, { note })} />
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 80,
      align: 'center' as const,
      render: (v: boolean, r: DraftRow) => (
        <Switch size="small" checked={v} onChange={(c) => updateRow(r.adId, { status: c })} />
      ),
    },
    {
      title: '编辑',
      width: 80,
      align: 'center' as const,
      render: (_: unknown, r: DraftRow) => (
        <Popconfirm title={`将广告 ${r.name} 移出此广告单？`} onConfirm={() => removeRow(r.adId)}>
          <Button danger size="small">
            移除
          </Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <>
      <PageHead
        title="链接编辑"
        crumb={
          <span>
            <a onClick={() => nav('/links')}>链接管理</a> / {link?.name}
          </span>
        }
        extra={
          <Button icon={<ArrowLeftOutlined />} onClick={() => nav('/links')}>
            返回列表
          </Button>
        }
      />
      <Card
        loading={isFetching}
        title={
          <div style={{ whiteSpace: 'normal' }}>
            <Space wrap size={8}>
              <span>{link?.name}</span>
              <span style={{ color: '#8a91a5', fontWeight: 400 }}>{link?.description}</span>
              <Tag color="purple">{link?.note || '无备注'}</Tag>
              {link?.trackers.map((t) => (
                <Tag key={t.id}>{t.name}</Tag>
              ))}
              {dirty && <Tag color="orange">未保存更改</Tag>}
            </Space>
            {link?.url && (
              <div style={{ marginTop: 6, fontWeight: 400 }}>
                <Typography.Text className="url-text" copyable={{ text: link.url }} style={{ wordBreak: 'break-all' }}>
                  <a href={link.url} target="_blank" rel="noreferrer">
                    {link.url}
                  </a>
                </Typography.Text>
              </div>
            )}
          </div>
        }
        extra={
          <Space>
            <Button onClick={openTransfer}>编辑广告单内广告</Button>
            <Button type="primary" loading={save.isPending} disabled={!dirty} onClick={onSubmit}>
              提交
            </Button>
          </Space>
        }
      >
        {rows.length ? (
          <>
            <Table rowKey="adId" size="small" pagination={false} columns={columns} dataSource={rows} />
            <div style={{ color: '#b7bccb', fontSize: 12, marginTop: 10 }}>
              提示：点击「权重」「量级」「备注」可直接编辑；广告组成、权重与量级修改后需点击右上角「提交」保存。
              新增广告的权重/量级默认为 0；留空保存也会按 0 处理，0 表示不限制。
            </div>
          </>
        ) : (
          <Empty description="此广告单暂无广告 · 点击右上角「编辑广告单内广告」添加" />
        )}
      </Card>

      {transferOpen && (
        <Card
          style={{ marginTop: 18 }}
          title="广告单内广告编辑"
          extra={
            <Space>
              <Button
                icon={sortAsc ? <SortAscendingOutlined /> : <SortDescendingOutlined />}
                onClick={() => setSortAsc((v) => !v)}
              >
                名称 {sortAsc ? 'A→Z' : 'Z→A'}
              </Button>
              <Button onClick={() => setTransferOpen(false)}>取消</Button>
              <Button type="primary" onClick={applyTransfer}>
                确定
              </Button>
            </Space>
          }
        >
          <Transfer
            dataSource={(allAds.data?.items ?? [])
              .slice()
              .sort((a, b) => (sortAsc ? 1 : -1) * naturalCompare(a.name, b.name))
              .map((a) => ({ key: a.id, title: a.name, description: a.description }))}
            titles={['可选广告', '广告单内']}
            targetKeys={targetKeys}
            onChange={(keys) => setTargetKeys(keys as string[])}
            render={(item) => `${item.title} · ${item.description}`}
            listStyle={{ width: '46%', height: 320 }}
            showSearch
            filterOption={(input, item) => (item.title ?? '').toLowerCase().includes(input.toLowerCase())}
          />
          <div style={{ color: '#b7bccb', fontSize: 12, marginTop: 10 }}>
            选择后点「确定」加入列表；新增广告的权重/量级默认为 0。
          </div>
        </Card>
      )}
    </>
  );
}
