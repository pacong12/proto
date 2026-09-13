# VPS Backend Deployment Guide

Workflow deployment otomatis untuk Backend API dan Redis ke server VPS (`.github/workflows/deploy-vps.yml`), identik dengan arsitektur project `course`.

## Cara Kerja

Setiap kali ada `git push` ke branch `main` yang mengubah folder:

- `apps/api/**`
- `packages/shared-types/**`
- `Dockerfile.api`
- `docker-compose.yml`
- `.github/workflows/deploy-vps.yml`

Atau dapat dijalankan manual melalui **Actions** -> **Auto Deploy Backend to VPS** -> **Run workflow**.

GitHub Actions akan:

1. Terhubung ke VPS melalui SSH (`appleboy/ssh-action@v1.0.3`).
2. Masuk ke direktori aplikasi (`/var/www/proto`).
3. Menjalankan `git fetch origin main && git reset --hard origin/main`.
4. Membangun ulang container `redis` dan `api` dengan `docker compose up -d --build --no-deps redis api`.
5. Melakukan health check otomatis (`http://127.0.0.1:3001/health`).

---

## Setup Awal di Server VPS

Jalankan perintah ini sekali saja di terminal VPS Anda:

```bash
# 1. Buat folder dan clone repository
mkdir -p /var/www/proto
cd /var/www/proto
git clone https://github.com/pacong12/proto.git .

# 2. Siapkan file .env untuk backend di VPS
cat << 'EOF' > .env
PORT=3001
NODE_ENV=production
ALLOWED_ORIGINS=https://proto.mutingudin12.workers.dev,https://proto.family

# Kunci untuk autentikasi live dashboard /devops
DEVOPS_AUTH_TOKEN=ganti_dengan_token_rahasia_anda

# Oracle CoinGecko untuk konversi harga live
PRICE_FEED_MODE=coingecko
COINGECKO_API_KEY=CG-kunci-api-anda

# Robinhood Chain Mainnet
ROBINHOOD_RPC_URL=https://rpc.mainnet.chain.robinhood.com
CHAIN_ID=4663
EOF

# 3. Jalankan container pertama kali
docker compose up -d --build redis api
```

---

## GitHub Secrets yang Digunakan

Pastikan secrets berikut telah diisi di **GitHub Repository** -> **Settings** -> **Secrets and variables** -> **Actions**:

| Secret Name                 | Default Value / Deskripsi              | Wajib?                                  |
| --------------------------- | -------------------------------------- | --------------------------------------- |
| `VPS_HOST`                  | `31.97.189.81` (IP VPS Anda)           | Opsional (default sudah `31.97.189.81`) |
| `VPS_USER`                  | `root` (atau user dengan akses docker) | Opsional (default `root`)               |
| `VPS_SSH_KEY` atau `DEPLOY` | Private SSH Key untuk login ke VPS     | **WAJIB**                               |
| `VPS_PORT`                  | `22`                                   | Opsional (default `22`)                 |
| `VPS_APP_DIR`               | `/var/www/proto`                       | Opsional (default `/var/www/proto`)     |

_Catatan: Jika secret `VPS_SSH_KEY` dan `DEPLOY` belum diisi, workflow akan otomatis di-skip secara aman tanpa menyebabkan build merah._
