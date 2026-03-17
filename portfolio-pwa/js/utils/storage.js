// js/utils/storage.js

const STORAGE_KEYS = {
    PORTFOLIO: 'mek_portfolio_data',
    WATCHLIST: 'mek_watchlist_data',
    SETTINGS: 'mek_app_settings'
};

export const Storage = {
    // บันทึกข้อมูล Portfolio
    savePortfolio(data) {
        localStorage.setItem(STORAGE_KEYS.PORTFOLIO, JSON.stringify(data));
    },

    // ดึงข้อมูล Portfolio
    getPortfolio() {
        const data = localStorage.getItem(STORAGE_KEYS.PORTFOLIO);
        return data ? JSON.parse(data) : [];
    },

    // บันทึก Watchlist
    saveWatchlist(data) {
        localStorage.setItem(STORAGE_KEYS.WATCHLIST, JSON.stringify(data));
    },

    // ดึง Watchlist
    getWatchlist() {
        const data = localStorage.getItem(STORAGE_KEYS.WATCHLIST);
        return data ? JSON.parse(data) : [];
    }
};
