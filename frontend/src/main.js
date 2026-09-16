/**
 * Головна точка входу додатку (Bootstrap & Event wiring)
 */

import { initSearchBar } from './components/searchBar.js';
import { initTabs, switchTab } from './components/tabs.js';
import { renderPlayerHeader } from './components/playerHeader.js';
import { initSummaryTab, renderSummaryTab } from './components/summaryTab.js';
import { initMatchesTab, renderMatchesTab } from './components/matchesTab.js';
import { renderMapsTab } from './components/mapsTab.js';
import { renderActivityTab } from './components/activityTab.js';
import { renderAnalyticsTab } from './components/analyticsTab.js';
import { destroyAllCharts } from './charts/chartManager.js';

function onSearchSuccess(data, isDeepScan) {
    destroyAllCharts();

    // Рендеримо всі модулі з ізоляцією помилок
    try { renderPlayerHeader(data); } catch (e) { console.error('Помилка renderPlayerHeader:', e); }
    try { renderSummaryTab(data); } catch (e) { console.error('Помилка renderSummaryTab:', e); }
    try { renderMatchesTab(true); } catch (e) { console.error('Помилка renderMatchesTab:', e); }
    try { renderMapsTab(data); } catch (e) { console.error('Помилка renderMapsTab:', e); }
    try { renderActivityTab(data); } catch (e) { console.error('Помилка renderActivityTab:', e); }
    try { renderAnalyticsTab(data); } catch (e) { console.error('Помилка renderAnalyticsTab:', e); }

    if (!isDeepScan) {
        switchTab('tab-summary');
    }
}

// Ініціалізація компонентів при старті
document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initSummaryTab();
    initMatchesTab();
    const { handleSearch } = initSearchBar(onSearchSuccess);

    // Перевірка URL query params (?player=...)
    const params = new URLSearchParams(window.location.search);
    const playerParam = params.get('player') || params.get('nickname');
    if (playerParam) {
        const input = document.getElementById('nicknameInput');
        if (input) input.value = playerParam;
        handleSearch(playerParam);
    }
});
