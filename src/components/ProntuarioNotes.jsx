import { useState, useEffect, useRef, useCallback } from 'react'
import { prontuarioNotesService, notificationsService, profilesService } from '../lib/storage'
import { useAuth } from '../hooks/useAuth'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import styles from './ProntuarioNotes.module.css'

const ROLE_LABEL = { admin: 'Admin', auditor: 'Auditor', revisor: 'Revisor', operador: 'Operador' }
const POLL_MS = 20_000

/**
 * Painel de notas compartilhadas de um prontuário.
 * Uso: <ProntuarioNotes prontuarioId={id} prontuario={row} />
 */
export default function ProntuarioNotes({ prontuarioId, prontuario }) {
  const { user, profile } = useAuth()
  const [notes,    setNotes]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [body,     setBody]     = useState('')
  const [sending,  setSending]  = useState(false)
  const [allUsers, setAllUsers] = useState([])   // para @mention autocomplete
  const [mention,  setMention]  = useState(null) // { query, start } ou null
  const bottomRef  = useRef(null)
  const textareaRef = useRef(null)
  const timerRef   = useRef(null)

  // Carrega lista de usuários uma vez (para @mention)
  useEffect(() => {
    profilesService.list().then(({ data }) => setAllUsers(data ?? []))
  }, [])

  const loadNotes = useCallback(async () => {
    if (!prontuarioId) return
    const { data } = await prontuarioNotesService.list(prontuarioId)
    setNotes(data ?? [])
    setLoading(false)
  }, [prontuarioId])

  useEffect(() => {
    setLoading(true)
    loadNotes()
    timerRef.current = setInterval(loadNotes, POLL_MS)
    return () => clearInterval(timerRef.current)
  }, [loadNotes])

  // Scroll para o fim quando novas notas chegam
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [notes.length])

  // Detecta @mention enquanto digita
  function handleTextChange(e) {
    const val = e.target.value
    setBody(val)

    const cursor = e.target.selectionStart
    const textBefore = val.slice(0, cursor)
    const match = textBefore.match(/@(\w*)$/)
    if (match) {
      setMention({ query: match[1].toLowerCase(), start: match.index })
    } else {
      setMention(null)
    }
  }

  // Usuários filtrados para o autocomplete
  const mentionCandidates = mention
    ? allUsers.filter(u =>
        u.id !== user?.id &&
        (u.name.toLowerCase().includes(mention.query) ||
         u.role.toLowerCase().includes(mention.query))
      ).slice(0, 5)
    : []

  function insertMention(u) {
    const before = body.slice(0, mention.start)
    const after  = body.slice(textareaRef.current.selectionStart)
    setBody(`${before}@${u.name} ${after}`)
    setMention(null)
    textareaRef.current?.focus()
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const text = body.trim()
    if (!text || sending) return
    setSending(true)

    // Extrai UUIDs mencionados
    const mentionedIds = allUsers
      .filter(u => text.includes(`@${u.name}`))
      .map(u => u.id)

    const { data: note, error } = await prontuarioNotesService.create(
      prontuarioId, user.id, text, mentionedIds
    )

    if (!error && note) {
      setNotes(prev => [...prev, note])
      setBody('')

      // Notifica mencionados
      if (mentionedIds.length && prontuario) {
        const ref = `${prontuario.record_number} – ${prontuario.patient_name}`
        await notificationsService.createForUsers(
          mentionedIds.filter(id => id !== user.id),
          {
            prontuario_id: prontuarioId,
            type: 'mention',
            message: `${profile?.name} te mencionou em ${ref}`,
          }
        )
      }
    }
    setSending(false)
  }

  function handleKeyDown(e) {
    // Envia com Ctrl+Enter ou Cmd+Enter
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') handleSubmit(e)
    // Esc fecha mention
    if (e.key === 'Escape') setMention(null)
  }

  async function handleDelete(noteId) {
    await prontuarioNotesService.remove(noteId)
    setNotes(prev => prev.filter(n => n.id !== noteId))
  }

  if (!prontuarioId) return null

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <span className={styles.title}>💬 Notas do prontuário</span>
        <span className={styles.count}>{notes.length}</span>
      </div>

      <div className={styles.feed}>
        {loading && <p className={styles.empty}>Carregando…</p>}
        {!loading && notes.length === 0 && (
          <p className={styles.empty}>Nenhuma nota ainda. Seja o primeiro.</p>
        )}
        {notes.map(n => {
          const isOwn = n.author_id === user?.id
          return (
            <div key={n.id} className={`${styles.note} ${isOwn ? styles.own : ''}`}>
              <div className={styles.noteMeta}>
                <span className={styles.noteAuthor}>{n.profiles?.name}</span>
                <span className={`${styles.noteRole} ${styles['role_' + n.profiles?.role]}`}>
                  {ROLE_LABEL[n.profiles?.role] ?? n.profiles?.role}
                </span>
                <span className={styles.noteTime}>
                  {format(new Date(n.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                </span>
                {isOwn && (
                  <button
                    className={styles.deleteBtn}
                    onClick={() => handleDelete(n.id)}
                    title="Remover nota"
                  >×</button>
                )}
              </div>
              <div className={styles.noteBody}>
                {renderBody(n.body, allUsers)}
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Compose */}
      <div className={styles.compose}>
        {mention && mentionCandidates.length > 0 && (
          <ul className={styles.mentionList}>
            {mentionCandidates.map(u => (
              <li key={u.id} onMouseDown={() => insertMention(u)}>
                <strong>{u.name}</strong>
                <span className={styles.mentionRole}>{ROLE_LABEL[u.role]}</span>
              </li>
            ))}
          </ul>
        )}
        <textarea
          ref={textareaRef}
          className={styles.textarea}
          value={body}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          placeholder="Adicione uma nota… use @Nome para mencionar"
          rows={2}
          disabled={sending}
        />
        <div className={styles.composeFooter}>
          <span className={styles.hint}>Ctrl+Enter para enviar</span>
          <button
            className={styles.sendBtn}
            onClick={handleSubmit}
            disabled={!body.trim() || sending}
          >
            {sending ? 'Enviando…' : 'Enviar nota'}
          </button>
        </div>
      </div>
    </div>
  )
}

/** Renderiza o body destacando @menções */
function renderBody(text, users) {
  const parts = text.split(/(@\S+)/g)
  return parts.map((part, i) => {
    if (part.startsWith('@')) {
      const name = part.slice(1)
      const found = users.find(u => u.name === name)
      if (found) return <mark key={i} className="mention">{part}</mark>
    }
    return <span key={i}>{part}</span>
  })
}
