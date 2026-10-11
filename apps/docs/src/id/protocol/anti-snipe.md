# Perlindungan Anti-Snipe & Fair Launch

Salah satu kendala terbesar dalam peluncuran token kripto adalah serangan bot sniper otomatis yang memborong likuiditas awal dalam hitungan milidetik dan merugikan komunitas.

Proto menerapkan aturan smart contract yang terkunci secara permanen pada blok awal peluncuran untuk memastikan anggota komunitas mendapatkan peluang yang adil.

---

## Mekanisme Kerja

Pada arsitektur kurva bonding, Proto menerapkan **pajak sniper peluruhan dinamis**:

- Pada detik pertama peluncuran ($t=0$), pajak otomatis sebesar 99% berlaku bagi bot predator yang mencoba eksekusi instan.
- Pajak ini meluruh dengan cepat dalam 3 detik berikutnya ($t=1 \to 25\%$, $t=2 \to 3\%$, $t \ge 3 \to 0\%$).
- Dalam beberapa detik, perdagangan kembali normal tanpa pajak bagi trader komunitas.

---

## Jaminan Transparansi & Keamanan

- **Tanpa Whitelist atau Perantara**: Siapa pun dengan dompet Web3 dapat berpartisipasi begitu jendela fair launch terbuka.
- **Tanpa Tombol Kendali Admin**: Batasan anti-snipe dikodekan secara matematis di dalam kontrak dan berakhir tanpa campur tangan manusia.
- **Penjualan Selalu Diizinkan**: Tidak ada penguncian token buatan atau masa tunggu bagi pembeli.
