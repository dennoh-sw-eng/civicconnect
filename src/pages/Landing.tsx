import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Category } from '../lib/types'

const STEPS = ['Report the issue with a location and description.', 'Receive a reference number such as CCR-2026-000123.',
  'Follow progress and read updates from the department.', 'Confirm the outcome, or ask for a review.']

export default function Landing() {
  const [cats, setCats] = useState<Category[]>([])
  useEffect(() => { supabase.from('request_categories').select('id,name').eq('active', true).order('name').then(({ data }) => setCats(data ?? [])) }, [])
  return (
    <>
      <section className="hero">
        <h1>Report a local issue. Track every step.</h1>
        <p>Help improve your community by reporting service delivery issues and following their progress from submission to resolution.</p>
        <div className="row"><Link className="btn" to="/requests/new">Submit a request</Link><Link className="btn ghost" to="/requests">Track a request</Link></div>
      </section>
      <section className="pad" id="categories"><h2>What you can report</h2>
        <ul className="grid">{cats.map(c => <li key={c.id} className="tile">{c.name}</li>)}</ul></section>
      <section className="pad" id="how"><h2>How it works</h2>
        <ol className="steps">{STEPS.map(s => <li key={s}>{s}</li>)}</ol></section>
      <section className="pad"><h2>Privacy</h2>
        <p>Your requests are visible only to you and the staff responsible for them. Tracking requires you to sign in.</p></section>
    </>
  )
}
