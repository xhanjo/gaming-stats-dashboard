/**
 * Компонент навігації по вкладках
 */

import { $, show, hide } from '../utils/dom.js';
import { store } from '../state/store.js';

const TABS = ['tab-summary', 'tab-matches', 'tab-maps', 'tab-activity', 'tab-analytics'];

export function initTabs() {
    const tabsContainer = document.querySelector('.overflow-x-auto');
    if (!tabsContainer) return;

    tabsContainer.addEventListener('click', (e) => {
        const btn = e.target.closest('.tab-btn');
        if (!btn) return;

        const tabId = btn.id.replace('btn-', '');
        if (TABS.includes(tabId)) {
            switchTab(tabId);
        }
    });

    const logo = document.querySelector('.cursor-pointer.group');
    if (logo) {
        logo.addEventListener('click', () => {
            goHome();
        });
    }
}

export function switchTab(tabId) {
    store.setState({ activeTab: tabId });

    TABS.forEach(t => {
        const el = $(t);
        const btn = $(`btn-${t}`);

        if (t === tabId) {
            show(el);
            if (btn) {
                btn.className = "tab-btn pb-3 text-sm font-bold text-faceit border-b-2 border-faceit transition-all";
            }
        } else {
            hide(el);
            if (btn) {
                btn.className = "tab-btn pb-3 text-sm font-bold text-gray-400 border-b-2 border-transparent hover:text-gray-200 transition-all";
            }
        }
    });
}

export function goHome() {
    hide('playerCard');
    const footer = $('appFooter');
    if (footer) hide(footer);
    hide('errorMessage');
    $('nicknameInput').value = '';
    switchTab('tab-summary');
    store.setState({ player: null, matchHistory: [] });
}
