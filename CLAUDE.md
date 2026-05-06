# JSU Marketing Dashboard

A multi-page static dashboard for JSU Marketing, deployed on Vercel. Each feature lives at its own URL under a folder containing an `index.html`.

## Structure

- `index.html` — Dashboard home (Quick Access tiles, recent content, schedule)
- `content-hub/` — Content library
- `content-plan/` — Bulk upload / scheduling calendar
- `caption-generator/` — AI caption generator
- `higgsfield/` — Higgsfield AI integration
- `clients/` — Client management
- `analytics-dashboard/` — Analytics overview
- `report-generator/` — Report generation
- `api/` — Vercel serverless functions (`generate.js`, `higgsfield.js`)
- `CSS/sidebar.css` — Shared sidebar styling
- `JS/sidebar.js` — Shared sidebar behavior (collapse, active state)
- `vercel.json` — Routes `/api/*` to serverless functions

## Conventions

### Sidebar
Every page embeds the same `<nav class="sidebar">` block in its `index.html`. The order of menu items is:

1. Dashboard (`/`)
2. Content Hub (`/content-hub/`)
3. Content Plan (`/content-plan/`)
4. AI Generator (`/caption-generator/`)
5. Higgsfield (`/higgsfield/`)
6. Clients (`/clients/`)
7. Analytics (`/analytics-dashboard/`)
8. Reports (`/report-generator/`)

When adding a new page, copy the sidebar verbatim from an existing page and update its own `<li class="menu-item active">` if active state is hardcoded. When adding a new tab, add the `<li>` block to **every** page's sidebar — there is no shared template.

### Quick Access tiles (dashboard only)
`index.html` has an `.actions-grid` with `.action-btn` tiles linking to the main features. Tile order should mirror sidebar order. Each tile uses an inline SVG icon styled via `.action-icon` (gold stroke).

### Styling
- Black/gold theme: gold `#FFD700`, bg `#060606`/`#0e0e0e`/`#111`
- Fonts: `Syne` (headings), `DM Sans` (body) from Google Fonts
- CSS is mostly inline `<style>` per page; only the sidebar is in a shared stylesheet

### Deployment
Vercel — static files served as-is, `/api/*` routes hit serverless functions.

## GitHub
Repo: https://github.com/Bressie10/jsu-marketing-dashboard
