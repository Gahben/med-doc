import { useState, useEffect, useCallback } from 'react'
import { logsService } from '../lib/storage'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { PageHeader, EmptyState } from '../components/UI'
import styles from './LogsPage.module.css'

const FILTERS = [
  { key: null,       label: 'Todos' },
  { key: 'upload',   label: 'Upload' },
  { key: 'download', label: 'Download' },
  { key: 'login',    label: 'Login' },
  { key: 'approved', label: 'Aprovado' },
  { key: 'reproved', label: 'Reprovado' },
  { key: 'print',    label: 'Impressão' },
  { key: 'delete',   label: 'Exclusão' },
]

const ICON_MAP = {
  upload:   { cls: styles.iconUpload,   path: '<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>' },
  download: { cls: styles.iconDownload, path: '<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>' },
  login:    { cls: styles.iconLogin,    path: '<path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3"/>' },
  approved: { cls: styles.iconApproved, path: '<path d="M20 6L9 17l-5-5"/>' },
  reproved: { cls: styles.iconReproved, path: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>' },
  print:    { cls: styles.iconPrint,    path: '<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>' },
  delete:   { cls: styles.iconDelete,   path: '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/>' },
  restore:  { cls: styles.iconApproved, path: '<path d="M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8"/><path d="M3 3v5h5"/>' },
}

export default function LogsPage() {
  const [logs, setLogs]       = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState(null)
  const [page, setPage]       = useState(1)
  const [total, setTotal]     = useState(0)
  const PER_PAGE = 50

  const fetch = useCallback(async () => {
    setLoading(true)
    const { data, count } = await logsService.list({ type: filter, page, perPage: PER_PAGE })
    setLogs(data || [])
    setTotal(count || 0)
    setLoading(false)
  }, [filter, page])

  useEffect(() => { fetch() }, [fetch])

  const icon = (type) => ICON_MAP[type] || ICON_MAP.login

  return (
    <div>
      <PageHeader title="Logs de auditoria" subtitle={`${total} evento${total !== 1 ? 's' : ''} registrado${total !== 1 ? 's' : ''}`} />

      <div className={styles.filters}>
        {FILTERS.map(f => (
          <button
            key={String(f.key)}
            className={`${styles.filterBtn} ${filter === f.key ? styles.active : ''}`}
            onClick={() => { setFilter(f.key); setPage(1) }}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className={styles.logWrap}>
        {loading ? (
          <div className={styles.loadingWrap}><span className="spinner dark" /></div>
        ) : logs.length === 0 ? (
          <EmptyState
            title="Nenhum log encontrado"
            subtitle="Tente outro filtro."
          />
        ) : logs.map(l => {
          const ic = icon(l.action_type)
          return (
            <div key={l.id} className={styles.entry}>
              <div className={`${styles.icon} ${ic.cls}`}>
                <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
                  dangerouslySetInnerHTML={{ __html: ic.path }} />
              </div>
              <div className={styles.body}>
                <div className={styles.action}>{l.detail || l.action_type}</div>
                <div className={styles.meta}>{l.profiles?.name || 'Sistema'}</div>
              </div>
              <div className={styles.time}>
                {format(new Date(l.created_at), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
              </div>
            </div>
          )
        })}
      </div>

      {total > PER_PAGE && (
        <div className={styles.pagination}>
          <button className={styles.pageBtn} disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Anterior</button>
          <span>{page} / {Math.ceil(total / PER_PAGE)}</span>
          <button className={styles.pageBtn} disabled={page >= Math.ceil(total / PER_PAGE)} onClick={() => setPage(p => p + 1)}>Próxima →</button>
        </div>
      )}
    </div>
  )
}
