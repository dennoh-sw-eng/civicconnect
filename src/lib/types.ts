export type Role = 'citizen' | 'officer' | 'supervisor' | 'admin'
export type Status = 'PENDING' | 'IN_PROGRESS' | 'RESOLVED'

export interface Profile { id: string; full_name: string; phone: string | null; role: Role; department_id: string | null }
export interface Category { id: string; name: string }
export interface Department { id: string; name: string; active: boolean }
export interface ServiceRequest {
  id: string; reference_number: string; title: string; description: string; location: string; landmark: string | null
  status: Status; priority: string; submitted_at: string; updated_at: string; resolved_at: string | null
  resolution_summary: string | null; image_path: string | null; department_id: string | null
  request_categories: { name: string } | null; departments: { name: string } | null
}
export interface RequestEvent {
  id: string; kind: string; from_status: Status | null; to_status: Status | null
  body: string | null; is_internal: boolean; created_at: string
}

export const STATUS_LABEL: Record<Status, string> = { PENDING: 'Pending', IN_PROGRESS: 'In Progress', RESOLVED: 'Resolved' }
export const STATUS_ICON: Record<Status, string> = { PENDING: '◔', IN_PROGRESS: '◑', RESOLVED: '●' }
export const isStaff = (r?: Role) => r === 'officer' || r === 'supervisor' || r === 'admin'
