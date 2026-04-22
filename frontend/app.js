import * as Charts from './charts.js';

let rawMatchHistory = []; 
let currentMatchHistory = []; 
let trueKDVal = "0.00"; 
let displayedMatchesCount = 0;
const MATCHES_PER_PAGE = 20;

window.switchTab = switchTab;
window.quickSearch = quickSearch;
window.goHome = goHome;
window.searchPlayer = searchPlayer;
window.loadMoreMatches = loadMoreMatches;
window.changeChart = changeChart;

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

    let footerEl = document.getElementById('appFooter');
    if (footerEl) footerEl.classList.add('hidden');

    Charts.destroyAllCharts();
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
            
            Charts.renderTrendChart(trendData, currentMatchHistory);
            changeChart('kd');

            renderAnalytics(data.recent_form, elo, rawMatchHistory);
            renderPlayActivity(rawMatchHistory);
            renderMatchTable(true); 
        }

        document.getElementById('playerCard').classList.remove('hidden');
        
        let footerEl = document.getElementById('appFooter');
        if (footerEl) footerEl.classList.remove('hidden');
        
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

    Charts.renderRadarChart(nSniper, nEntry, nAssists, nMulti, nHS, nADR, rawRadarStats);

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

    Charts.renderStabilityChart(roundedScore, gaugeColor);

    let clusterData = matches.map(m => {
        let k = parseInt(m.Kills) || 0;
        let d = parseInt(m.Deaths) || 1;
        let adr = parseFloat(m.ADR) || 0;
        return { x: k / d, y: adr, rawMatch: m };
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
         <span class="text-red-400 font-bold">${lowPct}% Low Impact</span>`;

    Charts.renderClusterChart(starPts, midPts, lowPts);

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

    Charts.renderEloChart(labels, expData, optData, pesData, validMatches, futureSteps, matches, baseColors);

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

    Charts.renderActivityCharts(hoursData, daysData);

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

    document.getElementById('panelMetricName').textContent = metricLabel;
    document.getElementById('panelCurrentVal').textContent = displayAvg;
    document.getElementById('panelHighVal').textContent = Math.max(...dataPoints.map(Number)).toFixed(2) + (metric === 'hs' ? '%' : '');
    document.getElementById('panelLowVal').textContent = Math.min(...dataPoints.map(Number)).toFixed(2) + (metric === 'hs' ? '%' : '');

    Charts.renderPerformanceChart(dataPoints, currentMatchHistory);
}

renderHistory();

renderHistory();


document.getElementById('searchBtn').addEventListener('click', function(event) {
    event.preventDefault(); 
    searchPlayer();
});

document.getElementById('nicknameInput').addEventListener('keypress', function(event) {
    if (event.key === 'Enter') {
        event.preventDefault(); 
        searchPlayer();
    }
});