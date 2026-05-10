import { useState, useEffect, useCallback } from 'react'
import { prontuariosService, storageService } from '../lib/storage'
import { useAuditLog } from '../hooks/useAuditLog'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import toast from 'react-hot-toast'
import { PageHeader, BtnSec, BtnDanger, EmptyState, LoadingRows, Modal } from '../components/UI'
import styles from './LixeiraPage.module.css'
import { useAuth } from '../hooks/useAuth'

const { profile } = useAuth()
const canManage = profile?.role === 'admin'
const canRestore = profile?.role === 'admin' || profile?.role === 'auditor'

export default function LixeiraPage() {
  const log = useAuditLog()
  const [rows, setRows]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [confirm, setConfirm]   = useState(null) // item to hard-delete
  const [deleting, setDeleting] = useState(false)
  

  const fetch = useCallback(async () => {
    setLoading(true)
    const { data } = await prontuariosService.list({ status: 'trash', perPage: 100 })
    setRows(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetch() }, [fetch])

  async function restore(item) {
    await prontuariosService.restore(item.id)
    await log('restore', `Restaurou prontuário ${item.record_number}`, item.id)
    toast.success('Prontuário restaurado.')
    setRows(r => r.filter(x => x.id !== item.id))
  }

  async function hardDelete() {
    if (!confirm) return
    setDeleting(true)
    try {
      if (confirm.file_path) await storageService.remove(confirm.file_path)
      await prontuariosService.hardDelete(confirm.id)
      await log('delete', `Excluiu permanentemente prontuário ${confirm.record_number}`, null)
      toast.success('Excluído permanentemente.')
      setRows(r => r.filter(x => x.id !== confirm.id))
      setConfirm(null)
    } catch {
      toast.error('Erro ao excluir.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div>
      <PageHeader title="Lixeira" subtitle={`${rows.length} item${rows.length !== 1 ? 's' : ''} na lixeira`} />

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Paciente</th>
              <th>Prontuário</th>
              <th>Tipo</th>
              <th>Movido em</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <LoadingRows cols={5} rows={5} />
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5}>
                  <EmptyState
                    icon={<svg fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>}
                    title="Lixeira vazia"
                    subtitle="Nenhum prontuário na lixeira."
                  />
                </td>
              </tr>
            ) : rows.map(row => (
              <tr key={row.id} className={styles.row}>
                <td className={styles.tdName}>{row.patient_name}</td>
                <td className={styles.tdCode}>{row.record_number}</td>
                <td className={styles.tdMuted}>{row.document_type}</td>
                <td className={styles.tdDate}>
                  {row.deleted_at
                    ? format(new Date(row.deleted_at), 'dd/MM/yyyy', { locale: ptBR })
                    : '—'}
                </td>
                <td>
                  <div className={styles.actions}>
                    {canRestore && (
                      <BtnSec small onClick={() => restore(row)}>Restaurar</BtnSec>
                    )}
                    {canManage && (
                      <BtnDanger small onClick={() => setConfirm(row)}>Excluir</BtnDanger>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={!!confirm} onClose={() => !deleting && setConfirm(null)} title="Excluir permanentemente" width={440}>
        {confirm && (
          <div>
            <p className={styles.confirmText}>
              Tem certeza que deseja excluir <strong>{confirm.patient_name}</strong> ({confirm.record_number}) permanentemente?
              <br /><br />
              Esta ação <strong>não pode ser desfeita</strong> e o arquivo será removido do storage.
            </p>
            <div className={styles.confirmActions}>
              <BtnDanger onClick={hardDelete} disabled={deleting}>
                {deleting ? <span className="spinner" /> : null}
                {deleting ? 'Excluindo…' : 'Sim, excluir permanentemente'}
              </BtnDanger>
              <BtnSec onClick={() => setConfirm(null)} disabled={deleting}>Cancelar</BtnSec>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
