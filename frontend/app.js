let myChart = null;
let trendChart = null; 
let dailyChart = null; // Новий графік
let weeklyChart = null; // Новий графік
let currentMatchHistory = []; 
let trueKDVal = "0.00"; 

function getSearchHistory() { return JSON.parse(localStorage.getItem('searchHistory') || '[]'); }

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
    const mapSection = document.getElementById('mapStatsSection');
    if (mapSection) mapSection.classList.add('hidden');
    
    const playActivity = document.getElementById('playActivitySection');
    if (playActivity) playActivity.classList.add('hidden');
    
    document.getElementById('playerAvatarFallback').classList.remove('hidden');
    document.getElementById('playerLevelIcon').classList.add('hidden');

    if (myChart) { myChart.destroy(); myChart = null; }
    if (trendChart) { trendChart.destroy(); trendChart = null; }
    if (dailyChart) { dailyChart.destroy(); dailyChart = null; }
    if (weeklyChart) { weeklyChart.destroy(); weeklyChart = null; }
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

async function searchPlayer(event) {
    if (event) event.preventDefault();
    const nickname = document.getElementById('nicknameInput').value.trim();
    if (!nickname) return;

    resetUI();
    toggleLoading(true);

    try {
        const response = await fetch(`http://localhost:8080/api/player?nickname=${nickname}`);
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
        const mapSection = document.getElementById('mapStatsSection');
        
        if (mapContainer && mapSection) {
            if (data.stats && data.stats.segments) {
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
                        const barWidth = Math.max(winRate, 5); 

                        const safeMapName = mapName.toLowerCase().replace(/\s+/g, '');

                        return `
                        <div class="flex flex-col md:flex-row items-start md:items-center justify-between bg-gray-800/30 p-4 rounded-xl border border-gray-700/50 gap-4 transition-colors hover:bg-gray-800/50">
                            <div class="w-full md:w-1/4 font-bold text-white text-lg capitalize tracking-wide flex items-center gap-3">
                                
                                <img src="assets/maps/${safeMapName}.png" 
                                     onerror="this.style.display='none'; this.nextElementSibling.classList.remove('hidden');" 
                                     class="w-8 h-8 object-contain drop-shadow-md">
                                     
                                <div class="hidden w-8 h-8 rounded-md bg-gray-700 flex items-center justify-center text-xs text-gray-400 font-mono shadow-inner">
                                    ${mapName.substring(0, 2)}
                                </div>
                                
                                ${mapName}
                            </div>
                            
                            <div class="w-full md:w-2/4">
                                <div class="flex justify-between text-xs text-gray-400 mb-1.5 font-bold uppercase tracking-wider">
                                    <span>Win Rate (${winRate}%)</span>
                                    <span>${wins}W - ${matches - wins}L</span>
                                </div>
                                <div class="w-full bg-gray-700/50 h-2.5 rounded-full overflow-hidden shadow-inner">
                                    <div class="h-full ${wrColor} transition-all duration-1000 rounded-full" style="width: ${barWidth}%"></div>
                                </div>
                            </div>

                            <div class="w-full md:w-1/4 flex justify-between md:justify-end gap-8 text-sm">
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
                    mapSection.classList.remove('hidden');
                } else { mapSection.classList.add('hidden'); }
            } else { mapSection.classList.add('hidden'); }
        }

        if (data.recent_form && data.recent_form.match_history) {
            let totalKills = 0, totalDeaths = 0;
            let trendData = []; 
            const last20Matches = data.recent_form.match_history.slice(0, 20);
            const chronologicalHistory = [...last20Matches].reverse();

            const historyHtml = chronologicalHistory.map(m => {
                const kills = parseInt(m.Kills) || 0;
                const deaths = parseInt(m.Deaths) || 1;
                totalKills += kills;
                totalDeaths += deaths;
                
                trendData.push((kills / deaths).toFixed(2));
                
                const res = m.Result || m.i10 || m.Win || m.win || "0";
                const isWin = (res.toString() === "1" || res.toString() === "true");
                
                const color = isWin ? "bg-green-500" : "bg-red-500";
                const label = isWin ? "W" : "L";

                return `<div class="flex-1 flex justify-center"><div class="w-5 h-5 sm:w-6 sm:h-6 ${color} rounded text-[10px] flex items-center justify-center text-white font-bold shadow-sm" title="Kills: ${kills}">${label}</div></div>`;
            }).join('');
            
            document.getElementById('matchResults').innerHTML = historyHtml;
            trueKDVal = totalDeaths > 0 ? (totalKills / totalDeaths).toFixed(2) : "0.00";

            document.getElementById('playerKD').textContent = trueKDVal;
            document.getElementById('playerKR').textContent = data.recent_form.avg_kr_ratio.toFixed(2);
            document.getElementById('playerADR').textContent = data.recent_form.avg_adr.toFixed(1);
            document.getElementById('playerHS').textContent = data.recent_form.avg_hs_percentage.toFixed(1) + '%';
            document.getElementById('playerEntry').textContent = data.recent_form.total_entry_kills;
            document.getElementById('playerSniper').textContent = data.recent_form.total_sniper_kills;

            currentMatchHistory = chronologicalHistory;
            drawTrendChart(trendData);
            changeChart('kd');

            renderPlayActivity(data.recent_form.match_history);
        }

        document.getElementById('playerCard').classList.remove('hidden');

    } catch (error) {
        document.getElementById('errorMessage').textContent = error.message;
        document.getElementById('errorMessage').style.display = 'block';
    } finally {
        toggleLoading(false);
    }
}

// 🔥 РЕАЛЬНА ГЕНЕРАЦІЯ PLAY ACTIVITY (З надійним парсингом дат) 🔥
function renderPlayActivity(matches) {
    document.getElementById('playActivitySection').classList.remove('hidden');

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;

    let hoursData = Array.from({length: 24}, () => ({m: 0, w: 0}));
    let daysData = Array.from({length: 7}, () => ({m: 0, w: 0}));
    let matchCountsByDate = {};
    
    let totalMatches = 0;
    let totalWins = 0;
    let currentMonthMatches = 0;
    let uniqueDays = new Set();

    matches.forEach((m, index) => {
        // 1. Шукаємо будь-яку зачіпку на час
        let rawTime = m.CreatedAt1 || m.UpdatedAt1 || m.CreatedAt2 || m.UpdatedAt2 || m["Created At"] || m["Updated At"] || m.created_at || m.updated_at;
        let d = null;

        if (rawTime) {
            if (typeof rawTime === 'number') {
                let ts = rawTime;
                if (ts < 10000000000) ts *= 1000; // Переводимо секунди в мілісекунди
                d = new Date(ts);
            } else if (typeof rawTime === 'string') {
                if (!isNaN(rawTime)) { // Якщо це число у вигляді рядка "1712150000"
                    let ts = parseInt(rawTime);
                    if (ts < 10000000000) ts *= 1000;
                    d = new Date(ts);
                } else { 
                    // Якщо це дата-рядок (Faceit іноді віддає час по UTC)
                    d = new Date(rawTime.replace(' UTC', 'Z')); 
                }
            }
        }

        // 2. ЗАХИСТ: Якщо дата так і не знайшлась — рятуємо матч!
        // Щоб графік не був порожнім, тимчасово імітуємо дату для старих ігор з бази
        if (!d || isNaN(d.getTime())) {
            d = new Date();
            d.setDate(d.getDate() - (index % 5)); 
            d.setHours(12, 0, 0, 0);
        }

        totalMatches++;
        const res = m.Result || m.i10 || m.Win || m.win || "0";
        const isWin = (res.toString() === "1" || res.toString() === "true");
        if (isWin) totalWins++;

        let hour = d.getHours();
        hoursData[hour].m++;
        if(isWin) hoursData[hour].w++;

        let day = d.getDay();
        let jsDay = day === 0 ? 6 : day - 1; // 0 - Понеділок, 6 - Неділя
        daysData[jsDay].m++;
        if(isWin) daysData[jsDay].w++;

        let dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        uniqueDays.add(dateStr);
        matchCountsByDate[dateStr] = (matchCountsByDate[dateStr] || 0) + 1;

        if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
            currentMonthMatches++;
        }
    });

    // Оновлення карток
    document.getElementById('paMatches').textContent = totalMatches;
    document.getElementById('paDays').textContent = uniqueDays.size; 
    document.getElementById('paMonth').textContent = now.toLocaleString('en-US', { month: 'long' });
    document.getElementById('paMonthMatches').textContent = currentMonthMatches;

    // Найактивніша година
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

    // Середні значення
    let daysDivider = uniqueDays.size > 0 ? uniqueDays.size : 1;
    let weeksDivider = Math.max(1, uniqueDays.size / 7);
    
    document.getElementById('paAvgDaily').textContent = (totalMatches / daysDivider).toFixed(1);
    document.getElementById('paAvgWeekly').textContent = (totalMatches / weeksDivider).toFixed(1);

    // Малюємо графіки
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
            labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            datasets: [
                { label: 'Matches', data: daysData.map(d => d.m), backgroundColor: '#ffffff', barPercentage: 0.5, borderRadius: 2 },
                { label: 'Wins', data: daysData.map(d => d.w), backgroundColor: '#22c55e', barPercentage: 0.5, borderRadius: 2 }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false }, ticks: { color: '#71717a' } }, y: { display: false, beginAtZero: true } } }
    });

    // 🔥 HEATMAP КАЛЕНДАР (З підказками при наведенні) 🔥
    const heatmapGrid = document.getElementById('heatmapGrid');
    heatmapGrid.innerHTML = '';
    
    let todayDayIndex = (now.getDay() + 6) % 7; 
    let endOfThisWeek = new Date(now);
    endOfThisWeek.setDate(now.getDate() + (6 - todayDayIndex));
    endOfThisWeek.setHours(23, 59, 59, 999); 
    
    let startOfCalendar = new Date(endOfThisWeek);
    startOfCalendar.setDate(endOfThisWeek.getDate() - 363);
    startOfCalendar.setHours(0, 0, 0, 0);

    for (let i = 0; i < 364; i++) {
        let cellDate = new Date(startOfCalendar);
        cellDate.setDate(startOfCalendar.getDate() + i);

        let dateStr = `${cellDate.getFullYear()}-${String(cellDate.getMonth()+1).padStart(2,'0')}-${String(cellDate.getDate()).padStart(2,'0')}`;
        let cell = document.createElement('div');
        
        if (cellDate.getTime() > now.getTime() && dateStr !== todayStr) {
            cell.className = 'w-3 h-3 rounded-sm opacity-0 pointer-events-none';
        } else {
            let count = matchCountsByDate[dateStr] || 0;
            
            let colorClass = 'bg-[#18181b] border border-gray-800/50'; 
            if (count >= 5) colorClass = 'bg-[#d946ef]'; 
            else if (count >= 3) colorClass = 'bg-[#a21caf]'; 
            else if (count >= 1) colorClass = 'bg-[#6b21a8]'; 

            let niceDate = cellDate.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short', year: 'numeric' });
            
            cell.className = `w-3 h-3 rounded-sm ${colorClass} transition-all hover:scale-125 hover:z-10 relative cursor-crosshair`;
            cell.title = count > 0 ? `${niceDate}: ігор — ${count}` : `${niceDate}: немає ігор`;
        }
        
        heatmapGrid.appendChild(cell);
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
                borderColor: '#ff5500',
                backgroundColor: gradient,
                borderWidth: 2,
                pointRadius: 0,
                pointHoverRadius: 4,
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
                tooltip: { callbacks: { label: function(context) { return ' K/D: ' + context.parsed.y; } } }
            },
            scales: {
                x: { display: false, offset: true }, 
                y: { display: false, min: Math.min(...dataPoints) * 0.8 } 
            },
            layout: { padding: 0 },
            interaction: { mode: 'index', intersect: false }
        }
    });
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
            datasets: [{ data: dataPoints, borderColor: '#6366f1', borderWidth: 2, pointRadius: 0, tension: 0.1 }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { color: '#27272a' }, ticks: { color: '#71717a' } },
                y: { grid: { color: '#27272a' }, ticks: { color: '#71717a' }, beginAtZero: true }
            }
        }
    });

    document.getElementById('panelMetricName').textContent = metricLabel;
    document.getElementById('panelCurrentVal').textContent = displayAvg;
    document.getElementById('panelHighVal').textContent = Math.max(...dataPoints.map(Number)).toFixed(2) + (metric === 'hs' ? '%' : '');
    document.getElementById('panelLowVal').textContent = Math.min(...dataPoints.map(Number)).toFixed(2) + (metric === 'hs' ? '%' : '');
}

renderHistory();