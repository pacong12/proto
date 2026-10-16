# Apa itu Proto?

**Proto** adalah platform crypto launchpad non-kustodial yang berfokus pada komunitas di **Robinhood Chain (Chain ID: 4663)** dan **Arc Network (Chain ID: 5042)**.

Proto menghadirkan ekosistem yang aman, transparan, dan adil bagi siapa saja untuk membuat, memperdagangkan, dan menemukan aset digital tanpa hambatan finansial yang rumit, pra-penjualan tersembunyi, maupun risiko penarikan likuiditas sepihak (_rug pulls_).

---

## Mengapa Memilih Proto?

Pada launchpad konvensional, pengguna sering kali menghadapi berbagai risiko umum:

1. **Rug Pull & Likuiditas Hilang**: Pengembang membuat token, menunggu pembeli ritel masuk, lalu menarik seluruh likuiditas pool.
   - **Solusi Proto**: Setiap posisi likuiditas dicetak dan dikunci secara permanen di dalam smart contract sumber terbuka (`LiquidityLocker.sol`) saat peluncuran. Tidak ada pihak pengembang atau administrator yang dapat membuka kunci atau memindahkan cadangan likuiditas.
2. **Bot Sniper & Front-Running**: Bot berkecepatan tinggi sering memborong puluhan persen pasokan dalam fraksi detik pertama dan langsung melakukan dumping pada pembeli asli.
   - **Solusi Proto**: Mekanisme anti-snipe otomatis membatasi kuota pembelian per transaksi dan batas kepemilikan dompet selama jendela peluncuran, menjamin peluang yang setara bagi anggota komunitas.
3. **Alokasi Tim Tersembunyi**: Proyek kerap menyisihkan alokasi token besar untuk orang dalam secara diam-diam.
   - **Solusi Proto**: Pasokan token bersifat tetap tepat **1.000.000.000 token** (1 Miliar) yang dicetak secara transparan on-chain. Tidak ada fungsi untuk mencetak token baru di masa mendatang.

---

## Model Peluncuran per Jaringan

- **Robinhood Chain**: token diperdagangkan di kurva bonding. Sekitar 714,3 juta token (71,43% suplai) dijual di kurva; setelah 4,2 ETH terkumpul, siapa pun dapat memindahkan pasar ke pool Uniswap v4 yang terkunci permanen berisi sisa ~285,7 juta token.
- **Arc Network**: tidak ada kurva terpisah. Seluruh suplai ditempatkan sebagai likuiditas satu sisi di pool Uniswap v4 sejak blok pertama (nilai awal ≈ $2.480). Token lulus di dalam pool saat kapitalisasi pasarnya melewati ≈ $45.000; tidak ada migrasi dan likuiditas tetap terkunci.

---

## Langkah Awal

Untuk menggunakan Proto, Anda hanya memerlukan tiga hal:

1. Dompet Web3 yang kompatibel dengan EVM (seperti MetaMask, Coinbase Wallet, Rabby, atau Rainbow).
2. Jaringan Robinhood Chain atau Arc Network yang terhubung pada dompet Anda.
3. Saldo aset gas asli (ETH di Robinhood atau USDC di Arc) untuk membayar biaya jaringan.

Lanjutkan membaca ke panduan [Cara Meluncurkan Token](/id/protocol/launches) atau pelajari [Panduan Trading & Swap](/id/protocol/trading-guide).
