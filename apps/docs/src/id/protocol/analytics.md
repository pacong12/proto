# Analitik Protokol

Halaman **Analytics** memberi tampilan langsung seluruh jaringan tentang aktivitas di Goton — berapa banyak yang diperdagangkan, berapa token yang diluncurkan, dan fee yang dihasilkan protokol — untuk jaringan yang sedang Anda pakai.

---

## Grafik Utama

Satu grafik interaktif memetakan satu metrik selama **24 jam terakhir**, dalam bucket. Ganti metriknya:

| Metrik       | Yang dipetakan                                   |
| :----------- | :----------------------------------------------- |
| **Volume**   | Volume trading dari waktu ke waktu               |
| **Launches** | Token yang diluncurkan dari waktu ke waktu       |
| **Fees**     | Fee protokol yang dihasilkan dari waktu ke waktu |

Beralih antara tampilan **area halus** dan **batang**. Semuanya tercakup ke **jaringan aktif** (Robinhood atau Arc) — ganti jaringan dari header untuk melihat angka chain lainnya.

---

## Statistik Utama

Di bawah grafik, kartu ringkasan menampilkan total jaringan, termasuk:

- **Total volume trading** — volume keseluruhan di jaringan.
- **Total token diluncurkan** — berapa token yang sudah dibuat.
- **Estimasi pajak / fee** — perkiraan fee yang dihasilkan.
- **Buyback** — aktivitas buyback protokol, bila ada.

Daftar **token teratas** mengurutkan token menurut market cap, jadi Anda bisa lompat langsung dari tampilan makro ke halaman trade token tertentu.

---

## Catatan

- Angka dibangun dari **data on-chain** dan diperbarui saat blok baru diproses. Mau angka yang sama untuk alat Anda sendiri? Semuanya ada di [Public API](/id/integration/api).
- Analitik bersifat **per jaringan**: halaman selalu mencerminkan chain yang ditampilkan di header, dan menyebutkannya di catatan cakupan.
- Angka diturunkan dari indexer dan diperbarui seiring blok baru diproses; jendela 24 jam adalah tampilan bergulir, bukan satu hari kalender.
