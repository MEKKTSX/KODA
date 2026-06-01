# KODA UI v2 — Design Specification

## Visual direction

Light business / professional fintech dashboard. Primary audience: desktop analysts and mobile on-the-go users.

## Color palette

| Token | Hex | Usage |
|-------|-----|--------|
| Background | `#F8FAFC` | Page background |
| Surface | `#FFFFFF` | Cards, sidebar |
| Border | `#E2E8F0` | Dividers, card borders |
| Primary | `#2563EB` | Links, active nav, CTAs |
| Success | `#059669` | Gains, positive change |
| Danger | `#DC2626` | Losses, negative change |
| Text | `#0F172A` | Headings, values |
| Text muted | `#64748B` | Labels, secondary |

Legacy Tailwind keys (`background-dark`, `surface-dark`, `border-dark`) map to the light palette for JS compatibility.

## Typography

- Font: Inter (400, 500, 600, 700)
- Page title: 1.25rem / 700
- Stat value: 1.875rem / 700
- Label: 0.75rem / 600 uppercase tracking

## Breakpoints

| Name | Min width | Layout |
|------|-----------|--------|
| Mobile | default | Bottom nav, full-width content |
| Desktop | 1024px (`lg`) | Fixed sidebar 240px, fluid content max 80rem |

## Components

- **koda-card** — white card, 1px border, subtle shadow
- **koda-page-header** — sticky mobile header; static on desktop
- **Modals** — bottom sheet on mobile; centered dialog on desktop (`koda-modal-backdrop`, `koda-modal-sheet`)

## Files

- `css/koda-tokens.css` — CSS variables
- `css/koda-shell.css` — layout and components
- `js/tailwind-config.js` — Tailwind theme
- `js/layout.js` — sidebar + bottom navigation
