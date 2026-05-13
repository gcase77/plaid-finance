# Funds Up design notes

## Principles
- One left sidebar owns global navigation; page-level controls stay inside the page header or first card.
- Cards, buttons, tables, forms, and chips use the same radius, border, shadow, and focus states.
- Dense finance data is allowed, but each screen starts with a short heading and the primary action.

## Tokens
- Font: system UI stack.
- Background: `#f6f7fb`.
- Surface: `#ffffff`.
- Ink: `#16202a`.
- Muted: `#667085`.
- Border: `#d9e0ea`.
- Primary: `#3657ff`.
- Success: `#168a62`.
- Danger: `#d9483b`.
- Warning: `#c47b13`.
- Radius: `18px` cards, `12px` controls, `999px` pills.

## Components
- `.app-shell`, `.app-sidebar`, `.app-main`: protected app frame.
- `.surface-card`: the default panel.
- `.page-head`: page title and actions row.
- `.pill-tabs`: tabbed segmented controls.
- `.chip`: compact labels and metadata.
- `.data-table`: all finance tables.
