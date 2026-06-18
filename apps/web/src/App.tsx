import { Navigate, Route, Routes } from 'react-router-dom';
import { Spin } from 'antd';
import { useAuth } from './auth';
import AppLayout from './components/AppLayout';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import QueryPage from './pages/QueryPage';
import LinksPage from './pages/LinksPage';
import LinkEditPage from './pages/LinkEditPage';
import AdsPage from './pages/AdsPage';
import TrackersPage from './pages/TrackersPage';
import LogsPage from './pages/LogsPage';
import type { JSX } from 'react';

function Protected({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div style={{ height: '100vh', display: 'grid', placeItems: 'center' }}>
        <Spin size="large" />
      </div>
    );
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <Protected>
            <AppLayout />
          </Protected>
        }
      >
        <Route path="/" element={<HomePage />} />
        <Route path="/query" element={<QueryPage />} />
        <Route path="/links" element={<LinksPage />} />
        <Route path="/links/:id" element={<LinkEditPage />} />
        <Route path="/ads" element={<AdsPage />} />
        <Route path="/stats" element={<TrackersPage />} />
        <Route path="/logs" element={<LogsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
