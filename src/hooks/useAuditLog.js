import { useAuth } from './useAuth'
import { logsService } from '../lib/storage'

// Retorna a função log diretamente (uso: const log = useAuditLog())
// Valores válidos de actionType (enum audit_action no banco):
//   upload, download, login, logout, approved, reproved,
//   print, delete, restore, resubmit,
//   user_invited, user_role_changed, user_deactivated,
//   user_activated, user_deleted, password_reset_sent,
//   workflow_update, reviewer_note

export function useAuditLog() {
  const { user } = useAuth()

  return async function log(actionType, detail, prontuarioId = null) {
    if (!user) return
    try {
      await logsService.create({
        user_id:       user.id,
        action_type:   actionType,
        detail,
        prontuario_id: prontuarioId,
      })
    } catch {
      // Nunca deixar falha de log quebrar o fluxo principal
    }
  }
}
