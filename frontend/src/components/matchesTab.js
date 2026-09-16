/**
 * Вкладка "Історія матчів" (Matches)
 */

import { $, escapeHtml, show, hide } from '../utils/dom.js';
import { formatMatchDate } from '../utils/dates.js';
import { store } from '../state/store.js';

const MATCHES_PER_PAGE = 20;

export function initMatchesTab() {
    const loadMoreBtn = $('loadMoreMatchesBtn');
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', (e) => {
            e.preventDefault();
            loadMoreMatches();
        });
    }
}

export function renderMatchesTab(reset = false) {
    const tbody = $('matchHistoryTableBody');
    const loadMoreBtn = $('loadMoreMatchesBtn');
    const { matchHistory, displayedMatchesCount } = store.getState();

    if (!tbody) return;

    let count = displayedMatchesCount;
    if (reset) {
        tbody.innerHTML = '';
        count = 0;
    }

    if (!matchHistory || matchHistory.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-gray-500 font-bold">Немає зіграних матчів</td></tr>`;
        hide(loadMoreBtn);
        return;
    }

    const nextBatch = matchHistory.slice(count, count + MATCHES_PER_PAGE);
    count += nextBatch.length;
    store.setState({ displayedMatchesCount: count });

    const rowsHtml = nextBatch.map(m => {
        const isWin = (m.Result === "1" || m.Win === "true" || m.win === "1");
        const resText = isWin ? "W" : "L";
        const resColor = isWin ? "text-green-400" : "text-red-400";

        const kills = parseInt(m.Kills) || 0;
        const deaths = parseInt(m.Deaths) || 0;
        const assists = parseInt(m.Assists) || 0;

        const kd = (kills / (deaths || 1)).toFixed(2);
        const kdColor = kd >= 1 ? 'text-green-400' : 'text-red-400';

        const mapRaw = m.map || 'unknown';
        const safeMapName = mapRaw.replace('de_', '').toLowerCase().replace(/\s+/g, '');
        const mapDisplay = mapRaw.replace('de_', '');

        const score = m.score ? m.score.replace(' / ', ':') : '-:-';

        const hsVal = m["Headshots %"] || m.HeadshotsPc || '-';
        const hsText = hsVal !== '-' ? hsVal + '%' : '-';
        const dateStr = formatMatchDate(m);

        return `
        <tr class="hover:bg-gray-800/30 transition-colors group text-[11px] md:text-sm">
            <td class="py-3 pr-4 pl-2 text-gray-400 font-bold whitespace-nowrap">${escapeHtml(dateStr)}</td>
            <td class="py-3 pr-4">
                <div class="flex items-center gap-2 md:gap-3">
                    <img src="assets/maps/${encodeURIComponent(safeMapName)}.png" onerror="this.style.display='none'; this.nextElementSibling.classList.remove('hidden');" class="w-6 h-6 md:w-8 md:h-8 object-contain drop-shadow-md transition-transform group-hover:scale-110">
                    <div class="hidden w-6 h-6 md:w-8 md:h-8 rounded border border-gray-700 bg-gray-800 flex items-center justify-center text-[9px] md:text-[10px] text-gray-400 font-bold uppercase shadow-inner">${escapeHtml(mapDisplay.substring(0, 2))}</div>
                    <span class="font-bold text-white capitalize">${escapeHtml(mapDisplay)}</span>
                </div>
            </td>
            <td class="py-3 pr-4">
                <div class="flex flex-col">
                    <span class="font-bold ${resColor}">${resText}</span>
                    <span class="text-[10px] md:text-[11px] text-gray-400 font-mono font-bold tracking-widest">${escapeHtml(score)}</span>
                </div>
            </td>
            <td class="py-3 pr-4 font-mono text-gray-300 font-bold tracking-wide">
                ${kills} <span class="text-gray-600">/</span> ${deaths} <span class="text-gray-600">/</span> ${assists}
            </td>
            <td class="py-3 pr-4 font-mono font-bold ${kdColor}">${escapeHtml(kd)}</td>
            <td class="py-3 pr-4 font-mono font-bold text-gray-300">${escapeHtml(m.ADR || '-')}</td>
            <td class="py-3 font-mono font-bold text-gray-300">${escapeHtml(hsText)}</td>
        </tr>
        `;
    }).join('');

    if (reset) {
        tbody.innerHTML = rowsHtml;
    } else {
        tbody.innerHTML += rowsHtml;
    }

    if (count < matchHistory.length) {
        show(loadMoreBtn);
    } else {
        hide(loadMoreBtn);
    }
}

export function loadMoreMatches() {
    renderMatchesTab(false);
}
