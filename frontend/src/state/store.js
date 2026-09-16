/**
 * Централізоване реактивне сховище стану (Single Source of Truth)
 */

class Store {
    constructor() {
        this.state = {
            player: null,
            matchHistory: [],
            rawMatchHistory: [],
            activeTab: 'tab-summary',
            currentMetric: 'kd',
            displayedMatchesCount: 0,
            isLoading: false,
            isDeepScanLoading: false,
            searchHistory: this.loadHistory(),
            errorMessage: null,
        };
        this.listeners = [];
    }

    getState() {
        return this.state;
    }

    setState(partialState) {
        this.state = { ...this.state, ...partialState };
        this.notify();
    }

    subscribe(listener) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    notify() {
        for (const listener of this.listeners) {
            listener(this.state);
        }
    }

    loadHistory() {
        try {
            return JSON.parse(localStorage.getItem('cs2_search_history')) || [];
        } catch {
            return [];
        }
    }

    addToHistory(nickname) {
        if (!nickname) return;
        let history = this.state.searchHistory.filter(name => name.toLowerCase() !== nickname.toLowerCase());
        history.unshift(nickname);
        if (history.length > 5) history = history.slice(0, 5);

        localStorage.setItem('cs2_search_history', JSON.stringify(history));
        this.setState({ searchHistory: history });
    }
}

export const store = new Store();
