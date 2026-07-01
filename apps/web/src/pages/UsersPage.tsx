import { useState } from 'react';
import { App, Button, Card, Form, Input, Modal, Popconfirm, Select, Space, Table, Tag } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import PageHead from '../components/PageHead';
import { createUser, deleteUser, listUsers, updateUser } from '../api/endpoints';
import { ApiError } from '../api/client';
import { useAuth } from '../auth';
import { useDebounce } from '../hooks';
import type { UserRow } from '../types';

export default function UsersPage() {
  const qc = useQueryClient();
  const { message } = App.useApp();
  const { user: me } = useAuth();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [keyword, setKeyword] = useState('');
  const deb = useDebounce(keyword);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [form] = Form.useForm();

  const { data, isFetching } = useQuery({
    queryKey: ['users', page, pageSize, deb],
    queryFn: () => listUsers({ page, pageSize, keyword: deb || undefined }),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['users'] });

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ role: 'OPERATOR' });
    setShowForm(true);
  };
  const openEdit = (u: UserRow) => {
    setEditing(u);
    form.resetFields();
    form.setFieldsValue({ role: u.role });
    setShowForm(true);
  };

  const save = useMutation({
    mutationFn: (v: { username?: string; password?: string; role: 'ADMIN' | 'OPERATOR' }) =>
      editing
        ? updateUser(editing.id, { role: v.role, password: v.password || undefined })
        : createUser({ username: v.username!, password: v.password!, role: v.role }),
    onSuccess: () => {
      message.success(editing ? '用户已更新' : '用户已创建');
      setShowForm(false);
      setEditing(null);
      form.resetFields();
      invalidate();
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '保存失败'),
  });

  const remove = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => {
      message.success('用户已删除');
      invalidate();
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '删除失败'),
  });

  const columns = [
    { title: '序列', width: 60, align: 'center' as const, render: (_: unknown, __: UserRow, i: number) => (page - 1) * pageSize + i + 1 },
    {
      title: '用户名',
      dataIndex: 'username',
      render: (v: string, r: UserRow) => (
        <Space>
          <b>{v}</b>
          {r.id === me?.id && <Tag color="blue">当前登录</Tag>}
        </Space>
      ),
    },
    {
      title: '角色',
      dataIndex: 'role',
      width: 140,
      render: (v: string) => <Tag color={v === 'ADMIN' ? 'purple' : 'default'}>{v === 'ADMIN' ? '管理员' : '操作员'}</Tag>,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 180,
      render: (v: string) => <span className="mono">{dayjs(v).format('YYYY-MM-DD HH:mm')}</span>,
    },
    {
      title: '编辑',
      width: 160,
      align: 'center' as const,
      render: (_: unknown, r: UserRow) => (
        <Space size={6}>
          <Button size="small" onClick={() => openEdit(r)}>
            修改
          </Button>
          <Popconfirm
            title={`确认删除用户 ${r.username}？`}
            disabled={r.id === me?.id}
            onConfirm={() => remove.mutate(r.id)}
          >
            <Button danger size="small" disabled={r.id === me?.id} title={r.id === me?.id ? '不能删除当前登录的用户' : ''}>
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
        title="用户管理"
        crumb="账号的创建、编辑（角色 / 重置密码）与删除 · 操作记录见「操作日志」"
        extra={
          <Space>
            <Input.Search
              placeholder="用户名"
              allowClear
              value={keyword}
              onChange={(e) => {
                setKeyword(e.target.value);
                setPage(1);
              }}
              style={{ width: 200 }}
            />
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              新建用户
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
        title={editing ? `编辑用户 · ${editing.username}` : '新建用户'}
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
          {!editing && (
            <Form.Item
              name="username"
              label="用户名"
              rules={[
                { required: true, message: '请输入用户名' },
                { pattern: /^[a-zA-Z0-9_.-]{3,50}$/, message: '3-50 字符，仅字母数字 _ . -' },
              ]}
            >
              <Input placeholder="如 operator01" />
            </Form.Item>
          )}
          <Form.Item
            name="password"
            label={editing ? '重置密码（留空则不修改）' : '密码'}
            rules={
              editing
                ? [{ min: 6, message: '至少 6 个字符' }]
                : [{ required: true, message: '请输入密码' }, { min: 6, message: '至少 6 个字符' }]
            }
          >
            <Input.Password placeholder={editing ? '留空保持不变' : '至少 6 个字符'} />
          </Form.Item>
          <Form.Item name="role" label="角色" rules={[{ required: true, message: '请选择角色' }]}>
            <Select
              options={[
                { value: 'OPERATOR', label: '操作员（OPERATOR）' },
                { value: 'ADMIN', label: '管理员（ADMIN）' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
