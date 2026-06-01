# KODA UI v2 — DOM Contract

Do not rename or remove these element IDs. JS modules depend on them.

## index.html — `api.js`

| ID | Module |
|----|--------|
| total-value, total-percent | api.js |
| top-gainer-ticker, top-gainer-percent | api.js |
| top-loser-ticker, top-loser-percent | api.js |
| sector-container, all-sectors-list | api.js |
| btn-view-sectors, btn-close-sectors | api.js |
| modal-sectors, modal-sectors-content | api.js |
| news-container | api.js |
| bottom-nav-container | layout.js |

## watchlist.html — `api.js`, `markets.js`, `drag-drop.js`, `ai-pro.js`

| ID | Module |
|----|--------|
| watchlist-container | api.js, drag-drop.js |
| btn-edit-watchlist, btn-sort-watchlist, icon-sort-watchlist | api.js |
| modal-delete-watchlist, modal-delete-content, delete-symbol-text | api.js |
| btn-cancel-delete, btn-confirm-delete | api.js |
| earnings-container, earnings-calendar-grid, earnings-week-display | markets.js |
| anomaly-container | markets.js, ai-pro.js |
| fng-status, fng-value, fng-pin | markets.js |
| tv-heatmap-container | market-plus.js |

## portfolio.html — `portfolio-calc.js`, `analytics.js`, `kodalab1.js`

| ID | Module |
|----|--------|
| port-total-val, port-cash-val, port-unrealized-val, position-count | portfolio-calc.js |
| portfolio-container, equity-chart | portfolio-calc.js |
| btn-manage-cash, modal-manage-cash, modal-manage-cash-content | portfolio-calc.js |
| tab-deposit, tab-withdraw, cash-mode, cash-label, cash-amount, btn-submit-cash | portfolio-calc.js |
| btn-open-add-stock, modal-add-stock, modal-content, add-stock-form | portfolio-calc.js |
| modal-sell-stock, modal-sell-content, sell-stock-form | portfolio-calc.js |
| sort-btn, sort-menu, sort-label | portfolio-calc.js |
| mode-holdings, mode-lab-main, mode-whatif, lab-container | analytics.js |
| matrix-head, matrix-body, lab-symbol-input, btn-fetch-sr | analytics.js |
| modal-whatif, modal-whatif-content, whatif-* | analytics.js, portfolio-calc.js |
| tab-aifund, content-aifund, ai-holdings-list, manual-holdings-list | kodalab1.js |
| mock-fund-chart, btn-run-aifund | kodalab1.js |

## stock-detail.html — `stock-detail.js`, `financial-details.js`, `asset-insights.js`

| ID | Module |
|----|--------|
| detail-symbol, detail-price, detail-change, detail-name | stock-detail.js |
| extended-price-container, extended-* | stock-detail.js |
| tv-chart-container, koda-chart-container, ta-chart-container | stock-detail.js |
| btn-chart-tv, btn-chart-koda, tf-selector | stock-detail.js |
| stat-open, stat-prev, stat-high, stat-low, stat-52high, stat-52low | stock-detail.js |
| stat-pe, stat-ps, stat-eps, stat-div, stat-fcf, stat-roe, stat-cr, stat-de, stat-mcap | stock-detail.js |
| detail-matrix-head, detail-matrix-body, detail-capital-input | stock-detail.js |
| analyst-bars, analyst-consensus-badge, target-line-chart | stock-detail.js |
| analysis-loading, analysis-content, financials-chart | stock-detail.js |
| stock-news-container, modal-news-detail, modal-news-content | stock-detail.js |
| ai-company-content, ai-summary-date, btn-refresh-summary | asset-insights.js |
| btn-fin-detail, modal-fin-detail, modal-fin-content, fin-modal-body | financial-details.js |
| modal-category-select, category-checkbox-list | stock-detail.js (dynamic) |

## world-news.html — `world-news.js`

| ID | Module |
|----|--------|
| tab-timeline, tab-intel, content-timeline, content-intel | world-news.js |
| timeline-container, video-container | world-news.js |
| btn-refresh-world, modal-world-detail, modal-world-content | world-news.js |
| world-modal-body, world-modal-link, btn-ai-analyze | world-news.js |

## Global — `search.js`

| ID | Module |
|----|--------|
| koda-search-modal, koda-search-input, koda-search-results, koda-search-close | search.js (injected) |

## Layout

| ID | Module |
|----|--------|
| koda-sidebar-container | layout.js |
| bottom-nav-container | layout.js |
