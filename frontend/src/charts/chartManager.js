/**
 * Менеджер графіків Chart.js
 */

import { escapeHtml } from '../utils/dom.js';
import { formatMatchDate } from '../utils/dates.js';

let myChart = null;
let trendChart = null; 
let dailyChart = null; 
let weeklyChart = null; 
let radarChart = null; 
let eloChart = null;
let stabilityChart = null;
let clusterChartInstance = null;

export function destroyAllCharts() {
    if (myChart) { myChart.destroy(); myChart = null; }
    if (trendChart) { trendChart.destroy(); trendChart = null; }
    if (dailyChart) { dailyChart.destroy(); dailyChart = null; }
    if (weeklyChart) { weeklyChart.destroy(); weeklyChart = null; }
    if (radarChart) { radarChart.destroy(); radarChart = null; }
    if (eloChart) { eloChart.destroy(); eloChart = null; }
    if (stabilityChart) { stabilityChart.destroy(); stabilityChart = null; }
    if (clusterChartInstance) { clusterChartInstance.destroy(); clusterChartInstance = null; }

    ['chartjs-tooltip', 'performance-chart-tooltip', 'cluster-html-tooltip', 'elo-html-tooltip', 'main-tooltip']
        .forEach(id => document.getElementById(id)?.remove());
}

export function renderTrendChart(dataPoints, matchHistory) {
    if (trendChart) trendChart.destroy();
    
    const canvas = document.getElementById('trendChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let gradient = ctx.createLinearGradient(0, 0, 0, 120);
    gradient.addColorStop(0, 'rgba(255, 85, 0, 0.4)');
    gradient.addColorStop(1, 'rgba(255, 85, 0, 0.0)');

    trendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dataPoints.map((_, i) => i + 1),
            datasets: [{
                data: dataPoints,
                borderColor: '#ff5500',
                borderWidth: 2,
                backgroundColor: gradient,
                fill: true,
                tension: 0.3,
                pointRadius: 0,
                pointHoverRadius: 6,
                pointHoverBackgroundColor: '#ffffff',
                pointHoverBorderColor: '#ff5500',
                pointHoverBorderWidth: 2,
                customMatchData: matchHistory
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { display: false },
                tooltip: {
                    enabled: false,
                    external: (context) => universalTooltipHandler(context, { id: 'chartjs-tooltip', color: 'orange' })
                }
            },
            scales: {
                x: { display: false },
                y: { display: false, min: 0 }
            }
        }
    });
}

export function renderPerformanceChart(dataPoints, matchHistory) {
    if (myChart) myChart.destroy();

    const canvas = document.getElementById('performanceChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, 'rgba(99, 102, 241, 0.3)');
    gradient.addColorStop(1, 'rgba(99, 102, 241, 0.0)');

    myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dataPoints.map((_, i) => i + 1),
            datasets: [{
                data: dataPoints,
                borderColor: '#6366f1',
                borderWidth: 2,
                backgroundColor: gradient,
                fill: true,
                tension: 0.3,
                pointRadius: 0,
                pointHoverRadius: 6,
                pointHoverBackgroundColor: '#ffffff',
                pointHoverBorderColor: '#6366f1',
                pointHoverBorderWidth: 2,
                customMatchData: matchHistory
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { display: false },
                tooltip: {
                    enabled: false,
                    external: (context) => universalTooltipHandler(context, { id: 'performance-chart-tooltip', color: 'indigo' })
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: '#71717a', font: { size: 10 } }
                },
                y: {
                    grid: { color: '#27272a' },
                    ticks: { color: '#71717a', font: { size: 10 } }
                }
            }
        }
    });
}

export function renderRadarChart(scores, rawStats) {
    if (radarChart) radarChart.destroy();
    
    const canvas = document.getElementById('playstyleRadarChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    radarChart = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: ['Снайпер', 'Ентрі', 'Сапорт', 'Опорник (Multi)', 'Точність (HS%)', 'Вогнева міць'],
            datasets: [{
                data: scores,
                backgroundColor: 'rgba(99, 102, 241, 0.2)',
                borderColor: '#6366f1',
                borderWidth: 2,
                pointBackgroundColor: '#6366f1',
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: '#6366f1',
                rawStats: rawStats
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                r: {
                    angleLines: { color: '#27272a' },
                    grid: { color: '#27272a' },
                    pointLabels: { color: '#a1a1aa', font: { size: 11, weight: 'bold' } },
                    ticks: { display: false },
                    min: 0,
                    max: 100
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => ' ' + (rawStats[ctx.dataIndex] || ctx.formattedValue)
                    }
                }
            }
        }
    });
}

export function renderStabilityGauge(score, colorHex) {
    if (stabilityChart) stabilityChart.destroy();

    const canvas = document.getElementById('stabilityGaugeChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    stabilityChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            datasets: [{
                data: [score, 100 - score],
                backgroundColor: [colorHex, '#27272a'],
                borderWidth: 0
            }]
        },
        options: {
            circumference: 180,
            rotation: 270,
            cutout: '80%',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { enabled: false }
            }
        }
    });
}

export function renderClusterChart(clusterReport, matches) {
    if (clusterChartInstance) clusterChartInstance.destroy();

    const canvas = document.getElementById('clusterChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const toScatter = (pts) => pts.map(p => ({
        x: p.kd,
        y: p.adr,
        rawMatch: matches[p.match_index]
    }));

    clusterChartInstance = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [
                {
                    label: 'Carry / High Impact',
                    data: toScatter(clusterReport.star_points || []),
                    backgroundColor: '#10b981',
                    pointRadius: 6,
                    pointHoverRadius: 8
                },
                {
                    label: 'Average',
                    data: toScatter(clusterReport.mid_points || []),
                    backgroundColor: '#6366f1',
                    pointRadius: 5,
                    pointHoverRadius: 7
                },
                {
                    label: 'Low Impact',
                    data: toScatter(clusterReport.low_points || []),
                    backgroundColor: '#ef4444',
                    pointRadius: 5,
                    pointHoverRadius: 7
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: { color: '#a1a1aa', font: { size: 10 } }
                },
                tooltip: {
                    enabled: false,
                    external: (context) => analyticsTooltipHandler(context, { id: 'cluster-html-tooltip', type: 'cluster' })
                }
            },
            scales: {
                x: {
                    title: { display: true, text: 'K/D Ratio', color: '#71717a' },
                    grid: { color: '#27272a' },
                    ticks: { color: '#71717a' }
                },
                y: {
                    title: { display: true, text: 'ADR', color: '#71717a' },
                    grid: { color: '#27272a' },
                    ticks: { color: '#71717a' }
                }
            }
        }
    });
}

export function renderEloChart(eloScenarios, matches) {
    if (eloChart) eloChart.destroy();

    const canvas = document.getElementById('eloPredictionChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const n = matches.length;
    const histLabels = matches.map((_, i) => `Матч ${i + 1}`).reverse();
    const simLabels = Array.from({ length: eloScenarios.future_steps || 10 }, (_, i) => `+${i + 1}`);
    const labels = [...histLabels, ...simLabels];

    // Historical elo progression backwards from current
    let current = eloScenarios.current_elo;
    let histElo = new Array(n);
    for (let i = 0; i < n; i++) {
        histElo[n - 1 - i] = current;
        let isWin = matches[i].Result === '1' || matches[i].Result === 'true';
        current = isWin ? current - 25 : current + 25;
    }

    const padNulls = (arr) => [...new Array(n - 1).fill(null), histElo[histElo.length - 1], ...arr];

    eloChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Історія Elo',
                    data: [...histElo, ...new Array(simLabels.length).fill(null)],
                    borderColor: '#ff5500',
                    borderWidth: 2,
                    tension: 0.1,
                    pointRadius: 0
                },
                {
                    label: 'Оптимістичний (+10)',
                    data: padNulls(eloScenarios.optimistic_path || []),
                    borderColor: '#10b981',
                    borderDash: [5, 5],
                    borderWidth: 1.5,
                    pointRadius: 0
                },
                {
                    label: 'Песимістичний (+10)',
                    data: padNulls(eloScenarios.pessimistic_path || []),
                    borderColor: '#ef4444',
                    borderDash: [5, 5],
                    borderWidth: 1.5,
                    pointRadius: 0
                },
                {
                    label: 'Очікуваний тренд',
                    data: padNulls(eloScenarios.expected_path || []),
                    borderColor: '#3b82f6',
                    borderWidth: 2,
                    pointRadius: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { labels: { color: '#a1a1aa', font: { size: 10 } } },
                tooltip: {
                    enabled: false,
                    external: (context) => analyticsTooltipHandler(context, {
                        id: 'elo-html-tooltip',
                        type: 'elo',
                        validMatches: n,
                        matches: matches
                    })
                }
            },
            scales: {
                x: { grid: { display: false }, ticks: { display: false } },
                y: { grid: { color: '#27272a' }, ticks: { color: '#71717a' } }
            }
        }
    });
}

export function renderHourlyChart(hourlyData) {
    if (dailyChart) dailyChart.destroy();

    const canvas = document.getElementById('dailyActivityChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const labels = hourlyData.map(h => `${h.hour}:00`);
    const matches = hourlyData.map(h => h.matches);
    const wins = hourlyData.map(h => h.wins || 0);

    dailyChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Матчі',
                    data: matches,
                    backgroundColor: '#ffffff',
                    barPercentage: 0.6,
                    borderRadius: 2
                },
                {
                    label: 'Перемоги',
                    data: wins,
                    backgroundColor: '#22c55e',
                    barPercentage: 0.6,
                    borderRadius: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { display: false }, ticks: { color: '#71717a', font: { size: 9 } } },
                y: { display: false, beginAtZero: true }
            }
        }
    });
}

export function renderDailyChart(dailyData) {
    if (weeklyChart) weeklyChart.destroy();

    const canvas = document.getElementById('weeklyActivityChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const labels = dailyData.map(d => d.day_name);
    const matches = dailyData.map(d => d.matches);
    const wins = dailyData.map(d => d.wins || 0);

    weeklyChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Матчі',
                    data: matches,
                    backgroundColor: '#ffffff',
                    barPercentage: 0.5,
                    borderRadius: 2
                },
                {
                    label: 'Перемоги',
                    data: wins,
                    backgroundColor: '#22c55e',
                    barPercentage: 0.5,
                    borderRadius: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { display: false }, ticks: { color: '#71717a', font: { size: 10 } } },
                y: { display: false, beginAtZero: true }
            }
        }
    });
}

// Custom universal HTML tooltip
function universalTooltipHandler(context, config) {
    let tooltipEl = document.getElementById(config.id);
    if (!tooltipEl) {
        tooltipEl = document.createElement('div');
        tooltipEl.id = config.id;
        tooltipEl.classList.add('absolute', 'z-50', 'pointer-events-none', 'transition-all', 'duration-150', 'w-64');
        document.body.appendChild(tooltipEl);
    }

    const tooltipModel = context.tooltip;
    if (tooltipModel.opacity === 0) {
        tooltipEl.style.opacity = 0;
        return;
    }

    const dataIndex = tooltipModel.dataPoints[0].dataIndex;
    const dataset = context.chart.data.datasets[0];
    const match = dataset.customMatchData[dataIndex];
    if (!match) return;

    const dateStr = formatMatchDate(match, 'long');
    const mapName = match.map ? match.map.replace('de_', '') : 'unknown';
    const safeMapName = mapName.toLowerCase().replace(/\s+/g, '');
    const score = match.score ? match.score.replace(' / ', ':') : '-:-';
    const isWin = (match.Result === '1' || match.Win === 'true');

    let metricsHtml = '';
    if (config.id === 'chartjs-tooltip') {
        const kr = match["K/R Ratio"] || match.KRRatio || '-';
        const hs = match["Headshots %"] || match.HeadshotsPc || '-';
        const hsSuffix = hs !== '-' ? '%' : '';
        const kdVal = (match.Kills / (match.Deaths || 1)).toFixed(2);
        
        metricsHtml = `
            <div class="flex justify-between items-center mb-1"><span class="text-gray-500 uppercase font-bold text-xs">K/D/A</span><span class="text-white font-black text-base tracking-wide">${match.Kills}/${match.Deaths}/${match.Assists}</span></div>
            <div class="flex justify-between items-center mb-1"><span class="text-gray-500 uppercase font-bold text-xs">K/D</span><span class="${kdVal >= 1 ? 'text-green-400' : 'text-red-400'} font-black text-base tracking-wide">${kdVal}</span></div>
            <div class="flex justify-between items-center mb-1"><span class="text-gray-500 uppercase font-bold text-xs">K/R</span><span class="text-white font-black text-base tracking-wide">${kr}</span></div>
            <div class="flex justify-between items-center"><span class="text-gray-500 uppercase font-bold text-xs">HS%</span><span class="text-white font-black text-base tracking-wide">${hs}${hsSuffix}</span></div>
        `;
    } else {
        const metricEl = document.getElementById('panelMetricName');
        const metricName = metricEl ? metricEl.textContent : 'Metric';
        metricsHtml = `<div class="flex justify-between items-center"><span class="text-gray-500 uppercase font-bold text-xs">${metricName}</span><span class="text-white font-black text-base tracking-wide">${tooltipModel.dataPoints[0].formattedValue}</span></div>`;
    }

    tooltipEl.innerHTML = `
        <div class="bg-[#18181b]/98 border ${config.color === 'indigo' ? 'border-indigo-500/50' : 'border-gray-700'} rounded-xl shadow-2xl p-4 backdrop-blur-md">
            <div class="text-xs text-gray-400 font-bold uppercase tracking-wider mb-3 border-b border-gray-800 pb-2 italic">${escapeHtml(dateStr)}</div>
            <div class="flex justify-between items-center mb-4">
                <div class="flex items-center gap-3">
                    <img src="assets/maps/${encodeURIComponent(safeMapName)}.png" onerror="this.src='assets/maps/unknown.png'" class="w-8 h-8 object-contain drop-shadow-md">
                    <span class="text-base font-bold text-white capitalize">${escapeHtml(mapName)}</span>
                </div>
                <span class="text-sm font-black text-white ${config.color === 'indigo' ? 'bg-indigo-500/20 border-indigo-500/30' : 'bg-black/40 border-gray-800'} px-2 py-1 rounded border">
                    ${isWin ? 'W' : 'L'} ${escapeHtml(score)}
                </span>
            </div>
            <div class="space-y-1.5 font-mono">${metricsHtml}</div>
        </div>
    `;

    const position = context.chart.canvas.getBoundingClientRect();
    const chartWidth = context.chart.width;
    let leftPos = (tooltipModel.caretX > chartWidth * 0.5) 
        ? position.left + window.scrollX + tooltipModel.caretX - tooltipEl.offsetWidth - 25
        : position.left + window.scrollX + tooltipModel.caretX + 25;

    tooltipEl.style.opacity = 1;
    tooltipEl.style.left = leftPos + 'px';
    tooltipEl.style.top = position.top + window.scrollY + 15 + (tooltipModel.caretY * 0.1) + 'px';
}

function analyticsTooltipHandler(context, config) {
    let tooltipEl = document.getElementById(config.id);
    if (!tooltipEl) {
        tooltipEl = document.createElement('div');
        tooltipEl.id = config.id;
        tooltipEl.classList.add('absolute', 'z-50', 'pointer-events-none', 'transition-all', 'duration-150', 'w-64');
        document.body.appendChild(tooltipEl);
    }

    const tooltipModel = context.tooltip;
    if (tooltipModel.opacity === 0) {
        tooltipEl.style.opacity = 0;
        return;
    }

    const dp = tooltipModel.dataPoints[0];

    if (config.type === 'cluster') {
        const pt = dp.raw;
        const m = pt.rawMatch;
        if (!m) return;

        const dateStr = formatMatchDate(m);
        const mapName = m.map ? m.map.replace('de_', '') : 'unknown';
        const safeMapName = mapName.toLowerCase().replace(/\s+/g, '');
        const score = m.score ? m.score.replace(' / ', ':') : '-:-';
        const isWin = (m.Result === '1' || m.Win === 'true' || m.win === '1');

        const metricsHtml = `
            <div class="flex justify-between items-center mb-1"><span class="text-gray-500 uppercase font-bold text-xs">K/D</span><span class="text-white font-black text-base tracking-wide">${pt.x.toFixed(2)}</span></div>
            <div class="flex justify-between items-center mb-1"><span class="text-gray-500 uppercase font-bold text-xs">ADR</span><span class="text-white font-black text-base tracking-wide">${pt.y.toFixed(1)}</span></div>
            <div class="flex justify-between items-center mt-2 pt-2 border-t border-gray-800/50 gap-2">
                <span class="text-gray-500 uppercase font-bold text-[10px] shrink-0">Кластер</span>
                <span class="text-indigo-400 font-bold text-xs text-right leading-tight">${context.chart.data.datasets[dp.datasetIndex].label}</span>
            </div>
        `;

        tooltipEl.innerHTML = `
            <div class="bg-[#18181b]/98 border ${isWin ? 'border-green-500/30' : 'border-red-500/30'} rounded-xl shadow-2xl p-4 backdrop-blur-md">
                <div class="text-[11px] text-gray-400 font-bold uppercase tracking-wider mb-3 border-b border-gray-800 pb-2 flex items-center gap-2">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                    ${escapeHtml(dateStr)}
                </div>
                <div class="flex justify-between items-center mb-3">
                    <div class="flex items-center gap-3">
                        <img src="assets/maps/${encodeURIComponent(safeMapName)}.png" onerror="this.src='assets/maps/unknown.png'" class="w-8 h-8 object-contain drop-shadow-md">
                        <span class="text-sm font-bold text-white capitalize">${escapeHtml(mapName)}</span>
                    </div>
                    <span class="text-xs font-black ${isWin ? 'text-green-400 bg-green-500/10' : 'text-red-400 bg-red-500/10'} px-2 py-1 rounded border ${isWin ? 'border-green-500/20' : 'border-red-500/20'}">
                        ${isWin ? 'W' : 'L'} ${escapeHtml(score)}
                    </span>
                </div>
                <div class="space-y-2 font-mono">${metricsHtml}</div>
            </div>
        `;
    } else if (config.type === 'elo') {
        const dataIndex = dp.dataIndex;
        const validMatches = config.validMatches;
        const matches = config.matches;

        if (dataIndex >= validMatches) {
            const step = dataIndex - validMatches + 1;
            const metricsHtml = tooltipModel.dataPoints.map(point => {
                let val = point.parsed.y;
                let datasetLabel = context.chart.data.datasets[point.datasetIndex].label;
                let colorClass = point.datasetIndex === 1 ? 'text-green-400' : (point.datasetIndex === 2 ? 'text-red-400' : 'text-blue-400');
                let prevElo = context.chart.data.datasets[point.datasetIndex].data[dataIndex - 1];
                let isWinStep = val > prevElo;
                let changeTxt = isWinStep ? '+25 (WIN)' : '-25 (LOSS)';

                return `
                    <div class="flex justify-between items-center gap-4 mt-3 border-b border-gray-800/50 pb-2">
                        <span class="text-gray-400 font-bold text-xs uppercase tracking-wide">${datasetLabel}</span>
                        <div class="text-right">
                            <span class="${colorClass} font-black text-lg block leading-tight tracking-wide">${val} Elo</span>
                            <span class="text-sm font-bold tracking-wide ${isWinStep ? 'text-green-400' : 'text-red-400'} mt-0.5 block">${changeTxt}</span>
                        </div>
                    </div>`;
            }).join('');

            tooltipEl.innerHTML = `
                <div class="bg-[#18181b]/98 border border-faceit/30 rounded-xl shadow-2xl p-4 backdrop-blur-md">
                    <div class="text-xs text-faceit font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path></svg>
                        Симуляція: Матч +${step}
                    </div>
                    <div class="space-y-1 font-mono">${metricsHtml}</div>
                </div>
            `;
            const pos = context.chart.canvas.getBoundingClientRect();
            let leftPos = (tooltipModel.caretX > context.chart.width * 0.5)
                ? pos.left + window.scrollX + tooltipModel.caretX - tooltipEl.offsetWidth - 25
                : pos.left + window.scrollX + tooltipModel.caretX + 25;
            tooltipEl.style.opacity = 1;
            tooltipEl.style.left = leftPos + 'px';
            tooltipEl.style.top = pos.top + window.scrollY + 15 + (tooltipModel.caretY * 0.1) + 'px';
            return;
        } else {
            const m = matches[validMatches - 1 - dataIndex];
            const dateStr = formatMatchDate(m);
            const mapName = m.map ? m.map.replace('de_', '') : 'unknown';
            const safeMapName = mapName.toLowerCase().replace(/\s+/g, '');
            const score = m.score ? m.score.replace(' / ', ':') : '-:-';
            const isWin = (m.Result === '1' || m.Win === 'true' || m.win === '1');
            const kd = (parseInt(m.Kills) / (parseInt(m.Deaths) || 1)).toFixed(2);

            const metricsHtml = `
                <div class="flex justify-between items-center mb-1"><span class="text-gray-500 uppercase font-bold text-xs">Elo після гри</span><span class="text-white font-black text-base tracking-wide">${dp.parsed.y}</span></div>
                <div class="flex justify-between items-center"><span class="text-gray-500 uppercase font-bold text-xs">K/D у матчі</span><span class="${kd >= 1 ? 'text-green-400' : 'text-red-400'} font-black text-base tracking-wide">${kd}</span></div>
            `;

            tooltipEl.innerHTML = `
                <div class="bg-[#18181b]/98 border ${isWin ? 'border-green-500/30' : 'border-red-500/30'} rounded-xl shadow-2xl p-4 backdrop-blur-md">
                    <div class="text-xs text-gray-400 font-bold uppercase tracking-wider mb-3 border-b border-gray-800 pb-2 flex items-center gap-2">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                        ${escapeHtml(dateStr)}
                    </div>
                    <div class="flex justify-between items-center mb-4">
                        <div class="flex items-center gap-3">
                            <img src="assets/maps/${encodeURIComponent(safeMapName)}.png" onerror="this.src='assets/maps/unknown.png'" class="w-8 h-8 object-contain drop-shadow-md">
                            <span class="text-base font-bold text-white capitalize">${escapeHtml(mapName)}</span>
                        </div>
                        <span class="text-sm font-black ${isWin ? 'text-green-400 bg-green-500/10' : 'text-red-400 bg-red-500/10'} px-2 py-1 rounded border ${isWin ? 'border-green-500/20' : 'border-red-500/20'}">
                            ${isWin ? 'W' : 'L'} ${escapeHtml(score)}
                        </span>
                    </div>
                    <div class="space-y-1.5 font-mono">${metricsHtml}</div>
                </div>
            `;
        }
    }

    const pos = context.chart.canvas.getBoundingClientRect();
    let leftPos = (tooltipModel.caretX > context.chart.width * 0.5)
        ? pos.left + window.scrollX + tooltipModel.caretX - tooltipEl.offsetWidth - 25
        : pos.left + window.scrollX + tooltipModel.caretX + 25;

    tooltipEl.style.opacity = 1;
    tooltipEl.style.left = leftPos + 'px';
    tooltipEl.style.top = pos.top + window.scrollY + 15 + (tooltipModel.caretY * 0.1) + 'px';
}
