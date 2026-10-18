import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Notice } from '../../components'
import type { Department, Role } from '../../lib/types'

interface UserRow { id: string; email: string; full_name: string; role: Role; department_id: string | null; active: boolean }
const ROLES: Role[] = ['citizen', 'officer', 'supervisor', 'admin']

function UserEditor({ user, depts, onSaved, onError }: { user: UserRow; depts: Department[]; onSaved: () => void; onError: (m: string) => void }) {
  const [role, setRole] = useState(user.role)
  const [dept, setDept] = useState(user.department_id ?? '')
  const [active, setActive] = useState(user.active)
  const needsDept = role === 'officer' || role === 'supervisor'

  async function save() {
    if (!window.confirm(`Save changes for ${user.email}?`)) return
    const { error } = await supabase.rpc('admin_set_user', { p_user: user.id, p_role: role, p_dept: needsDept ? dept || null : null, p_active: active })
    if (error) onError(error.message); else onSaved()
  }
  return (
    <tr>
      <td>{user.full_name}<br /><span className="muted">{user.email}</span></td>
      <td><select aria-label="Role" value={role} onChange={e => setRole(e.target.value as Role)}>{ROLES.map(r => <option key={r} value={r}>{r}</option>)}</select></td>
      <td><select aria-label="Department" value={dept} disabled={!needsDept} onChange={e => setDept(e.target.value)}>
        <option value="">None</option>{depts.filter(d => d.active || d.id === user.department_id).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></td>
      <td><label className="check"><input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} /> Active</label></td>
      <td><button className="btn small" onClick={save}>Save</button></td>
    </tr>
  )
}

export default function AdminUsers() {
  const [users, setUsers] = useState<UserRow[]>([]); const [depts, setDepts] = useState<Department[]>([])
  const [q, setQ] = useState(''); const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const load = useCallback(async () => {
    const [u, d] = await Promise.all([supabase.rpc('admin_list_users'), supabase.from('departments').select('*').order('name')])
    if (u.error) setMsg({ ok: false, text: 'Could not load users.' }); else setUsers(u.data as UserRow[])
    setDepts((d.data ?? []) as Department[])
  }, [])
  useEffect(() => { load() }, [load])

  const term = q.trim().toLowerCase()
  const shown = users.filter(u => !term || u.email.toLowerCase().includes(term) || u.full_name.toLowerCase().includes(term))
  return (
    <>
      <h2>Users and roles</h2>
      <p className="muted">New staff register as citizens first. Find them here and change their role. Officers and supervisors need a department.</p>
      <label className="inline">Search<input value={q} onChange={e => setQ(e.target.value)} placeholder="Name or email" /></label>
      {msg && <Notice kind={msg.ok ? 'ok' : 'error'}>{msg.text}</Notice>}
      <div className="scroll"><table>
        <thead><tr><th>User</th><th>Role</th><th>Department</th><th>Status</th><th /></tr></thead>
        <tbody>{shown.map(u => <UserEditor key={u.id + u.role + u.department_id + u.active} user={u} depts={depts}
          onSaved={() => { setMsg({ ok: true, text: 'User updated.' }); load() }} onError={t => setMsg({ ok: false, text: t })} />)}</tbody>
      </table></div>
    </>
  )
}