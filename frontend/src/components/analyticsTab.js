/**
 * Вкладка "Аналітика" (Analytics)
 * Отримує готові статистичні звіти від Go Backend (data.recent_form.analytics)
 */

import { $, escapeHtml } from '../utils/dom.js';
import * as Charts from '../charts/chartManager.js';

export function renderAnalyticsTab(data) {
    const recent = data.recent_form || {};
    const analytics = recent.analytics;
    const matches = recent.match_history || [];

    if (!analytics) return;

    // 1. Playstyle / Radar
    const ps = analytics.playstyle;
    if (ps) {
        const roleEl = $('playstyleRoleText');
        if (roleEl) roleEl.textContent = ps.role || 'Flex';
        Charts.renderRadarChart(ps.radar_scores || [], ps.raw_radar_stats || []);
    }

    // 2. Stability Gauge
    const stab = analytics.stability;
    if (stab) {
        const scoreEl = $('stabilityScoreText');
        if (scoreEl) {
            scoreEl.textContent = `${stab.score}%`;
            scoreEl.style.color = stab.color_hex;
        }
        const statusEl = $('stabilityStatusText');
        if (statusEl) {
            statusEl.textContent = stab.status_text;
            statusEl.style.color = stab.color_hex;
        }
        Charts.renderStabilityGauge(stab.score, stab.color_hex);
    }

    // 3. Cluster Scatter Chart
    const clust = analytics.clustering;
    if (clust) {
        Charts.renderClusterChart(clust, matches);
        const sumEl = $('clusterSummaryText');
        if (sumEl) {
            sumEl.innerHTML = 
                `Матчів у ролі зірки (Carry): <strong class="text-green-400 font-mono">${clust.star_percent}%</strong>. ` +
                `Середній вплив: <strong class="text-indigo-400 font-mono">${clust.mid_percent}%</strong>. ` +
                `Провальні ігри: <strong class="text-red-400 font-mono">${clust.low_percent}%</strong>.`;
        }
    }

    // 4. Elo Scenarios
    const eloScen = analytics.elo_scenarios;
    if (eloScen) {
        Charts.renderEloChart(eloScen, matches);

        const predEl = $('predictedEloText');
        if (predEl) {
            predEl.textContent = eloScen.final_expected;
        }

        const diff = eloScen.final_expected - eloScen.current_elo;
        let diffColor = 'text-gray-400';
        let diffSign = '';
        if (diff > 0) { diffColor = 'text-green-400'; diffSign = '+'; }
        else if (diff < 0) { diffColor = 'text-red-400'; }

        const trendEl = $('eloTrendText');
        if (trendEl) {
            trendEl.innerHTML = `<span class="${diffColor} font-mono font-bold">${diffSign}${diff} Elo</span>`;
        }
    }

    // 5. Win Conditions (6 карток: 1 базова + 5 умов перемоги для сітки 3x2)
    const wc = analytics.win_conditions;
    if (wc) {
        const container = $('winConditionsContainer');
        if (!container) return;
        const metrics = [wc.high_adr, wc.high_kd, wc.high_kills, wc.high_entry, wc.high_assists].filter(Boolean);

        const baselineCard = `
            <div class="flex justify-between items-center bg-[#18181b] p-4 rounded-xl border border-gray-800 hover:border-gray-700 transition-colors">
                <div class="pr-2">
                    <div class="text-white font-bold text-sm">Базовий вінрейт (останні матчі)</div>
                    <div class="text-[11px] text-gray-400 mt-0.5">Середня ймовірність перемоги</div>
                    <div class="text-[10px] text-gray-500 font-mono mt-1">Точка відліку для інших показників</div>
                </div>
                <div class="text-right shrink-0">
                    <div class="text-2xl font-black text-white font-mono">${wc.baseline_win_rate}%</div>
                    <div class="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-0.5">WIN RATE</div>
                </div>
            </div>
        `;

        const conditionCards = metrics.map(m => {
            const diff = m.diff_from_baseline !== undefined ? m.diff_from_baseline : (m.win_rate - wc.baseline_win_rate);
            const diffSign = diff > 0 ? `+${diff}%` : `${diff}%`;
            const diffColor = diff > 0 ? 'text-green-400' : (diff < 0 ? 'text-red-400' : 'text-gray-400');
            const sampleText = m.total_matches > 0 ? `вибірка: ${m.total_matches} ігор` : 'немає ігор';

            return `
            <div class="flex justify-between items-center bg-[#18181b] p-4 rounded-xl border border-gray-800 hover:border-gray-700 transition-colors">
                <div class="pr-2">
                    <div class="text-white font-bold text-sm">${escapeHtml(m.label)}</div>
                    <div class="text-[11px] text-gray-400 mt-0.5">${escapeHtml(m.description || `Поріг: ${m.threshold_val}`)}</div>
                    <div class="text-[10px] text-gray-500 font-mono mt-1">Поріг: ${escapeHtml(m.threshold_val)} (${escapeHtml(sampleText)})</div>
                </div>
                <div class="text-right shrink-0">
                    <div class="text-2xl font-black ${escapeHtml(m.color_class || 'text-white')} font-mono">${m.win_rate}%</div>
                    <div class="text-[10px] font-bold font-mono ${diffColor} mt-0.5">${diffSign} до шансу</div>
                </div>
            </div>
            `;
        }).join('');

        container.innerHTML = baselineCard + conditionCards;
    }
}
