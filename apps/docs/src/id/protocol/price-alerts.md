# Alert Harga & Market Cap

Pasang alert pada token mana pun dan Goton memberi tahu Anda saat token itu mencapai target. Alert terikat ke dompet Anda dan diperiksa di server, jadi tetap memantau meski tab ditutup dan berbunyi saat berikutnya Anda membuka aplikasi.

---

## Membuat Alert

1. Buka halaman **trade** sebuah token.
2. Klik **bel alert** di header trade untuk membuka popover alert.
3. Pilih:
   - **Apa yang dipantau** — **Market cap** atau **Harga** (keduanya dalam USD).
   - **Arah** — **Di atas** atau **Di bawah** ambang Anda.
   - **Ambang** — nilai USD yang harus dilewati.
4. Buat. Alert memerlukan dompet yang terhubung, karena disimpan atas nama dompet Anda.

Anda bisa memasang beberapa alert pada token yang sama — misalnya "harga di atas $0,01" dan "market cap di bawah $50K" sekaligus.

---

## Cara Alert Berbunyi

- Goton memeriksa alert terbuka Anda **di server**, terus-menerus, terhadap harga dan market cap terbaru setiap token — jadi alert tetap memantau bahkan saat tab Anda tertutup.
- Alert berbunyi saat nilainya melewati arahnya: alert **di atas** pada atau melebihi ambang, alert **di bawah** pada atau di bawahnya.
- Saat Anda membuka aplikasi, akan muncul notifikasi untuk setiap alert yang baru berbunyi, dan popover menandai alert yang sudah berbunyi dengan titik. Alert yang sudah berbunyi berhenti memantau — buat yang baru untuk memantau lagi.

---

## Mengelola Alert

- Popover menampilkan alert terbuka dan yang sudah berbunyi untuk token tersebut.
- Hapus alert mana pun dari daftar kapan saja.
- Alert bersifat per dompet: hubungkan dompet yang sama untuk melihatnya lagi di perangkat lain.

---

## Catatan

- Ambang adalah nilai **USD**. Alert market cap memantau market cap USD (fully-diluted) token; alert harga memantau harga USD-nya.
- Alert hanya **notifikasi** — tidak pernah melakukan trade. Untuk bertindak otomatis pada harga tertentu, pakai [order Limit, Take-Profit & Stop-Loss](/id/protocol/advanced-orders).
