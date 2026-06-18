import { useState } from 'react';
import { App, Button, Card, Form, Input, Modal, Popconfirm, Select, Space, Switch, Table, Tag } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import PageHead from '../components/PageHead';
import EditableText from '../components/EditableText';
import {
  createLink,
  deleteLink,
  listLinks,
  listTrackers,
  setLinkStatus,
  updateLink,
} from '../api/endpoints';
import { ApiError } from '../api/client';
import { useDebounce } from '../hooks';
import type { LinkRow } from '../types';

export default function LinksPage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { message } = App.useApp();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [keyword, setKeyword] = useState('');
  const deb = useDebounce(keyword);
  const [showForm, setShowForm] = useState(false);
  const [form] = Form.useForm();

  const { data, isFetching } = useQuery({
    queryKey: ['links', page, pageSize, deb],
    queryFn: () => listLinks({ page, pageSize, keyword: deb || undefined }),
  });

  const trackerOpts = useQuery({
    queryKey: ['trackers-all'],
    queryFn: () => listTrackers({ page: 1, pageSize: 200 }),
    enabled: showForm,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['links'] });

  const create = useMutation({
    mutationFn: createLink,
    onSuccess: () => {
      message.success('链接已创建');
      setShowForm(false);
      form.resetFields();
      invalidate();
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '创建失败'),
  });

  const toggle = useMutation({
    mutationFn: (v: { id: string; status: boolean }) => setLinkStatus(v.id, v.status),
    onSuccess: () => invalidate(),
    onError: (e) => message.error(e instanceof ApiError ? e.message : '操作失败'),
  });

  const saveNote = useMutation({
    mutationFn: (v: { id: string; note: string }) => updateLink(v.id, { note: v.note }),
    onSuccess: () => {
      message.success('备注已保存');
      invalidate();
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '保存失败'),
  });

  const remove = useMutation({
    mutationFn: deleteLink,
    onSuccess: () => {
      message.success('链接已删除');
      invalidate();
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '删除失败'),
  });

  const columns = [
    { title: '序列', width: 60, align: 'center' as const, render: (_: unknown, __: LinkRow, i: number) => (page - 1) * pageSize + i + 1 },
    {
      title: '名称',
      dataIndex: 'name',
      render: (v: string, r: LinkRow) => (
        <a onClick={() => nav(`/links/${r.id}`)} style={{ fontWeight: 600 }}>
          {v}
        </a>
      ),
    },
    { title: '描述', dataIndex: 'description' },
    {
      title: '广告数',
      dataIndex: 'adCount',
      width: 90,
      align: 'center' as const,
      render: (v: number, r: LinkRow) => (
        <Tag
          color={v ? 'green' : 'default'}
          style={{ cursor: 'pointer' }}
          onClick={() => nav(`/links/${r.id}`)}
        >
          {v}
        </Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 80,
      align: 'center' as const,
      render: (v: boolean, r: LinkRow) => (
        <Switch size="small" checked={v} onChange={(c) => toggle.mutate({ id: r.id, status: c })} />
      ),
    },
    {
      title: '备注（点击编辑·回车生效）',
      dataIndex: 'note',
      render: (v: string, r: LinkRow) => (
        <EditableText value={v} onSave={(note) => saveNote.mutate({ id: r.id, note })} width={160} />
      ),
    },
    {
      title: '编辑',
      width: 90,
      align: 'center' as const,
      render: (_: unknown, r: LinkRow) => (
        <Popconfirm
          title={`确认删除链接 ${r.name}？`}
          disabled={r.adCount > 0}
          onConfirm={() => remove.mutate(r.id)}
        >
          <Button danger size="small" disabled={r.adCount > 0} title={r.adCount > 0 ? '仅可删除不包含广告的链接' : ''}>
            删除
          </Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <>
      <PageHead
        title="链接管理"
        crumb="广告单链接的创建、上下线与编辑"
        extra={
          <Space>
            <Input.Search
              placeholder="链接名称 / 描述 / 备注"
              allowClear
              value={keyword}
              onChange={(e) => {
                setKeyword(e.target.value);
                setPage(1);
              }}
              style={{ width: 240 }}
            />
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setShowForm(true)}>
              新建链接
            </Button>
          </Space>
        }
      />
      <Card>
        <Table
          rowKey="id"
          size="middle"
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
        title="新建链接"
        open={showForm}
        onCancel={() => setShowForm(false)}
        onOk={() => form.submit()}
        okText="提交"
        cancelText="取消"
        confirmLoading={create.isPending}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={(v) => create.mutate(v)} style={{ marginTop: 12 }}>
          <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入链接名称' }]}>
            <Input placeholder="如 11-02-03" />
          </Form.Item>
          <Form.Item
            name="shortCode"
            label="链接地址（URL 后缀 · 可选，留空自动生成）"
            normalize={(v?: string) => v?.trim().toLowerCase()}
            rules={[
              {
                pattern: /^[a-z0-9-]{3,40}$/,
                message: '仅可包含小写字母、数字、连字符，长度 3-40',
              },
            ]}
            extra="完整地址为 域名 + /main/link/ + 此后缀，将同步显示在首页与数据查询"
          >
            <Input addonBefore=".../main/link/" placeholder="如 weather-vn" />
          </Form.Item>
          <Form.Item name="trackerIds" label="选择统计（非必选 · 可多选）">
            <Select
              mode="multiple"
              allowClear
              placeholder="从统计管理中选择…"
              loading={trackerOpts.isFetching}
              options={(trackerOpts.data?.items ?? []).map((t) => ({
                value: t.id,
                label: `${t.name} · ${t.description}`,
              }))}
            />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input placeholder="如 android-天气" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
