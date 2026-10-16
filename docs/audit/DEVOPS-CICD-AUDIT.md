# Audit Keamanan DevOps, CI/CD, Secrets & Supply Chain Hygiene

> Status remediasi per 2026-10-16: ✅ = sudah diperbaiki, 🟡 = diperbaiki sebagian, ❌ = tidak valid, ⚪ = risiko diterima, ⏳ = terbuka (butuh keputusan legal/bisnis); verifikasi lengkap di [AUDIT-VERIFICATION.md](./AUDIT-VERIFICATION.md).

**Klasifikasi**: PROTOCOL CONFIDENTIAL / AUDIT INFRASTRUKTUR & CI/CD  
**Ruang Lingkup Pemeriksaan**:

- **GitHub Actions Workflows**: `.github/workflows/` (14 file workflow: `ci.yml`, `security.yml`, `deploy-vps.yml`, `deploy-api-docker.yml`, `security-audit.yml`, `codeql.yml`, `commit-check.yml`, `release.yml`, `deploy-docs-worker.yml`, dll.)
- **Manajemen Secrets & Environment**: `.env.example`, `.env`, `contracts/.env`, `.gitignore`, git commit history
- **Kontainerisasi & Deployment**: `docker-compose.yml`, `Dockerfile.api`, `Dockerfile.frontoffice`, `Dockerfile.docs`
- **Supply Chain & Lockfile**: `package.json` (root, apps, packages), `bun.lock`, dependensi Bun & Foundry
- **Naskah Operasional (Scripts)**: `scripts/`, `contracts/scripts/verify-robinhood.sh`, `apps/api/entrypoint.sh`

---

## 1. Ringkasan Eksekutif

Audit menyeluruh dilakukan terhadap alur kerja CI/CD (Continuous Integration / Continuous Deployment), konfigurasi rahasia (_secrets_), keamanan citra kontainer Docker, integritas rantai pasokan perangkat lunak (_software supply chain_), serta skrip deployment pada ekosistem Proto.

Audit mengidentifikasi **8 temuan keamanan dan kelemahan konfigurasi**:

- **2 Tingkat Tinggi (High Severity)**: IP publik server produksi VPS ter-hardcode di file workflow GitHub publik, dan seluruh pipeline pemindaian keamanan (`gitleaks`, `slither`, `codeql`, `trivy`) dikonfigurasi dalam mode non-blocking (`continue-on-error: true` dan `|| true`).
- **4 Tingkat Sedang (Medium Severity)**: Penggunaan unpinned branch `@master` pada action Trivy, alur deploy Cloudflare Workers yang aktif pada event `pull_request`, kontainer Docker yang berjalan sebagai user `root` dengan hak akses folder `chmod 777`, serta kata sandi default Redis yang terpublikasi di template.
- **2 Tingkat Rendah (Low Severity)**: Ketidaksesuaian argumen verifikasi token pada skrip shell, dan resiko proliferasi secret pada `.env` lokal tanpa guard hook `git add`.

---

## 2. Matriks Temuan Audit DevOps & CI/CD

| ID               | Severity | Komponen Terkait                                       | Ringkasan Kerentanan                                                                               |
| :--------------- | :------- | :----------------------------------------------------- | :------------------------------------------------------------------------------------------------- |
| **DEVOPS-01** ✅ | High     | `.github/workflows/deploy-vps.yml:33`                  | **IP Publik Server VPS Produksi (`31.97.189.81`) Terpapar di Kode Workflow Terbuka**               |
| **DEVOPS-02** ✅ | High     | `security.yml`, `security-audit.yml`, `codeql.yml`     | **Pemindaian Keamanan Dikonfigurasi Non-Blocking (`continue-on-error: true` & `\|\| true`)**       |
| **DEVOPS-03** ✅ | Medium   | `.github/workflows/security-audit.yml:25`              | **Resiko Rantai Pasokan Action via Unpinned Branch Mutable (`aquasecurity/trivy-action@master`)**  |
| **DEVOPS-04** ✅ | Medium   | `.github/workflows/deploy-docs-worker.yml:9-13, 42-53` | **Alur Deploy Cloudflare Workers ke Produksi Terpicu pada Event `pull_request`**                   |
| **DEVOPS-05** ✅ | Medium   | `Dockerfile.api:34-37` / `Dockerfile.frontoffice:28`   | **Kontainer Docker Berjalan Sebagai Root dengan Izin Direktori Berbahaya (`chmod 777 /app/data`)** |
| **DEVOPS-06** ✅ | Medium   | `docker-compose.yml:20, 45` / `.env.example:130`       | **Kata Sandi Default Redis (`proto_redis_default_secure_pass`) Terbuka di Repositori Publik**      |
| **DEVOPS-07** ✅ | Low      | `contracts/scripts/verify-robinhood.sh:72-83`          | **Skrip Verifikasi Mengirim 9 Argumen Konstruktor ke Kontrak Token yang Menggunakan Initializer**  |
| **DEVOPS-08** ✅ | Low      | Root `.env` & `contracts/.env`                         | **Proliferasi Private Key & API Key pada File `.env` Lokal Tanpa Proteksi Pre-Commit Hook**        |

---

## 3. Detail Analisis Teknis & Rencana Remediasi

### DEVOPS-01: IP Publik Server VPS Produksi (`31.97.189.81`) Terpapar di Kode Workflow Terbuka [High] — ✅ RESOLVED

> **Status: ✅ RESOLVED (2026-10-16)** — Fallback IP dihapus dari `deploy-vps.yml`; deploy hanya berjalan bila secret `VPS_HOST` (dan kunci SSH) diset. IP lama tetap ada di riwayat git, jadi lindungi server dengan firewall/allowlist SSH.

- **Lokasi Kode**:
  - `.github/workflows/deploy-vps.yml:33`
- **Akar Masalah**:
  Pada langkah deploy SSH:
  ```yaml
  - name: Deploy via SSH
    uses: appleboy/ssh-action@v1.0.3
    with:
      host: ${{ secrets.VPS_HOST || '31.97.189.81' }}
      username: ${{ secrets.VPS_USER || 'deploy' }}
      key: ${{ secrets.VPS_SSH_KEY || secrets.DEPLOY }}
  ```
  Alamat IP publik server VPS produksi (`31.97.189.81`), direktori aplikasi (`/var/www/proto`), serta user sistem (`deploy`) ditulis secara gamblang (_hardcoded fallback_) di file workflow yang dapat dibaca di repositori.
  Selain itu, baris 51 menunjukkan bahwa user `deploy` memiliki hak akses passwordless sudo:
  `sudo docker compose up -d --build --no-deps redis api`.
- **Dampak**:
  Penyerang dapat langsung mengetahui target infrastruktur fisik server Proto, melakukan port scanning terarah, mencoba serangan brute-force SSH, atau menargetkan celah kernel/OS pada IP tersebut.
- **Rekomendasi Remediasi**:
  Hapus IP hardcoded dan direktori default dari file YAML:
  ```yaml
  host: ${{ secrets.VPS_HOST }}
  username: ${{ secrets.VPS_USER }}
  key: ${{ secrets.VPS_SSH_KEY }}
  ```
  Pastikan workflow langsung membatalkan eksekusi jika `secrets.VPS_HOST` belum dikonfigurasi.

---

### DEVOPS-02: Pemindaian Keamanan Dikonfigurasi Non-Blocking (`continue-on-error: true` & `|| true`) [High] — ✅ RESOLVED

> **Status: ✅ RESOLVED (2026-10-16)** — Gitleaks dan CodeQL kini memblokir (tanpa `continue-on-error`); Slither memakai `--fail-high` (delapan temuan high diperiksa: semuanya positif palsu, diberi anotasi `slither-disable` beserta alasannya; `src/legacy/` dikecualikan karena sudah di-deploy dan dibekukan); Trivy memakai `exit-code: 1`. Slither lokal: lolos.

- **Lokasi Kode**:
  - `.github/workflows/security.yml:31, 61, 68`
  - `.github/workflows/security-audit.yml:38`
  - `.github/workflows/codeql.yml:102`
- **Akar Masalah**:
  Semua pemindai keamanan inti dikonfigurasi agar tidak pernah menggagalkan build:
  1. `gitleaks-action` (pemindai kebocoran secret):
     ```yaml
     - name: Gitleaks Scan
       uses: gitleaks/gitleaks-action@v2
       continue-on-error: true # Kebocoran secret tidak memblokir PR
     ```
  2. `slither` (analisis statis smart contract):
     ```yaml
     slither . ... --sarif slither.sarif || true # Revert code diabaikan
     ...
     - name: Upload Slither SARIF to GitHub Security
       continue-on-error: true
     ```
  3. `codeql` (analisis kerentanan kode):
     ```yaml
     - name: Perform CodeQL Analysis
       continue-on-error: true
     ```
  4. `trivy` (pemindaian kerentanan dependensi):
     ```yaml
     - name: Upload Trivy Scan Results to GitHub Security
       continue-on-error: true
     ```
- **Dampak**:
  Pemindaian keamanan hanya bersifat kosmetik (_informational_). Jika seorang pengembang secara tidak sengaja menambahkan private key ke commit atau menulis smart contract dengan celah kritis (seperti reentrancy atau integer overflow), seluruh pipeline CI tetap berwarna hijau (_passing_) dan PR diizinkan untuk di-merge ke branch `main`.
- **Rekomendasi Remediasi**:
  Hapus `continue-on-error: true` dan `|| true` dari `gitleaks` dan `slither`. Wajibkan PR gagal jika Gitleaks menemukan secret aktif atau jika Slither mendeteksi kerentanan tingkat High/Critical.

---

### DEVOPS-03: Resiko Rantai Pasokan Action via Unpinned Branch Mutable (`aquasecurity/trivy-action@master`) [Medium] — ✅ RESOLVED

> **Status: ✅ RESOLVED (2026-10-16)** — `trivy-action` dipin ke SHA `57a97c7…` (v0.35.0, satu-satunya tag yang tidak ditimpa pada insiden CVE-2026-33634, 19 Maret 2026). Karena workflow sebelumnya memakai `@master`, periksa run `security-audit.yml` pada 19–20 Maret 2026 dan rotasi secret repo bila workflow berjalan saat itu.

- **Lokasi Kode**:
  - `.github/workflows/security-audit.yml:25`
- **Akar Masalah**:
  Pada workflow `security-audit.yml`:
  ```yaml
  - name: Run Trivy Vulnerability Scanner (Repository)
    uses: aquasecurity/trivy-action@master
  ```
  Action merujuk langsung ke nama branch bergerak `@master`, bukan tag rilis spesifik (`@v0.29.0`) atau commit hash SHA-256 (`@d43c1f...`).
- **Dampak**:
  Jika repositori pihak ketiga `aquasecurity/trivy-action` disusupi oleh penyerang, atau jika ada commit berbahaya yang di-push ke branch master repositori tersebut, kode berbahaya akan langsung dieksekusi di dalam runner GitHub Actions Proto yang memiliki akses ke `GITHUB_TOKEN` repositori.
- **Rekomendasi Remediasi**:
  Kunci action ke commit hash permanen (SHA pinning):
  ```yaml
  uses: aquasecurity/trivy-action@18f2510ee396bbf400402947b394f2dd8c87dbb0 # v0.29.0
  ```

---

### DEVOPS-04: Alur Deploy Cloudflare Workers ke Produksi Terpicu pada Event `pull_request` [Medium] — ✅ RESOLVED

> **Status: ✅ RESOLVED (2026-10-16)** — Event `pull_request` hanya mem-build docs; langkah deploy Cloudflare dilewati untuk PR.
>
> **Pembaruan (2026-10-16):** workflow ini dan `deploy-frontoffice.yml` dihapus. Keduanya tidak pernah men-deploy karena secret `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` tidak ada di GitHub (langkah deploy selalu _skipped_). Docs (`proto-docs`) dan frontoffice (`proto`) di-deploy oleh integrasi Git Cloudflare Workers dari `main`; atur _Root directory_ `apps/docs` untuk proto-docs dan matikan _Builds for non-production branches_ di dashboard agar PR tidak di-build.

- **Lokasi Kode**:
  - `.github/workflows/deploy-docs-worker.yml:9-13, 42-53`
- **Akar Masalah**:
  Pemicu workflow mencakup pull request:
  ```yaml
  on:
    push:
      branches: [main, refactor/clean-architecture]
    pull_request:
      branches: [main, refactor/clean-architecture]
  ```
  Dan langkah deploy ke Cloudflare Workers:
  ```yaml
  - name: Deploy to Cloudflare Workers
    if: env.CF_TOKEN != '' && env.CF_ACCOUNT != ''
    uses: cloudflare/wrangler-action@v3
    with:
      command: deploy
  ```
  Langkah deployment tidak memiliki penjaga `github.event_name == 'push' && github.ref == 'refs/heads/main'`.
- **Dampak**:
  Setiap pembukaan atau pembaruan pull request internal akan langsung men-deploy perubahan dokumentasi ke layanan Cloudflare Workers produksi sebelum PR tersebut ditinjau atau di-merge.
- **Rekomendasi Remediasi**:
  Tambahkan pengecekan ketat pada langkah deploy:
  ```yaml
  if: github.event_name == 'push' && github.ref == 'refs/heads/main' && env.CF_TOKEN != ''
  ```

---

### DEVOPS-05: Kontainer Docker Berjalan Sebagai Root dengan Izin Direktori Berbahaya (`chmod 777 /app/data`) [Medium] — ✅ RESOLVED

> **Status: ✅ RESOLVED (2026-10-16)** — API, frontoffice, dan docs berjalan sebagai user `bun`. Entrypoint API memperbaiki kepemilikan volume lama lalu menurunkan hak akses via `su-exec`; `chmod 777` dihapus (kini 750). Diuji dengan Docker: container sehat, proses berjalan sebagai `bun`, volume milik root diambil alih. Sekalian diperbaiki: healthcheck memakai `127.0.0.1` (sebelumnya `localhost` → IPv6 sehingga selalu gagal) dan default `DB_PATH`/`UPLOADS_DIR` di volume data.

- **Lokasi Kode**:
  - `Dockerfile.api:33-37`
  - `Dockerfile.frontoffice:28`
- **Akar Masalah**:
  1. Pada `Dockerfile.api`:
     ```dockerfile
     RUN chmod +x /app/entrypoint.sh \
       && mkdir -p /app/data \
       && chmod 777 /app/data
     ENTRYPOINT ["/app/entrypoint.sh"]
     CMD ["bun", "run", "apps/api/src/server.ts"]
     ```
     Direktori `/app/data` (tempat file database SQLite disimpan) diberikan izin `777` (world-writable).
  2. Baik `Dockerfile.api` maupun `Dockerfile.frontoffice` tidak mendefinisikan instruksi `USER`. Secara default, `oven/bun:1-alpine` menjalankan proses sebagai user `root` (UID 0).
- **Dampak**:
  Menjalankan aplikasi web langsung sebagai user `root` di dalam kontainer melanggar prinsip hak akses terendah (_least privilege_). Jika terjadi eksploitasi Remote Code Execution (RCE) atau eksekusi perintah shell pada aplikasi Node/Bun, penyerang memperoleh hak akses root di dalam kontainer, mempermudah pelolosan kontainer (_container breakout_) ke host VPS.
- **Rekomendasi Remediasi**:
  Gunakan non-root user bawaan Bun (`bun:bun`):
  ```dockerfile
  RUN chown -R bun:bun /app/data
  USER bun
  ```
  Ubah hak akses folder data menjadi `750` atau `700`.

---

### DEVOPS-06: Kata Sandi Default Redis (`proto_redis_default_secure_pass`) Terbuka di Repositori Publik [Medium] — ✅ RESOLVED

> **Status: ✅ RESOLVED (2026-10-16)** — Tidak ada lagi password default: `docker-compose.yml` memakai `${REDIS_PASSWORD:?…}` dan `.env.example` kosong. **Wajib set `REDIS_PASSWORD` di `.env` VPS sebelum deploy berikutnya.** Variabel env alamat kontrak di compose juga diperbarui ke nama v4.

- **Lokasi Kode**:
  - `docker-compose.yml:20, 22, 45`
  - `.env.example:130`
- **Akar Masalah**:
  Pada `docker-compose.yml`:
  ```yaml
  --requirepass ${REDIS_PASSWORD:-proto_redis_default_secure_pass}
  REDIS_URL=redis://:${REDIS_PASSWORD:-proto_redis_default_secure_pass}@redis:6379
  ```
  Terdapat nilai fallback kata sandi default `proto_redis_default_secure_pass` yang terpublikasi di repositori.
- **Dampak**:
  Jika operator menjalankan `docker compose up -d` di server VPS tanpa terlebih dahulu menetapkan `REDIS_PASSWORD` yang kuat di file `.env`, instance Redis akan beroperasi dengan kata sandi default yang telah diketahui publik. Jika port Redis terpapar atau diakses melalui celah SSRF, penyerang dapat membaca cache dan data sesi.
- **Rekomendasi Remediasi**:
  Hapus nilai fallback default di `docker-compose.yml`. Wajibkan variabel `REDIS_PASSWORD` didefinisikan secara eksplisit:
  ```yaml
  --requirepass ${REDIS_PASSWORD:?REDIS_PASSWORD must be set in .env}
  ```

---

### DEVOPS-07: Skrip Verifikasi Mengirim 9 Argumen Konstruktor ke Kontrak Token yang Menggunakan Initializer [Low] — ✅ RESOLVED

> **Status: ✅ RESOLVED (2026-10-16)** — `verify-robinhood.sh` ditulis ulang untuk stack v4 (hook, splitter deployer, graduator, factory, router, buyback); argumen konstruktor dibaca dari kontrak yang sudah di-deploy; token/kurva tanpa argumen konstruktor. Belum dijalankan terhadap deployment asli karena stack baru belum di-deploy.

- **Lokasi Kode**:
  - `contracts/scripts/verify-robinhood.sh:72-83`
- **Akar Masalah**:
  Skrip shell `verify-robinhood.sh` mencoba memverifikasi bytecode kontrak token dengan mengenkripsi 9 argumen konstruktor:
  ```bash
  TOKEN_CONSTRUCTOR_ARGS=$(cast abi-encode \
    "constructor(string,string,string,string,(string,string,string,string,string),address,address,address,uint256)" \
    "$TOKEN_NAME" ... "$TOKEN_SUPPLY")
  forge verify-contract ... --constructor-args "$TOKEN_CONSTRUCTOR_ARGS"
  ```
  Namun, kontrak `LaunchpadToken.sol` mengadopsi pola **Initializer** untuk auto-verifikasi CREATE2:
  `constructor() {}` (konstruktor kosong tanpa parameter).
- **Dampak**:
  Perintah verifikasi explorer otomatis akan gagal dengan error ketidaksesuaian panjang argumen konstruktor (_mismatched constructor arguments length_).
- **Rekomendasi Remediasi**:
  Hapus pengkodean argumen konstruktor untuk `LaunchpadToken.sol` pada skrip verifikasi karena kontrak dideploy tanpa argumen konstruktor.

---

### DEVOPS-08: Proliferasi Private Key & API Key pada File `.env` Lokal Tanpa Proteksi Pre-Commit Hook [Low] — ✅ RESOLVED

> **Status: ✅ RESOLVED (2026-10-16)** — `scripts/setup-git-hooks.sh` kini juga memasang hook `pre-commit` (gitleaks bila terpasang; jika tidak, memblokir file `.env` dan pola private key 64-hex). Terpasang otomatis lewat `prepare` saat `bun install`. Diuji di repo sementara.

- **Lokasi Kode**:
  - Root `.env`, `contracts/.env`
- **Akar Masalah**:
  File `.env` lokal menyimpan private key aktif (`PRIVATE_KEY=0x2e...`), token JWT Pinata, dan API key Etherscan/RobinScan. Meskipun `.gitignore` telah mengecualikan `.env`, pengembang dapat secara tidak sengaja menjalankan `git add -f` atau menyalin secret ke file pengujian yang ter-commit.
- **Dampak**:
  Resiko kebocoran kunci deployment blockchain di masa mendatang jika file `.env` terpapar secara tidak sengaja.
- **Rekomendasi Remediasi**:
  Aktifkan pre-commit hook lokal menggunakan `gitleaks` atau git hook `commit-msg` untuk memblokir penambahan string 64-karakter hex (private key) sebelum commit dibuat.

---

## 4. Audit Rantai Pasokan Dependensi (Supply Chain Hygiene)

- **Manajer Paket**: Bun (menggunakan `bun.lock` dengan integritas hash)
- **Status Script Postinstall**: Hasil eksekusi `bun pm untrusted` mengonfirmasi **0 dependensi tidak terpercaya yang menjalankan lifecycle script**.
- **Pemeriksaan Dependensi Berbahaya**:
  Seluruh paket inti (`viem`, `radix-vue`, `@reown/appkit`, `ioredis`, `@wagmi/core`, `lightweight-charts`) berasal dari registri resmi npm dengan versi semver terkontrol.
- **Overrides**: Terdapat override pada `source-map-js: "^1.2.2"` di root `package.json` untuk menambal kerentanan parsing sumber kode.

---

## Status Remediasi (2026-10-16)

- **DEVOPS-01** ✅ RESOLVED — Fallback IP dihapus dari `deploy-vps.yml`; deploy hanya berjalan bila secret `VPS_HOST` (dan kunci SSH) diset. IP lama tetap ada di riwayat git, jadi lindungi server dengan firewall/allowlist SSH.
- **DEVOPS-02** ✅ RESOLVED — Gitleaks dan CodeQL kini memblokir (tanpa `continue-on-error`); Slither memakai `--fail-high` (delapan temuan high diperiksa: semuanya positif palsu, diberi anotasi `slither-disable` beserta alasannya; `src/legacy/` dikecualikan karena sudah di-deploy dan dibekukan); Trivy memakai `exit-code: 1`. Slither lokal: lolos.
- **DEVOPS-03** ✅ RESOLVED — `trivy-action` dipin ke SHA `57a97c7…` (v0.35.0, satu-satunya tag yang tidak ditimpa pada insiden CVE-2026-33634, 19 Maret 2026). Karena workflow sebelumnya memakai `@master`, periksa run `security-audit.yml` pada 19–20 Maret 2026 dan rotasi secret repo bila workflow berjalan saat itu.
- **DEVOPS-04** ✅ RESOLVED — Workflow deploy Cloudflare di GitHub dihapus (tidak pernah aktif); deploy hanya lewat integrasi Git Cloudflare dari `main`.
- **DEVOPS-05** ✅ RESOLVED — API, frontoffice, dan docs berjalan sebagai user `bun`. Entrypoint API memperbaiki kepemilikan volume lama lalu menurunkan hak akses via `su-exec`; `chmod 777` dihapus (kini 750). Diuji dengan Docker: container sehat, proses berjalan sebagai `bun`, volume milik root diambil alih. Sekalian diperbaiki: healthcheck memakai `127.0.0.1` (sebelumnya `localhost` → IPv6 sehingga selalu gagal) dan default `DB_PATH`/`UPLOADS_DIR` di volume data.
- **DEVOPS-06** ✅ RESOLVED — Tidak ada lagi password default: `docker-compose.yml` memakai `${REDIS_PASSWORD:?…}` dan `.env.example` kosong. **Wajib set `REDIS_PASSWORD` di `.env` VPS sebelum deploy berikutnya.** Variabel env alamat kontrak di compose juga diperbarui ke nama v4.
- **DEVOPS-07** ✅ RESOLVED — `verify-robinhood.sh` ditulis ulang untuk stack v4 (hook, splitter deployer, graduator, factory, router, buyback); argumen konstruktor dibaca dari kontrak yang sudah di-deploy; token/kurva tanpa argumen konstruktor. Belum dijalankan terhadap deployment asli karena stack baru belum di-deploy.
- **DEVOPS-08** ✅ RESOLVED — `scripts/setup-git-hooks.sh` kini juga memasang hook `pre-commit` (gitleaks bila terpasang; jika tidak, memblokir file `.env` dan pola private key 64-hex). Terpasang otomatis lewat `prepare` saat `bun install`. Diuji di repo sementara.
