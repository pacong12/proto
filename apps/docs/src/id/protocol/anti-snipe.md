# Perlindungan Anti-Snipe & Fair Launch

Salah satu kendala terbesar dalam peluncuran token kripto adalah serangan bot sniper otomatis yang memborong likuiditas awal dalam hitungan milidetik dan merugikan komunitas.

Proto menerapkan aturan smart contract yang terkunci secara permanen pada blok awal peluncuran untuk memastikan anggota komunitas mendapatkan peluang yang adil.

---

## Mekanisme Kerja

### Untuk Model v1 Direct Pool (Uniswap V3)

Selama 2 blok pertama setelah pool likuiditas diinisialisasi:

1. **Blok 0 (Blok Peluncuran)**:
   - Hanya transaksi pembelian awal (_initial buy_) opsional milik kreator yang dapat dieksekusi bersamaan dengan pembuatan kontrak.
   - Setiap transaksi bot dari luar yang mencoba menyalip di blok yang sama akan otomatis ditolak.
2. **Blok 1 dan 2**:
   - **Batas Maksimal Beli Per Transaksi**: Tidak ada transaksi yang boleh membeli lebih dari **5.5% dari total pasokan** (55.000.000 token).
   - **Batas Maksimal Saldo Dompet**: Tidak ada dompet yang boleh memegang lebih dari **5.0% dari total pasokan** (50.000.000 token).
3. **Blok 3 dan Seterusnya**:
   - Seluruh batasan kuota berakhir secara otomatis di dalam bytecode smart contract. Pasar menjadi terbuka secara bebas dan tanpa batas.
   - **Penjualan Tidak Pernah Dibatasi**: Siapa pun yang membeli dapat menjual kembali tokennya ke pool kapan saja, bahkan selama jendela pembatasan masih aktif.

---

### Untuk Model v2 Bonding Curve

Pada kurva bonding, Proto menerapkan **pajak sniper peluruhan dinamis**:

- Pada detik pertama peluncuran ($t=0$), pajak otomatis sebesar 99% berlaku bagi bot predator yang mencoba eksekusi instan.
- Pajak ini meluruh dengan cepat dalam 3 detik berikutnya ($t=1 \to 25\%$, $t=2 \to 3\%$, $t \ge 3 \to 0\%$).
- Dalam beberapa detik, perdagangan kembali normal tanpa pajak bagi trader komunitas.

---

## Jaminan Transparansi & Keamanan

- **Tanpa Whitelist atau Perantara**: Siapa pun dengan dompet Web3 dapat berpartisipasi begitu jendela fair launch terbuka.
- **Tanpa Tombol Kendali Admin**: Batasan anti-snipe dikodekan secara matematis di dalam kontrak dan berakhir tanpa campur tangan manusia.
- **Penjualan Selalu Diizinkan**: Tidak ada penguncian token buatan atau masa tunggu bagi pembeli.
