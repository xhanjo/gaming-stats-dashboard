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
}

export function renderTrendChart(dataPoints, currentMatchHistory) {
    if (trendChart) trendChart.destroy();
    
    const ctx = document.getElementById('trendChart').getContext('2d');
    let gradient = ctx.createLinearGradient(0, 0, 0, 120);
    gradient.addColorStop(0, 'rgba(255, 85, 0, 0.4)');
    gradient.addColorStop(1, 'rgba(255, 85, 0, 0.0)');

    trendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dataPoints.map((_, i) => i + 1),
            datasets: [{
                data: dataPoints,
                customMatchData: currentMatchHistory,
                borderColor: '#ff5500',
                backgroundColor: gradient,
                borderWidth: 2,
                pointRadius: 0,
                pointHoverRadius: 6,
                pointBackgroundColor: '#ff5500',
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { 
                legend: { display: false },
                tooltip: {
                    enabled: false,
                    external: (context) => universalTooltipHandler(context, { color: 'gray', id: 'chartjs-tooltip' })
                }
            },
            scales: {
                x: { display: false, offset: true }, 
                y: { display: false, min: Math.min(...dataPoints) * 0.8 } 
            },
            interaction: { mode: 'index', intersect: false }
        }
    });
}

export function renderPerformanceChart(dataPoints, currentMatchHistory) {
    if (myChart) myChart.destroy();
    myChart = new Chart(document.getElementById('performanceChart').getContext('2d'), {
        type: 'line',
        data: {
            labels: currentMatchHistory.map((_, i) => i + 1),
            datasets: [{ 
                data: dataPoints, 
                customMatchData: currentMatchHistory, 
                borderColor: '#6366f1', 
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                borderWidth: 2, 
                pointRadius: 4,
                pointHoverRadius: 6,
                fill: true,
                tension: 0.2 
            }]
        },
        options: {
            responsive: true, 
            maintainAspectRatio: false,
            plugins: { 
                legend: { display: false },
                tooltip: {
                    enabled: false,
                    external: (context) => universalTooltipHandler(context, { color: 'indigo', id: 'performance-chart-tooltip' })
                }
            },
            scales: {
                x: { grid: { color: '#27272a' }, ticks: { color: '#71717a' } },
                y: { grid: { color: '#27272a' }, ticks: { color: '#71717a' } }
            },
            interaction: { mode: 'index', intersect: false }
        }
    });
}

export function renderActivityCharts(hoursData, daysData) {
    if (dailyChart) dailyChart.destroy();
    dailyChart = new Chart(document.getElementById('dailyActivityChart').getContext('2d'), {
        type: 'bar',
        data: {
            labels: Array.from({length: 24}, (_, i) => i),
            datasets: [
                { label: 'Matches', data: hoursData.map(d => d.m), backgroundColor: '#ffffff', barPercentage: 0.6, borderRadius: 2 },
                { label: 'Wins', data: hoursData.map(d => d.w), backgroundColor: '#22c55e', barPercentage: 0.6, borderRadius: 2 }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false }, ticks: { color: '#71717a' } }, y: { display: false, beginAtZero: true } } }
    });

    if (weeklyChart) weeklyChart.destroy();
    weeklyChart = new Chart(document.getElementById('weeklyActivityChart').getContext('2d'), {
        type: 'bar',
        data: {
            labels: ['Пн', 'Вв', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'],
            datasets: [
                { label: 'Matches', data: daysData.map(d => d.m), backgroundColor: '#ffffff', barPercentage: 0.5, borderRadius: 2 },
                { label: 'Wins', data: daysData.map(d => d.w), backgroundColor: '#22c55e', barPercentage: 0.5, borderRadius: 2 }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false }, ticks: { color: '#71717a' } }, y: { display: false, beginAtZero: true } } }
    });
}

export function renderRadarChart(nSniper, nEntry, nAssists, nMulti, nHS, nADR, rawRadarStats) {
    if (radarChart) radarChart.destroy();
    radarChart = new Chart(document.getElementById('playstyleRadarChart').getContext('2d'), {
        type: 'radar',
        data: {
            labels: ['Снайпер', 'Ентрі', 'Сапорт', 'Опорник (Multi)', 'Точність (HS%)', 'Вогнева міць'],
            datasets: [{
                data: [nSniper, nEntry, nAssists, nMulti, nHS, nADR],
                rawStats: rawRadarStats,
                backgroundColor: 'rgba(99, 102, 241, 0.25)',
                borderColor: '#6366f1',
                pointBackgroundColor: '#6366f1',
                pointBorderColor: '#fff',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: { 
                r: { 
                    angleLines: { color: 'rgba(255, 255, 255, 0.1)' }, 
                    grid: { color: 'rgba(255, 255, 255, 0.1)' }, 
                    pointLabels: { color: '#a1a1aa', font: { size: 11, weight: 'bold' } }, 
                    ticks: { display: false, min: 0, max: 100, stepSize: 20 }
                } 
            },
            plugins: { 
                legend: { display: false }, 
                tooltip: { 
                    enabled: true,
                    backgroundColor: 'rgba(24, 24, 27, 0.95)',
                    titleColor: '#a1a1aa',
                    bodyColor: '#ffffff',
                    borderColor: '#6366f1',
                    borderWidth: 1,
                    padding: 10,
                    displayColors: false,
                    callbacks: {
                        label: function(context) { return context.dataset.rawStats[context.dataIndex]; }
                    }
                } 
            }
        }
    });
}

export function renderStabilityChart(roundedScore, gaugeColor) {
    if (stabilityChart) stabilityChart.destroy();
    stabilityChart = new Chart(document.getElementById('stabilityGaugeChart').getContext('2d'), {
        type: 'doughnut',
        data: {
            datasets: [{
                data: [roundedScore, 100 - roundedScore],
                backgroundColor: [gaugeColor, '#27272a'],
                borderWidth: 0,
                circumference: 180,
                rotation: 270
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            cutout: '80%',
            plugins: { legend: { display: false }, tooltip: { enabled: false } },
            layout: { padding: { bottom: 20 } }
        }
    });
}

export function renderClusterChart(starPts, midPts, lowPts) {
    if (clusterChartInstance) clusterChartInstance.destroy();
    clusterChartInstance = new Chart(document.getElementById('clusterChart').getContext('2d'), {
        type: 'scatter',
        data: {
            datasets: [
                {
                    label: 'Carry (Високий імпакт)',
                    data: starPts,
                    backgroundColor: '#10b981', 
                    borderColor: 'rgba(16, 185, 129, 0.5)',
                    pointRadius: 5,
                    pointHoverRadius: 8
                },
                {
                    label: 'Average (Середній імпакт)',
                    data: midPts,
                    backgroundColor: '#eab308', 
                    borderColor: 'rgba(234, 179, 8, 0.5)',
                    pointRadius: 5,
                    pointHoverRadius: 8
                },
                {
                    label: 'Low Impact (Низький імпакт)',
                    data: lowPts,
                    backgroundColor: '#ef4444', 
                    borderColor: 'rgba(239, 68, 68, 0.5)',
                    pointRadius: 5,
                    pointHoverRadius: 8
                }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
                x: { title: { display: true, text: 'K/D Ratio', color: '#71717a' }, grid: { color: '#27272a' }, ticks: { color: '#71717a' } },
                y: { title: { display: true, text: 'ADR', color: '#71717a' }, grid: { color: '#27272a' }, ticks: { color: '#71717a' } }
            },
            plugins: {
                legend: { position: 'top', labels: { color: '#a1a1aa', boxWidth: 12 } },
                tooltip: {
                    enabled: false,
                    external: (context) => analyticsTooltipHandler(context, { type: 'cluster', id: 'cluster-html-tooltip' })
                }
            }
        }
    });
}

export function renderEloChart(labels, expData, optData, pesData, validMatches, futureSteps, matches, baseColors) {
    if (eloChart) eloChart.destroy();
    eloChart = new Chart(document.getElementById('eloPredictionChart').getContext('2d'), {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Очікувано',
                    data: expData,
                    segment: {
                        borderDash: ctx => ctx.p0DataIndex >= validMatches - 1 ? [5, 5] : undefined,
                        borderColor: ctx => ctx.p0DataIndex >= validMatches - 1 ? '#3b82f6' : '#ff5500', 
                    },
                    borderWidth: 2,
                    pointBackgroundColor: baseColors.concat(Array(futureSteps).fill('#3b82f6')),
                    pointRadius: ctx => ctx.dataIndex === validMatches + futureSteps - 1 ? 5 : 0,
                    pointHoverRadius: 6,
                    fill: false,
                    tension: 0
                },
                {
                    label: 'Вдала серія',
                    data: optData,
                    borderColor: '#10b981', 
                    borderDash: [4, 4],
                    borderWidth: 2,
                    pointRadius: ctx => ctx.dataIndex === validMatches + futureSteps - 1 ? 5 : 0,
                    pointBackgroundColor: '#10b981',
                    fill: false,
                    tension: 0
                },
                {
                    label: 'Погана серія',
                    data: pesData,
                    borderColor: '#ef4444', 
                    borderDash: [4, 4],
                    borderWidth: 2,
                    pointRadius: ctx => ctx.dataIndex === validMatches + futureSteps - 1 ? 5 : 0,
                    pointBackgroundColor: '#ef4444',
                    fill: false,
                    tension: 0
                }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { 
                legend: { display: false },
                tooltip: {
                    enabled: false,
                    external: (context) => analyticsTooltipHandler(context, { type: 'elo', id: 'elo-html-tooltip', validMatches: validMatches, matches: matches })
                }
            },
            scales: { x: { display: false }, y: { grid: { color: '#27272a' }, ticks: { color: '#71717a', precision: 0 } } },
            interaction: { mode: 'index', intersect: false }
        }
    });
}



function universalTooltipHandler(context, config = { color: 'gray', id: 'main-tooltip' }) {
    let tooltipEl = document.getElementById(config.id);

    if (!tooltipEl) {
        tooltipEl = document.createElement('div');
        tooltipEl.id = config.id;
        tooltipEl.classList.add('absolute', 'z-50', 'pointer-events-none', 'transition-all', 'duration-150', 'w-64');
        document.body.appendChild(tooltipEl);
    }

    const tooltipModel = context.tooltip;
    if (tooltipModel.opacity === 0) { tooltipEl.style.opacity = 0; return; }

    const dataIndex = tooltipModel.dataPoints[0].dataIndex;
    const dataset = context.chart.data.datasets[0];
    const match = dataset.customMatchData[dataIndex];
    
    let rawTime = match.CreatedAt1 || match.UpdatedAt1 || match.CreatedAt2 || match.UpdatedAt2 || match["Created At"] || match["Updated At"] || match.created_at || match.updated_at;
    let dateStr = "Невідома дата";
    if (rawTime) {
        let ts = rawTime;
        if (typeof ts === 'number') ts = ts * (ts < 1e10 ? 1000 : 1);
        else if (!isNaN(ts)) ts = parseInt(ts) * (parseInt(ts) < 1e10 ? 1000 : 1);
        else ts = new Date(ts.replace(' UTC', 'Z')).getTime();
        
        let d = new Date(ts);
        if (!isNaN(d.getTime())) {
            const datePart = d.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' }).replace(' р.', '');
            const timePart = d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
            dateStr = `${datePart}, ${timePart}`;
        }
    }

    const mapName = match.map ? match.map.replace('de_', '') : 'unknown';
    const safeMapName = mapName.toLowerCase().replace(/\s+/g, '');
    const score = match.score ? match.score.replace(' / ', ':') : '-:-';
    const isWin = (match.Result === "1" || match.Win === "true");

    let metricsHtml = '';
    if (config.id === 'chartjs-tooltip') {
        const kr = match["K/R Ratio"] || match.KRRatio || '-';
        const hs = match["Headshots %"] || match.HeadshotsPc || '-';
        const hsSuffix = hs !== '-' ? '%' : '';
        
        metricsHtml = `
            <div class="flex justify-between items-center mb-1"><span class="text-gray-500 uppercase font-bold text-xs">K/D/A</span><span class="text-white font-black text-base tracking-wide">${match.Kills}/${match.Deaths}/${match.Assists}</span></div>
            <div class="flex justify-between items-center mb-1"><span class="text-gray-500 uppercase font-bold text-xs">K/D</span><span class="${(match.Kills/match.Deaths) >= 1 ? 'text-green-400' : 'text-red-400'} font-black text-base tracking-wide">${(match.Kills/match.Deaths).toFixed(2)}</span></div>
            <div class="flex justify-between items-center mb-1"><span class="text-gray-500 uppercase font-bold text-xs">K/R</span><span class="text-white font-black text-base tracking-wide">${kr}</span></div>
            <div class="flex justify-between items-center"><span class="text-gray-500 uppercase font-bold text-xs">HS%</span><span class="text-white font-black text-base tracking-wide">${hs}${hsSuffix}</span></div>
        `;
    } else {
        const metricName = document.getElementById('panelMetricName').textContent;
        metricsHtml = `<div class="flex justify-between items-center"><span class="text-gray-500 uppercase font-bold text-xs">${metricName}</span><span class="text-white font-black text-base tracking-wide">${tooltipModel.dataPoints[0].formattedValue}</span></div>`;    }

    tooltipEl.innerHTML = `
        <div class="bg-[#18181b]/98 border ${config.color === 'indigo' ? 'border-indigo-500/50' : 'border-gray-700'} rounded-xl shadow-2xl p-4 backdrop-blur-md">
            <div class="text-xs text-gray-400 font-bold uppercase tracking-wider mb-3 border-b border-gray-800 pb-2 italic">${dateStr}</div>
            <div class="flex justify-between items-center mb-4">
                <div class="flex items-center gap-3">
                    <img src="assets/maps/${safeMapName}.png" onerror="this.src='assets/maps/unknown.png'" class="w-8 h-8 object-contain drop-shadow-md">
                    <span class="text-base font-bold text-white capitalize">${mapName}</span>
                </div>
                <span class="text-sm font-black text-white ${config.color === 'indigo' ? 'bg-indigo-500/20 border-indigo-500/30' : 'bg-black/40 border-gray-800'} px-2 py-1 rounded border">
                    ${isWin ? 'W' : 'L'} ${score}
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
    if (tooltipModel.opacity === 0) { tooltipEl.style.opacity = 0; return; }

    const dp = tooltipModel.dataPoints[0];
    let mapName = 'unknown', safeMapName = 'unknown', dateStr = 'Невідома дата', score = '', isWin = false, metricsHtml = '';

    if (config.type === 'cluster') {
        let pt = dp.raw;
        let m = pt.rawMatch;
        
        if (!m) return; 

        let rawTime = m.CreatedAt1 || m.UpdatedAt1 || m.created_at || m.updated_at || m["Created At"] || m["Updated At"];
        if (rawTime) {
            let ts = rawTime;
            if (typeof ts === 'number') ts = ts * (ts < 1e10 ? 1000 : 1);
            else if (!isNaN(ts)) ts = parseInt(ts) * (parseInt(ts) < 1e10 ? 1000 : 1);
            else ts = new Date(ts.replace(' UTC', 'Z')).getTime();
            
            let d = new Date(ts);
            if (!isNaN(d.getTime())) {
                dateStr = d.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short', year: 'numeric' }) + ', ' + d.toLocaleTimeString('uk-UA', {hour: '2-digit', minute:'2-digit'});
            }
        }
        
        mapName = m.map ? m.map.replace('de_', '') : 'unknown';
        safeMapName = mapName.toLowerCase().replace(/\s+/g, '');
        mapName = mapName.charAt(0).toUpperCase() + mapName.slice(1);
        score = m.score ? m.score.replace(' / ', ':') : '-:-';
        isWin = (m.Result === "1" || m.Win === "true" || m.win === "1");

        metricsHtml = `
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
                    ${dateStr}
                </div>
                <div class="flex justify-between items-center mb-3">
                    <div class="flex items-center gap-3">
                        <img src="assets/maps/${safeMapName}.png" onerror="this.src='assets/maps/unknown.png'" class="w-8 h-8 object-contain drop-shadow-md">
                        <span class="text-sm font-bold text-white capitalize">${mapName}</span>
                    </div>
                    <span class="text-xs font-black ${isWin ? 'text-green-400 bg-green-500/10' : 'text-red-400 bg-red-500/10'} px-2 py-1 rounded border ${isWin ? 'border-green-500/20' : 'border-red-500/20'}">
                        ${isWin ? 'W' : 'L'} ${score}
                    </span>
                </div>
                <div class="space-y-2 font-mono">${metricsHtml}</div>
            </div>
        `;

    } else if (config.type === 'elo') {
        let dataIndex = dp.dataIndex;
        let validMatches = config.validMatches;
        let matches = config.matches;

        if (dataIndex >= validMatches) {
            let step = dataIndex - validMatches + 1;
            
            metricsHtml = tooltipModel.dataPoints.map(point => {
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

            const position = context.chart.canvas.getBoundingClientRect();
            const chartWidth = context.chart.width;
            let leftPos = (tooltipModel.caretX > chartWidth * 0.5) 
                ? position.left + window.scrollX + tooltipModel.caretX - tooltipEl.offsetWidth - 25
                : position.left + window.scrollX + tooltipModel.caretX + 25;

            tooltipEl.style.opacity = 1;
            tooltipEl.style.left = leftPos + 'px';
            tooltipEl.style.top = position.top + window.scrollY + 15 + (tooltipModel.caretY * 0.1) + 'px';
            return;
        } else {
            let m = matches[validMatches - 1 - dataIndex];
            
            let rawTime = m.CreatedAt1 || m.UpdatedAt1 || m.created_at || m.updated_at || m["Created At"] || m["Updated At"];
            if (rawTime) {
                let ts = rawTime;
                if (typeof ts === 'number') ts = ts * (ts < 1e10 ? 1000 : 1);
                else if (!isNaN(ts)) ts = parseInt(ts) * (parseInt(ts) < 1e10 ? 1000 : 1);
                else ts = new Date(ts.replace(' UTC', 'Z')).getTime();
                
                let d = new Date(ts);
                if (!isNaN(d.getTime())) {
                    dateStr = d.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short', year: 'numeric' }) + ', ' + d.toLocaleTimeString('uk-UA', {hour: '2-digit', minute:'2-digit'});
                }
            }

            mapName = m.map ? m.map.replace('de_', '') : 'unknown';
            safeMapName = mapName.toLowerCase().replace(/\s+/g, '');
            mapName = mapName.charAt(0).toUpperCase() + mapName.slice(1);
            score = m.score ? m.score.replace(' / ', ':') : '-:-';
            isWin = (m.Result === "1" || m.Win === "true" || m.win === "1");
            let kd = (parseInt(m.Kills) / (parseInt(m.Deaths)||1)).toFixed(2);

            metricsHtml = `
                <div class="flex justify-between items-center mb-1"><span class="text-gray-500 uppercase font-bold text-xs">Elo після гри</span><span class="text-white font-black text-base tracking-wide">${dp.parsed.y}</span></div>
                <div class="flex justify-between items-center"><span class="text-gray-500 uppercase font-bold text-xs">K/D у матчі</span><span class="${kd >= 1 ? 'text-green-400' : 'text-red-400'} font-black text-base tracking-wide">${kd}</span></div>
            `;
        }
    }

    tooltipEl.innerHTML = `
        <div class="bg-[#18181b]/98 border ${isWin ? 'border-green-500/30' : 'border-red-500/30'} rounded-xl shadow-2xl p-4 backdrop-blur-md">
            <div class="text-xs text-gray-400 font-bold uppercase tracking-wider mb-3 border-b border-gray-800 pb-2 flex items-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                ${dateStr}
            </div>
            <div class="flex justify-between items-center mb-4">
                <div class="flex items-center gap-3">
                    <img src="assets/maps/${safeMapName}.png" onerror="this.src='assets/maps/unknown.png'" class="w-8 h-8 object-contain drop-shadow-md">
                    <span class="text-base font-bold text-white capitalize">${mapName}</span>
                </div>
                <span class="text-sm font-black ${isWin ? 'text-green-400 bg-green-500/10' : 'text-red-400 bg-red-500/10'} px-2 py-1 rounded border ${isWin ? 'border-green-500/20' : 'border-red-500/20'}">
                    ${isWin ? 'W' : 'L'} ${score}
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