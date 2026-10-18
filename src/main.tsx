import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './lib/auth'
import { Layout, RequireAuth } from './components'
import Landing from './pages/Landing'
import { Login, Register } from './pages/Auth'
import MyRequests from './pages/MyRequests'
import NewRequest from './pages/NewRequest'
import RequestDetail from './pages/RequestDetail'
import StaffDashboard from './pages/StaffDashboard'
import AdminLayout from './pages/admin/AdminLayout'
import AdminUsers from './pages/admin/AdminUsers'
import AdminDepartments from './pages/admin/AdminDepartments'
import AdminCategories from './pages/admin/AdminCategories'
import AdminAudit from './pages/admin/AdminAudit'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route element={<RequireAuth />}>
              <Route path="/requests" element={<MyRequests />} />
              <Route path="/requests/new" element={<NewRequest />} />
              <Route path="/requests/:id" element={<RequestDetail />} />
            </Route>
            <Route element={<RequireAuth roles={['officer', 'supervisor', 'admin']} />}>
              <Route path="/staff" element={<StaffDashboard />} />
            </Route>
            <Route element={<RequireAuth roles={['admin']} />}>
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<Navigate to="users" replace />} />
                <Route path="users" element={<AdminUsers />} />
                <Route path="departments" element={<AdminDepartments />} />
                <Route path="categories" element={<AdminCategories />} />
                <Route path="audit" element={<AdminAudit />} />
              </Route>
            </Route>
            <Route path="*" element={<p className="pad">Page not found.</p>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </React.StrictMode>
)