/**
 * Утиліти для роботи з датами матчів
 */

export function getMatchTimestamp(m) {
    if (!m) return 0;
    let rawTime = m.CreatedAt1 || m.UpdatedAt1 || m.CreatedAt2 || m.UpdatedAt2 || m["Created At"] || m["Updated At"] || m.created_at || m.updated_at;
    if (!rawTime) return 0;
    if (typeof rawTime === 'number') return rawTime * (rawTime < 1e10 ? 1000 : 1);
    if (typeof rawTime === 'string') {
        if (!isNaN(rawTime)) return parseInt(rawTime) * (parseInt(rawTime) < 1e10 ? 1000 : 1);
        return new Date(rawTime.replace(' UTC', 'Z')).getTime() || 0;
    }
    return 0;
}

export function formatMatchDate(m, formatType = 'short') {
    const ts = getMatchTimestamp(m);
    if (!ts) return "Невідома дата";
    const d = new Date(ts);
    if (isNaN(d.getTime())) return "Невідома дата";

    if (formatType === 'long') {
        const datePart = d.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' }).replace(' р.', '');
        const timePart = d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
        return `${datePart}, ${timePart}`;
    }

    return d.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short', year: 'numeric' }) + ', ' + d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
}
