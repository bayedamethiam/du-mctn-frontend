/* Dates serveur : « YYYY-MM-DD HH:MM:SS » (SQLite, UTC) ou ISO 8601 */
export function parseServerDate(v) {
  if (!v) return null;
  if (v instanceof Date) return v;
  const s = String(v);
  const d = new Date(/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(s) ? s.replace(' ', 'T') + 'Z' : s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function fmtDateTime(v, fallback = '-') {
  const d = parseServerDate(v);
  return d ? d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : fallback;
}

export const isFuture = v => { const d = parseServerDate(v); return !!d && d.getTime() > Date.now(); };

/* « Chrome · Windows » à partir d'un user-agent */
export function shortUserAgent(ua) {
  if (!ua) return 'Appareil inconnu';
  const browser =
    /Edg\//.test(ua)                    ? 'Edge' :
    /OPR\/|Opera/.test(ua)              ? 'Opera' :
    /Firefox\//.test(ua)                ? 'Firefox' :
    /Chrome\/|CriOS\//.test(ua)         ? 'Chrome' :
    /Safari\//.test(ua)                 ? 'Safari' :
    /curl|node|axios|PostmanRuntime/i.test(ua) ? 'Client API' : 'Navigateur';
  const os =
    /Windows/.test(ua)                  ? 'Windows' :
    /Android/.test(ua)                  ? 'Android' :
    /iPhone|iPad|iPod/.test(ua)         ? 'iOS' :
    /Mac OS X|Macintosh/.test(ua)       ? 'macOS' :
    /Linux/.test(ua)                    ? 'Linux' : '';
  return os ? `${browser} · ${os}` : browser;
}
