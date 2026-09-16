/**
 * Клієнт для взаємодії з Go API
 */

const API_BASE_URL = (window.location.port === '8080') ? '' : 'http://localhost:8080';

export async function fetchPlayerStats(nickname, limit = 30) {
    if (!navigator.onLine) {
        throw new Error('Немає підключення до Інтернету. Будь ласка, перевірте мережу.');
    }

    let response;
    try {
        response = await fetch(`${API_BASE_URL}/api/player/${encodeURIComponent(nickname)}?limit=${limit}`);
    } catch (err) {
        throw new Error('Не вдалося зв’язатися з сервером. Перевірте, чи працює бекенд.');
    }

    if (!response.ok) {
        let errorMsg = `Помилка сервера: статус ${response.status}`;
        try {
            const data = await response.json();
            if (data.error) errorMsg = data.error;
        } catch {
            // non-json response
        }
        throw new Error(errorMsg);
    }

    const data = await response.json();
    if (!data.games || !data.games.cs2) {
        throw new Error('Гравець не грає в CS2 на платформі FACEIT');
    }

    return data;
}
