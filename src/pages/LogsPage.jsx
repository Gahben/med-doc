import { useState, useEffect, useCallback } from 'react'
import { logsService } from '../lib/storage'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { PageHeader, EmptyState } from '../components/UI'
import toast from 'react-hot-toast'
import styles from './LogsPage.module.css'

const FILTERS = [
  { key: null,                label: 'Todos' },
  { key: 'upload',            label: 'Upload' },
  { key: 'download',          label: 'Download' },
  { key: 'print',             label: 'Impressão' },
  { key: 'login',             label: 'Login' },
  { key: 'approved',          label: 'Aprovado' },
  { key: 'reproved',          label: 'Reprovado' },
  { key: 'resubmit',          label: 'Reenvio' },
  { key: 'workflow_update',   label: 'Fluxo' },
  { key: 'reviewer_note',     label: 'Nota revisor' },
  { key: 'delete',            label: 'Exclusão' },
  { key: 'restore',           label: 'Restauração' },
  { key: 'user_invited',      label: 'Usuário convidado' },
  { key: 'user_role_changed', label: 'Role alterado' },
  { key: 'user_deactivated',  label: 'Desativado' },
  { key: 'user_deleted',      label: 'Excluído' },
]

const ICON_MAP = {
  upload:            { cls: styles.iconUpload,   path: '<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>' },
  download:          { cls: styles.iconDownload, path: '<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>' },
  login:             { cls: styles.iconLogin,    path: '<path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3"/>' },
  logout:            { cls: styles.iconLogin,    path: '<path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>' },
  approved:          { cls: styles.iconApproved, path: '<path d="M20 6L9 17l-5-5"/>' },
  reproved:          { cls: styles.iconReproved, path: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>' },
  print:             { cls: styles.iconPrint,    path: '<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>' },
  delete:            { cls: styles.iconDelete,   path: '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/>' },
  restore:           { cls: styles.iconApproved, path: '<path d="M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8"/><path d="M3 3v5h5"/>' },
  resubmit:          { cls: styles.iconUpload,   path: '<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>' },
  workflow_update:   { cls: styles.iconWorkflow, path: '<circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 010 14.14M4.93 4.93a10 10 0 000 14.14"/>' },
  reviewer_note:     { cls: styles.iconNote,     path: '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>' },
  user_invited:      { cls: styles.iconLogin,    path: '<path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>' },
  user_role_changed: { cls: styles.iconWorkflow, path: '<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>' },
  user_deactivated:  { cls: styles.iconReproved, path: '<path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="14" y2="14"/><line x1="14" y1="8" x2="20" y2="14"/>' },
  user_deleted:      { cls: styles.iconDelete,   path: '<path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="14" y2="14"/><line x1="14" y1="8" x2="20" y2="14"/>' },
  password_reset_sent: { cls: styles.iconWorkflow, path: '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>' },
}

export default function LogsPage() {
  const [logs,        setLogs]        = useState([])
  const [loading,     setLoading]     = useState(true)
  const [filter,      setFilter]      = useState(null)
  const [search,      setSearch]      = useState('')
  const [dateFrom,    setDateFrom]    = useState('')
  const [dateTo,      setDateTo]      = useState('')
  const [page,        setPage]        = useState(1)
  const [total,       setTotal]       = useState(0)
  const [exporting,   setExporting]   = useState(false)
  const PER_PAGE = 50

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    const { data, count } = await logsService.list({
      type: filter,
      search: search.trim(),
      page,
      perPage: PER_PAGE,
      dateFrom: dateFrom || null,
      dateTo: dateTo ? dateTo + 'T23:59:59' : null,
    })
    setLogs(data || [])
    setTotal(count || 0)
    setLoading(false)
  }, [filter, search, page, dateFrom, dateTo])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  async function handleExportCSV() {
    setExporting(true)
    try {
      const filename = `logs_${format(new Date(), 'yyyy-MM-dd')}.csv`
      await logsService.exportCSV({ type: filter, search: search.trim(), dateFrom, dateTo }, filename)
      toast.success('CSV exportado com sucesso.')
    } catch {
      toast.error('Erro ao exportar CSV.')
    } finally {
      setExporting(false)
    }
  }

  const icon = (type) => ICON_MAP[type] || ICON_MAP.login

  return (
    <div>
      <PageHeader
        title="Logs de auditoria"
        subtitle={`${total} evento${total !== 1 ? 's' : ''} registrado${total !== 1 ? 's' : ''}`}
        actions={
          <button
            onClick={handleExportCSV}
            disabled={exporting}
            className={styles.btnExport}
          >
            <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
            </svg>
            {exporting ? 'Exportando…' : 'Exportar CSV'}
          </button>
        }
      />

      {/* Filtros de tipo */}
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

      {/* Filtros avançados */}
      <div className={styles.advancedFilters}>
        <input
          type="text"
          placeholder="Buscar nos detalhes…"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          className={styles.searchInput}
        />
        <div className={styles.dateRange}>
          <label>De</label>
          <input
            type="date"
            value={dateFrom}
            onChange={e => { setDateFrom(e.target.value); setPage(1) }}
            className={styles.dateInput}
          />
          <label>Até</label>
          <input
            type="date"
            value={dateTo}
            onChange={e => { setDateTo(e.target.value); setPage(1) }}
            className={styles.dateInput}
          />
          {(dateFrom || dateTo || search) && (
            <button
              className={styles.btnClearFilters}
              onClick={() => { setDateFrom(''); setDateTo(''); setSearch(''); setPage(1) }}
            >
              Limpar
            </button>
          )}
        </div>
      </div>

      <div className={styles.logWrap}>
        {loading ? (
          <div className={styles.loadingWrap}><span className="spinner dark" /></div>
        ) : logs.length === 0 ? (
          <EmptyState
            title="Nenhum log encontrado"
            subtitle="Tente outro filtro ou período."
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
                <div className={styles.meta}>
                  {l.profiles?.name || 'Sistema'}
                  {l.profiles?.role && <span className={styles.roleTag}>{l.profiles.role}</span>}
                  {l.prontuario_id && <span className={styles.prontuarioTag}>prontuário</span>}
                </div>
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
