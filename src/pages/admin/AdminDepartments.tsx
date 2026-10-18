import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { Notice } from '../../components'

interface Dept { id: string; name: string; description: string | null; active: boolean }

export default function AdminDepartments() {
  const [rows, setRows] = useState<Dept[]>([]); const [err, setErr] = useState('')
  const load = useCallback(async () => {
    const { data } = await supabase.from('departments').select('*').order('name'); setRows((data ?? []) as Dept[])
  }, [])
  useEffect(() => { load() }, [load])

  async function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form = e.currentTarget; const f = new FormData(form)
    const { error } = await supabase.from('departments').insert({ name: String(f.get('name')).trim(), description: String(f.get('description') || '').trim() || null })
    if (error) setErr(error.code === '23505' ? 'A department with that name already exists.' : 'Could not add the department.')
    else { setErr(''); form.reset(); load() }
  }
  async function toggle(d: Dept) {
    if (!window.confirm(d.active ? `Deactivate ${d.name}? It will no longer receive new assignments.` : `Reactivate ${d.name}?`)) return
    const { error } = await supabase.from('departments').update({ active: !d.active }).eq('id', d.id)
    if (error) setErr('Could not update the department.'); else { setErr(''); load() }
  }
  return (
    <>
      <h2>Departments</h2>
      {err && <Notice>{err}</Notice>}
      <form className="card" onSubmit={add}>
        <label>Name<input name="name" minLength={2} maxLength={80} required /></label>
        <label>Description (optional)<input name="description" maxLength={200} /></label>
        <button className="btn">Add department</button>
      </form>
      <div className="scroll"><table>
        <thead><tr><th>Name</th><th>Description</th><th>Status</th><th /></tr></thead>
        <tbody>{rows.map(d => <tr key={d.id}><td>{d.name}</td><td>{d.description}</td><td>{d.active ? 'Active' : 'Inactive'}</td>
          <td><button className="btn ghost small" onClick={() => toggle(d)}>{d.active ? 'Deactivate' : 'Reactivate'}</button></td></tr>)}</tbody>
      </table></div>
    </>
  )
}