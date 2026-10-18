import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { fmtDate } from '../lib/format'
import { Notice, StatusBadge } from '../components'
import { isStaff, STATUS_LABEL, type Department, type RequestEvent, type ServiceRequest, type Status } from '../lib/types'

const NEXT: Record<Status, Status | null> = { PENDING: 'IN_PROGRESS', IN_PROGRESS: 'RESOLVED', RESOLVED: 'IN_PROGRESS' }
const EVENT_LABEL: Record<string, string> = { submitted: 'Submitted', status: 'Status changed', assignment: 'Assigned', public_update: 'Update from the department', citizen_message: 'Message from citizen', internal_note: 'Internal note' }

export default function RequestDetail() {
  const { id } = useParams(); const { profile } = useAuth(); const staff = isStaff(profile?.role)
  const [req, setReq] = useState<ServiceRequest | null>(null); const [events, setEvents] = useState<RequestEvent[]>([])
  const [depts, setDepts] = useState<Department[]>([]); const [img, setImg] = useState<string | null>(null)
  const [err, setErr] = useState(''); const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const { data } = await supabase.from('service_requests').select('*, request_categories(name), departments(name)').eq('id', id!).maybeSingle()
    setReq(data as ServiceRequest | null); setLoading(false)
    if (!data) return
    const ev = await supabase.from('request_events').select('*').eq('request_id', id!).order('created_at')
    setEvents((ev.data ?? []) as RequestEvent[])
    if (data.image_path) { const s = await supabase.storage.from('request-images').createSignedUrl(data.image_path, 300); setImg(s.data?.signedUrl ?? null) }
  }, [id])
  useEffect(() => { load() }, [load])
  useEffect(() => { if (staff) supabase.from('departments').select('*').eq('active', true).then(({ data }) => setDepts(data ?? [])) }, [staff])

  async function rpc(name: string, args: Record<string, unknown>) {
    setErr('')
    const { error } = await supabase.rpc(name, args)
    if (error) setErr(error.message); else load()
    return !error
  }
  async function message(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form = e.currentTarget; const body = String(new FormData(form).get('body')).trim()
    if (!body) return
    const { error } = await supabase.from('request_events').insert({ request_id: id, actor_id: profile!.id, kind: 'citizen_message', body })
    if (error) setErr('Your message could not be sent.'); else { form.reset(); load() }
  }
  async function staffAction(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form = e.currentTarget; const f = new FormData(form)
    const next = NEXT[req!.status]!
    if (!window.confirm(`Change status to ${STATUS_LABEL[next]}?`)) return
    if (await rpc('update_request_status', { p_id: id, p_status: next, p_public: String(f.get('public') || '') || null, p_internal: String(f.get('internal') || '') || null })) form.reset()
  }
  async function assign(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget)
    await rpc('assign_request', { p_id: id, p_dept: String(f.get('dept')), p_officer: null, p_priority: String(f.get('priority')) })
  }

  if (loading) return <p className="pad">Loading…</p>
  if (!req) return <p className="pad">This request does not exist or you do not have access to it.</p>
  const visible = events.filter(ev => staff || !ev.is_internal)
  return (
    <section className="pad detail">
      <p className="muted">{req.reference_number}</p>
      <div className="row between"><h1>{req.title}</h1><StatusBadge status={req.status} /></div>
      <p className="muted">{req.request_categories?.name} · {req.location}{req.landmark ? ` (${req.landmark})` : ''} · Submitted {fmtDate(req.submitted_at)}</p>
      {req.departments && <p>Handled by {req.departments.name}</p>}
      <p>{req.description}</p>
      {img && <img src={img} alt="Photo supplied with the request" className="photo" />}
      {req.resolution_summary && <div className="card"><h2>Resolution</h2><p>{req.resolution_summary}</p></div>}
      {err && <Notice>{err}</Notice>}

      <h2>Progress</h2>
      <ol className="timeline">{visible.map(ev => (
        <li key={ev.id} className={ev.is_internal ? 'internal' : ''}>
          <strong>{EVENT_LABEL[ev.kind]}{ev.to_status && ev.kind === 'status' ? `: ${STATUS_LABEL[ev.to_status]}` : ''}{ev.is_internal ? ' (staff only)' : ''}</strong>
          <span className="muted"> {fmtDate(ev.created_at)}</span>{ev.body && <p>{ev.body}</p>}
        </li>))}</ol>

      {!staff && <form className="card" onSubmit={message}><label>Add information or a follow-up message<textarea name="body" maxLength={2000} rows={3} required /></label><button className="btn">Send message</button></form>}

      {staff && <>
        <form className="card" onSubmit={staffAction}>
          <h2>Update status</h2>
          <label>Update visible to the citizen<textarea name="public" maxLength={2000} rows={2} required={NEXT[req.status] === 'RESOLVED'} /></label>
          <label>Internal note (staff only)<textarea name="internal" maxLength={2000} rows={2} /></label>
          <button className="btn">Move to {STATUS_LABEL[NEXT[req.status]!]}</button>
        </form>
        {profile!.role !== 'officer' && <form className="card" onSubmit={assign}>
          <h2>Assign department</h2>
          <label>Department<select name="dept" defaultValue={req.department_id ?? ''} required><option value="" disabled>Choose</option>{depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
          <label>Priority<select name="priority" defaultValue={req.priority}><option value="LOW">Low</option><option value="NORMAL">Normal</option><option value="HIGH">High</option><option value="URGENT">Urgent</option></select></label>
          <button className="btn">Save assignment</button>
        </form>}
      </>}
    </section>
  )
}
