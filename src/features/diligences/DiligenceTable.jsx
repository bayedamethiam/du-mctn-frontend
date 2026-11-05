import { Edit2, Trash2 } from 'lucide-react';
import { Card, Badge, Btn, EmptyState } from '../../components/UI.jsx';
import { T, alpha } from '../../theme.js';

/* Vue « Liste » : le tableau historique de la page, déplacé tel quel (styles en ligne d'origine).
 * `refData` : référentiels (le nom `ref` est réservé par React pour les props). */
export function DiligenceTable({ rows, refData: ref, isLate, search, canEdit, canDelete, nextStatus, cycleStatus, openEdit, remove }) {
  return (
    <Card>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${T.border}` }}>
            {['Diligence', 'Source', 'Échéance', 'Responsable', 'Priorité', 'Statut', 'Actions'].map(h => (
              <th key={h} style={{ fontFamily: 'DM Sans', fontSize: 11, fontWeight: 700, color: T.textDim, letterSpacing: 1.5, textTransform: 'uppercase', padding: '12px 16px', textAlign: 'left' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0
            ? <tr><td colSpan={7}><EmptyState title="Aucun résultat" subtitle={search ? `Aucune diligence pour "${search}"` : 'Aucune diligence à afficher'} /></td></tr>
            : rows.map(d => {
              const next = nextStatus(d);
              const late = isLate(d);
              return (
                <tr key={d.id} style={{ borderBottom: `1px solid ${T.border}`, transition: 'background 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = T.surface2}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '13px 16px' }}>
                    <div style={{ fontFamily: 'DM Sans', fontSize: 13, fontWeight: 500, color: T.text }}>{d.title}</div>
                    <div style={{ fontFamily: 'DM Sans', fontSize: 11, color: T.textDim, marginTop: 2 }}>{ref.label('diligence_type', d.type)}</div>
                    {d.notes && <div title={d.notes} style={{ fontFamily: 'DM Sans', fontSize: 11, color: T.textMuted, marginTop: 4, maxWidth: 360, whiteSpace: 'pre-line', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>📝 {d.notes}</div>}
                  </td>
                  <td style={{ padding: '13px 16px', fontFamily: 'DM Sans', fontSize: 12, color: T.textMuted }}>{d.source}</td>
                  <td style={{ padding: '13px 16px', whiteSpace: 'nowrap' }}>
                    {d.deadline ? (
                      <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 3 }}>
                        <span style={{ fontFamily: 'DM Sans', fontSize: 12, color: late ? T.danger : T.textMuted, fontWeight: late ? 700 : 400 }}>{d.deadline}</span>
                        {late && <span style={{ fontSize: 10, fontFamily: 'DM Sans', fontWeight: 700, color: T.danger, background: alpha(T.danger, 12), borderRadius: 4, padding: '1px 6px', letterSpacing: 0.5 }}>⚠ En retard</span>}
                      </div>
                    ) : <span style={{ color: T.textDim, fontSize: 12, fontFamily: 'DM Sans' }}>-</span>}
                  </td>
                  <td style={{ padding: '13px 16px', fontFamily: 'DM Sans', fontSize: 12, color: T.textMuted }}>{d.responsible}</td>
                  <td style={{ padding: '13px 16px' }}><Badge status={d.priority} domain="priority" /></td>
                  <td style={{ padding: '13px 16px' }}><Badge status={d.status} domain="diligence_status" /></td>
                  <td style={{ padding: '13px 16px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {canEdit && <Btn onClick={() => openEdit(d)} variant="ghost" color={T.teal} size="sm"><Edit2 size={12} /></Btn>}
                      {canEdit && next && (
                        <span title={`Passer à : ${next.label}`}>
                          <Btn onClick={() => cycleStatus(d)} variant="ghost" color={next.color || T.success} size="sm">
                            {ref.has('diligence_status', next.code, 'done') ? '✓' : '↩'}
                          </Btn>
                        </span>
                      )}
                      {canDelete && <Btn onClick={() => remove(d)} variant="ghost" color={T.danger} size="sm"><Trash2 size={12} /></Btn>}
                    </div>
                  </td>
                </tr>
              );
            })}
        </tbody>
      </table>
    </Card>
  );
}
