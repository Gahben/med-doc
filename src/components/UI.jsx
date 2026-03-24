import styles from './UI.module.css'

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className={styles.pageHeader}>
      <div>
        <h1 className={styles.pageTitle}>{title}</h1>
        {subtitle && <p className={styles.pageSubtitle}>{subtitle}</p>}
      </div>
      {actions && <div className={styles.pageActions}>{actions}</div>}
    </div>
  )
}

export function BtnAccent({ children, onClick, disabled, type = 'button', small }) {
  return (
    <button
      type={type}
      className={`${styles.btnAccent} ${small ? styles.small : ''}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  )
}

export function BtnSec({ children, onClick, disabled, type = 'button', small }) {
  return (
    <button
      type={type}
      className={`${styles.btnSec} ${small ? styles.small : ''}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  )
}

export function BtnDanger({ children, onClick, disabled, type = 'button', small }) {
  return (
    <button
      type={type}
      className={`${styles.btnDanger} ${small ? styles.small : ''}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  )
}

export function Badge({ status }) {
  const map = {
    pending:  { label: 'Aguardando',  cls: styles.badgePending },
    approved: { label: 'Liberado',    cls: styles.badgeApproved },
    reproved: { label: 'Não liberado',cls: styles.badgeReproved },
    trash:    { label: 'Lixeira',     cls: styles.badgeTrash },
    locked:   { label: 'Protegido',   cls: styles.badgeLocked },
  }
  const b = map[status] || map.pending
  return <span className={`${styles.badge} ${b.cls}`}>{b.label}</span>
}

export function RoleBadge({ role }) {
  const map = {
    admin:    styles.roleAdmin,
    revisor:  styles.roleRevisor,
    operador: styles.roleOperador,
  }
  return <span className={`${styles.badge} ${map[role] || ''}`}>{role}</span>
}

export function Card({ children, className }) {
  return <div className={`${styles.card} ${className || ''}`}>{children}</div>
}

export function EmptyState({ icon, title, subtitle }) {
  return (
    <div className={styles.emptyState}>
      {icon && <div className={styles.emptyIcon}>{icon}</div>}
      <h3>{title}</h3>
      {subtitle && <p>{subtitle}</p>}
    </div>
  )
}

export function LoadingRows({ cols = 5, rows = 5 }) {
  return Array.from({ length: rows }).map((_, i) => (
    <tr key={i} className={styles.skeletonRow}>
      {Array.from({ length: cols }).map((_, j) => (
        <td key={j}><span className={styles.skeleton} /></td>
      ))}
    </tr>
  ))
}

export function Modal({ open, onClose, title, children, width = 480 }) {
  if (!open) return null
  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div
        className={styles.modalBox}
        style={{ maxWidth: width }}
        onClick={e => e.stopPropagation()}
      >
        <div className={styles.modalHeader}>
          <h3>{title}</h3>
          <button className={styles.modalClose} onClick={onClose}>
            <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div className={styles.modalBody}>{children}</div>
      </div>
    </div>
  )
}

export function Field({ label, children, required }) {
  return (
    <div className={styles.field}>
      <label className={styles.fieldLabel}>
        {label}{required && <span className={styles.required}> *</span>}
      </label>
      {children}
    </div>
  )
}

export function Input(props) {
  return <input className={styles.input} {...props} />
}

export function Select({ children, ...props }) {
  return <select className={styles.select} {...props}>{children}</select>
}

export function Textarea(props) {
  return <textarea className={styles.textarea} {...props} />
}
