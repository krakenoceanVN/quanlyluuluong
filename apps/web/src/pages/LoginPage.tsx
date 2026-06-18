import { useState } from 'react';
import { Button, Card, Form, Input, Typography, App } from 'antd';
import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { ApiError } from '../api/client';

export default function LoginPage() {
  const { login, user } = useAuth();
  const nav = useNavigate();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);

  if (user) nav('/', { replace: true });

  const onFinish = async (v: { username: string; password: string }) => {
    setLoading(true);
    try {
      await login(v.username, v.password);
      message.success('登录成功');
      nav('/', { replace: true });
    } catch (e) {
      message.error(e instanceof ApiError ? e.message : '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ height: '100vh', display: 'grid', placeItems: 'center', background: '#1c2230' }}>
      <Card style={{ width: 360, borderRadius: 12 }} bordered={false}>
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 10,
              background: '#7b6cf0',
              color: '#fff',
              display: 'grid',
              placeItems: 'center',
              fontSize: 26,
              margin: '0 auto 12px',
            }}
          >
            流
          </div>
          <Typography.Title level={4} style={{ margin: 0 }}>
            流量管理系统
          </Typography.Title>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Traffic Console · 请登录
          </Typography.Text>
        </div>
        <Form layout="vertical" onFinish={onFinish} initialValues={{ username: 'admin', password: 'admin123' }}>
          <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input prefix={<UserOutlined />} placeholder="用户名" size="large" />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="密码" size="large" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block size="large" loading={loading}>
            登录
          </Button>
          <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginTop: 12, marginBottom: 0, textAlign: 'center' }}>
            默认账号 admin / admin123
          </Typography.Paragraph>
        </Form>
      </Card>
    </div>
  );
}
