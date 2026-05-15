# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev        # Next.js dev server on port 3001
npm run build      # Production Next.js build
npm run lint       # ESLint
npm run electron   # Launch Electron (requires the web app to be running or deployed)
npm run dist:win   # Package for Windows (NSIS installer)
npm run dist:mac   # Package for macOS (DMG)
```

## Architecture

**GastoFácil** is a Spanish-language personal expense tracker built as a Next.js web app wrapped in an Electron shell.

### Electron + Next.js split

The Electron main process ([electron/main.js](electron/main.js)) loads a **remote URL** — the production deployment on Railway (`https://my-app-front-desktop-production.up.railway.app/`) — rather than a local build. Override with `NEXT_PUBLIC_WEB_URL`. The Next.js app itself is a standalone web app served on port 3001.

### App Router pages (`/app`)

| Route | Purpose |
|---|---|
| `/dashboard` | Main overview: balance, charts, monthly breakdown |
| `/gastos` | Expense list and CRUD |
| `/ingresos` | Income tracking |
| `/categorias` | Category management |
| `/importar` | Import transactions |
| `/recordatorios` | Reminders |

Root `/` redirects to `/dashboard`.

### Service layer (`/service/index.ts`)

All API calls go through a centralized service module. Services (`categoriesService`, `expensesService`, `incomesService`, `dashboardService`, `remindersService`) wrap fetch calls against `NEXT_PUBLIC_API_URL` (default: `http://localhost:3000`) and a Python API at `NEXT_PUBLIC_PYTHON_API_URL` (default: `http://localhost:8000`).

### Key types (`/lib/types.ts`)

Entities: `Expense`, `Income`, `Category`, `Reminder`. Expenses support multi-currency (ARS/USD) with historical exchange rates and a `FIXED | VARIABLE` type distinction.

### Styling

- **Tailwind CSS v4** with `@theme` directive in [app/globals.css](app/globals.css) — not the v3 `tailwind.config.js` you may expect.
- **shadcn/ui** components use the `radix-nova` style variant.
- Design tokens, glass morphism utilities (`.glass`, `.glass-strong`), and dark theme colors are defined in `globals.css`, not a config file.
- **Framer Motion** is used widely for micro-animations throughout components.

### Path alias

`@/` maps to the repository root (not `src/`).
