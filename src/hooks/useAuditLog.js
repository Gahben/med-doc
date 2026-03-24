import { useAuth } from './useAuth'
import { logsService } from '../lib/storage'

export function useAuditLog() {
  const { user } = useAuth()

  return async function log(actionType, detail, prontuarioId = null) {
    if (!user) return
    await logsService.create({
      user_id: user.id,
      action_type: actionType,
      detail,
      prontuario_id: prontuarioId,
    })
  }
}
