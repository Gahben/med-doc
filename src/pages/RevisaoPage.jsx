import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/storage'  // ← CORRIGIDO
import { useAuth } from '../hooks/useAuth'
import { useAuditLog } from '../hooks/useAuditLog'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import toast from 'react-hot-toast'

export default function RevisaoPage() {
  const { user } = useAuth()
  const { log }  = useAuditLog()

  const [fila,    setFila]    = useState([])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  // Prontuário sendo revisado
  const [current,    setCurrent]    = useState(null)
  const [fileUrl,    setFileUrl]    = useState('')
  const [loadingUrl, setLoadingUrl] = useState(false)
  const [obs,        setObs]        = useState('')
  const [saving,     setSaving]     = useState(false)

  /* ─── busca a fila de pendentes ─────────────────────────────────── */
  const fetchFila = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const { data, error: err } = await supabase
      .from('prontuarios')
      .select('*, profiles(name, role)')  // ← CORRIGIDO: adicionar join com profiles
      .eq('status', 'pending')            // ← CORRIGIDO: 'pending' em vez de 'pendente'
      .order('created_at', { ascending: true }) // mais antigos primeiro

      if (err) throw err
        console.log('📋 Fila de revisão:', data?.length || 0)
        setFila(data ?? [])
    } catch (err) {
      console.error('RevisaoPage fetchFila:', err)
      setError('Não foi possível carregar a fila. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchFila()
  }, [fetchFila])

  /* ─── abre um prontuário para revisão ────────────────────────────── */
  async function openReview(row) {
    setCurrent(row)
    setObs('')
    setFileUrl('')
    if (row.file_path) {  // ← CORRIGIDO: file_path em vez de arquivo_path
      setLoadingUrl(true)
      try {
        const { data } = await supabase.storage
        .from('prontuarios')
        .createSignedUrl(row.file_path, 60 * 60)
        setFileUrl(data?.signedUrl ?? '')
      } catch {
        setFileUrl('')
      } finally {
        setLoadingUrl(false)
      }
    }
  }

  function closeReview() {
    setCurrent(null)
    setFileUrl('')
    setObs('')
  }

  /* ─── decisão (aprovar / reprovar) ──────────────────────────────── */
  async function decidir(novoStatus) {
    if (!current) return
      setSaving(true)
      try {
        const updateData = {
          status: novoStatus,
          reviewed_at: new Date().toISOString(),
        }

        // Se tiver observação, adiciona
        if (obs.trim()) {
          updateData.review_note = obs.trim()
        }

        const { error: err } = await supabase
        .from('prontuarios')
        .update(updateData)
        .eq('id', current.id)

        if (err) throw err

          // Log de auditoria
          await log('revisao', `Prontuário ${current.record_number} foi ${novoStatus === 'approved' ? 'aprovado' : 'reprovado'}`, current.id)

          toast.success(novoStatus === 'approved' ? 'Prontuário aprovado!' : 'Prontuário reprovado.')
          closeReview()
          fetchFila() // atualiza a fila
      } catch (err) {
        console.error('RevisaoPage decidir:', err)
        toast.error('Erro ao salvar revisão. Tente novamente.')
      } finally {
        setSaving(false)
      }
  }

  /* ─── render ─────────────────────────────────────────────────────── */
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
    <div className="flex items-center justify-between">
    <h1 className="text-xl font-semibold text-gray-900">Fila de Revisão</h1>
    <button
    onClick={fetchFila}
    disabled={loading}
    className="text-sm text-blue-600 hover:text-blue-800 font-medium transition disabled:opacity-50"
    >
    ↻ Atualizar
    </button>
    </div>

    {/* Erro */}
    {error && (
      <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
      {error}
      </p>
    )}

    {/* Lista */}
    {loading ? (
      <div className="flex justify-center items-center py-20 text-sm text-gray-400">
      Carregando fila…
      </div>
    ) : fila.length === 0 ? (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-2">
      <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-300" fill="none"
      viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round"
      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <p className="text-sm text-gray-400">Nenhum prontuário pendente de revisão.</p>
      </div>
    ) : (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wider">
      {fila.length} prontuário{fila.length !== 1 ? 's' : ''} aguardando
      </div>
      <ul className="divide-y divide-gray-50">
      {fila.map(row => (
        <li key={row.id}
        className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition">
        <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">
        {row.patient_name || '(sem nome)'}  {/* ← CORRIGIDO */}
        </p>
        <p className="text-xs text-gray-400 mt-0.5">
        Nº {row.record_number || '—'} · {row.document_type || '—'} · enviado por {row.profiles?.name || '—'} ·{' '}
        {row.created_at
          ? format(new Date(row.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
          : '—'}
          </p>
          </div>
          <button
          onClick={() => openReview(row)}
          className="ml-4 flex-shrink-0 bg-blue-600 hover:bg-blue-700 text-white
          text-xs font-medium px-3 py-1.5 rounded-lg transition"
          >
          Revisar
          </button>
          </li>
      ))}
      </ul>
      </div>
    )}

    {/* Modal de revisão */}
    {current && (
      <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={closeReview}
      >
      <div
      className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4"
      onClick={e => e.stopPropagation()}
      >
      <div className="flex items-start justify-between">
      <h2 className="text-lg font-semibold text-gray-900">Revisar Prontuário</h2>
      <button onClick={closeReview}
      className="text-gray-400 hover:text-gray-600 transition text-xl leading-none">
      ×
      </button>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
      <div>
      <dt className="text-gray-500">Paciente</dt>
      <dd className="font-medium text-gray-900">{current.patient_name || '—'}</dd>
      </div>
      <div>
      <dt className="text-gray-500">CPF</dt>
      <dd className="font-mono text-gray-900">{current.patient_cpf || '—'}</dd>
      </div>
      <div>
      <dt className="text-gray-500">Número</dt>
      <dd className="font-mono text-gray-900">{current.record_number || '—'}</dd>
      </div>
      <div>
      <dt className="text-gray-500">Tipo</dt>
      <dd className="text-gray-900">{current.document_type || '—'}</dd>
      </div>
      <div>
      <dt className="text-gray-500">Páginas</dt>
      <dd className="text-gray-900">{current.pages || '—'}</dd>
      </div>
      <div>
      <dt className="text-gray-500">Enviado por</dt>
      <dd className="text-gray-900">{current.profiles?.name || '—'}</dd>
      </div>
      <div className="col-span-2">
      <dt className="text-gray-500">Enviado em</dt>
      <dd className="text-gray-900">
      {current.created_at
        ? format(new Date(current.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
        : '—'}
        </dd>
        </div>
        {current.upload_note && (
          <div className="col-span-2">
          <dt className="text-gray-500">Obs. do upload</dt>
          <dd className="text-gray-900 whitespace-pre-wrap">{current.upload_note}</dd>
          </div>
        )}
        </dl>

        {/* Link para o arquivo */}
        {current.file_path && (
          <div>
          {loadingUrl ? (
            <span className="text-sm text-gray-400">Gerando link do arquivo…</span>
          ) : fileUrl ? (
            <a href={fileUrl} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-blue-600
            hover:text-blue-800 font-medium transition">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none"
            viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round"
            d="M2.458 12C3.732 7.943 7.523 5 12 5
            c4.478 0 8.268 2.943 9.542 7
            -1.274 4.057-5.064 7-9.542 7
            -4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            Abrir arquivo do prontuário
            </a>
          ) : (
            <span className="text-sm text-gray-400">Arquivo não disponível.</span>
          )}
          </div>
        )}

        {/* Observações */}
        <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
        Observações da revisão (opcional)
        </label>
        <textarea
        rows={3}
        value={obs}
        onChange={e => setObs(e.target.value)}
        placeholder="Justificativa da decisão, pendências…"
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
        resize-none"
        />
        </div>

        {/* Botões de decisão */}
        <div className="flex gap-3 pt-1">
        <button
        onClick={() => decidir('reproved')}  // ← CORRIGIDO
        disabled={saving}
        className="flex-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200
        text-sm font-medium py-2 rounded-lg transition disabled:opacity-50"
        >
        {saving ? '…' : '✕ Reprovar'}
        </button>
        <button
        onClick={() => decidir('approved')}  // ← CORRIGIDO
        disabled={saving}
        className="flex-1 bg-green-600 hover:bg-green-700 text-white
        text-sm font-medium py-2 rounded-lg transition disabled:opacity-50"
        >
        {saving ? '…' : '✓ Aprovar'}
        </button>
        </div>
        </div>
        </div>
    )}
    </div>
  )
}
