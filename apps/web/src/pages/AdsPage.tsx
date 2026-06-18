import { useState } from 'react';
import { App, Button, Card, Form, Input, List, Modal, Popconfirm, Space, Switch, Table, Tag } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import PageHead from '../components/PageHead';
import { adLinks, createAd, deleteAd, listAds, setAdStatus, updateAd } from '../api/endpoints';
import { ApiError } from '../api/client';
import { useDebounce } from '../hooks';
import type { Ad } from '../types';

export default function AdsPage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { message } = App.useApp();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [keyword, setKeyword] = useState('');
  const deb = useDebounce(keyword);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Ad | null>(null);
  const [drillAd, setDrillAd] = useState<Ad | null>(null);
  const [form] = Form.useForm();

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    setShowForm(true);
  };
  const openEdit = (ad: Ad) => {
    setEditing(ad);
    form.setFieldsValue({ name: ad.name, targetUrl: ad.targetUrl, description: ad.description });
    setShowForm(true);
  };

  const { data, isFetching } = useQuery({
    queryKey: ['ads', page, pageSize, deb],
    queryFn: () => listAds({ page, pageSize, keyword: deb || undefined }),
  });

  const drill = useQuery({
    queryKey: ['ad-links', drillAd?.id],
    queryFn: () => adLinks(drillAd!.id),
    enabled: !!drillAd,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['ads'] });

  const save = useMutation({
    mutationFn: (v: { name: string; targetUrl: string; description?: string }) =>
      editing ? updateAd(editing.id, v) : createAd(v),
    onSuccess: () => {
      message.success(editing ? '广告已更新' : '广告已创建');
      setShowForm(false);
      setEditing(null);
      form.resetFields();
      invalidate();
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '保存失败'),
  });

  const toggle = useMutation({
    mutationFn: (v: { id: string; status: boolean }) => setAdStatus(v.id, v.status),
    onSuccess: () => invalidate(),
    onError: (e) => message.error(e instanceof ApiError ? e.message : '操作失败'),
  });

  const remove = useMutation({
    mutationFn: deleteAd,
    onSuccess: () => {
      message.success('广告已删除');
      invalidate();
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '删除失败'),
  });

  const columns = [
    { title: '序列', width: 60, align: 'center' as const, render: (_: unknown, __: Ad, i: number) => (page - 1) * pageSize + i + 1 },
    { title: '名称', dataIndex: 'name', render: (v: string) => <b>{v}</b> },
    { title: '链接', dataIndex: 'targetUrl', render: (v: string) => <span className="url-text">{v}</span> },
    { title: '描述', dataIndex: 'description' },
    {
      title: '广告单数',
      dataIndex: 'usageCount',
      width: 100,
      align: 'center' as const,
      render: (v: number, r: Ad) => (
        <Tag color={v ? 'green' : 'default'} style={{ cursor: 'pointer' }} onClick={() => setDrillAd(r)}>
          {v}
        </Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 80,
      align: 'center' as const,
      render: (v: boolean, r: Ad) => (
        <Switch size="small" checked={v} onChange={(c) => toggle.mutate({ id: r.id, status: c })} />
      ),
    },
    {
      title: '编辑',
      width: 150,
      align: 'center' as const,
      render: (_: unknown, r: Ad) => (
        <Space size={6}>
          <Button size="small" onClick={() => openEdit(r)}>
            修改
          </Button>
          <Popconfirm title={`确认删除广告 ${r.name}？`} disabled={r.usageCount > 0} onConfirm={() => remove.mutate(r.id)}>
            <Button danger size="small" disabled={r.usageCount > 0} title={r.usageCount > 0 ? '该广告仍在广告单内，先移出后才可删除' : ''}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <PageHead
        title="广告管理"
        crumb="广告的创建、上下线与投放查询"
        extra={
          <Space>
            <Input.Search
              placeholder="名称 / 链接 / 描述"
              allowClear
              value={keyword}
              onChange={(e) => {
                setKeyword(e.target.value);
                setPage(1);
              }}
              style={{ width: 240 }}
            />
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              新建广告
            </Button>
          </Space>
        }
      />
      <Card>
        <Table
          rowKey="id"
          loading={isFetching}
          columns={columns}
          dataSource={data?.items ?? []}
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

      <Modal
        title={editing ? `编辑广告 · ${editing.name}` : '新建广告'}
        open={showForm}
        onCancel={() => {
          setShowForm(false);
          setEditing(null);
        }}
        onOk={() => form.submit()}
        okText="提交"
        cancelText="取消"
        confirmLoading={save.isPending}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={(v) => save.mutate(v)} style={{ marginTop: 12 }}>
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入广告名称' }]}>
            <Input placeholder="如 sm-252" />
          </Form.Item>
          <Form.Item
            name="targetUrl"
            label="投放链接"
            rules={[
              { required: true, message: '请输入投放链接' },
              { type: 'url', message: '请输入合法 URL（含 http/https）' },
            ]}
          >
            <Input placeholder="https://…" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input placeholder="如 sly-0601上线" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`包含广告「${drillAd?.name}」的广告单`}
        open={!!drillAd}
        footer={null}
        onCancel={() => setDrillAd(null)}
      >
        <List
          loading={drill.isFetching}
          dataSource={drill.data ?? []}
          locale={{ emptyText: '暂无广告单使用此广告' }}
          renderItem={(l) => (
            <List.Item
              actions={[
                <a key="go" onClick={() => nav(`/links/${l.id}`)}>
                  进入编辑
                </a>,
              ]}
            >
              <Space>
                <b>{l.name}</b>
                <span style={{ color: '#8a91a5' }}>{l.description}</span>
                <Tag color={l.status ? 'green' : 'default'}>{l.status ? '在线' : '下线'}</Tag>
              </Space>
            </List.Item>
          )}
        />
      </Modal>
    </>
  );
}
