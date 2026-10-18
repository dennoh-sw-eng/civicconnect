import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fmtDate } from '../lib/format'
import { Notice, StatusBadge } from '../components'
import type { ServiceRequest, Status } from '../lib/types'

interface Stats { total: number; pending: number; in_progress: number; resolved: number; unassigned: number; avg_resolution_hours: number | null; by_category: { name: string; count: number }[] }
const PAGE = 15

export default function StaffDashboard() {
  const [days, setDays] = useState(30); const [stats, setStats] = useState<Stats | null>(null)
  const [rows, setRows] = useState<ServiceRequest[]>([]); const [count, setCount] = useState(0); const [page, setPage] = useState(0)
  const [status, setStatus] = useState<Status | ''>(''); const [search, setSearch] = useState(''); const [err, setErr] = useState('')

  useEffect(() => { supabase.rpc('request_stats', { p_days: days }).then(({ data, error }) => { if (error) setErr('Could not load metrics.'); else setStats(data as Stats) }) }, [days])
  useEffect(() => {
    let q = supabase.from('service_requests')
      .select('id,reference_number,title,status,priority,submitted_at,updated_at,request_categories(name),departments(name)', { count: 'exact' })
      .eq('archived', false).order('submitted_at', { ascending: false }).range(page * PAGE, page * PAGE + PAGE - 1)
    if (status) q = q.eq('status', status)
    const term = search.trim().replace(/[%,()]/g, '')
    if (term) q = q.or(`reference_number.ilike.%${term}%,title.ilike.%${term}%`)
    q.then(({ data, count: c, error }) => { if (error) setErr('Could not load requests.'); setRows((data ?? []) as unknown as ServiceRequest[]); setCount(c ?? 0) })
  }, [status, search, page])

  const max = Math.max(1, ...(stats?.by_category.map(c => c.count) ?? [1]))
  return (
    <section className="pad">
      <div className="row between"><h1>Staff dashboard</h1>
        <label className="inline">Period<select value={days} onChange={e => setDays(Number(e.target.value))}><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option></select></label></div>
      {err && <Notice>{err}</Notice>}
      {stats && <>
        <div className="cards">
          {([['Total', stats.total], ['Pending', stats.pending], ['In Progress', stats.in_progress], ['Resolved', stats.resolved], ['Unassigned', stats.unassigned], ['Avg. hours to resolve', stats.avg_resolution_hours ?? '–']] as const)
            .map(([k, v]) => <div key={k} className="card stat"><span className="muted">{k}</span><strong>{v}</strong></div>)}
        </div>
        <h2>Requests by category</h2>
        {stats.by_category.length === 0 ? <p className="muted">No requests in this period.</p> :
          <ul className="bars">{stats.by_category.map(c => <li key={c.name}><span>{c.name}</span><span className="bar" style={{ width: `${(c.count / max) * 100}%` }} role="img" aria-label={`${c.count} requests`} /><b>{c.count}</b></li>)}</ul>}
      </>}
      <h2>Requests</h2>
      <div className="row">
        <label className="inline">Search<input value={search} onChange={e => { setSearch(e.target.value); setPage(0) }} placeholder="Reference or title" /></label>
        <label className="inline">Status<select value={status} onChange={e => { setStatus(e.target.value as Status | ''); setPage(0) }}><option value="">All</option><option value="PENDING">Pending</option><option value="IN_PROGRESS">In Progress</option><option value="RESOLVED">Resolved</option></select></label>
      </div>
      <div className="scroll"><table>
        <thead><tr><th>Reference</th><th>Title</th><th>Category</th><th>Priority</th><th>Status</th><th>Department</th><th>Submitted</th></tr></thead>
        <tbody>{rows.length === 0 ? <tr><td colSpan={7}>No matching requests.</td></tr> : rows.map(r => (
          <tr key={r.id}><td><Link to={`/requests/${r.id}`}>{r.reference_number}</Link></td><td>{r.title}</td><td>{r.request_categories?.name}</td><td>{r.priority}</td>
            <td><StatusBadge status={r.status} /></td><td>{r.departments?.name ?? 'Unassigned'}</td><td>{fmtDate(r.submitted_at)}</td></tr>))}</tbody></table></div>
      <div className="row"><button className="btn ghost" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous</button>
        <button className="btn ghost" disabled={(page + 1) * PAGE >= count} onClick={() => setPage(p => p + 1)}>Next</button><span className="muted">{count} total</span></div>
    </section>
  )
}
