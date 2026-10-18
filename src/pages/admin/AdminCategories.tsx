import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { Notice } from '../../components'
import type { Department } from '../../lib/types'

interface Cat { id: string; name: string; active: boolean; default_department_id: string | null }

export default function AdminCategories() {
  const [rows, setRows] = useState<Cat[]>([]); const [depts, setDepts] = useState<Department[]>([]); const [err, setErr] = useState('')
  const load = useCallback(async () => {
    const [c, d] = await Promise.all([supabase.from('request_categories').select('*').order('name'), supabase.from('departments').select('*').eq('active', true).order('name')])
    setRows((c.data ?? []) as Cat[]); setDepts((d.data ?? []) as Department[])
  }, [])
  useEffect(() => { load() }, [load])
  const deptName = (id: string | null) => depts.find(d => d.id === id)?.name ?? 'None'

  async function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form = e.currentTarget; const f = new FormData(form)
    const { error } = await supabase.from('request_categories').insert({ name: String(f.get('name')).trim(), default_department_id: String(f.get('dept')) || null })
    if (error) setErr(error.code === '23505' ? 'A category with that name already exists.' : 'Could not add the category.')
    else { setErr(''); form.reset(); load() }
  }
  async function toggle(c: Cat) {
    if (!window.confirm(c.active ? `Hide ${c.name} from the request form?` : `Show ${c.name} on the request form?`)) return
    const { error } = await supabase.from('request_categories').update({ active: !c.active }).eq('id', c.id)
    if (error) setErr('Could not update the category.'); else { setErr(''); load() }
  }
  return (
    <>
      <h2>Categories</h2>
      {err && <Notice>{err}</Notice>}
      <form className="card" onSubmit={add}>
        <label>Name<input name="name" minLength={2} maxLength={80} required /></label>
        <label>Usual department<select name="dept" defaultValue=""><option value="">None</option>{depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
        <button className="btn">Add category</button>
      </form>
      <div className="scroll"><table>
        <thead><tr><th>Name</th><th>Usual department</th><th>Status</th><th /></tr></thead>
        <tbody>{rows.map(c => <tr key={c.id}><td>{c.name}</td><td>{deptName(c.default_department_id)}</td><td>{c.active ? 'Shown' : 'Hidden'}</td>
          <td><button className="btn ghost small" onClick={() => toggle(c)}>{c.active ? 'Hide' : 'Show'}</button></td></tr>)}</tbody>
      </table></div>
    </>
  )
}