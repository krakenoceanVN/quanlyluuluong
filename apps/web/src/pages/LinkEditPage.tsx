import { useState } from 'react';
import { App, Button, Card, Empty, Popconfirm, Space, Switch, Table, Tag, Transfer } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import PageHead from '../components/PageHead';
import EditableText from '../components/EditableText';
import { getLink, listAds, replaceLinkAds, updateLinkAd } from '../api/endpoints';
import { ApiError } from '../api/client';
import { fmt } from '../hooks';
import type { LinkAdRow } from '../types';

export default function LinkEditPage() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { message } = App.useApp();
  const [transferOpen, setTransferOpen] = useState(false);
  const [targetKeys, setTargetKeys] = useState<string[]>([]);

  const { data: link, isFetching } = useQuery({
    queryKey: ['link', id],
    queryFn: () => getLink(id),
    enabled: !!id,
  });

  const allAds = useQuery({
    queryKey: ['ads-all'],
    queryFn: () => listAds({ page: 1, pageSize: 500 }),
    enabled: transferOpen,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['link', id] });
    qc.invalidateQueries({ queryKey: ['links'] });
  };

  const patch = useMutation({
    mutationFn: (v: { adId: string; body: Partial<LinkAdRow> }) =>
      updateLinkAd(id, v.adId, v.body),
    onSuccess: () => {
      message.success('已保存');
      invalidate();
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '保存失败'),
  });

  const replace = useMutation({
    mutationFn: (adIds: string[]) => replaceLinkAds(id, adIds),
    onSuccess: () => {
      message.success('广告单已更新');
      setTransferOpen(false);
      invalidate();
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '更新失败'),
  });

  const openTransfer = () => {
    setTargetKeys((link?.ads ?? []).map((a) => a.adId));
    setTransferOpen(true);
  };

  const numParse = (raw: string): string | null => {
    const n = parseInt(raw.replace(/[^\d]/g, ''), 10);
    if (isNaN(n)) {
      message.error('请输入数字');
      return null;
    }
    return String(n);
  };

  const columns = [
    { title: '序列', width: 60, align: 'center' as const, render: (_: unknown, __: LinkAdRow, i: number) => i + 1 },
    { title: '名称（不可修改）', dataIndex: 'name', render: (v: string) => <b>{v}</b> },
    { title: '链接（不可修改）', dataIndex: 'targetUrl', render: (v: string) => <span className="url-text">{v}</span> },
    {
      title: '权重',
      dataIndex: 'weight',
      width: 90,
      align: 'right' as const,
      render: (v: number, r: LinkAdRow) => (
        <EditableText value={v} width={70} align="right" parse={numParse} onSave={(w) => patch.mutate({ adId: r.adId, body: { weight: Number(w) } })} />
      ),
    },
    {
      title: '量级',
      dataIndex: 'dailyLimit',
      width: 120,
      align: 'right' as const,
      render: (v: number, r: LinkAdRow) => (
        <EditableText value={v} width={90} align="right" parse={numParse} display={(x) => fmt(Number(x))} onSave={(l) => patch.mutate({ adId: r.adId, body: { dailyLimit: Number(l) } })} />
      ),
    },
    {
      title: '备注',
      dataIndex: 'note',
      render: (v: string, r: LinkAdRow) => (
        <EditableText value={v} width={160} onSave={(note) => patch.mutate({ adId: r.adId, body: { note } })} />
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 80,
      align: 'center' as const,
      render: (v: boolean, r: LinkAdRow) => (
        <Switch size="small" checked={v} onChange={(c) => patch.mutate({ adId: r.adId, body: { status: c } })} />
      ),
    },
    {
      title: '编辑',
      width: 90,
      align: 'center' as const,
      render: (_: unknown, r: LinkAdRow) => (
        <Popconfirm
          title={`将广告 ${r.name} 移出此广告单？`}
          onConfirm={() => replace.mutate((link?.ads ?? []).filter((a) => a.adId !== r.adId).map((a) => a.adId))}
        >
          <Button danger size="small">
            删除
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
          <Space wrap>
            <span>{link?.name}</span>
            <span style={{ color: '#8a91a5', fontWeight: 400 }}>{link?.description}</span>
            <Tag color="purple">{link?.note || '无备注'}</Tag>
            {link?.trackers.map((t) => (
              <Tag key={t.id}>{t.name}</Tag>
            ))}
          </Space>
        }
        extra={
          <Button type="primary" onClick={openTransfer}>
            编辑广告单内广告
          </Button>
        }
      >
        {link && link.ads.length ? (
          <>
            <Table rowKey="adId" size="small" pagination={false} columns={columns} dataSource={link.ads} />
            <div style={{ color: '#b7bccb', fontSize: 12, marginTop: 10 }}>
              提示：权重、量级与备注支持点击后直接编辑，回车即可确认生效。
            </div>
          </>
        ) : (
          <Empty description="此广告单暂无广告 · 点击右上角「编辑广告单内广告」添加" />
        )}
      </Card>

      {transferOpen && (
        <Card style={{ marginTop: 18 }} title="广告单内广告编辑" extra={
          <Space>
            <Button onClick={() => setTransferOpen(false)}>取消</Button>
            <Button type="primary" loading={replace.isPending} onClick={() => replace.mutate(targetKeys)}>
              提交
            </Button>
          </Space>
        }>
          <Transfer
            dataSource={(allAds.data?.items ?? []).map((a) => ({ key: a.id, title: a.name, description: a.description }))}
            titles={['可选广告', '广告单内']}
            targetKeys={targetKeys}
            onChange={(keys) => setTargetKeys(keys as string[])}
            render={(item) => `${item.title} · ${item.description}`}
            listStyle={{ width: '46%', height: 320 }}
            showSearch
            filterOption={(input, item) => (item.title ?? '').toLowerCase().includes(input.toLowerCase())}
          />
        </Card>
      )}
    </>
  );
}
