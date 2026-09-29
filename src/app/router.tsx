import { createBrowserRouter, Navigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import Login from '@/pages/Login/Login';
import Roadmap from '@/pages/Roadmap/Roadmap';
import SkillDetails from '@/pages/SkillDetails/SkillDetails';
import Documents from '@/pages/Documents/Documents';
import Notes from '@/pages/Notes/Notes';
import Projects from '@/pages/Projects/Projects';
import Settings from '@/pages/Settings/Settings';
import UserDashboard from '@/pages/User/UserDashboard';
import AdminConsole from '@/pages/Admin/AdminConsole';
import UserMonitoring from '@/pages/Admin/UserMonitoring';
import { useAuth } from '@/hooks/useAuth';
import type { ReactNode } from 'react';

export function Guard({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen grid place-items-center text-muted">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, loading, roleLoading, isAdmin } = useAuth();
  if (loading || roleLoading) return <div className="min-h-screen grid place-items-center text-muted">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <AccessDenied />;
  return <>{children}</>;
}

export function AccessDenied() {
  return (
    <div className="card p-6 text-center mt-6">
      <h2 className="font-medium">Access denied</h2>
      <p className="text-sm text-muted mt-1 mb-4">This section is for admins only.</p>
      <a href="/dashboard" className="btn btn-primary">Back to my dashboard</a>
    </div>
  );
}

export const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  {
    path: '/', element: <Guard><AppLayout /></Guard>,
    children: [
      { index: true, element: <Roadmap /> },
      { path: 'dashboard', element: <UserDashboard /> },
      { path: 'skill/:id', element: <SkillDetails /> },
      { path: 'documents', element: <Documents /> },
      { path: 'notes', element: <Notes /> },
      { path: 'projects', element: <Projects /> },
      { path: 'settings', element: <Settings /> },
      { path: 'admin', element: <RequireAdmin><AdminConsole /></RequireAdmin> },
      { path: 'admin/users', element: <RequireAdmin><UserMonitoring /></RequireAdmin> },
      // Legacy routes removed from nav — redirect to home instead of 404
      { path: 'today', element: <Navigate to="/dashboard" replace /> },
      { path: 'analytics', element: <Navigate to="/dashboard" replace /> },
    ],
  },
]);
