# Funds Up — Design System

A single source of truth for the front-end look. All visual decisions in
`/src` must come from this file. The tokens are defined in `/src/theme.css`
on the `:root` and can be referenced as plain CSS variables.

## Type scale

- Font family: `Inter, "Segoe UI", system-ui, sans-serif`
- Base size: `15px`, line-height `1.5`
- `text-xs` `.72rem` · `text-sm` `.86rem` · `text-md` `1rem` · `text-lg` `1.18rem` · `text-xl` `1.6rem` · `text-2xl` `2.4rem`
- Weights: `regular 450`, `medium 550`, `semibold 650`, `bold 750`

## Colors

| Token            | Value      | Use                             |
| ---------------- | ---------- | ------------------------------- |
| `--ink`          | `#0c1730`  | Primary text                    |
| `--ink-muted`    | `#5b6677`  | Secondary text                  |
| `--bg`           | `#f7f8fb`  | Page background                 |
| `--surface`      | `#ffffff`  | Cards / panels                  |
| `--surface-alt`  | `#f0f3f9`  | Inset rows, table stripes       |
| `--line`         | `#e3e7ef`  | Borders, separators             |
| `--brand`        | `#3358ff`  | Primary actions, focus rings    |
| `--brand-soft`   | `#e4e9ff`  | Brand-tinted backgrounds        |
| `--accent`       | `#7c5cff`  | Secondary accent                |
| `--success`      | `#16a34a`  | Positive money / on-budget      |
| `--danger`       | `#dc2626`  | Destructive, over-budget        |
| `--warning`      | `#d97706`  | Warnings, neutral budget        |

## Spacing

`--s1 4px · --s2 8px · --s3 12px · --s4 16px · --s5 24px · --s6 32px · --s7 48px`

## Radius / Shadow

- Radius: `--r-sm 6px · --r-md 10px · --r-lg 16px · --r-pill 999px`
- Shadow: `--shadow-1 0 1px 2px rgba(12,23,48,.06)` · `--shadow-2 0 6px 20px rgba(12,23,48,.08)`

## Interaction patterns

The whole app must follow these:

1. **Navigation** — Universal left sidebar (`AppShell`). The sidebar holds
   global nav (Home, Transactions, Tools, Account) and the signed-in user's
   account controls. The right column is the active page.
2. **Page header** — Each page starts with an `<h1>` title and an optional
   one-line description. Page-specific controls live directly under that
   header (a single horizontal action row).
3. **Cards** — All content blocks use `<div class="card">`. No nested cards.
4. **Buttons** — Three variants only: `btn primary`, `btn ghost`, `btn danger`.
   Sizes: default and `sm`. Icon-only buttons add `btn-icon`.
5. **Tabs** — `nav nav-tabs` for content switching inside a card.
6. **Tags / Badges** — `chip` (neutral), `chip-soft` (brand-tinted),
   colored `tag-badge` (user tags carry their assigned color).
7. **Tables** — `table` class only. Sticky header, zebra striping, no borders
   between columns. Use `<TransactionTable>` whenever showing transactions.
8. **Forms** — Use `<Field label>`. Inputs use `.input` / `.select` /
   `.textarea`. Errors below the field, in `--danger`.
9. **Tooltips** — Always use `<Tooltip>`. Hover trigger, neutral dark background.
10. **Modals** — Always use `<Modal>` (centered, dimmed backdrop, ESC closes).

## What is shared

Everything that appears in 2+ places lives in `src/components/shared`:
`Tooltip`, `Modal`, `TagBadge`, `TagPicker`, `Field`, `Segmented`,
`TransactionTable`, `AppliedFiltersBar`, `FilterSection`, `LoadingSpinner`,
plus the `AppShell` itself.
