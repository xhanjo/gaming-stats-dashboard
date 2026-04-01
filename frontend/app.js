let myChart = null;
let currentMatchHistory = []; 

async function searchPlayer() {
    const nickname = document.getElementById('nicknameInput').value.trim();
    const errorMsg = document.getElementById('errorMessage');
    const card = document.getElementById('playerCard');

    if (!nickname) return;

    errorMsg.style.display = 'none';
    card.style.display = 'none';

    try {
        const response = await fetch(`http://localhost:8080/api/player?nickname=${nickname}`);
        const data = await response.json();

        if (!response.ok) throw new Error(data.error || 'Гравця не знайдено');

        document.getElementById('playerName').textContent = data.nickname;
        const avatarImg = document.getElementById('playerAvatar');
        const avatarFallback = document.getElementById('playerAvatarFallback');
        
        if (data.avatar && data.avatar !== "") {
            avatarImg.src = data.avatar;
            avatarImg.classList.remove('hidden');
            avatarFallback.classList.add('hidden');
        } else {
            avatarImg.classList.add('hidden');
            avatarFallback.classList.remove('hidden');
        }

        document.getElementById('linkFaceit').href = `https://www.faceit.com/en/players/${data.nickname}`;
        
        const steamLink = document.getElementById('linkSteam');
        if (data.steam_id_64 && data.steam_id_64 !== "") {
            steamLink.href = `https://steamcommunity.com/profiles/${data.steam_id_64}`;
            steamLink.style.display = 'flex';
        } else {
            steamLink.style.display = 'none'; 
        }

        if (data.games && data.games.cs2) {
            document.getElementById('playerLevel').textContent = data.games.cs2.skill_level;
            document.getElementById('playerElo').textContent = data.games.cs2.faceit_elo;
        }

        if (data.stats && data.stats.lifetime) {
            document.getElementById('playerMatches').textContent = data.stats.lifetime["Matches"];
            document.getElementById('playerWinrate').textContent = data.stats.lifetime["Win Rate %"] + "%";
        }

        if (data.recent_form) {
            let totalKills = 0;
            let totalDeaths = 0;
            
            if (data.recent_form.match_history) {
                data.recent_form.match_history.forEach(match => {
                    totalKills += parseInt(match.Kills) || 0;
                    totalDeaths += parseInt(match.Deaths) || 0;
                });
            }
            
            const trueKD = totalDeaths > 0 ? (totalKills / totalDeaths).toFixed(2) : "0.00";

            document.getElementById('playerKD').textContent = trueKD;
            document.getElementById('playerKR').textContent = data.recent_form.avg_kr_ratio.toFixed(2);
            document.getElementById('playerADR').textContent = data.recent_form.avg_adr.toFixed(1);
            document.getElementById('playerHS').textContent = data.recent_form.avg_hs_percentage.toFixed(1) + '%';
            document.getElementById('playerEntry').textContent = data.recent_form.total_entry_kills;
            document.getElementById('playerSniper').textContent = data.recent_form.total_sniper_kills;

            if (data.recent_form.match_history && data.recent_form.match_history.length > 0) {
                currentMatchHistory = [...data.recent_form.match_history].reverse();
                changeChart('kd'); 
            }
        }

        card.style.display = 'block';

    } catch (error) {
        errorMsg.textContent = error.message;
        errorMsg.style.display = 'block';
    }
}

function changeChart(metric) {
    if (!currentMatchHistory.length) return;

    const btns = ['kd', 'kr', 'hs', 'adr'];
    btns.forEach(b => {
        const el = document.getElementById(`btn-${b}`);
        if (b === metric) {
            el.className = "px-5 py-1.5 rounded-full text-sm font-bold bg-faceit text-white transition-colors";
        } else {
            el.className = "px-5 py-1.5 rounded-full text-sm font-bold bg-gray-800 text-gray-400 hover:bg-gray-700 transition-colors";
        }
    });


    const labels = currentMatchHistory.map((_, i) => `${i + 1}`); 
    let dataPoints = [];
    let metricLabel = "";

    if (metric === 'kd') {
        dataPoints = currentMatchHistory.map(m => {
            const kills = parseInt(m.Kills);
            const deaths = parseInt(m.Deaths) || 1;
            return parseFloat((kills / deaths).toFixed(2));
        });
        metricLabel = "K/D";
    } else if (metric === 'kr') {
        dataPoints = currentMatchHistory.map(m => parseFloat(m['K/R Ratio']));
        metricLabel = "K/R";
    } else if (metric === 'hs') {
        dataPoints = currentMatchHistory.map(m => parseFloat(m['Headshots %']));
        metricLabel = "HS%";
    } else if (metric === 'adr') {
        dataPoints = currentMatchHistory.map(m => parseFloat(m.ADR));
        metricLabel = "ADR";
    }

    const maxVal = Math.max(...dataPoints);
    const minVal = Math.min(...dataPoints);
    const avgVal = dataPoints.reduce((a, b) => a + b, 0) / dataPoints.length;

    const suffix = metric === 'hs' ? '%' : '';
    document.getElementById('panelMetricName').textContent = metricLabel;
    document.getElementById('panelCurrentVal').textContent = avgVal.toFixed(2) + suffix;
    document.getElementById('panelHighVal').textContent = metric === 'hs' ? maxVal.toFixed(0) + suffix : maxVal.toFixed(2);
    document.getElementById('panelLowVal').textContent = metric === 'hs' ? minVal.toFixed(0) + suffix : minVal.toFixed(2);

    if (myChart) myChart.destroy();
    const ctx = document.getElementById('performanceChart').getContext('2d');

    myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: metricLabel,
                data: dataPoints,
                borderColor: '#6366f1', 
                borderWidth: 2,
                pointBackgroundColor: '#6366f1',
                pointRadius: 0, 
                pointHoverRadius: 6, 
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }, 
                tooltip: {
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    titleColor: '#aaa',
                    bodyFont: { size: 16, weight: 'bold' },
                    displayColors: false 
                }
            },
            interaction: {
                intersect: false,
                mode: 'index',
            },
            scales: {
                x: {
                    grid: { color: '#27272a', drawBorder: false }, 
                    ticks: { color: '#71717a', maxTicksLimit: 10 }
                },
                y: {
                    grid: { color: '#27272a', borderDash: [5, 5], drawBorder: false }, 
                    ticks: { color: '#71717a' },
                    beginAtZero: true
                }
            }
        }
    });
}