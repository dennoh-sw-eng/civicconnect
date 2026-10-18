import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { fmtDate } from '../../lib/format'
import { Notice } from '../../components'

interface Log { id: number; actor_id: string | null; action: string; entity: string; entity_id: string | null; details: Record<string, unknown> | null; created_at: string }
const PAGE = 25

export default function AdminAudit() {
  const [logs, setLogs] = useState<Log[]>([]); const [count, setCount] = useState(0); const [page, setPage] = useState(0)
  const [emails, setEmails] = useState<Record<string, string>>({}); const [err, setErr] = useState('')

  useEffect(() => {
    supabase.rpc('admin_list_users').then(({ data }) => setEmails(Object.fromEntries(((data ?? []) as { id: string; email: string }[]).map(u => [u.id, u.email]))))
  }, [])
  useEffect(() => {
    supabase.from('audit_logs').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range(page * PAGE, page * PAGE + PAGE - 1)
      .then(({ data, count: c, error }) => { if (error) setErr('Could not load the audit log.'); setLogs((data ?? []) as Log[]); setCount(c ?? 0) })
  }, [page])

  return (
    <>
      <h2>Audit log</h2>
      {err && <Notice>{err}</Notice>}
      <div className="scroll"><table>
        <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Details</th></tr></thead>
        <tbody>{logs.length === 0 ? <tr><td colSpan={4}>No entries yet.</td></tr> : logs.map(l => (
          <tr key={l.id}><td>{fmtDate(l.created_at)}</td><td>{l.actor_id ? emails[l.actor_id] ?? l.actor_id.slice(0, 8) : 'System'}</td>
            <td>{l.action}</td><td className="muted">{l.details ? JSON.stringify(l.details).slice(0, 120) : ''}</td></tr>))}</tbody>
      </table></div>
      <div className="row"><button className="btn ghost" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous</button>
        <button className="btn ghost" disabled={(page + 1) * PAGE >= count} onClick={() => setPage(p => p + 1)}>Next</button><span className="muted">{count} entries</span></div>
    </>
  )
}