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

        if (!response.ok) {
            throw new Error(data.error || 'Гравця не знайдено');
        }

        // Заповнюємо базові дані
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
            const kd = (data.recent_form.avg_kills / (data.recent_form.avg_kills / data.recent_form.avg_kr_ratio || 1)).toFixed(2);
            document.getElementById('playerKD').textContent = kd;
            document.getElementById('playerKR').textContent = data.recent_form.avg_kr_ratio.toFixed(2);
            document.getElementById('playerADR').textContent = data.recent_form.avg_adr.toFixed(1);
            document.getElementById('playerHS').textContent = data.recent_form.avg_hs_percentage.toFixed(1) + '%';
            document.getElementById('playerEntry').textContent = data.recent_form.total_entry_kills;
            document.getElementById('playerSniper').textContent = data.recent_form.total_sniper_kills;
        }

        card.style.display = 'block';

    } catch (error) {
        errorMsg.textContent = error.message;
        errorMsg.style.display = 'block';
    }
}