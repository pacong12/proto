# VPS Backend Deployment Guide

Workflow deployment otomatis untuk Backend API dan Redis ke server VPS (`.github/workflows/deploy-vps.yml`), identik dengan arsitektur project `course`.

## Cara Kerja

Deploy hanya berjalan untuk **rilis**. Saat rilis dibuat, `release.yml` memindahkan branch
`production` ke commit rilis lalu menjalankan workflow ini pada branch tersebut. Untuk deploy ulang
atau rollback, jalankan **Promote Release to Production** dengan tag rilis.

GitHub Actions akan:

1. Terhubung ke VPS melalui SSH (`appleboy/ssh-action`).
2. Masuk ke direktori aplikasi (`/var/www/proto`).
3. Menjalankan `git fetch origin production && git reset --hard origin/production`.
4. Membangun ulang container `redis` dan `api` dengan `docker compose up -d --build --no-deps redis api`.
5. Melakukan health check (`http://127.0.0.1:3011/health`).

Hardening server (SSH, firewall, fail2ban, update otomatis): lihat `docs/VPS_SECURITY.md`.

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
CORS_ALLOWED_ORIGINS=https://goton.fun,https://docs.goton.fun

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

### Memulihkan trade yang terlewat indexer

Token yang tercatat setelah indexer melewati trade pertamanya (misalnya ditemukan saat halaman
token dibuka) kehilangan riwayat trade awalnya. API sekarang mengisinya otomatis untuk token baru;
untuk data lama, jalankan sekali:

```bash
H=$(docker exec proto-api sh -c 'wget -qO- http://127.0.0.1:3001/dex/latest-block?chain=robinhood' \
  | sed 's/.*"block":\([0-9]*\).*/\1/')
docker exec proto-api bun run scripts/backfill-tokens.ts --chain robinhood \
  --from $((H - 4000000)) --trades-only
```

Trade disimpan dengan id `txHash-logIndex`, jadi menjalankan ulang aman.

---

## GitHub Secrets yang Digunakan

Pastikan secrets berikut telah diisi di **GitHub Repository** -> **Settings** -> **Secrets and variables** -> **Actions**:

| Secret Name                 | Default Value / Deskripsi           | Wajib?                                 |
| --------------------------- | ----------------------------------- | -------------------------------------- |
| `VPS_HOST`                  | IP atau hostname VPS                | **WAJIB** (deploy di-skip jika kosong) |
| `VPS_USER`                  | `deploy` (user dengan akses docker) | Opsional (default `deploy`)            |
| `VPS_SSH_KEY` atau `DEPLOY` | Private SSH Key untuk login ke VPS  | **WAJIB**                              |
| `VPS_PORT`                  | `22`                                | Opsional (default `22`)                |
| `VPS_APP_DIR`               | `/var/www/proto`                    | Opsional (default `/var/www/proto`)    |

_Catatan: Jika secret `VPS_SSH_KEY` dan `DEPLOY` belum diisi, workflow akan otomatis di-skip secara aman tanpa menyebabkan build merah._
