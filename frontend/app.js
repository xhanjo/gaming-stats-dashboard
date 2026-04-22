let myChart = null;
let trendChart = null; 
let dailyChart = null; 
let weeklyChart = null; 
let rawMatchHistory = []; 
let currentMatchHistory = []; 
let trueKDVal = "0.00"; 
let radarChart = null; 
let eloChart = null;
let stabilityChart = null;
let clusterChartInstance = null;

let displayedMatchesCount = 0;
const MATCHES_PER_PAGE = 20;

function switchTab(tabId) {
    const tabs = ['tab-summary', 'tab-matches', 'tab-maps', 'tab-activity', 'tab-analytics'];
    
    tabs.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('text-faceit', 'border-faceit');
        btn.classList.add('text-gray-400', 'border-transparent');
    });

    const activeTab = document.getElementById(tabId);
    if (activeTab) activeTab.classList.remove('hidden');

    const activeBtn = document.getElementById('btn-' + tabId);
    if (activeBtn) {
        activeBtn.classList.add('text-faceit', 'border-faceit');
        activeBtn.classList.remove('text-gray-400', 'border-transparent');
    }
}

function getSearchHistory() { 
    try {
        const h = JSON.parse(localStorage.getItem('searchHistory'));
        return Array.isArray(h) ? h : [];
    } catch (e) {
        return [];
    }
}

function addToHistory(nickname) {
    let history = getSearchHistory();
    history = history.filter(h => h.toLowerCase() !== nickname.toLowerCase());
    history.unshift(nickname);
    history = history.slice(0, 5);
    localStorage.setItem('searchHistory', JSON.stringify(history));
    renderHistory();
}

function renderHistory() {
    const container = document.getElementById('searchHistory');
    container.innerHTML = getSearchHistory().map(name => `
        <button onclick="quickSearch('${name}')" class="history-tag text-xs font-bold text-gray-500 border border-gray-800 px-3 py-1 rounded-full transition-all">${name}</button>
    `).join('');
}

function quickSearch(nickname) {
    document.getElementById('nicknameInput').value = nickname;
    searchPlayer();
}

function goHome() {
    resetUI();
    document.getElementById('nicknameInput').value = "";
    document.getElementById('playerCard').classList.add('hidden');
}

function resetUI() {
    document.getElementById('errorMessage').style.display = 'none';
    const textIds = ['playerName', 'playerElo', 'playerMatches', 'playerWinrate', 'playerLifetimeKD', 'playerKD', 'playerKR', 'playerADR', 'playerHS', 'playerEntry', 'playerSniper'];
    textIds.forEach(id => document.getElementById(id).textContent = "-");
    
    document.getElementById('playerAvatar').src = "";
    document.getElementById('playerAvatar').classList.add('hidden');
    document.getElementById('playerFlag').src = "";
    document.getElementById('playerLevelIcon').src = "";
    document.getElementById('matchResults').innerHTML = "";
    
    const mapContainer = document.getElementById('mapStatsContainer');
    if (mapContainer) mapContainer.innerHTML = "";
    
    const tabs = ['tab-summary', 'tab-matches', 'tab-maps', 'tab-activity', 'tab-analytics'];
    tabs.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });

    document.getElementById('playerAvatarFallback').classList.remove('hidden');
    document.getElementById('playerLevelIcon').classList.add('hidden');

    if (myChart) { myChart.destroy(); myChart = null; }
    if (trendChart) { trendChart.destroy(); trendChart = null; }
    if (dailyChart) { dailyChart.destroy(); dailyChart = null; }
    if (weeklyChart) { weeklyChart.destroy(); weeklyChart = null; }
    if (clusterChartInstance) { clusterChartInstance.destroy(); clusterChartInstance = null; }
}

function toggleLoading(isLoading) {
    const btn = document.getElementById('searchBtn');
    const spinner = document.getElementById('btnSpinner');
    const mainLoader = document.getElementById('mainLoader');
    const input = document.getElementById('nicknameInput');
    const card = document.getElementById('playerCard');

    if (isLoading) {
        btn.disabled = true;
        spinner.classList.remove('hidden');
        mainLoader.classList.remove('hidden');
        card.classList.add('hidden');
        input.disabled = true;
    } else {
        btn.disabled = false;
        spinner.classList.add('hidden');
        mainLoader.classList.add('hidden');
        input.disabled = false;
    }
}

function getMatchTimestamp(m) {
    let rawTime = m.CreatedAt1 || m.UpdatedAt1 || m.CreatedAt2 || m.UpdatedAt2 || m["Created At"] || m["Updated At"] || m.created_at || m.updated_at;
    if (!rawTime) return 0;
    if (typeof rawTime === 'number') return rawTime * (rawTime < 10000000000 ? 1000 : 1);
    if (typeof rawTime === 'string' && !isNaN(rawTime)) return parseInt(rawTime) * (parseInt(rawTime) < 10000000000 ? 1000 : 1);
    if (typeof rawTime === 'string') return new Date(rawTime.replace(' UTC', 'Z')).getTime();
    return 0;
}

async function searchPlayer(event, limit = 30, isDeepScan = false) { 
    if (event) event.preventDefault();
    const nickname = document.getElementById('nicknameInput').value.trim();
    if (!nickname) return;

    if (!isDeepScan) {
        rawMatchHistory = [];
        currentMatchHistory = [];
        resetUI();
        toggleLoading(true);
    }

    const deepScanBtn = document.getElementById('deepScanBtn');
    if (deepScanBtn && isDeepScan) {
        deepScanBtn.innerHTML = `<div class="w-3 h-3 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin"></div> Сканування...`;
        deepScanBtn.disabled = true;
    }

    try {
        const response = await fetch(`http://localhost:8080/api/player/${nickname}?limit=${limit}`);
        const data = await response.json();

        if (!response.ok) throw new Error(data.error || 'Гравця не знайдено');
        if (!data.games || !data.games.cs2) throw new Error('Гравець не грає в CS2');

        addToHistory(data.nickname);
        document.getElementById('playerName').textContent = data.nickname;
        
        if (data.avatar) {
            const img = document.getElementById('playerAvatar');
            img.src = data.avatar;
            img.classList.remove('hidden');
            document.getElementById('playerAvatarFallback').classList.add('hidden');
        }

        if (data.country) {
            const flag = document.getElementById('playerFlag');
            flag.src = `https://flagcdn.com/w40/${data.country.toLowerCase()}.png`;
            flag.classList.remove('hidden');
            try { flag.title = new Intl.DisplayNames(['uk'], { type: 'region' }).of(data.country.toUpperCase()); } 
            catch (e) { flag.title = data.country.toUpperCase(); }
        }

        const elo = data.games.cs2.faceit_elo;
        let lvl = data.games.cs2.skill_level;
        if (lvl === 10 && elo >= 3806) lvl = 11;
        
        const lvlIcon = document.getElementById('playerLevelIcon');
        lvlIcon.dataset.lvl = lvl; 
        lvlIcon.src = `assets/level${lvl}.svg`;
        lvlIcon.classList.remove('hidden');
        document.getElementById('playerLevelFallback').classList.add('hidden');
        document.getElementById('playerElo').textContent = elo;

        document.getElementById('linkFaceit').href = `https://www.faceit.com/en/players/${data.nickname}`;
        if (data.steam_id_64) {
            document.getElementById('linkSteam').href = `https://steamcommunity.com/profiles/${data.steam_id_64}`;
        }

        if (data.stats && data.stats.lifetime) {
            document.getElementById('playerMatches').textContent = data.stats.lifetime["Matches"];
            document.getElementById('playerWinrate').textContent = data.stats.lifetime["Win Rate %"] + "%";
            document.getElementById('playerLifetimeKD').textContent = data.stats.lifetime["Average K/D Ratio"];
        }

        const mapContainer = document.getElementById('mapStatsContainer');
        if (mapContainer && data.stats && data.stats.segments) {
            const mapSegments = data.stats.segments.filter(s => s.type === "Map" && s.mode === "5v5");
            
            if (mapSegments.length > 0) {
                mapSegments.sort((a, b) => parseInt(b.stats["Matches"] || 0) - parseInt(a.stats["Matches"] || 0));

                mapContainer.innerHTML = mapSegments.map(mapData => {
                    const mapName = mapData.label.replace('de_', '');
                    const matches = parseInt(mapData.stats["Matches"] || 0);
                    const wins = parseInt(mapData.stats["Wins"] || 0);
                    const winRate = parseInt(mapData.stats["Win Rate %"] || 0);
                    const mapKD = parseFloat(mapData.stats["Average K/D Ratio"] || 0).toFixed(2);
                    
                    const wrColor = winRate >= 50 ? 'bg-green-500' : 'bg-red-500';
                    const barWidth = winRate; 

                    const safeMapName = mapName.toLowerCase().replace(/\s+/g, '');

                    return `
                    <div class="flex flex-col md:flex-row items-start md:items-center justify-between bg-gray-800/30 p-4 rounded-xl border border-gray-700/50 gap-4 transition-colors hover:bg-gray-800/50">
                        <div class="w-full md:w-1/4 font-bold text-white text-base md:text-lg capitalize tracking-wide flex items-center gap-2 md:gap-3">
                            <img src="assets/maps/${safeMapName}.png" onerror="this.style.display='none'; this.nextElementSibling.classList.remove('hidden');" class="w-6 h-6 md:w-8 md:h-8 object-contain drop-shadow-md">
                            <div class="hidden w-6 h-6 md:w-8 md:h-8 rounded-md bg-gray-700 flex items-center justify-center text-[10px] text-gray-400 font-mono shadow-inner">${mapName.substring(0, 2)}</div>
                            <span class="truncate max-w-[100px] md:max-w-none">${mapName}</span>
                        </div>
                        <div class="w-full md:w-2/4">
                            <div class="flex justify-between text-[10px] md:text-xs text-gray-400 mb-1.5 font-bold uppercase tracking-wider">
                                <span>Win Rate (${winRate}%)</span>
                                <span>${wins}W - ${matches - wins}L</span>
                            </div>
                            <div class="w-full bg-gray-700/50 h-2.5 rounded-full overflow-hidden shadow-inner">
                                <div class="h-full ${wrColor} transition-all duration-1000 rounded-full" style="width: ${barWidth}%"></div>
                            </div>
                        </div>
                        <div class="w-full md:w-1/4 flex justify-between md:justify-end gap-6 md:gap-8 text-sm">
                            <div class="text-center">
                                <span class="block text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-0.5">Матчів</span>
                                <strong class="text-white text-base">${matches}</strong>
                            </div>
                            <div class="text-center">
                                <span class="block text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-0.5">K/D</span>
                                <strong class="text-faceit text-base">${mapKD}</strong>
                            </div>
                        </div>
                    </div>`;
                }).join('');
            }
        }

        if (data.recent_form && data.recent_form.match_history) {
            let fetchedMatches = data.recent_form.match_history;
            
            rawMatchHistory = fetchedMatches;
            
            rawMatchHistory.sort((a, b) => getMatchTimestamp(b) - getMatchTimestamp(a));
            
            const uniqueMatches = [];
            const seenIds = new Set();
            rawMatchHistory.forEach(m => {
                const id = m["Match Id"] || m.match_id;
                if (id && !seenIds.has(id)) {
                    seenIds.add(id);
                    uniqueMatches.push(m);
                }
            });
            rawMatchHistory = uniqueMatches;

            const last30Matches = rawMatchHistory.slice(0, 30);
            const chronologicalHistory = [...last30Matches].reverse();

            let tKills = 0, tDeaths = 0, tADR = 0, tHS = 0, tKR = 0, tEntry = 0, tSniper = 0;
            let trendData = []; 

            const historyHtml = chronologicalHistory.map(m => {
                const kills = parseInt(m.Kills) || 0;
                const deaths = parseInt(m.Deaths) || 1;
                
                trendData.push((kills / deaths).toFixed(2));
                
                const res = m.Result || m.i10 || m.Win || m.win || "0";
                const isWin = (res.toString() === "1" || res.toString() === "true");
                
                const color = isWin ? "bg-green-500" : "bg-red-500";
                const label = isWin ? "W" : "L";

                return `<div class="flex-1 px-[1px] flex justify-center"><div class="w-full max-w-[24px] aspect-square ${color} rounded-sm flex items-center justify-center text-white font-bold shadow-sm text-[6px] sm:text-[10px] leading-none" title="Kills: ${kills}">${label}</div></div>`;      
            }).join('');
            
            document.getElementById('matchResults').innerHTML = historyHtml;

            last30Matches.forEach(m => {
                tKills += parseInt(m.Kills) || 0;
                tDeaths += parseInt(m.Deaths) || 1;
                tADR += parseFloat(m.ADR) || 0;
                tHS += parseFloat(m['Headshots %'] || m.HeadshotsPc) || 0;
                tKR += parseFloat(m['K/R Ratio'] || m.KRRatio) || 0;
                tEntry += parseInt(m['First Kills'] || m.FirstKills) || 0;
                tSniper += parseInt(m['Sniper Kills'] || m.SniperKills) || 0;
            });

            const validMatches = last30Matches.length || 1;

            trueKDVal = (tKills / (tDeaths || 1)).toFixed(2);
            document.getElementById('playerKD').textContent = trueKDVal;
            document.getElementById('playerKR').textContent = (tKR / validMatches).toFixed(2);
            document.getElementById('playerADR').textContent = (tADR / validMatches).toFixed(1);
            document.getElementById('playerHS').textContent = (tHS / validMatches).toFixed(1) + '%';
            document.getElementById('playerEntry').textContent = tEntry;
            document.getElementById('playerSniper').textContent = tSniper;

            currentMatchHistory = chronologicalHistory;
            drawTrendChart(trendData);
            changeChart('kd');

            renderAnalytics(data.recent_form, elo, rawMatchHistory);
            renderPlayActivity(rawMatchHistory);
            renderMatchTable(true); 
        }

        document.getElementById('playerCard').classList.remove('hidden');
        if (!isDeepScan) switchTab('tab-summary'); 

    } catch (error) {
        document.getElementById('errorMessage').textContent = error.message;
        document.getElementById('errorMessage').style.display = 'block';
    } finally {
        toggleLoading(false);
        const deepScanBtn = document.getElementById('deepScanBtn');
        if (deepScanBtn) {
            deepScanBtn.innerHTML = `<svg class="w-3.5 h-3.5 group-hover:animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"></path></svg> Глибокий аналіз (100 матчів)`;
            deepScanBtn.disabled = false;
        }
    }
}

function renderMatchTable(reset = false) {
    const tbody = document.getElementById('matchHistoryTableBody');
    const loadBtn = document.getElementById('loadMoreMatchesBtn');
    
    if (reset) {
        tbody.innerHTML = '';
        displayedMatchesCount = 0;
    }

    const nextMatches = rawMatchHistory.slice(displayedMatchesCount, displayedMatchesCount + MATCHES_PER_PAGE);

    let rowsHtml = nextMatches.map(m => {
        const mapNameRaw = m.map ? m.map.replace('de_', '') : 'Unknown';
        const safeMapName = mapNameRaw.toLowerCase().replace(/\s+/g, '');
        const mapDisplay = mapNameRaw.charAt(0).toUpperCase() + mapNameRaw.slice(1);

        const res = m.Result || m.i10 || m.Win || m.win || "0";
        const isWin = (res.toString() === "1" || res.toString() === "true");
        const resColor = isWin ? 'text-green-500' : 'text-red-500';
        const resText = isWin ? 'WIN' : 'LOSS';

        const kills = parseInt(m.Kills) || 0;
        const deaths = parseInt(m.Deaths) || 1;
        const assists = parseInt(m.Assists) || 0;
        const kd = (kills / (deaths || 1)).toFixed(2);
        const kdColor = kd >= 1 ? 'text-green-400' : 'text-red-400';

        const score = m.score ? m.score.replace(' / ', ':') : '-:-';

        const hsVal = m["Headshots %"] || m.HeadshotsPc || '-';
        const hsText = hsVal !== '-' ? hsVal + '%' : '-';

        let rawTime = m.CreatedAt1 || m.UpdatedAt1 || m.CreatedAt2 || m.UpdatedAt2 || m["Created At"] || m["Updated At"] || m.created_at || m.updated_at;
        let dateStr = "-";
        if (rawTime) {
            let ts = rawTime;
            if (typeof ts === 'number') ts = ts * (ts < 1e10 ? 1000 : 1);
            else if (!isNaN(ts)) ts = parseInt(ts) * (parseInt(ts) < 1e10 ? 1000 : 1);
            else ts = new Date(ts.replace(' UTC', 'Z')).getTime();
            
            let d = new Date(ts);
            if (!isNaN(d.getTime())) {
                dateStr = d.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' }) + ', ' + d.toLocaleTimeString('uk-UA', {hour: '2-digit', minute:'2-digit'});
            }
        }

        return `
        <tr class="hover:bg-gray-800/30 transition-colors group text-[11px] md:text-sm">
            <td class="py-3 pr-4 pl-2 text-gray-400 font-bold whitespace-nowrap">${dateStr}</td>
            <td class="py-3 pr-4">
                <div class="flex items-center gap-2 md:gap-3">
                    <img src="assets/maps/${safeMapName}.png" onerror="this.style.display='none'; this.nextElementSibling.classList.remove('hidden');" class="w-6 h-6 md:w-8 md:h-8 object-contain drop-shadow-md transition-transform group-hover:scale-110">
                    <div class="hidden w-6 h-6 md:w-8 md:h-8 rounded border border-gray-700 bg-gray-800 flex items-center justify-center text-[9px] md:text-[10px] text-gray-400 font-bold uppercase shadow-inner">${mapDisplay.substring(0, 2)}</div>
                    <span class="font-bold text-white capitalize">${mapDisplay}</span>
                </div>
            </td>
            <td class="py-3 pr-4">
                <div class="flex flex-col">
                    <span class="font-bold ${resColor}">${resText}</span>
                    <span class="text-[10px] md:text-[11px] text-gray-400 font-mono font-bold tracking-widest">${score}</span>
                </div>
            </td>
            <td class="py-3 pr-4 font-mono text-gray-300 font-bold tracking-wide">
                ${kills} <span class="text-gray-600">/</span> ${deaths} <span class="text-gray-600">/</span> ${assists}
            </td>
            <td class="py-3 pr-4 font-mono font-bold ${kdColor}">${kd}</td>
            <td class="py-3 pr-4 font-mono font-bold text-gray-300">${m.ADR || '-'}</td>
            <td class="py-3 font-mono font-bold text-gray-300">${hsText}</td>
        </tr>
        `;
    }).join('');

    if (reset) {
        tbody.innerHTML = rowsHtml;
    } else {
        tbody.innerHTML += rowsHtml;
    }

    displayedMatchesCount += nextMatches.length;

    if (loadBtn) {
        if (displayedMatchesCount >= rawMatchHistory.length) {
            loadBtn.classList.add('hidden');
        } else {
            loadBtn.classList.remove('hidden');
        }
    }
}

function loadMoreMatches() {
    renderMatchTable(false);
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
            <div class="flex justify-between"><span class="text-gray-500 uppercase font-bold text-[10px]">K/D</span><span class="text-white font-bold text-[13px]">${pt.x.toFixed(2)}</span></div>
            <div class="flex justify-between"><span class="text-gray-500 uppercase font-bold text-[10px]">ADR</span><span class="text-white font-bold text-[13px]">${pt.y.toFixed(1)}</span></div>
            <div class="flex justify-between mt-1"><span class="text-gray-500 uppercase font-bold text-[10px]">Кластер</span><span class="text-indigo-400 font-bold text-[13px]">${context.chart.data.datasets[dp.datasetIndex].label}</span></div>
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
                    <div class="flex justify-between items-center gap-2 mt-2 border-b border-gray-800/50 pb-1.5">
                        <span class="text-gray-400 font-bold text-[10px] uppercase">${datasetLabel}</span>
                        <div class="text-right">
                            <span class="${colorClass} font-bold text-[15px] block leading-tight">${val} Elo</span>
                            <span class="text-xs font-bold tracking-wide ${isWinStep ? 'text-green-400' : 'text-red-400'}">${changeTxt}</span>
                        </div>
                    </div>`;
            }).join('');

            tooltipEl.innerHTML = `
                <div class="bg-[#18181b]/98 border border-faceit/30 rounded-xl shadow-2xl p-4 backdrop-blur-md">
                    <div class="text-[11px] text-faceit font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path></svg>
                        Симуляція: Матч +${step}
                    </div>
                    <div class="space-y-1 font-mono">${metricsHtml}</div>
                </div>
            `;
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
                <div class="flex justify-between"><span class="text-gray-500 uppercase font-bold text-[10px]">Elo після гри</span><span class="text-white font-bold text-[13px]">${dp.parsed.y}</span></div>
                <div class="flex justify-between"><span class="text-gray-500 uppercase font-bold text-[10px]">K/D у матчі</span><span class="${kd >= 1 ? 'text-green-400' : 'text-red-400'} font-bold text-[13px]">${kd}</span></div>
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
        }
    }

    if (config.type === 'cluster') {
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
    }

    const position = context.chart.canvas.getBoundingClientRect();
    const chartWidth = context.chart.width;
    let leftPos = (tooltipModel.caretX > chartWidth * 0.5) 
        ? position.left + window.scrollX + tooltipModel.caretX - tooltipEl.offsetWidth - 25
        : position.left + window.scrollX + tooltipModel.caretX + 25;

    tooltipEl.style.opacity = 1;
    tooltipEl.style.left = leftPos + 'px';
    tooltipEl.style.top = position.top + window.scrollY + 15 + (tooltipModel.caretY * 0.1) + 'px';
}

function renderAnalytics(recentForm, currentElo, matches) {
    let tSniper = 0, tEntry = 0, tAssists = 0, tADR = 0, tHS = 0, tMulti = 0;
    let validMatches = matches.length || 1;
    
    let eloHistory = new Array(validMatches);
    let tempElo = currentElo;
    let recentWins = 0;

    matches.forEach((m, i) => {
        tSniper += parseInt(m['Sniper Kills'] || m.SniperKills) || 0;
        tEntry += parseInt(m['First Kills'] || m.FirstKills) || 0;
        tAssists += parseInt(m.Assists) || 0;
        tADR += parseFloat(m.ADR) || 0;
        tHS += parseFloat(m['Headshots %'] || m.HeadshotsPc) || 0;
        
        let triples = parseInt(m['Triple Kills'] || m.TripleKills) || 0;
        let quadros = parseInt(m['Quadro Kills'] || m.QuadroKills) || 0;
        let pentas = parseInt(m['Penta Kills'] || m.PentaKills) || 0;
        tMulti += (triples + quadros + pentas);

        eloHistory[validMatches - 1 - i] = tempElo;
        const res = m.Result || m.win || "0";
        if (res.toString() === "1" || res.toString() === "true") {
            tempElo -= 25; 
            recentWins++;
        } else {
            tempElo += 25; 
        }
    });

    let avgSniper = tSniper / validMatches;
    let avgEntry = tEntry / validMatches;
    let avgAssists = tAssists / validMatches;
    let avgADR = tADR / validMatches;
    let avgHS = tHS / validMatches;
    let avgMulti = tMulti / validMatches;

    let role = "Flex";
    if (avgSniper >= 6.0) role = "Main AWPer";
    else if (avgEntry >= 2.5 && avgADR >= 85.0) role = "Entry Fragger";
    else if (avgMulti >= 0.8 && avgADR >= 80.0) role = "Anchor";
    else if (avgHS >= 50.0 && avgADR >= 85.0) role = "Star Rifler";
    else if (avgAssists >= 4.5) role = "Support";

    document.getElementById('playstyleRoleText').textContent = role;

    let nSniper = Math.min(((avgSniper) / 8) * 100, 100); 
    let nEntry = Math.min(((avgEntry) / 3.5) * 100, 100);
    let nAssists = Math.min(((avgAssists) / 6) * 100, 100);
    let nADR = Math.min(((avgADR) / 105) * 100, 100);
    let nHS = Math.min(((avgHS) / 60) * 100, 100); 
    let nMulti = Math.min(((avgMulti) / 1.2) * 100, 100); 
    
    let rawRadarStats = [
        `${avgSniper.toFixed(2)} AWP кілів / матч`,
        `${avgEntry.toFixed(2)} First kills / матч`,
        `${avgAssists.toFixed(2)} Асистів / матч`,
        `${avgMulti.toFixed(2)} Мультикілів (3k+) / матч`,
        `${avgHS.toFixed(1)}% Headshots (в сер.)`,
        `${avgADR.toFixed(1)} ADR (в сер.)`
    ];

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

    let kdArray = matches.map(m => {
        let k = parseInt(m.Kills) || 0;
        let d = parseInt(m.Deaths) || 1;
        return k / d;
    });

    let meanKD = kdArray.reduce((a, b) => a + b, 0) / validMatches;
    let sumSquaredDiffs = kdArray.reduce((sum, kd) => sum + Math.pow(kd - meanKD, 2), 0);
    let kdStdDev = Math.sqrt(sumSquaredDiffs / validMatches);

    let stabilityScore = Math.max(0, 100 - (kdStdDev * 75)); 
    let roundedScore = Math.round(stabilityScore);

    let statusText = "Максимальна";
    let gaugeColor = '#10b981'; 
    if (roundedScore < 85) { statusText = "Висока"; gaugeColor = '#3b82f6'; } 
    if (roundedScore < 70) { statusText = "Середня"; gaugeColor = '#f59e0b'; } 
    if (roundedScore < 30) { statusText = "Низька"; gaugeColor = '#ef4444'; } 

    document.getElementById('stabilityScoreText').textContent = roundedScore + "%";
    document.getElementById('stabilityScoreText').style.color = gaugeColor;
    document.getElementById('stabilityStatusText').textContent = statusText;

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

    let clusterData = matches.map(m => {
        let k = parseInt(m.Kills) || 0;
        let d = parseInt(m.Deaths) || 1;
        let adr = parseFloat(m.ADR) || 0;
        return {
            x: k / d,
            y: adr,
            rawMatch: m 
        };
    });

    let centroids = [
        { x: 0.5, y: 50 },  
        { x: 1.0, y: 75 },  
        { x: 1.5, y: 100 }  
    ];

    for (let iter = 0; iter < 10; iter++) {
        let clusters = [[], [], []];
        
        clusterData.forEach(point => {
            let distances = centroids.map(c => 
                Math.pow((point.x - c.x) * 50, 2) + Math.pow(point.y - c.y, 2)
            );
            let minIndex = distances.indexOf(Math.min(...distances));
            point.cluster = minIndex;
            clusters[minIndex].push(point);
        });

        centroids = clusters.map((cluster, i) => {
            if (cluster.length === 0) return centroids[i];
            let sumX = cluster.reduce((sum, p) => sum + p.x, 0);
            let sumY = cluster.reduce((sum, p) => sum + p.y, 0);
            return { x: sumX / cluster.length, y: sumY / cluster.length };
        });
    }

    centroids.forEach((c, i) => c.originalIndex = i);
    centroids.sort((a, b) => (b.x * 50 + b.y) - (a.x * 50 + a.y));
    
    let starClusterId = centroids[0].originalIndex;
    let midClusterId = centroids[1].originalIndex;
    let lowClusterId = centroids[2].originalIndex;

    let starPts = clusterData.filter(p => p.cluster === starClusterId);
    let midPts = clusterData.filter(p => p.cluster === midClusterId);
    let lowPts = clusterData.filter(p => p.cluster === lowClusterId);

    let starPct = Math.round((starPts.length / validMatches) * 100);
    let midPct = Math.round((midPts.length / validMatches) * 100);
    let lowPct = Math.round((lowPts.length / validMatches) * 100);

    document.getElementById('clusterSummaryText').innerHTML = 
        `<span class="text-green-400 font-bold">${starPct}% Carry</span> • 
         <span class="text-yellow-500 font-bold">${midPct}% Average</span> • 
         <span class="text-red-400 font-bold">${lowPct}% Low impact</span>`;

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

    let futureSteps = 10;
    let wr = recentWins / validMatches;
    wr = Math.max(0.2, Math.min(0.8, wr)); 

    let expWins = Math.round(futureSteps * wr);
    let mcStdDev = Math.round(Math.sqrt(futureSteps * wr * (1 - wr)));
    
    let optWins = Math.min(futureSteps, expWins + mcStdDev + 1);
    let pesWins = Math.max(0, expWins - mcStdDev - 1);

    function generateRealisticPath(startElo, winsCount) {
        let lossesCount = futureSteps - winsCount;
        let steps = Array(winsCount).fill(25).concat(Array(lossesCount).fill(-25));
        
        for (let i = steps.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [steps[i], steps[j]] = [steps[j], steps[i]];
        }
        
        let path = [];
        let current = startElo;
        for(let step of steps) {
            current += step;
            path.push(current);
        }
        return path;
    }

    let expectedArray = generateRealisticPath(currentElo, expWins);
    let optimisticArray = generateRealisticPath(currentElo, optWins);
    let pessimisticArray = generateRealisticPath(currentElo, pesWins);
    let futureLabels = Array.from({length: futureSteps}, (_, i) => '+' + (i + 1));

    let finalExpected = expectedArray[futureSteps - 1];
    let finalOpt = optimisticArray[futureSteps - 1];
    let finalPes = pessimisticArray[futureSteps - 1];

    document.getElementById('predictedEloText').innerHTML = `
        <span class="text-gray-500 text-xl font-medium">${currentElo}</span>
        <span class="text-gray-600 mx-1 text-xl">→</span>
        <span class="text-white">${finalExpected}</span>
    `;
    
    let trendEl = document.getElementById('eloTrendText');
    trendEl.innerHTML = `<span class="text-gray-400 font-medium">Сценарії (10 ігор): </span>
                         <span class="text-green-500 font-bold ml-1">↑${finalOpt} (${optWins}W)</span>
                         <span class="text-gray-600 mx-1">/</span>
                         <span class="text-red-500 font-bold">↓${finalPes} (${pesWins}W)</span>`;

    let labels = Array.from({length: validMatches}, (_, i) => i + 1).concat(futureLabels);
    
    let optData = Array(validMatches - 1).fill(null).concat([currentElo, ...optimisticArray]);
    let pesData = Array(validMatches - 1).fill(null).concat([currentElo, ...pessimisticArray]);
    let expData = [...eloHistory, ...expectedArray];

    let baseColors = Array(validMatches).fill('#ff5500');

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

    let winCondContainer = document.getElementById('winConditionsContainer');
    if (winCondContainer) {
        let baselineWr = Math.round((recentWins / validMatches) * 100);

        let highAdrMatches = matches.filter(m => (parseFloat(m.ADR) || 0) >= avgADR);
        let highAdrWins = highAdrMatches.filter(m => (m.Result === "1" || m.Win === "true" || m.win === "1")).length;
        let highAdrWr = highAdrMatches.length > 0 ? Math.round((highAdrWins / highAdrMatches.length) * 100) : 0;

        let highKdMatches = matches.filter(m => (parseInt(m.Kills) / (parseInt(m.Deaths) || 1)) >= 1.15);
        let highKdWins = highKdMatches.filter(m => (m.Result === "1" || m.Win === "true" || m.win === "1")).length;
        let highKdWr = highKdMatches.length > 0 ? Math.round((highKdWins / highKdMatches.length) * 100) : 0;

        let assistMatches = matches.filter(m => (parseInt(m.Assists) || 0) >= 5);
        let assistWins = assistMatches.filter(m => (m.Result === "1" || m.Win === "true" || m.win === "1")).length;
        let assistWr = assistMatches.length > 0 ? Math.round((assistWins / assistMatches.length) * 100) : 0;

        function getWrColor(wrVal, baseline) {
            if (wrVal >= baseline + 10) return 'text-green-400';
            if (wrVal <= baseline - 10) return 'text-red-400';
            return 'text-yellow-400';
        }

        winCondContainer.innerHTML = `
            <div class="bg-[#18181b] border border-gray-800 rounded-xl p-4 flex flex-col justify-between shadow-inner">
                <span class="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full bg-blue-500"></span> ADR вище ${Math.round(avgADR)}
                </span>
                <div class="flex items-end justify-between mt-2">
                    <span class="text-3xl font-black ${getWrColor(highAdrWr, baselineWr)}">${highAdrWr}%</span>
                    <span class="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Вінрейт</span>
                </div>
            </div>
            <div class="bg-[#18181b] border border-gray-800 rounded-xl p-4 flex flex-col justify-between shadow-inner">
                <span class="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full bg-emerald-500"></span> K/D більше 1.15
                </span>
                <div class="flex items-end justify-between mt-2">
                    <span class="text-3xl font-black ${getWrColor(highKdWr, baselineWr)}">${highKdWr}%</span>
                    <span class="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Вінрейт</span>
                </div>
            </div>
            <div class="bg-[#18181b] border border-gray-800 rounded-xl p-4 flex flex-col justify-between shadow-inner">
                <span class="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full bg-purple-500"></span> 5+ Асистів за гру
                </span>
                <div class="flex items-end justify-between mt-2">
                    <span class="text-3xl font-black ${getWrColor(assistWr, baselineWr)}">${assistWr}%</span>
                    <span class="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Вінрейт</span>
                </div>
            </div>
        `;
    }
}

function renderPlayActivity(matches) {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;

    let hoursData = Array.from({length: 24}, () => ({m: 0, w: 0}));
    let daysData = Array.from({length: 7}, () => ({m: 0, w: 0}));
    let matchCountsByDate = {};
    
    let totalMatches = 0;
    let totalWins = 0;
    let currentMonthMatches = 0;
    let uniqueDays = new Set();

    let sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(now.getMonth() - 6);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    matches.forEach((m, index) => {
        let rawTime = m.CreatedAt1 || m.UpdatedAt1 || m.CreatedAt2 || m.UpdatedAt2 || m["Created At"] || m["Updated At"] || m.created_at || m.updated_at;
        let d = null;

        if (rawTime) {
            if (typeof rawTime === 'number') {
                let ts = rawTime;
                if (ts < 10000000000) ts *= 1000; 
                d = new Date(ts);
            } else if (typeof rawTime === 'string') {
                if (!isNaN(rawTime)) { 
                    let ts = parseInt(rawTime);
                    if (ts < 10000000000) ts *= 1000;
                    d = new Date(ts);
                } else { 
                    d = new Date(rawTime.replace(' UTC', 'Z')); 
                }
            }
        }

        if (!d || isNaN(d.getTime())) {
            d = new Date();
            d.setDate(d.getDate() - (index % 5)); 
            d.setHours(12, 0, 0, 0);
        }

        if (d >= sixMonthsAgo) {
            totalMatches++;
            const res = m.Result || m.i10 || m.Win || m.win || "0";
            const isWin = (res.toString() === "1" || res.toString() === "true");
            if (isWin) totalWins++;

            let hour = d.getHours();
            hoursData[hour].m++;
            if(isWin) hoursData[hour].w++;

            let day = d.getDay();
            let jsDay = day === 0 ? 6 : day - 1; 
            daysData[jsDay].m++;
            if(isWin) daysData[jsDay].w++;

            let dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
            uniqueDays.add(dateStr);
            matchCountsByDate[dateStr] = (matchCountsByDate[dateStr] || 0) + 1;

            if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
                currentMonthMatches++;
            }
        }
    });
    
    let currentMonthUk = now.toLocaleString('uk-UA', { month: 'long' });

    document.getElementById('paMatches').textContent = totalMatches;
    document.getElementById('paDays').textContent = uniqueDays.size; 
    document.getElementById('paMonth').textContent = currentMonthUk.charAt(0).toUpperCase() + currentMonthUk.slice(1);
    document.getElementById('paMonthMatches').textContent = currentMonthMatches;

    let maxHour = 0, maxHourVal = -1;
    hoursData.forEach((data, i) => {
        if (data.m > maxHourVal) { maxHourVal = data.m; maxHour = i; }
    });
    let ampm = maxHour >= 12 ? 'PM' : 'AM';
    let displayHour = maxHour % 12 || 12;
    document.getElementById('paHour').textContent = displayHour + ampm;

    let hourWinrate = maxHourVal > 0 ? Math.round((hoursData[maxHour].w / maxHourVal) * 100) : 0;
    document.getElementById('paHourWinrate').textContent = hourWinrate + "%";
    document.getElementById('paHourWinrate').className = hourWinrate >= 50 ? 'text-green-400' : 'text-red-400';

    let daysDivider = uniqueDays.size > 0 ? uniqueDays.size : 1;
    let weeksDivider = Math.max(1, uniqueDays.size / 7);
    
    document.getElementById('paAvgDaily').textContent = (totalMatches / daysDivider).toFixed(1);
    document.getElementById('paAvgWeekly').textContent = (totalMatches / weeksDivider).toFixed(1);

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

    const heatmapGrid = document.getElementById('heatmapGrid');
    heatmapGrid.innerHTML = '';
    heatmapGrid.className = 'flex flex-1 justify-between gap-4 w-full'; 
    
    let currentYear = now.getFullYear();
    let currentMonth = now.getMonth();

    for (let i = 5; i >= 0; i--) {
        let monthDate = new Date(currentYear, currentMonth - i, 1);
        let year = monthDate.getFullYear();
        let monthIndex = monthDate.getMonth();

        let rawMonthName = monthDate.toLocaleString('uk-UA', { month: 'long' });
        let monthName = rawMonthName.charAt(0).toUpperCase() + rawMonthName.slice(1);
        let headerText = (monthIndex === 0) ? `<span class="text-white">${year}</span> ${monthName}` : monthName;

        let daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
        let firstDayOfWeek = monthDate.getDay();
        let startPad = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1; 

        let monthHtml = `
        <div class="flex flex-col flex-1">
            <span class="text-[10px] font-bold text-gray-400 mb-2 border-b border-gray-800 pb-1 tracking-wider whitespace-nowrap">${headerText}</span>
            <div class="grid grid-rows-7 grid-flow-col gap-1 md:gap-1.5">
        `;

        for (let p = 0; p < startPad; p++) {
            monthHtml += `<div class="w-3 h-3 md:w-3.5 md:h-3.5"></div>`;
        }

        for (let d = 1; d <= daysInMonth; d++) {
            let cellDate = new Date(year, monthIndex, d);

            if (cellDate > now) {
                monthHtml += `<div class="w-3 h-3 md:w-3.5 md:h-3.5 rounded-sm bg-[#18181b] border border-gray-800/50 opacity-40 pointer-events-none"></div>`;
                continue; 
            }

            let dateStr = `${year}-${String(monthIndex+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
            let count = matchCountsByDate[dateStr] || 0;

            let colorClass = 'bg-[#18181b] border border-gray-800/50';
            if (count >= 5) colorClass = 'bg-[#d946ef]';
            else if (count >= 3) colorClass = 'bg-[#a21caf]';
            else if (count >= 1) colorClass = 'bg-[#6b21a8]';

            let niceDate = cellDate.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short', year: 'numeric' });
            let title = count > 0 ? `${niceDate}: ігор — ${count}` : `${niceDate}: немає ігор`;

            monthHtml += `<div class="w-3 h-3 md:w-3.5 md:h-3.5 rounded-sm ${colorClass} transition-all hover:scale-125 hover:z-10 relative cursor-crosshair" title="${title}"></div>`;
        }

        monthHtml += `</div></div>`;
        heatmapGrid.innerHTML += monthHtml;
    }
}

function drawTrendChart(dataPoints) {
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
            <div class="flex justify-between"><span class="text-gray-500 uppercase font-bold text-[10px]">K/D/A</span><span class="text-white font-bold text-[13px]">${match.Kills}/${match.Deaths}/${match.Assists}</span></div>
            <div class="flex justify-between"><span class="text-gray-500 uppercase font-bold text-[10px]">K/D</span><span class="${(match.Kills/match.Deaths) >= 1 ? 'text-green-400' : 'text-red-400'} font-bold text-[13px]">${(match.Kills/match.Deaths).toFixed(2)}</span></div>
            <div class="flex justify-between"><span class="text-gray-500 uppercase font-bold text-[10px]">K/R</span><span class="text-white font-bold text-[13px]">${kr}</span></div>
            <div class="flex justify-between"><span class="text-gray-500 uppercase font-bold text-[10px]">HS%</span><span class="text-white font-bold text-[13px]">${hs}${hsSuffix}</span></div>
        `;
    } else {
        const metricName = document.getElementById('panelMetricName').textContent;
        metricsHtml = `<div class="flex justify-between"><span class="text-gray-500 uppercase font-bold text-[11px]">${metricName}</span><span class="text-white font-bold text-[13px]">${tooltipModel.dataPoints[0].formattedValue}</span></div>`;
    }

    tooltipEl.innerHTML = `
        <div class="bg-[#18181b]/98 border ${config.color === 'indigo' ? 'border-indigo-500/50' : 'border-gray-700'} rounded-xl shadow-2xl p-4 backdrop-blur-md">
            <div class="text-[11px] text-gray-500 font-bold uppercase tracking-wider mb-3 border-b border-gray-800 pb-2 italic">${dateStr}</div>
            <div class="flex justify-between items-center mb-3">
                <div class="flex items-center gap-3">
                    <img src="assets/maps/${safeMapName}.png" onerror="this.src='assets/maps/unknown.png'" class="w-7 h-7 object-contain drop-shadow-md">
                    <span class="text-sm font-bold text-white capitalize">${mapName}</span>
                </div>
                <span class="text-xs font-black text-white ${config.color === 'indigo' ? 'bg-indigo-500/20 border-indigo-500/30' : 'bg-black/40 border-gray-800'} px-2 py-1 rounded border">
                    ${isWin ? 'W' : 'L'} ${score}
                </span>
            </div>
            <div class="space-y-2 font-mono">${metricsHtml}</div>
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

function changeChart(metric) {
    if (!currentMatchHistory.length) return;
    const btns = ['kd', 'kr', 'hs', 'adr'];
    btns.forEach(b => document.getElementById(`btn-${b}`).className = (b === metric) ? 
        "px-5 py-1.5 rounded-full text-sm font-bold bg-faceit text-white transition-colors" : 
        "px-5 py-1.5 rounded-full text-sm font-bold bg-gray-800 text-gray-400 hover:bg-gray-700 transition-colors");

    let dataPoints = [], metricLabel = metric.toUpperCase(), displayAvg = "";
    if (metric === 'kd') {
        dataPoints = currentMatchHistory.map(m => (parseInt(m.Kills) / (parseInt(m.Deaths) || 1)).toFixed(2));
        displayAvg = trueKDVal;
    } else if (metric === 'kr') {
        dataPoints = currentMatchHistory.map(m => parseFloat(m['K/R Ratio']));
        displayAvg = (dataPoints.reduce((a, b) => a + b, 0) / dataPoints.length).toFixed(2);
    } else if (metric === 'hs') {
        dataPoints = currentMatchHistory.map(m => parseFloat(m['Headshots %']));
        displayAvg = (dataPoints.reduce((a, b) => a + b, 0) / dataPoints.length).toFixed(0) + '%';
    } else if (metric === 'adr') {
        dataPoints = currentMatchHistory.map(m => parseFloat(m.ADR));
        displayAvg = (dataPoints.reduce((a, b) => a + b, 0) / dataPoints.length).toFixed(1);
    }

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
            interaction: { 
                mode: 'index', 
                intersect: false 
            }
        }
    });

    document.getElementById('panelMetricName').textContent = metricLabel;
    document.getElementById('panelCurrentVal').textContent = displayAvg;
    document.getElementById('panelHighVal').textContent = Math.max(...dataPoints.map(Number)).toFixed(2) + (metric === 'hs' ? '%' : '');
    document.getElementById('panelLowVal').textContent = Math.min(...dataPoints.map(Number)).toFixed(2) + (metric === 'hs' ? '%' : '');
}

renderHistory();