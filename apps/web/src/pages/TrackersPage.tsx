import { useEffect, useState } from 'react';
import { App, Button, Card, Col, Form, Input, Popconfirm, Row, Space, Table, Tag } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import PageHead from '../components/PageHead';
import { createTracker, deleteTracker, listTrackers, updateTracker } from '../api/endpoints';
import { ApiError } from '../api/client';
import { useDebounce } from '../hooks';
import type { Tracker } from '../types';

export default function TrackersPage() {
  const qc = useQueryClient();
  const { message } = App.useApp();
  const nav = useNavigate();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [keyword, setKeyword] = useState('');
  const deb = useDebounce(keyword);
  const [editing, setEditing] = useState<Tracker | null>(null);
  const [form] = Form.useForm();

  const { data, isFetching } = useQuery({
    queryKey: ['trackers', page, pageSize, deb],
    queryFn: () => listTrackers({ page, pageSize, keyword: deb || undefined }),
  });

  useEffect(() => {
    if (editing) form.setFieldsValue(editing);
    else form.resetFields();
  }, [editing, form]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ['trackers'] });

  const save = useMutation({
    mutationFn: (v: { name: string; description?: string; code?: string }) =>
      editing ? updateTracker(editing.id, v) : createTracker(v),
    onSuccess: () => {
      message.success(editing ? '统计已更新' : '统计已创建');
      setEditing(null);
      form.resetFields();
      invalidate();
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '保存失败'),
  });

  const remove = useMutation({
    mutationFn: deleteTracker,
    onSuccess: () => {
      message.success('统计已删除');
      invalidate();
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '删除失败'),
  });

  const columns = [
    { title: '序列', width: 60, align: 'center' as const, render: (_: unknown, __: Tracker, i: number) => (page - 1) * pageSize + i + 1 },
    {
      title: '名称',
      dataIndex: 'name',
      render: (v: string, r: Tracker) => (
        <a onClick={() => setEditing(r)} title="点击在右侧编辑">
          {v}
        </a>
      ),
    },
    { title: '描述', dataIndex: 'description' },
    {
      title: '链接',
      dataIndex: 'usageCount',
      width: 80,
      align: 'center' as const,
      render: (v: number) => (
        <Tag
          color={v ? 'green' : 'default'}
          style={{ cursor: v ? 'pointer' : 'default' }}
          onClick={() => v && nav('/links')}
          title={v ? '点击前往链接管理查看' : ''}
        >
          {v}
        </Tag>
      ),
    },
    {
      title: '编辑',
      width: 90,
      align: 'center' as const,
      render: (_: unknown, r: Tracker) => (
        <Popconfirm title={`确认删除统计 ${r.name}？`} disabled={r.usageCount > 0} onConfirm={() => remove.mutate(r.id)}>
          <Button danger size="small" disabled={r.usageCount > 0} title={r.usageCount > 0 ? '仅可删除未被使用的统计' : ''}>
            删除
          </Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <>
      <PageHead
        title="统计管理"
        crumb="第三方统计代码的创建与绑定"
        extra={
          <Input.Search
            placeholder="名称 / 描述"
            allowClear
            value={keyword}
            onChange={(e) => {
              setKeyword(e.target.value);
              setPage(1);
            }}
            style={{ width: 220 }}
          />
        }
      />
      <Row gutter={18}>
        <Col xs={24} lg={14}>
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
        </Col>
        <Col xs={24} lg={10}>
          <Card
            title={editing ? `编辑统计 · ${editing.name}` : '新建统计'}
            extra={editing && <Button size="small" onClick={() => setEditing(null)}>改为新建</Button>}
          >
            <Form form={form} layout="vertical" onFinish={(v) => save.mutate(v)}>
              <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入统计名称' }]}>
                <Input placeholder="如 11-02-03" />
              </Form.Item>
              <Form.Item name="description" label="描述">
                <Input placeholder="如 51la_v6" />
              </Form.Item>
              <Form.Item name="code" label="统计代码" extra="贴入第三方统计代码，提交即可生效">
                <Input.TextArea rows={6} placeholder='<script src="//js.users.51.la/…"></script>' style={{ fontFamily: 'monospace', fontSize: 12 }} />
              </Form.Item>
              <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
                <Button onClick={() => { setEditing(null); form.resetFields(); }}>取消</Button>
                <Button type="primary" htmlType="submit" loading={save.isPending}>
                  提交
                </Button>
              </Space>
            </Form>
          </Card>
        </Col>
      </Row>
    </>
  );
}
