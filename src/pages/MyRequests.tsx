import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { fmtDate } from '../lib/format'
import { Notice, StatusBadge } from '../components'
import { isStaff, type ServiceRequest, type Status } from '../lib/types'

const COLS = 'id,reference_number,title,location,status,submitted_at,updated_at,request_categories(name)'
const PAGE = 10

export default function MyRequests() {
  const { profile } = useAuth()
  const [rows, setRows] = useState<ServiceRequest[]>([]); const [count, setCount] = useState(0)
  const [status, setStatus] = useState<Status | ''>(''); const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true); const [err, setErr] = useState('')

  useEffect(() => {
    if (!profile) return
    setLoading(true)
    let q = supabase.from('service_requests').select(COLS, { count: 'exact' }).eq('citizen_id', profile.id)
      .order('submitted_at', { ascending: false }).range(page * PAGE, page * PAGE + PAGE - 1)
    if (status) q = q.eq('status', status)
    q.then(({ data, count: c, error }) => {
      if (error) setErr('Could not load your requests. Try again.')
      setRows((data ?? []) as unknown as ServiceRequest[]); setCount(c ?? 0); setLoading(false)
    })
  }, [profile, status, page])

  if (isStaff(profile?.role)) return <p className="pad">Staff accounts manage requests from the <Link to="/staff">staff dashboard</Link>.</p>
  return (
    <section className="pad">
      <div className="row between"><h1>My requests</h1><Link className="btn" to="/requests/new">Submit a request</Link></div>
      <label className="inline">Status
        <select value={status} onChange={e => { setStatus(e.target.value as Status | ''); setPage(0) }}>
          <option value="">All</option><option value="PENDING">Pending</option><option value="IN_PROGRESS">In Progress</option><option value="RESOLVED">Resolved</option>
        </select></label>
      {err && <Notice>{err}</Notice>}
      {loading ? <p>Loading…</p> : rows.length === 0 ? (
        <div className="card"><p>You have no requests{status ? ' with this status' : ' yet'}.</p>{!status && <Link className="btn" to="/requests/new">Submit your first request</Link>}</div>
      ) : (
        <ul className="list">{rows.map(r => (
          <li key={r.id} className="card">
            <div className="row between"><strong>{r.reference_number}</strong><StatusBadge status={r.status} /></div>
            <h2>{r.title}</h2>
            <p className="muted">{r.request_categories?.name} · {r.location}</p>
            <p className="muted">Submitted {fmtDate(r.submitted_at)} · Updated {fmtDate(r.updated_at)}</p>
            <Link to={`/requests/${r.id}`}>View details</Link>
          </li>))}</ul>)}
      <div className="row"><button className="btn ghost" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous</button>
        <button className="btn ghost" disabled={(page + 1) * PAGE >= count} onClick={() => setPage(p => p + 1)}>Next</button></div>
    </section>
  )
}
