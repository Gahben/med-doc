export type UserRole = 'admin' | 'revisor' | 'atendente'

export type DocumentStatus = 'pending' | 'approved' | 'reproved' | 'trash'

export type DocumentType = 
  | 'Prontuário médico' 
  | 'Exame laboratorial' 
  | 'Laudo de imagem' 
  | 'Receituário' 
  | 'Declaração / atestado' 
  | 'Outro'

export type OriginSector = 
  | 'Recepção' 
  | 'Arquivo Médico' 
  | 'Consultório' 
  | 'Exames' 
  | 'Outro'

export type LogAction = 
  | 'login' 
  | 'logout'
  | 'upload' 
  | 'download' 
  | 'print' 
  | 'approve' 
  | 'reprove' 
  | 'delete'
  | 'view'
  | 'user_create'
  | 'user_update'
  | 'config_update'

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  active: boolean
  created_at: string
  last_login: string | null
}

export interface Document {
  id: string
  patient_name: string
  cpf: string
  prontuario_code: string
  system_code: string
  document_date: string
  type: DocumentType
  origin_sector: OriginSector
  file_url: string
  file_size: number
  uploaded_by: string
  uploader_name?: string
  status: DocumentStatus
  review_note: string | null
  reviewed_by: string | null
  reviewer_name?: string | null
  reviewed_at: string | null
  never_delete: boolean
  created_at: string
  updated_at: string
}

export interface DocumentVersion {
  id: string
  document_id: string
  version_number: number
  file_url: string
  status: DocumentStatus
  review_note: string | null
  created_at: string
}

export interface AccessLog {
  id: string
  user_id: string
  user_name?: string
  action: LogAction
  document_id: string | null
  details: string | null
  ip_address: string | null
  created_at: string
}

export interface SystemConfig {
  id: string
  trash_after_days: number
  permanent_delete_after_days: number
  alert_review_hours: number
}

export interface ReviewQueueItem {
  id: string
  patient_name: string
  cpf: string
  code: string
  type: DocumentType
  sender: string
  date: string
  pages: number
}

export interface DashboardStats {
  totalApproved: number
  pendingReview: number
  inTrash: number
  storageUsed: string
  pendingAlert: number
}
