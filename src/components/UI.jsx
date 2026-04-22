import { T, statusConf } from '../theme.js';

export const Card = ({ children, style = {}, hover = false, onClick }) => (
  <div onClick={onClick}
    style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, overflow: 'hidden', cursor: onClick ? 'pointer' : 'default', transition: hover ? 'all 0.2s ease' : undefined, ...style }}
    onMouseEnter={hover ? e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 30px rgba(6,182,212,0.15)'; } : undefined}
    onMouseLeave={hover ? e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; } : undefined}>
    {children}
  </div>
);

export const Badge = ({ status, size = 'sm' }) => {
  const c = statusConf[status] || { bg: T.surface2, color: T.textMuted, label: status };
  return (
    <span style={{ background: c.bg, color: c.color, padding: size === 'sm' ? '2px 8px' : '4px 12px', borderRadius: 20, fontSize: size === 'sm' ? 11 : 12, fontWeight: 600, fontFamily: 'DM Sans', letterSpacing: 0.3, whiteSpace: 'nowrap' }}>
      {c.label}
    </span>
  );
};

export const ProgressBar = ({ value, color = T.teal, height = 4 }) => (
  <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: height, height, overflow: 'hidden' }}>
    <div style={{ width: `${Math.min(100, value || 0)}%`, height: '100%', background: `linear-gradient(90deg, ${color}99, ${color})`, borderRadius: height, transition: 'width 0.6s ease' }} />
  </div>
);

export const Input = ({ placeholder, value, onChange, icon: Icon, style = {}, type = 'text', disabled }) => (
  <div style={{ position: 'relative', ...style }}>
    {Icon && <Icon size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: T.textDim, pointerEvents: 'none' }} />}
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} disabled={disabled}
      style={{ width: '100%', background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8, padding: `10px ${Icon ? 36 : 14}px 10px ${Icon ? 36 : 14}px`, color: T.text, fontSize: 13, fontFamily: 'DM Sans', outline: 'none' }} />
  </div>
);

export const Btn = ({ children, onClick, color = T.teal, variant = 'solid', size = 'md', disabled, style = {} }) => {
  const base = { display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'DM Sans', fontSize: size === 'sm' ? 12 : 13, fontWeight: 600, padding: size === 'sm' ? '6px 12px' : '9px 18px', borderRadius: 8, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1, border: 'none', transition: 'all 0.2s', ...style };
  if (variant === 'solid')   return <button onClick={onClick} disabled={disabled} style={{ ...base, background: `linear-gradient(135deg,${color},${color}cc)`, color: '#fff' }}>{children}</button>;
  if (variant === 'outline') return <button onClick={onClick} disabled={disabled} style={{ ...base, background: 'transparent', border: `1px solid ${color}`, color }}>{children}</button>;
  return <button onClick={onClick} disabled={disabled} style={{ ...base, background: `${color}15`, color }}>{children}</button>;
};

export const Select = ({ value, onChange, children, style = {} }) => (
  <select value={value} onChange={e => onChange(e.target.value)}
    style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8, padding: '10px 12px', color: T.text, fontSize: 13, fontFamily: 'DM Sans', outline: 'none', cursor: 'pointer', ...style }}>
    {children}
  </select>
);

export const Textarea = ({ value, onChange, placeholder, rows = 3, style = {} }) => (
  <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows}
    style={{ width: '100%', background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8, padding: '10px 12px', color: T.text, fontSize: 13, fontFamily: 'DM Sans', resize: 'vertical', outline: 'none', ...style }} />
);

export const Spinner = ({ size = 20, color = T.teal }) => (
  <div style={{ width: size, height: size, border: `2px solid ${color}33`, borderTop: `2px solid ${color}`, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
);

export const ErrorBanner = ({ error, onDismiss }) => error ? (
  <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '12px 16px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
    <span style={{ fontFamily: 'DM Sans', fontSize: 13, color: '#ef4444' }}>⚠ {error}</span>
    {onDismiss && <button onClick={onDismiss} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 18 }}>×</button>}
  </div>
) : null;

export const EmptyState = ({ icon: Icon, title, subtitle }) => (
  <div style={{ padding: '48px 24px', textAlign: 'center' }}>
    {Icon && <div style={{ marginBottom: 12, opacity: 0.3 }}><Icon size={40} color={T.teal} style={{ margin: '0 auto' }} /></div>}
    <div style={{ fontFamily: 'EB Garamond', fontSize: 20, color: T.textMuted, marginBottom: 6 }}>{title}</div>
    {subtitle && <div style={{ fontFamily: 'DM Sans', fontSize: 13, color: T.textDim }}>{subtitle}</div>}
  </div>
);

export const Modal = ({ open, onClose, title, children, width = 520 }) => {
  if (!open) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <Card style={{ width, maxHeight: '90vh', overflowY: 'auto', padding: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ fontFamily: 'EB Garamond', fontSize: 22, color: T.text }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: T.textMuted, cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>×</button>
        </div>
        {children}
      </Card>
    </div>
  );
};

export const ModalFooter = ({ onCancel, onConfirm, confirmLabel = 'Enregistrer', loading, color = T.teal }) => (
  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
    <Btn onClick={onCancel} variant="outline" color={T.textMuted}>Annuler</Btn>
    <Btn onClick={onConfirm} disabled={loading} color={color}>
      {loading ? <Spinner size={14} color="#fff" /> : confirmLabel}
    </Btn>
  </div>
);
