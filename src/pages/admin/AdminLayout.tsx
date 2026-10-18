import { NavLink, Outlet } from 'react-router-dom'

const TABS = [['users', 'Users and roles'], ['departments', 'Departments'], ['categories', 'Categories'], ['audit', 'Audit log']] as const

export default function AdminLayout() {
  return (
    <section className="pad">
      <h1>Administration</h1>
      <nav aria-label="Administration" className="row">
        {TABS.map(([to, label]) => <NavLink key={to} to={to} className="btn ghost small">{label}</NavLink>)}
      </nav>
      <Outlet />
    </section>
  )
}