import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './lib/auth'
import { Layout, RequireAuth } from './components'
import Landing from './pages/Landing'
import { Login, Register } from './pages/Auth'
import MyRequests from './pages/MyRequests'
import NewRequest from './pages/NewRequest'
import RequestDetail from './pages/RequestDetail'
import StaffDashboard from './pages/StaffDashboard'
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
            <Route path="*" element={<p className="pad">Page not found.</p>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </React.StrictMode>
)
