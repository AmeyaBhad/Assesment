import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/common/ProtectedRoute';
import Layout from './components/layout/Layout';

import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import LeadsPage from './pages/LeadsPage';
import LeadFormPage from './pages/LeadFormPage';
import LeadDetailPage from './pages/LeadDetailPage';
import UsersPage from './pages/UsersPage';
import UserFormPage from './pages/UserFormPage';
import ActivityPage from './pages/ActivityPage';

const LayoutRoute = ({ children, roles }) => (
  <ProtectedRoute roles={roles}>
    <Layout>{children}</Layout>
  </ProtectedRoute>
);

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            style: { background: '#1e1e2e', color: '#e2e8f0', border: '1px solid #2d2d3e' },
            success: { iconTheme: { primary: '#10b981', secondary: '#1e1e2e' } },
            error: { iconTheme: { primary: '#ef4444', secondary: '#1e1e2e' } },
          }}
        />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          <Route path="/dashboard" element={<LayoutRoute><DashboardPage /></LayoutRoute>} />

          <Route path="/leads" element={<LayoutRoute><LeadsPage /></LayoutRoute>} />
          <Route path="/leads/new" element={<LayoutRoute roles={['admin', 'manager']}><LeadFormPage /></LayoutRoute>} />
          <Route path="/leads/:id" element={<LayoutRoute><LeadDetailPage /></LayoutRoute>} />
          <Route path="/leads/:id/edit" element={<LayoutRoute><LeadFormPage /></LayoutRoute>} />

          <Route path="/users" element={<LayoutRoute roles={['admin', 'manager']}><UsersPage /></LayoutRoute>} />
          <Route path="/users/create" element={<LayoutRoute roles={['admin']}><UserFormPage /></LayoutRoute>} />
          <Route path="/users/:id/edit" element={<LayoutRoute roles={['admin']}><UserFormPage /></LayoutRoute>} />

          <Route path="/activity" element={<LayoutRoute roles={['admin', 'manager']}><ActivityPage /></LayoutRoute>} />

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
