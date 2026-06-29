import { Layout, Menu, Avatar, Dropdown, Typography } from 'antd';
import {
  HomeOutlined,
  SearchOutlined,
  LinkOutlined,
  PlayCircleOutlined,
  BarChartOutlined,
  FileTextOutlined,
  TeamOutlined,
  LogoutOutlined,
} from '@ant-design/icons';
import { useLocation, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '../auth';

const { Sider, Content } = Layout;

const MENU = [
  { key: '/', icon: <HomeOutlined />, label: '首页' },
  { key: '/query', icon: <SearchOutlined />, label: '数据查询' },
  { key: '/links', icon: <LinkOutlined />, label: '链接管理' },
  { key: '/ads', icon: <PlayCircleOutlined />, label: '广告管理' },
  { key: '/stats', icon: <BarChartOutlined />, label: '统计管理' },
  { key: '/users', icon: <TeamOutlined />, label: '用户管理', adminOnly: true },
  { key: '/logs', icon: <FileTextOutlined />, label: '操作日志' },
];

export default function AppLayout() {
  const nav = useNavigate();
  const loc = useLocation();
  const { user, logout } = useAuth();

  // highlight parent for /links/:id
  const selected = loc.pathname.startsWith('/links') ? '/links' : loc.pathname;

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider width={218} theme="dark" breakpoint="lg" collapsedWidth={64} style={{ background: '#1c2230' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '20px 18px',
            borderBottom: '1px solid #313b55',
          }}
        >
          <Avatar shape="square" style={{ background: '#7b6cf0', flex: 'none' }}>
            流
          </Avatar>
          <div style={{ lineHeight: 1.3 }}>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>流量管理系统</div>
            <div style={{ color: '#b7bccb', fontSize: 11 }}>Traffic Console · v1.0</div>
          </div>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selected]}
          style={{ background: 'transparent', borderInlineEnd: 'none', marginTop: 8 }}
          items={MENU.filter((m) => !m.adminOnly || user?.role === 'ADMIN').map(({ key, icon, label }) => ({ key, icon, label }))}
          onClick={({ key }) => nav(key)}
        />
        <div style={{ position: 'absolute', bottom: 0, width: '100%', padding: 16, borderTop: '1px solid #313b55' }}>
          <Dropdown
            menu={{
              items: [{ key: 'logout', icon: <LogoutOutlined />, label: '退出登录', onClick: () => { logout(); nav('/login'); } }],
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <Avatar size={30} style={{ background: '#7b6cf0' }}>
                {user?.username?.[0]?.toUpperCase() ?? 'U'}
              </Avatar>
              <Typography.Text style={{ color: '#cfd4e2', fontSize: 13 }}>
                {user?.username} · {user?.role === 'ADMIN' ? '管理员' : '操作员'}
              </Typography.Text>
            </div>
          </Dropdown>
        </div>
      </Sider>
      <Layout>
        <Content style={{ padding: '24px 28px 48px', overflow: 'auto' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
