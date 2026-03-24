import { useState, useEffect, useCallback } from 'react'
import { prontuariosService, storageService } from '../lib/storage'
import { useAuth } from '../hooks/useAuth'
import { useAuditLog } from '../hooks/useAuditLog'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import toast from 'react-hot-toast'
import {
  PageHeader, BtnAccent, BtnSec, BtnDanger,
  Badge, EmptyState, LoadingRows, Modal, Field, Input, Select
} from '../components/UI'
import styles from './BuscaPage.module.css'

const DOC_TYPES = ['Todos', 'Prontuário médico', 'Exame laboratorial', 'Laudo de imagem', 'Receituário', 'Declaração / atestado', 'Outro']
const STATUS_OPTS = [
  { value: '', label: 'Todos os status' },
  { value: 'pending',  label: 'Aguardando' },
  { value: 'approved', label: 'Liberado' },
  { value: 'reproved', label: 'Não liberado' },
]

export default function BuscaPage() {
  const { profile } = useAuth()
  const log = useAuditLog()

  const [rows, setRows]     = useState([])
  const [total, setTotal]   = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage]     = useState(1)
  const PER_PAGE = 20

  const [selected, setSelected] = useState(null)
  const [signedUrl, setSignedUrl] = useState(null)
  const [loadingUrl, setLoadingUrl] = useState(false)

  const fetch = useCallback(async () => {
    setLoading(true)
    const { data, count, error } = await prontuariosService.list({ search, status: status || null, page, perPage: PER_PAGE })
    if (!error) { setRows(data || []); setTotal(count || 0) }
    setLoading(false)
  }, [search, status, page])

  useEffect(() => { fetch() }, [fetch])

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setPage(1); fetch() }, 350)
    return () => clearTimeout(t)
  }, [search])

  async function openModal(row) {
    setSelected(row)
    setSignedUrl(null)
    if (row.file_path) {
      setLoadingUrl(true)
      try {
        const url = await storageService.getSignedUrl(row.file_path, 3600)
        setSignedUrl(url)
        await log('download', `Visualizou prontuário ${row.record_number}`, row.id)
      } catch {
        toast.error('Erro ao gerar link de acesso ao arquivo.')
      } finally {
        setLoadingUrl(false)
      }
    }
  }

  async function handlePrint() {
    if (!selected) return
    await log('print', `Imprimiu prontuário ${selected.record_number}`, selected.id)
    window.open(signedUrl, '_blank')
  }

  const totalPages = Math.ceil(total / PER_PAGE)
  const canReview = profile?.role === 'admin' || profile?.role === 'revisor'

  return (
    <div>
      <PageHeader
        title="Busca de Prontuários"
        subtitle={`${total} registro${total !== 1 ? 's' : ''} encontrado${total !== 1 ? 's' : ''}`}
      />

      {/* Search bar */}
      <div className={styles.searchBar}>
        <div className={styles.searchWrap}>
          <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            className={styles.searchInput}
            placeholder="Buscar por nome, CPF ou número do prontuário…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className={styles.filterSelect}
          value={status}
          onChange={e => { setStatus(e.target.value); setPage(1) }}
        >
          {STATUS_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Paciente</th>
              <th>Prontuário</th>
              <th>CPF</th>
              <th>Tipo</th>
              <th>Status</th>
              <th>Data</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <LoadingRows cols={7} rows={8} />
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <EmptyState
                    icon={<svg fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>}
                    title="Nenhum prontuário encontrado"
                    subtitle="Tente ajustar os filtros ou o termo de busca."
                  />
                </td>
              </tr>
            ) : rows.map(row => (
              <tr key={row.id} onClick={() => openModal(row)} className={styles.tableRow}>
                <td className={styles.tdName}>{row.patient_name}</td>
                <td className={styles.tdCode}>{row.record_number}</td>
                <td className={styles.tdCode}>{row.patient_cpf}</td>
                <td className={styles.tdMuted}>{row.document_type}</td>
                <td><Badge status={row.locked ? 'locked' : row.status} /></td>
                <td className={styles.tdDate}>
                  {row.created_at
                    ? format(new Date(row.created_at), 'dd/MM/yyyy', { locale: ptBR })
                    : '—'}
                </td>
                <td>
                  <div className={styles.rowActions}>
                    <button className={styles.iconBtn} title="Ver detalhes" onClick={e => { e.stopPropagation(); openModal(row) }}>
                      <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className={styles.pagination}>
          <BtnSec small disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Anterior</BtnSec>
          <span className={styles.pageInfo}>Página {page} de {totalPages}</span>
          <BtnSec small disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Próxima →</BtnSec>
        </div>
      )}

      {/* Detail Modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title="Detalhes do Prontuário" width={560}>
        {selected && (
          <div>
            <div className={styles.detailGrid}>
              <DetailItem label="Paciente"       value={selected.patient_name} />
              <DetailItem label="CPF"            value={selected.patient_cpf} />
              <DetailItem label="Número"         value={selected.record_number} />
              <DetailItem label="Tipo"           value={selected.document_type} />
              <DetailItem label="Status"         value={<Badge status={selected.status} />} />
              <DetailItem label="Data do doc."   value={selected.document_date || '—'} />
              <DetailItem label="Enviado por"    value={selected.profiles?.name || '—'} />
              <DetailItem label="Páginas"        value={selected.pages} />
              {selected.upload_note && (
                <DetailItem label="Obs. upload" value={selected.upload_note} full />
              )}
              {selected.review_note && (
                <DetailItem label="Obs. revisão" value={selected.review_note} full />
              )}
            </div>

            <div className={styles.modalActions}>
              {selected.file_path && (
                <BtnAccent onClick={handlePrint} disabled={loadingUrl || !signedUrl}>
                  {loadingUrl ? <span className="spinner" /> : (
                    <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                  {loadingUrl ? 'Carregando…' : 'Abrir arquivo'}
                </BtnAccent>
              )}
              <BtnSec onClick={() => setSelected(null)}>Fechar</BtnSec>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

function DetailItem({ label, value, full }) {
  return (
    <div className={`${styles.detailItem} ${full ? styles.full : ''}`}>
      <span className={styles.detailLabel}>{label}</span>
      <span className={styles.detailValue}>{value}</span>
    </div>
  )
}
