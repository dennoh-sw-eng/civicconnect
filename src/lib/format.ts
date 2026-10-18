export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' })
