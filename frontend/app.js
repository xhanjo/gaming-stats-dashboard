let myChart = null;
let currentMatchHistory = []; // Зберігаємо історію тут, щоб перемикати графіки без запитів до API

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
        
        if (data.games && data.games.cs2) {
            document.getElementById('playerLevel').textContent = data.games.cs2.skill_level;
            document.getElementById('playerElo').textContent = data.games.cs2.faceit_elo;
        }

        if (data.stats && data.stats.lifetime) {
            document.getElementById('playerMatches').textContent = data.stats.lifetime["Matches"];
            document.getElementById('playerWinrate').textContent = data.stats.lifetime["Win Rate %"] + "%";
        }

if (data.recent_form) {
            // 1. РАХУЄМО ПРАВИЛЬНИЙ K/D (Сума Kills / Сума Deaths)
            let totalKills = 0;
            let totalDeaths = 0;
            
            if (data.recent_form.match_history) {
                data.recent_form.match_history.forEach(match => {
                    totalKills += parseInt(match.Kills) || 0;
                    totalDeaths += parseInt(match.Deaths) || 0;
                });
            }
            
            // Захист від ділення на нуль
            const trueKD = totalDeaths > 0 ? (totalKills / totalDeaths).toFixed(2) : "0.00";

            // 2. Виводимо дані на екран
            document.getElementById('playerKD').textContent = trueKD;
            document.getElementById('playerKR').textContent = data.recent_form.avg_kr_ratio.toFixed(2);
            document.getElementById('playerADR').textContent = data.recent_form.avg_adr.toFixed(1);
            document.getElementById('playerHS').textContent = data.recent_form.avg_hs_percentage.toFixed(1) + '%';
            document.getElementById('playerEntry').textContent = data.recent_form.total_entry_kills;
            document.getElementById('playerSniper').textContent = data.recent_form.total_sniper_kills;

            // Зберігаємо історію і малюємо графік
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

// Нова функція для перемикання метрик графіка
function changeChart(metric) {
    if (!currentMatchHistory.length) return;

    // 1. Оновлюємо кольори кнопок (робимо активну помаранчевою)
    const btns = ['kd', 'kr', 'hs', 'adr'];
    btns.forEach(b => {
        const el = document.getElementById(`btn-${b}`);
        if (b === metric) {
            el.className = "px-5 py-1.5 rounded-full text-sm font-bold bg-faceit text-white transition-colors";
        } else {
            el.className = "px-5 py-1.5 rounded-full text-sm font-bold bg-gray-800 text-gray-400 hover:bg-gray-700 transition-colors";
        }
    });

    // 2. Готуємо дані залежно від обраної метрики
    // Faceit малює просто номери по осі X (1, 13, 25...)
    const labels = currentMatchHistory.map((_, i) => `${i + 1}`); 
    let dataPoints = [];
    let metricLabel = "";

    // Витягуємо правильні цифри з нашого JSON
    if (metric === 'kd') {
        dataPoints = currentMatchHistory.map(m => {
            const kills = parseInt(m.Kills);
            const deaths = parseInt(m.Deaths) || 1; // Захист від ділення на нуль
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

    // 3. Рахуємо статистику для бокової панелі
    const maxVal = Math.max(...dataPoints);
    const minVal = Math.min(...dataPoints);
    const avgVal = dataPoints.reduce((a, b) => a + b, 0) / dataPoints.length;

    // Оновлюємо текст у боковій панелі
    const suffix = metric === 'hs' ? '%' : '';
    document.getElementById('panelMetricName').textContent = metricLabel;
    document.getElementById('panelCurrentVal').textContent = avgVal.toFixed(2) + suffix;
    document.getElementById('panelHighVal').textContent = metric === 'hs' ? maxVal.toFixed(0) + suffix : maxVal.toFixed(2);
    document.getElementById('panelLowVal').textContent = metric === 'hs' ? minVal.toFixed(0) + suffix : minVal.toFixed(2);

    // 4. Малюємо новий графік
    if (myChart) myChart.destroy();
    const ctx = document.getElementById('performanceChart').getContext('2d');

    myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: metricLabel,
                data: dataPoints,
                borderColor: '#6366f1', // Фіолетово-синій відтінок (Indigo) як на скріншоті Faceit
                borderWidth: 2,
                pointBackgroundColor: '#6366f1',
                pointRadius: 0, // Ховаємо точки, щоб лінія була суцільною
                pointHoverRadius: 6, // Показуємо точку тільки при наведенні мишки
                tension: 0.1 // Робимо лінії гострими, а не хвилястими
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }, // Ховаємо легенду зверху
                tooltip: {
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    titleColor: '#aaa',
                    bodyFont: { size: 16, weight: 'bold' },
                    displayColors: false // Ховаємо кольоровий квадратик в тултипі
                }
            },
            interaction: {
                intersect: false,
                mode: 'index',
            },
            scales: {
                x: {
                    grid: { color: '#27272a', drawBorder: false }, // Темна сітка
                    ticks: { color: '#71717a', maxTicksLimit: 10 } // Показуємо не всі номери матчів
                },
                y: {
                    grid: { color: '#27272a', borderDash: [5, 5], drawBorder: false }, // Пунктирна лінія сітки
                    ticks: { color: '#71717a' },
                    beginAtZero: true
                }
            }
        }
    });
}