let myChart = null;
let trendChart = null; 
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
    
    document.getElementById('playerAvatarFallback').classList.remove('hidden');
    document.getElementById('playerLevelIcon').classList.add('hidden');

    if (myChart) { myChart.destroy(); myChart = null; }
    if (trendChart) { trendChart.destroy(); trendChart = null; }
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

        if (data.recent_form && data.recent_form.match_history) {
            let totalKills = 0, totalDeaths = 0;
            let trendData = []; 
            const chronologicalHistory = [...data.recent_form.match_history].reverse();

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

                // ВИПРАВЛЕНО: огортаємо в flex-1 flex justify-center для ідеального центрування під графіком
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
        }

        document.getElementById('playerCard').classList.remove('hidden');

    } catch (error) {
        document.getElementById('errorMessage').textContent = error.message;
        document.getElementById('errorMessage').style.display = 'block';
    } finally {
        toggleLoading(false);
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
                // СЕКРЕТ ІДЕАЛЬНОГО ВІДЦЕНТРУВАННЯ: offset: true
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