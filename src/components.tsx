import type { ReactNode } from 'react'
import { Link, Navigate, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from './lib/auth'
import { isStaff, STATUS_ICON, STATUS_LABEL, type Role, type Status } from './lib/types'

export function StatusBadge({ status }: { status: Status }) {
  return <span className={`badge ${status.toLowerCase()}`}><span aria-hidden="true">{STATUS_ICON[status]}</span> {STATUS_LABEL[status]}</span>
}

export function Notice({ kind = 'error', children }: { kind?: 'error' | 'ok'; children: ReactNode }) {
  return <p role={kind === 'error' ? 'alert' : 'status'} className={`notice ${kind}`}>{children}</p>
}

export function Layout() {
  const { profile, signOut } = useAuth()
  const staff = isStaff(profile?.role)
  return (
    <>
      <header className="top">
        <Link to="/" className="brand">i-citizen</Link>
        <nav aria-label="Main">
          {profile && !staff && <><NavLink to="/requests">My requests</NavLink><NavLink to="/requests/new">Submit a request</NavLink></>}
          {staff && <NavLink to="/staff">Staff dashboard</NavLink>}
          {profile?.role === 'admin' && <NavLink to="/admin">Administration</NavLink>}
          {profile ? <button className="link" onClick={signOut}>Sign out</button>
            : <><NavLink to="/login">Sign in</NavLink><NavLink to="/register" className="btn small">Register</NavLink></>}
        </nav>
      </header>
      <main><Outlet /></main>
      <footer className="foot">i-citizen government service.</footer>
    </>
  )
}

export function RequireAuth({ roles }: { roles?: Role[] }) {
  const { session, profile, loading } = useAuth()
  if (loading) return <p className="pad">Loading…</p>
  if (!session) return <Navigate to="/login" replace />
  if (roles && profile && !roles.includes(profile.role)) return <Navigate to="/requests" replace />
  return <Outlet />
}