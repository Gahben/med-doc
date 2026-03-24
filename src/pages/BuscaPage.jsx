import { useState, useEffect, useCallback } from 'react'
import { supabase, prontuariosService } from '../lib/storage'  // ← CORRIGIDO
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const PAGE_SIZE = 20

const STATUS_LABEL = {
  pending:  { label: 'Pendente',  color: 'bg-yellow-100 text-yellow-800' },
  approved: { label: 'Aprovado',  color: 'bg-green-100 text-green-800'  },
  reproved: { label: 'Reprovado', color: 'bg-red-100 text-red-800'    },
}

export default function BuscaPage() {
  const [query,   setQuery]   = useState('')
  const [status,  setStatus]  = useState('')
  const [page,    setPage]    = useState(0)
  const [rows,    setRows]    = useState([])
  const [total,   setTotal]   = useState(0)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  // Modal de detalhe
  const [selected, setSelected] = useState(null)
  const [fileUrl,  setFileUrl]  = useState('')

  /* ─── busca ─────────────────────────────────────────────────────── */
  const fetchProntuarios = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      // Monta a query base
      let q = supabase
      .from('prontuarios')
      .select('*, profiles(name, role)', { count: 'exact' })  // ← CORRIGIDO: incluir profiles
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)

      // Filtro de texto (nome do paciente ou número) - CORRIGIDO nomes das colunas
      if (query.trim()) {
        q = q.or(
          `patient_name.ilike.%${query.trim()}%,record_number.ilike.%${query.trim()}%`
        )
      }

      // Filtro de status
      if (status && status !== 'todos') {
        q = q.eq('status', status)
      }

      const { data, count, error: err } = await q

      if (err) throw err

        console.log('📋 Prontuários encontrados:', data?.length || 0)
        setRows(data ?? [])
        setTotal(count ?? 0)
    } catch (err) {
      console.error('BuscaPage fetchProntuarios:', err)
      setError('Não foi possível carregar os prontuários. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }, [query, status, page])

  // Executa ao montar e quando os filtros/página mudam
  useEffect(() => {
    fetchProntuarios()
  }, [fetchProntuarios])

  // Quando o filtro muda, volta para a primeira página
  function handleFilterChange(field, value) {
    setPage(0)
    if (field === 'query')  setQuery(value)
      if (field === 'status') setStatus(value)
  }

  /* ─── modal de detalhe ──────────────────────────────────────────── */
  async function openDetail(row) {
    setSelected(row)
    setFileUrl('')
    if (row.file_path) {  // ← CORRIGIDO: file_path ao invés de arquivo_path
      const { data } = await supabase.storage
      .from('prontuarios')
      .createSignedUrl(row.file_path, 60 * 60) // 1 hora
      setFileUrl(data?.signedUrl ?? '')
    }
  }

  function closeDetail() {
    setSelected(null)
    setFileUrl('')
  }

  /* ─── render ─────────────────────────────────────────────────────── */
  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
    <h1 className="text-xl font-semibold text-gray-900">Busca de Prontuários</h1>

    {/* Filtros */}
    <div className="flex flex-wrap gap-3">
    <input
    type="text"
    placeholder="Paciente ou número do prontuário…"
    value={query}
    onChange={e => handleFilterChange('query', e.target.value)}
    className="flex-1 min-w-[220px] rounded-lg border border-gray-300 px-3 py-2 text-sm
    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
    />
    <select
    value={status}
    onChange={e => handleFilterChange('status', e.target.value)}
    className="rounded-lg border border-gray-300 px-3 py-2 text-sm
    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
    >
    <option value="">Todos os status</option>
    <option value="pending">Pendente</option>
    <option value="approved">Aprovado</option>
    <option value="reproved">Reprovado</option>
    </select>
    <button
    onClick={fetchProntuarios}
    className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium
    px-4 py-2 rounded-lg transition"
    >
    Buscar
    </button>
    </div>

    {/* Erro */}
    {error && (
      <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
      {error}
      </p>
    )}

    {/* Tabela */}
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
    {loading ? (
      <div className="flex justify-center items-center py-20 text-sm text-gray-400">
      Carregando…
      </div>
    ) : rows.length === 0 ? (
      <div className="flex justify-center items-center py-20 text-sm text-gray-400">
      Nenhum prontuário encontrado.
      </div>
    ) : (
      <table className="w-full text-sm">
      <thead>
      <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
      <th className="px-4 py-3">Paciente</th>
      <th className="px-4 py-3">Número</th>
      <th className="px-4 py-3">Tipo</th>
      <th className="px-4 py-3">Data</th>
      <th className="px-4 py-3">Status</th>
      <th className="px-4 py-3">Enviado por</th>
      <th className="px-4 py-3"></th>
      </tr>
      </thead>
      <tbody className="divide-y divide-gray-50">
      {rows.map(row => (
        <tr key={row.id} className="hover:bg-gray-50 transition">
        <td className="px-4 py-3 font-medium text-gray-900">
        {row.patient_name || '—'}
        </td>
        <td className="px-4 py-3 text-gray-600 font-mono">
        {row.record_number || '—'}
        </td>
        <td className="px-4 py-3 text-gray-500">
        {row.document_type || '—'}
        </td>
        <td className="px-4 py-3 text-gray-500">
        {row.document_date
          ? format(new Date(row.document_date), "dd/MM/yyyy", { locale: ptBR })
          : '—'}
          </td>
          <td className="px-4 py-3">
          {row.status ? (
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium
              ${STATUS_LABEL[row.status]?.color ?? 'bg-gray-100 text-gray-600'}`}>
              {STATUS_LABEL[row.status]?.label ?? row.status}
              </span>
          ) : '—'}
          </td>
          <td className="px-4 py-3 text-gray-500">
          {row.profiles?.name || '—'}
          </td>
          <td className="px-4 py-3 text-right">
          <button
          onClick={() => openDetail(row)}
          className="text-blue-600 hover:text-blue-800 text-xs font-medium transition"
          >
          Ver detalhe
          </button>
          </td>
          </tr>
      ))}
      </tbody>
      </table>
    )}
    </div>

    {/* Paginação */}
    {totalPages > 1 && (
      <div className="flex items-center justify-between text-sm text-gray-500">
      <span>{total} registro{total !== 1 ? 's' : ''} encontrado{total !== 1 ? 's' : ''}</span>
      <div className="flex gap-2">
      <button
      onClick={() => setPage(p => Math.max(0, p - 1))}
      disabled={page === 0}
      className="px-3 py-1.5 rounded-lg border border-gray-200 hover:border-gray-300
      disabled:opacity-40 disabled:cursor-not-allowed transition"
      >
      ← Anterior
      </button>
      <span className="px-3 py-1.5">
      {page + 1} / {totalPages}
      </span>
      <button
      onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
      disabled={page >= totalPages - 1}
      className="px-3 py-1.5 rounded-lg border border-gray-200 hover:border-gray-300
      disabled:opacity-40 disabled:cursor-not-allowed transition"
      >
      Próxima →
      </button>
      </div>
      </div>
    )}

    {/* Modal de detalhe */}
    {selected && (
      <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={closeDetail}
      >
      <div
      className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4"
      onClick={e => e.stopPropagation()}
      >
      <div className="flex items-start justify-between">
      <h2 className="text-lg font-semibold text-gray-900">Detalhe do Prontuário</h2>
      <button onClick={closeDetail} className="text-gray-400 hover:text-gray-600 transition text-xl leading-none">×</button>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
      <div>
      <dt className="text-gray-500">Paciente</dt>
      <dd className="font-medium text-gray-900">{selected.patient_name || '—'}</dd>
      </div>
      <div>
      <dt className="text-gray-500">CPF</dt>
      <dd className="font-mono text-gray-900">{selected.patient_cpf || '—'}</dd>
      </div>
      <div>
      <dt className="text-gray-500">Número</dt>
      <dd className="font-mono text-gray-900">{selected.record_number || '—'}</dd>
      </div>
      <div>
      <dt className="text-gray-500">Tipo</dt>
      <dd className="text-gray-900">{selected.document_type || '—'}</dd>
      </div>
      <div>
      <dt className="text-gray-500">Status</dt>
      <dd>
      {selected.status ? (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium
          ${STATUS_LABEL[selected.status]?.color ?? 'bg-gray-100 text-gray-600'}`}>
          {STATUS_LABEL[selected.status]?.label ?? selected.status}
          </span>
      ) : '—'}
      </dd>
      </div>
      <div>
      <dt className="text-gray-500">Data do doc.</dt>
      <dd className="text-gray-900">
      {selected.document_date
        ? format(new Date(selected.document_date), "dd/MM/yyyy", { locale: ptBR })
        : '—'}
        </dd>
        </div>
        <div>
        <dt className="text-gray-500">Páginas</dt>
        <dd className="text-gray-900">{selected.pages || '—'}</dd>
        </div>
        <div>
        <dt className="text-gray-500">Enviado por</dt>
        <dd className="text-gray-900">{selected.profiles?.name || '—'}</dd>
        </div>
        {selected.upload_note && (
          <div className="col-span-2">
          <dt className="text-gray-500">Obs. do upload</dt>
          <dd className="text-gray-900 whitespace-pre-wrap">{selected.upload_note}</dd>
          </div>
        )}
        {selected.review_note && (
          <div className="col-span-2">
          <dt className="text-gray-500">Obs. da revisão</dt>
          <dd className="text-gray-900 whitespace-pre-wrap">{selected.review_note}</dd>
          </div>
        )}
        </dl>

        {selected.file_path && (
          <div className="pt-2">
          {fileUrl ? (
            <a
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-blue-600
            hover:text-blue-800 font-medium transition"
            >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none"
            viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1
            m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Visualizar arquivo
            </a>
          ) : (
            <span className="text-sm text-gray-400">Gerando link…</span>
          )}
          </div>
        )}

        <div className="pt-2 flex justify-end">
        <button
        onClick={closeDetail}
        className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-700
        hover:border-gray-300 transition"
        >
        Fechar
        </button>
        </div>
        </div>
        </div>
    )}
    </div>
  )
}
