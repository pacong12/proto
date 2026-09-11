# Cloudflare Pages - Deployment Configuration

## Build Settings (Cloudflare Pages Dashboard)

| Setting                | Value                                  |
| ---------------------- | -------------------------------------- |
| Framework preset       | None                                   |
| Build command          | `cd apps/frontoffice && bun run build` |
| Build output directory | `apps/frontoffice/dist`                |
| Root directory         | `/` (root of repo)                     |
| Node.js version        | `20`                                   |

## Environment Variables (Cloudflare Pages Dashboard)

| Variable                | Value                      | Notes                      |
| ----------------------- | -------------------------- | -------------------------- |
| `VITE_REOWN_PROJECT_ID` | `<your_reown_project_id>`  | Required for wallet modal  |
| `VITE_API_BASE_URL`     | `https://api.proto.family` | URL of deployed API server |

## Files Added

- `apps/frontoffice/wrangler.toml` - Wrangler config for Cloudflare Pages
- `apps/frontoffice/public/_redirects` - SPA fallback routing (`/* -> /index.html 200`)
- `apps/frontoffice/public/_headers` - Security headers + cache rules for assets

## Notes

- The frontoffice is a **static SPA** (Vue 3 / Vite). No Worker or edge runtime needed.
- API calls (`/api/*`) are made to `VITE_API_BASE_URL` in production. The API server must be deployed separately (VPS / Docker).
- `_redirects` ensures Vue Router (history mode) works correctly on Cloudflare Pages.
- Static assets in `dist/assets/` are served with `Cache-Control: immutable` (1 year).
- `index.html` is served with `no-cache` to ensure users always get the latest version.
