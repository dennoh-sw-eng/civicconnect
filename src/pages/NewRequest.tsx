import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { Notice } from '../components'
import type { Category } from '../lib/types'

const MAX_BYTES = 5 * 1024 * 1024
const TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

export default function NewRequest() {
  const { profile } = useAuth()
  const [cats, setCats] = useState<Category[]>([])
  const [err, setErr] = useState(''); const [created, setCreated] = useState<{ id: string; ref: string } | null>(null)
  const submitting = useRef(false)
  useEffect(() => { supabase.from('request_categories').select('id,name').eq('active', true).order('name').then(({ data }) => setCats(data ?? [])) }, [])

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (submitting.current || !profile) return
    const f = new FormData(e.currentTarget); const file = f.get('image') as File
    setErr('')
    if (file.size > 0 && (!TYPES[file.type] || file.size > MAX_BYTES)) return setErr('Use a JPEG, PNG or WebP image of 5 MB or less.')
    submitting.current = true
    let image_path: string | null = null
    if (file.size > 0) {
      image_path = `${profile.id}/${crypto.randomUUID()}.${TYPES[file.type]}`
      const { error } = await supabase.storage.from('request-images').upload(image_path, file, { contentType: file.type })
      if (error) { submitting.current = false; return setErr('The image could not be uploaded. Try again or submit without it.') }
    }
    const { data, error } = await supabase.from('service_requests').insert({
      title: String(f.get('title')).trim(), category_id: String(f.get('category')), location: String(f.get('location')).trim(),
      landmark: String(f.get('landmark') || '').trim() || null, description: String(f.get('description')).trim(), image_path,
    }).select('id,reference_number').single()
    submitting.current = false
    if (error || !data) return setErr('Your request could not be saved. Check the fields and try again.')
    setCreated({ id: data.id, ref: data.reference_number })
  }

  if (created) return (
    <div className="card narrow"><Notice kind="ok">Request received.</Notice>
      <p>Your reference number is</p><p className="ref">{created.ref}</p>
      <Link className="btn" to={`/requests/${created.id}`}>View request</Link></div>)

  return (
    <form className="card narrow" onSubmit={submit}>
      <h1>Submit a request</h1>
      {err && <Notice>{err}</Notice>}
      <label>Title<input name="title" minLength={5} maxLength={120} placeholder="Streetlight not working" required /></label>
      <label>Category<select name="category" required defaultValue=""><option value="" disabled>Choose a category</option>{cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label>Location or area<input name="location" maxLength={200} placeholder="Estate, street or ward" required /></label>
      <label>Landmark (optional)<input name="landmark" maxLength={200} placeholder="Opposite the primary school" /></label>
      <label>Description<textarea name="description" minLength={10} maxLength={2000} rows={5} placeholder="What is the problem and how long has it been there?" required /></label>
      <label>Photo (optional)<input name="image" type="file" accept="image/jpeg,image/png,image/webp" /></label>
      <button className="btn">Submit request</button>
    </form>
  )
}
