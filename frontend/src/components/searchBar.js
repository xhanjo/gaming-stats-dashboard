/**
 * Компонент пошуку та історії
 */

import { $, show, hide, escapeHtml } from '../utils/dom.js';
import { store } from '../state/store.js';
import { fetchPlayerStats } from '../api/playerApi.js';
import { getMatchTimestamp } from '../utils/dates.js';

export function initSearchBar(onSearchSuccess) {
    const input = $('nicknameInput');
    const btn = $('searchBtn');
    const historyContainer = $('searchHistory');

    const handleSearch = async (nickname, limit = 30, isDeepScan = false) => {
        nickname = (nickname || input.value || '').trim();
        if (!nickname) return;

        if (isDeepScan) {
            store.setState({ isDeepScanLoading: true });
        } else {
            store.setState({ isLoading: true, errorMessage: null });
        }

        renderLoadingState();

        try {
            const data = await fetchPlayerStats(nickname, limit);
            store.addToHistory(data.nickname);
            input.value = data.nickname;
            
            const history = (data.recent_form?.match_history || []).slice();
            history.sort((a, b) => getMatchTimestamp(b) - getMatchTimestamp(a));

            store.setState({
                player: data,
                matchHistory: history,
                rawMatchHistory: history,
                errorMessage: null,
                isLoading: false,
                isDeepScanLoading: false
            });

            if (onSearchSuccess) {
                onSearchSuccess(data, isDeepScan);
            }
        } catch (err) {
            store.setState({
                errorMessage: err.message,
                isLoading: false,
                isDeepScanLoading: false
            });
        } finally {
            renderLoadingState();
            renderSearchHistory();
        }
    };

    btn.addEventListener('click', (e) => {
        e.preventDefault();
        handleSearch();
    });

    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSearch();
        }
    });

    // Delegated click for search history tags
    if (historyContainer) {
        historyContainer.addEventListener('click', (e) => {
            const tag = e.target.closest('.history-tag');
            if (tag) {
                const name = tag.dataset.name;
                if (name) {
                    input.value = name;
                    handleSearch(name);
                }
            }
        });
    }

    // Deep scan button event listener
    const deepScanBtn = $('deepScanBtn');
    if (deepScanBtn) {
        deepScanBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const state = store.getState();
            if (state.player && state.player.nickname) {
                handleSearch(state.player.nickname, 200, true);
            }
        });
    }

    renderSearchHistory();

    return { handleSearch };
}

function renderLoadingState() {
    const { isLoading, isDeepScanLoading, errorMessage } = store.getState();

    const btn = $('searchBtn');
    const spinner = $('btnSpinner');
    const mainLoader = $('mainLoader');
    const card = $('playerCard');
    const input = $('nicknameInput');
    const errorEl = $('errorMessage');
    const deepScanBtn = $('deepScanBtn');

    if (isLoading) {
        btn.disabled = true;
        show(spinner);
        show(mainLoader);
        hide(card);
        input.disabled = true;
    } else {
        btn.disabled = false;
        hide(spinner);
        hide(mainLoader);
        input.disabled = false;
    }

    if (deepScanBtn) {
        if (isDeepScanLoading) {
            deepScanBtn.disabled = true;
            deepScanBtn.innerHTML = `<div class="w-3 h-3 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin"></div> Скануємо...`;
        } else {
            deepScanBtn.disabled = false;
            deepScanBtn.innerHTML = `<svg class="w-3.5 h-3.5 group-hover:animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"></path></svg> Глибокий аналіз (200 матчів)`;
        }
    }

    if (errorMessage) {
        errorEl.textContent = errorMessage;
        show(errorEl);
    } else {
        hide(errorEl);
    }
}

export function renderSearchHistory() {
    const container = $('searchHistory');
    if (!container) return;

    const { searchHistory } = store.getState();
    container.innerHTML = '';

    searchHistory.forEach(name => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.dataset.name = name;
        btn.textContent = name;
        btn.className = 'history-tag text-xs font-bold text-gray-500 border border-gray-800 px-3 py-1 rounded-full transition-all cursor-pointer hover:bg-faceit/20 hover:border-faceit';
        container.appendChild(btn);
    });
}
