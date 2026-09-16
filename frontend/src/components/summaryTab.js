/**
 * Вкладка "Огляд" (Summary)
 */

import { $, escapeHtml } from '../utils/dom.js';
import { store } from '../state/store.js';
import * as Charts from '../charts/chartManager.js';

let trueKDVal = "0.00";

export function initSummaryTab() {
    const metricBtns = ['kd', 'kr', 'hs', 'adr'];
    metricBtns.forEach(metric => {
        const btn = $(`btn-${metric}`);
        if (btn) {
            btn.addEventListener('click', () => {
                changePerformanceMetric(metric);
            });
        }
    });
}

export function renderSummaryTab(data) {
    const cs2Stats = data.stats || {};
    const lifetime = cs2Stats.lifetime || {};
    const recent = data.recent_form || {};
    const matches = recent.match_history || [];

    // Lifetime
    const setTxt = (id, val) => { const el = $(id); if (el) el.textContent = val; };
    setTxt('playerMatches', lifetime.Matches || '-');
    setTxt('playerWinrate', (lifetime['Win Rate %'] || lifetime.WinRate || '-') + (lifetime.WinRate ? '%' : ''));
    setTxt('playerLifetimeKD', lifetime['Average K/D Ratio'] || lifetime.AverageKD || '-');

    // Recent 30 matches
    const summaryMatches = matches.slice(0, 30);

    let totalK = 0, totalD = 0;
    let sumKR = 0, countKR = 0;
    let sumADR = 0, countADR = 0;
    let sumHS = 0, countHS = 0;
    let totalEntry = 0, totalSniper = 0;

    summaryMatches.forEach(m => {
        const k = parseInt(m.Kills) || 0;
        const d = parseInt(m.Deaths) || 0;
        totalK += k;
        totalD += d;

        const kr = parseFloat(m['K/R Ratio'] || m.KRRatio);
        if (!isNaN(kr)) { sumKR += kr; countKR++; }

        const adr = parseFloat(m.ADR);
        if (!isNaN(adr)) { sumADR += adr; countADR++; }

        const hs = parseFloat(m['Headshots %'] || m.HeadshotsPc);
        if (!isNaN(hs)) { sumHS += hs; countHS++; }

        totalEntry += parseInt(m['First Kills'] || m.FirstKills) || 0;
        totalSniper += parseInt(m['Sniper Kills'] || m.SniperKills) || 0;
    });

    trueKDVal = totalD > 0 ? (totalK / totalD).toFixed(2) : (totalK > 0 ? totalK.toFixed(2) : "0.00");

    const kdEl = $('playerKD');
    if (kdEl) {
        kdEl.textContent = trueKDVal;
        kdEl.className = `text-xl font-bold ${parseFloat(trueKDVal) >= 1 ? 'text-green-400' : 'text-red-400'}`;
    }

    setTxt('playerKR', countKR > 0 ? (sumKR / countKR).toFixed(2) : (recent.avg_kr_ratio ? recent.avg_kr_ratio.toFixed(2) : '-'));
    setTxt('playerADR', countADR > 0 ? (sumADR / countADR).toFixed(1) : (recent.avg_adr ? recent.avg_adr.toFixed(1) : '-'));
    setTxt('playerHS', countHS > 0 ? `${(sumHS / countHS).toFixed(0)}%` : (recent.avg_hs_percentage ? `${recent.avg_hs_percentage.toFixed(0)}%` : '-'));
    setTxt('playerEntry', summaryMatches.length > 0 ? String(totalEntry) : (recent.total_entry_kills || '0'));
    setTxt('playerSniper', summaryMatches.length > 0 ? String(totalSniper) : (recent.total_sniper_kills || '0'));

    // Trend chart & match result blocks (30 matches max, sorted chronologically left-to-right: oldest -> newest)
    if (summaryMatches.length > 0) {
        const chronologicalMatches = [...summaryMatches].reverse();
        const trendData = chronologicalMatches.map(m => {
            const k = parseInt(m.Kills) || 0;
            const d = parseInt(m.Deaths) || 1;
            return (k / d).toFixed(2);
        });

        Charts.renderTrendChart(trendData, chronologicalMatches);

        let historyHtml = "";
        for (let i = 0; i < chronologicalMatches.length; i++) {
            const m = chronologicalMatches[i];
            const isWin = (m.Result === "1" || m.Win === "true" || m.win === "1");
            const color = isWin ? "bg-green-500" : "bg-red-500";
            const label = isWin ? "W" : "L";
            const kills = parseInt(m.Kills) || 0;

            historyHtml += `
                <div class="flex-1 flex flex-col items-center gap-1 group relative cursor-pointer py-1">
                    <div class="w-full h-1.5 ${color} rounded-full transition-all group-hover:h-3"></div>
                    <span class="text-[9px] font-bold text-gray-500 group-hover:text-white transition-colors">${label}</span>
                    <div class="absolute bottom-full mb-1 hidden group-hover:flex flex-col items-center z-20 pointer-events-none">
                        <span class="bg-gray-900 border border-gray-700 text-white text-[10px] font-mono font-bold px-2 py-1 rounded shadow-lg whitespace-nowrap">
                            ${kills} кілів (${escapeHtml(m.map ? m.map.replace('de_', '') : '')})
                        </span>
                    </div>
                </div>
            `;
        }
        const resultsEl = $('matchResults');
        if (resultsEl) resultsEl.innerHTML = historyHtml;

        changePerformanceMetric(store.getState().currentMetric || 'kd');
    }
}

export function changePerformanceMetric(metric) {
    const { matchHistory } = store.getState();
    if (!matchHistory || matchHistory.length === 0) return;

    store.setState({ currentMetric: metric });

    const btns = ['kd', 'kr', 'hs', 'adr'];
    btns.forEach(b => {
        const el = $(`btn-${b}`);
        if (el) {
            el.className = (b === metric)
                ? "px-5 py-1.5 rounded-full text-sm font-bold bg-faceit text-white transition-colors cursor-pointer"
                : "px-5 py-1.5 rounded-full text-sm font-bold bg-gray-800 text-gray-400 hover:bg-gray-700 transition-colors cursor-pointer";
        }
    });

    // 30 matches max, sorted chronologically left-to-right (oldest -> newest)
    const summaryMatches = matchHistory.slice(0, 30);
    const chronologicalMatches = [...summaryMatches].reverse();

    let dataPoints = [];
    let metricLabel = metric.toUpperCase();
    let displayAvg = "";

    if (metric === 'kd') {
        dataPoints = chronologicalMatches.map(m => ((parseInt(m.Kills) || 0) / (parseInt(m.Deaths) || 1)).toFixed(2));
        displayAvg = trueKDVal;
    } else if (metric === 'kr') {
        dataPoints = chronologicalMatches.map(m => parseFloat(m['K/R Ratio'] || m.KRRatio || 0).toFixed(2));
        displayAvg = (dataPoints.reduce((a, b) => a + parseFloat(b), 0) / (dataPoints.length || 1)).toFixed(2);
    } else if (metric === 'hs') {
        dataPoints = chronologicalMatches.map(m => parseFloat(m['Headshots %'] || m.HeadshotsPc || 0).toFixed(0));
        displayAvg = (dataPoints.reduce((a, b) => a + parseFloat(b), 0) / (dataPoints.length || 1)).toFixed(0) + '%';
    } else if (metric === 'adr') {
        dataPoints = chronologicalMatches.map(m => parseFloat(m.ADR || 0).toFixed(1));
        displayAvg = (dataPoints.reduce((a, b) => a + parseFloat(b), 0) / (dataPoints.length || 1)).toFixed(1);
    }

    const numVals = dataPoints.map(Number);
    const setTxt = (id, val) => { const el = $(id); if (el) el.textContent = val; };

    setTxt('panelMetricName', metricLabel);
    setTxt('panelCurrentVal', displayAvg);
    setTxt('panelHighVal', (numVals.length ? Math.max(...numVals) : 0).toFixed(metric === 'hs' ? 0 : 2) + (metric === 'hs' ? '%' : ''));
    setTxt('panelLowVal', (numVals.length ? Math.min(...numVals) : 0).toFixed(metric === 'hs' ? 0 : 2) + (metric === 'hs' ? '%' : ''));

    Charts.renderPerformanceChart(dataPoints, chronologicalMatches);
}
