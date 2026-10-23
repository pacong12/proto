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

| Variable                | Value                     | Notes                      |
| ----------------------- | ------------------------- | -------------------------- |
| `VITE_REOWN_PROJECT_ID` | `<your_reown_project_id>` | Required for wallet modal  |
| `VITE_API_BASE_URL`     | `https://api.goton.cloud` | URL of deployed API server |

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

## Maintenance Mode

The edge worker (`worker.ts`) reads three variables. Set them in the Cloudflare dashboard under
**Workers & Pages > proto > Settings > Variables and Secrets**; changes apply on save, with no
rebuild. `keep_vars = true` in `wrangler.toml` keeps them across deploys.

| Variable                   | Values                            | Effect                                                                                               |
| -------------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `MAINTENANCE_MODE`         | `off` (default), `banner`, `full` | `banner` shows a dismissible notice in the app; `full` returns a 503 maintenance page for every page |
| `MAINTENANCE_MESSAGE`      | plain text                        | Optional text for the banner and the 503 page                                                        |
| `MAINTENANCE_BYPASS_TOKEN` | secret                            | During `full`, open any page with `?maintenance_bypass=<token>` to use the site for 12 hours         |

The API proxy (`/api/*`, `/dex/*`, `/health`) stays reachable in every mode. Store the bypass token
as a secret, not a plain variable.

## Environments and Release Flow

| Environment | Trigger                                   | Frontoffice worker             | Docs worker                         |
| ----------- | ----------------------------------------- | ------------------------------ | ----------------------------------- |
| Development | every push to `main`                      | `proto-dev` (workers.dev only) | `proto-docs-dev` (workers.dev only) |
| Production  | a published release (`production` branch) | `proto` on goton.fun           | `proto-docs` on docs.goton.fun      |

Development URLs are `https://proto-dev.mutingudin12.workers.dev` and
`https://proto-docs-dev.mutingudin12.workers.dev`; both send `noindex` and use the production API.

Production only changes on a release: when release-please publishes a release, `release.yml` moves
the `production` branch to the released commit and dispatches the VPS deploy and the GHCR image
publish. To redeploy or roll back, run **Promote Release to Production** (`promote-production.yml`)
with a release tag.

### Cloudflare Workers Builds settings

Under **Workers & Pages > (worker) > Settings > Build**:

| Worker           | Git branch   | Root directory | Build command   | Deploy command                           | Enable Preview Builds |
| ---------------- | ------------ | -------------- | --------------- | ---------------------------------------- | --------------------- |
| `proto`          | `production` | (repo root)    | (empty)         | `bunx wrangler deploy`                   | off                   |
| `proto-docs`     | `production` | `apps/docs`    | `bun run build` | `bunx wrangler deploy`                   | off                   |
| `proto-dev`      | `main`       | (repo root)    | (empty)         | `bunx wrangler deploy --env development` | off                   |
| `proto-docs-dev` | `main`       | `apps/docs`    | (empty)         | `bunx wrangler deploy --env development` | off                   |

The frontoffice build runs from the `[build]` command in `wrangler.toml` (per environment), so the
dashboard build command stays empty. Create `proto-dev` and `proto-docs-dev` with **Import a
repository**, using the same repository.
