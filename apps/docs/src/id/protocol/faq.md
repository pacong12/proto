# Pertanyaan yang Sering Diajukan (FAQ)

Temukan jawaban atas pertanyaan umum seputar perdagangan, peluncuran, dan pengelolaan token di Proto.

---

## Pertanyaan Umum

### Apa itu Proto?

Proto adalah launchpad kripto non-kustodial terdesentralisasi yang mendukung **Robinhood Chain** (L2) dan **Arc Network** (Circle Stablecoin L1). Platform ini memungkinkan siapa saja untuk meluncurkan token pasokan tetap, bertransaksi dengan grafik real-time, dan berpartisipasi dalam fair launch dengan likuiditas yang terkunci permanen.

### Apakah pengembang dapat melakukan rug pull atau menguras likuiditas?

**Tidak bisa.** Seluruh posisi likuiditas pool dicetak langsung ke dalam smart contract terbuka `LiquidityLocker.sol` dan dikunci secara permanen selamanya. Tidak ada fungsi pembuka kunci, backdoor, atau kunci admin penarikan.

### Dompet apa saja yang didukung?

Proto mendukung semua dompet Web3 standar yang kompatibel dengan EVM, termasuk:

- MetaMask
- Coinbase Wallet
- Rabby Wallet
- Rainbow Wallet
- Dompet seluler berbasis WalletConnect / Reown
- Login sosial melalui Google, X, Discord, dan GitHub via embedded wallet

---

## Trading & Transaksi

### Mengapa transaksi saya gagal?

Kegagalan transaksi umumnya disebabkan oleh dua faktor:

1. **Batas Slippage Terlampaui**: Pada periode volatilitas tinggi, harga bergerak melampaui persentase slippage yang Anda tentukan. Naikkan toleransi slippage di menu pengaturan (misal dari 1% ke 2%).
2. **Saldo Gas Tidak Mencukupi**: Selalu sisakan sedikit saldo aset gas asli (ETH di Robinhood Chain atau USDC di Arc Network) untuk membayar biaya eksekusi transaksi.

### Apa perbedaan antara On Curve dan Graduated?

- **On Curve (v2)**: Token sedang diperdagangkan pada kurva harga dinamis. Harga bertambah seiring banyaknya token yang dibeli.
- **Graduated**: Token telah berhasil mengumpulkan target likuiditas (4.2 ETH di Robinhood atau 8.400 USDC di Arc) dan bermigrasi secara permanen ke pool likuiditas DEX Uniswap.

### Apakah ada batasan saat menjual token?

**Tidak pernah ada batasan.** Pengguna dapat menjual token mereka kapan saja. Proto tidak pernah menerapkan penguncian saldo (_lockup_), jeda penarikan (_cooldown_), maupun pembekuan transfer pada pemegang token.

---

## Pembuatan Token

### Berapa biaya untuk meluncurkan token?

Biaya protokol tetap sebesar **0.0005 ETH** di Robinhood Chain atau **1 USDC** di Arc Network. Biaya ini mencakup penyebaran smart contract, pencetakan pasokan token, dan penguncian likuiditas awal.

### Bisakah pasokan token ditambah di masa depan?

**Tidak bisa.** Setiap token di Proto memiliki pasokan tetap tepat **1.000.000.000 token** (1 Miliar). Smart contract tidak memiliki fungsi pencetakan tambahan (_mint_).

### Bagaimana kreator mendapatkan pendapatan?

Kreator secara otomatis mengakumulasi **70% dari fee transaksi sebesar 1%** yang terjadi pada pasar token mereka. Anda dapat memeriksa dan mengklaim pendapatan fee tersebut kapan saja di halaman **Profile** (`/profile`).

---

## Jaringan & Bantuan

### Jaringan apa saja yang didukung oleh Proto?

Proto beroperasi secara multi-chain pada **Robinhood Chain** (Chain ID: `4663`) dan **Arc Testnet** (Chain ID: `5042002`).

### Di mana saya bisa mendapatkan bantuan lebih lanjut?

Untuk diskusi komunitas dan pembaruan protokol, silakan bergabung dengan saluran resmi kami atau tinjau [Kontrak Pintar Terverifikasi](/id/integration/contracts).
