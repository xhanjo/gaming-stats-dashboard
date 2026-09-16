/**
 * Вкладка "Мапи" (Maps)
 */

import { $, escapeHtml } from '../utils/dom.js';

export function renderMapsTab(data) {
    const mapContainer = $('mapStatsContainer');
    if (!mapContainer) return;

    const mapSegments = (data.stats && data.stats.segments) ? data.stats.segments : [];

    if (mapSegments.length > 0) {
        mapContainer.innerHTML = mapSegments.map(mapData => {
            const mapName = mapData.label ? mapData.label.replace('de_', '') : 'unknown';
            const safeMapName = mapName.toLowerCase().replace(/\s+/g, '');
            const mapStats = mapData.stats || {};
            const mapWR = parseInt(mapStats['Win Rate %']) || 0;
            const mapKD = mapStats['Average K/D Ratio'] || '-';
            const mapMatches = mapStats['Matches'] || 0;

            let wrColor = 'bg-gray-600';
            if (mapWR >= 60) wrColor = 'bg-green-500';
            else if (mapWR >= 50) wrColor = 'bg-indigo-500';
            else if (mapWR >= 40) wrColor = 'bg-yellow-500';
            else wrColor = 'bg-red-500';

            return `
            <div class="flex flex-col md:flex-row items-start md:items-center justify-between bg-gray-800/30 p-4 rounded-xl border border-gray-700/50 gap-4 transition-colors hover:bg-gray-800/50">
                <div class="w-full md:w-1/4 font-bold text-white text-base md:text-lg capitalize tracking-wide flex items-center gap-2 md:gap-3">
                    <img src="assets/maps/${encodeURIComponent(safeMapName)}.png" onerror="this.style.display='none'; this.nextElementSibling.classList.remove('hidden');" class="w-6 h-6 md:w-8 md:h-8 object-contain drop-shadow-md">
                    <div class="hidden w-6 h-6 md:w-8 md:h-8 rounded-md bg-gray-700 flex items-center justify-center text-[10px] text-gray-400 font-mono shadow-inner">${escapeHtml(mapName.substring(0, 2))}</div>
                    <span class="truncate max-w-[100px] md:max-w-none">${escapeHtml(mapName)}</span>
                </div>
                <div class="w-full md:w-2/4">
                    <div class="flex justify-between text-[10px] md:text-xs text-gray-400 mb-1.5 font-bold uppercase tracking-wider">
                        <span>Вінрейт</span>
                        <span class="text-white font-mono font-bold">${mapWR}%</span>
                    </div>
                    <div class="w-full bg-gray-900 rounded-full h-2 md:h-2.5 overflow-hidden border border-gray-800">
                        <div class="${wrColor} h-full rounded-full transition-all duration-500 shadow-sm" style="width: ${mapWR}%"></div>
                    </div>
                </div>
                <div class="w-full md:w-1/4 flex justify-between md:justify-end items-center gap-6 border-t md:border-t-0 border-gray-800/60 pt-2 md:pt-0 font-mono">
                    <div class="flex flex-col md:items-end">
                        <span class="text-[9px] md:text-[10px] text-gray-500 font-bold uppercase tracking-wider">Матчі</span>
                        <span class="text-white font-bold text-xs md:text-sm">${mapMatches}</span>
                    </div>
                    <div class="flex flex-col md:items-end">
                        <span class="text-[9px] md:text-[10px] text-gray-500 font-bold uppercase tracking-wider">K/D</span>
                        <span class="font-bold text-xs md:text-sm ${parseFloat(mapKD) >= 1 ? 'text-green-400' : 'text-red-400'}">${escapeHtml(mapKD)}</span>
                    </div>
                </div>
            </div>`;
        }).join('');
    } else {
        mapContainer.innerHTML = '<div class="text-center py-8 text-gray-500 font-bold">Дані по картах відсутні в профілі API</div>';
    }
}
