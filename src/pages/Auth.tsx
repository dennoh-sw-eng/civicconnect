import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { Notice } from '../components'

export function Login() {
  const { session } = useAuth(); const nav = useNavigate()
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  if (session) return <Navigate to="/requests" replace />
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setErr('')
    const f = new FormData(e.currentTarget)
    const { error } = await supabase.auth.signInWithPassword({ email: String(f.get('email')), password: String(f.get('password')) })
    setBusy(false)
    if (error) setErr('Email or password is incorrect, or the email is not yet verified.'); else nav('/requests')
  }
  return (
    <form className="card narrow" onSubmit={submit}>
      <h1>Sign in</h1>
      {err && <Notice>{err}</Notice>}
      <label>Email<input name="email" type="email" autoComplete="email" required /></label>
      <label>Password<input name="password" type="password" autoComplete="current-password" required /></label>
      <button className="btn" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      <p>New here? <Link to="/register">Create an account</Link></p>
    </form>
  )
}

export function Register() {
  const [err, setErr] = useState(''); const [done, setDone] = useState(false); const [busy, setBusy] = useState(false)
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setErr('')
    const f = new FormData(e.currentTarget)
    if (String(f.get('password')).length < 8) return setErr('Use a password of at least 8 characters.')
    setBusy(true)
    const { error } = await supabase.auth.signUp({
      email: String(f.get('email')), password: String(f.get('password')),
      options: { data: { full_name: String(f.get('name')), phone: String(f.get('phone') || '') }, emailRedirectTo: window.location.origin + '/login' },
    })
    setBusy(false)
    if (error) setErr(error.message); else setDone(true)
  }
  if (done) return <div className="card narrow"><Notice kind="ok">Account created. Check your email to verify your address, then sign in.</Notice></div>
  return (
    <form className="card narrow" onSubmit={submit}>
      <h1>Create an account</h1>
      {err && <Notice>{err}</Notice>}
      <label>Full name<input name="name" minLength={2} maxLength={120} autoComplete="name" required /></label>
      <label>Email<input name="email" type="email" autoComplete="email" required /></label>
      <label>Phone (optional)<input name="phone" type="tel" maxLength={20} autoComplete="tel" /></label>
      <label>Password<input name="password" type="password" minLength={8} autoComplete="new-password" required /></label>
      <label className="check"><input type="checkbox" required /> I accept the privacy notice and terms of service.</label>
      <button className="btn" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button>
    </form>
  )
}
