/**
 * Утиліти для безпечної роботи з DOM та санітизації
 */

export function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = String(str ?? '');
    return div.innerHTML;
}

export function $(id) {
    return document.getElementById(id);
}

export function show(el) {
    if (typeof el === 'string') el = $(el);
    if (el) el.classList.remove('hidden');
}

export function hide(el) {
    if (typeof el === 'string') el = $(el);
    if (el) el.classList.add('hidden');
}
