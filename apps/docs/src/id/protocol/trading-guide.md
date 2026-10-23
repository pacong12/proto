# Panduan Trading & Swap

Membeli dan menjual token di Goton dirancang agar cepat, aman, dan responsif. Setiap transaksi dieksekusi secara non-kustodial langsung melalui dompet pribadi Anda.

---

## Cara Membeli Token

1. **Pilih Token**: Telusuri halaman **Explore** atau klik kartu token pilihan Anda untuk membuka halaman Trade View.
2. **Periksa Grafik & Metrik Pasar**:
   - Pantau grafik candlestick harga real-time dan riwayat volume 24 jam.
   - Periksa apakah token berstatus **On Curve** (masih di kurva harga) atau **Graduated** (sudah bermigrasi ke DEX Uniswap).
   - Tinjau daftar pemegang token teratas dan status aktivitas kreator.
3. **Pilih Mode Beli (Buy)**: Pada panel transaksi di sisi kanan, pastikan tab **Buy** aktif.
4. **Tentukan Jumlah Pembelian**:
   - Masukkan jumlah aset gas (ETH atau USDC) yang ingin dibelanjakan, atau gunakan tombol pintas nominal yang tersedia.
   - Panel akan secara otomatis menghitung estimasi jumlah token yang akan diterima berdasarkan rumus kurva bonding.
5. **Konfigurasi Slippage Tolerance (Opsional)**:
   - Klik ikon pengaturan untuk menentukan toleransi slippage (preset 0.5%, 1%, 2.5% dan 5%, nilai custom, atau Auto).
   - Fitur slippage menjamin transaksi otomatis dibatalkan jika harga bergerak melebihi batas toleransi Anda saat konfirmasi blok berlangsung.
6. **Eksekusi Pembelian**: Klik tombol **Buy [Simbol Token]** dan konfirmasikan transaksi di dompet Anda.

---

## Cara Menjual Token

1. Buka halaman Trade View token yang Anda miliki.
2. Pilih tab **Sell** pada panel perdagangan.
3. Masukkan jumlah token yang ingin dijual, atau gunakan tombol persentase (`25%`, `50%`, `75%`, `100% / Max`).
4. Periksa estimasi penerimaan aset gas yang ditampilkan.
5. Klik **Sell [Simbol Token]**:
   - Untuk penjualan pertama kali, dompet Anda akan meminta persetujuan (_approval_) satu kali untuk mengizinkan kontrak memproses token Anda.
   - Konfirmasikan transaksi penjualan untuk menerima saldo aset gas langsung ke dompet Anda.

---

## Memahami Price Impact & Proteksi Slippage

- **Price Impact**: Pada pasar terdesentralisasi, membeli porsi besar dari token yang tersedia akan menggeser harga ke atas. Pada token kurva bonding, harga bergerak secara matematis mengikuti formula $x \cdot y = k$.
- **Slippage Protection**: Melindungi Anda dari manipulasi harga atau serangan front-running. Jika ada transaksi lain yang dieksekusi tepat sebelum transaksi Anda, proteksi on-chain menjamin Anda menerima minimal output yang disepakati atau transaksi akan dibatalkan secara aman.

---

## Membaca Halaman Token

- **Market cap** adalah nilai total token saat ini: harga × total pasokan (1 miliar). Angka ini ikut bergerak bersama harga meskipun tidak ada yang bertransaksi.
- **Volume 24 jam** adalah nilai semua pembelian dan penjualan dalam 24 jam terakhir. Token bisa punya market cap tinggi tanpa volume: bernilai, tetapi sepi.
- **Perubahan 24 jam** membandingkan harga dengan 24 jam lalu. Token yang tidak diperdagangkan dalam rentang itu menunjukkan 0%.
- **Buy / sell pressure** membagi volume terbaru menjadi beli dan jual dalam 5 menit, 1 jam, 6 jam, atau 24 jam.
- **Holders** menampilkan saldo terbesar. Bonding curve (atau pool setelah graduasi) diberi label tersendiri, bukan sebagai pengguna.
- **Top traders** menampilkan pembelian, penjualan, saldo, dan profit setiap dompet.
- **Chart** menampilkan harga atau market cap dalam candle dari 1 detik hingga 1 hari. Bar tanpa transaksi digambar abu-abu.
- Di Explore, **grafik** kecil di samping setiap token adalah harganya sejak peluncuran hingga sekarang.

---

## Limit, Take-Profit & Stop-Loss

Untuk membeli atau menjual di harga target, gunakan tab **Limit** dan **TP / SL** di panel trading. Lihat [Order Limit, Take-Profit & Stop-Loss](/id/protocol/advanced-orders).
