# Pertanyaan yang Sering Diajukan (FAQ)

Temukan jawaban atas pertanyaan umum seputar perdagangan, peluncuran, dan pengelolaan token di Goton.

---

## Pertanyaan Umum

### Apa itu Goton?

Goton adalah launchpad kripto non-kustodial terdesentralisasi yang mendukung **Robinhood Chain** (L2) dan **Arc Network** (Circle Stablecoin L1). Platform ini memungkinkan siapa saja untuk meluncurkan token pasokan tetap, bertransaksi dengan grafik real-time, dan berpartisipasi dalam fair launch dengan likuiditas yang terkunci permanen.

### Apakah pengembang dapat melakukan rug pull atau menguras likuiditas?

**Tidak bisa.** Seluruh posisi likuiditas pool dicetak langsung ke dalam smart contract terbuka `LiquidityLocker.sol` dan dikunci secara permanen selamanya. Tidak ada fungsi pembuka kunci, backdoor, atau kunci admin penarikan.

### Dompet apa saja yang didukung?

Goton mendukung semua dompet Web3 standar yang kompatibel dengan EVM, termasuk:

- MetaMask
- Coinbase Wallet
- Rabby Wallet
- Rainbow Wallet
- Dompet seluler berbasis WalletConnect / Reown

Goton hanya menghubungkan dompet. Tidak ada login email atau sosial, sehingga aplikasi tidak pernah menyimpan kunci untuk Anda.

- Login sosial melalui Google, X, Discord, dan GitHub via embedded wallet

---

## Trading & Transaksi

### Mengapa transaksi saya gagal?

Kegagalan transaksi umumnya disebabkan oleh dua faktor:

1. **Batas Slippage Terlampaui**: Pada periode volatilitas tinggi, harga bergerak melampaui persentase slippage yang Anda tentukan. Naikkan toleransi slippage di menu pengaturan (misal dari 1% ke 2%).
2. **Saldo Gas Tidak Mencukupi**: Selalu sisakan sedikit saldo aset gas asli (ETH di Robinhood Chain atau USDC di Arc Network) untuk membayar biaya eksekusi transaksi.

### Apa perbedaan antara On Curve dan Graduated?

- **On Curve (v2)**: Token sedang diperdagangkan pada kurva harga dinamis. Harga bertambah seiring banyaknya token yang dibeli.
- **Graduated**: Di Robinhood Chain, kurva telah mengumpulkan target 4,2 ETH dan pasar pindah permanen ke pool Uniswap v4 yang terkunci. Di Arc Network, token diperdagangkan di pool Uniswap v4 sejak peluncuran dan lulus di dalam pool saat kapitalisasi pasar melewati sekitar $45.000.

### Bisakah saya membeli atau menjual di harga target?

Bisa. Tab **Limit** dan **TP / SL** memasang order yang terisi otomatis saat market cap mencapai target Anda, dan dapat dibatalkan kapan saja. Lihat [Order Limit, Take-Profit & Stop-Loss](/id/protocol/advanced-orders).

### Apa beda Explore dan Memestock?

Explore menampilkan semua token. Memestock hanya menampilkan peluncuran dengan tesis tertulis yang kreatornya membeli dan masih memegang sebagian besar posisinya, diurutkan berdasarkan trading terbaru. Lihat [Feed, Call, Memestock & Follow](/id/protocol/social).

### Apakah ada batasan saat menjual token?

**Tidak pernah ada batasan.** Pengguna dapat menjual token mereka kapan saja. Goton tidak pernah menerapkan penguncian saldo (_lockup_), jeda penarikan (_cooldown_), maupun pembekuan transfer pada pemegang token.

---

## Pembuatan Token

### Berapa biaya untuk meluncurkan token?

Biaya protokol sebesar **0.0005 ETH** di Robinhood Chain atau **Gratis (0 USDC)** di Arc Network (dengan pre-buy minimal 4.50 USDC). Biaya ini mencakup penyebaran smart contract, pencetakan pasokan token, dan penguncian likuiditas awal.

### Bisakah pasokan token ditambah di masa depan?

**Tidak bisa.** Setiap token di Goton memiliki pasokan tetap tepat **1.000.000.000 token** (1 Miliar). Smart contract tidak memiliki fungsi pencetakan tambahan (_mint_).

### Bagaimana kreator mendapatkan pendapatan?

Fee dan pajak setiap token dibagi on-chain: **70% untuk bagian kreator di Robinhood Chain, 80% di Arc**, dan sisanya untuk protokol. Kreator dapat membagi bagiannya sekali, sebelum trading publik dimulai, antara dirinya, holder, dan buyback-and-burn. Lihat [Fee Kreator & Reward](/id/protocol/fees-and-burns). Klaim fee yang terkumpul di halaman **Profile**.

---

## Jaringan & Bantuan

### Jaringan apa saja yang didukung oleh Goton?

Goton beroperasi secara multi-chain pada **Robinhood Chain** (Chain ID: `4663`) dan **Arc Network** (Chain ID: `5042`).

### Di mana saya bisa mendapatkan bantuan lebih lanjut?

Untuk diskusi komunitas dan pembaruan protokol, silakan bergabung dengan saluran resmi kami atau tinjau [Kontrak Pintar Terverifikasi](/id/integration/contracts).
