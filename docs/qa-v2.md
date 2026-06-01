# KODA UI v2 — QA Checklist

## Functional parity

- [ ] Home: total value, gainer/loser, sectors modal, AI news feed
- [ ] Portfolio: add/sell stock, cash deposit/withdraw, equity chart, sort
- [ ] Watchlist: categories, edit/delete, drag-drop, scanner filter, earnings calendar
- [ ] Stock detail: price, charts (TV + KODA), tabs, AI summary, financials, news modal
- [ ] World news: timeline, intel tab, detail modal, AI analyze
- [ ] AI Ops: chat, history, image upload
- [ ] Config: toggles, currency, import/export JSON, reset data
- [ ] Global search opens and navigates to `stock-detail.html?symbol=`
- [ ] `loadKodaConfig()` loads API keys

## Responsive

- [ ] 320px — content readable, bottom nav not overlapping modals
- [ ] 390px — primary mobile target
- [ ] 768px — tablet uses mobile nav
- [ ] 1024px — sidebar visible, bottom nav hidden
- [ ] 1440px — content centered, grids use extra columns

## Regression

- [ ] `localStorage` `koda_portfolio_data` unchanged after refresh
- [ ] PWA manifest colors match light theme
- [ ] No console errors for missing `getElementById` targets

## Visual

- [ ] Light background, readable contrast on cards
- [ ] Active nav state clear on sidebar and bottom bar
- [ ] Modals usable on desktop (centered) and mobile (sheet)
