# Pengambilalihan Komunitas (CTO)

Apa yang terjadi jika pengembang token ingin mundur dari proyek?

Di Goton, kreator dapat menyerahkan aliran fee-nya kepada komunitas yang melanjutkan proyek. Ini selalu menjadi keputusan kreator sendiri. Tidak ada pihak lain, termasuk protokol, yang dapat memindahkan fee kreator.

---

## Apa itu Community Takeover?

Community Takeover terjadi ketika anggota komunitas mengadopsi sebuah token, mengambil alih pemasaran, memperbarui tautan sosial, dan melanjutkan pertumbuhan komunitas.

Goton mendukung hal ini melalui pengalihan pada fee splitter token:

1. **Ajukan**: Kreator mengajukan alamat dompet komunitas, multisig, atau DAO dari halaman **Profile** (tab **Created**, tombol **Kelola CTO**).
2. **Tunggu 48 jam**: Pengajuan tidak dapat berlaku selama timelock ini, sehingga semua orang dapat melihatnya lebih dulu. Kreator dapat membatalkannya selama belum diterima. Pengajuan baru menggantikan yang lama dan mengulang masa tunggu.
3. **Terima**: Setelah timelock berakhir, kreator atau penerima yang diajukan menerimanya. Sejak saat itu, porsi Kreator dari fee mengalir ke penerima baru.
4. **Kunci (opsional)**: Kreator dapat mengunci penerima saat ini secara permanen. Tindakan ini tidak dapat dibatalkan dan menghapus pengajuan yang tertunda, jadi terima dulu penerima baru sebelum mengunci.

Selama penerima belum dikunci, kreator dapat memulai pengalihan baru kapan saja, tetap dengan timelock 48 jam.

Jumlah yang dialihkan bergantung pada tokennya. Kreator menentukan pembagian bagian kreator, sehingga pengalihan hanya mencakup porsi yang ditetapkan untuk **Kreator**. Porsi pemegang, buyback, dan likuiditas tetap ke tujuannya masing-masing. Lihat [Fee Kreator & Reward](./fees-and-burns.md).

---

## Cara Meminta Takeover

1. **Siapkan penerima**: Buat multisig atau DAO yang dikendalikan komunitas, bukan dompet pribadi salah satu anggota.
2. **Minta kepada kreator**: Hubungi kreator secara terbuka dan bagikan alamat penerima, agar permintaan dapat diperiksa semua orang.
3. **Pantau pengajuan**: Setelah kreator mengajukan alamat, pastikan alamatnya persis seperti yang disepakati.
4. **Terima setelah 48 jam**: Penerima dapat menerima tanpa menunggu kreator.
5. **Minta penguncian dan verifikasi**: Tanpa kunci, kreator masih dapat mengalihkan fee lagi di kemudian hari.

Untuk memverifikasi secara on-chain, buka fee splitter token di block explorer dan baca nilai berikut:

- `creatorRecipient()`: alamat yang saat ini menerima fee.
- `creatorRecipientLocked()`: `true` berarti alamat ini tidak akan pernah berubah.
- `pendingCreatorRecipient()` dan `pendingCreatorRecipientValidAfter()`: pengajuan yang sedang menunggu timelock.

Halaman trading token juga menampilkan lencana **Komunitas** saat fee mengalir ke pihak selain kreator, dan tooltip-nya menyebutkan jika penerima sudah dikunci.

Beberapa batasan yang perlu diingat:

- **Tanpa kreator, tidak ada pengalihan**: Jika kreator menghilang dan tidak pernah mengajukan pengalihan, aliran fee tetap menjadi miliknya. Komunitas tetap dapat mengadopsi token secara sosial, tetapi baik komunitas maupun Goton tidak dapat mengklaim fee tersebut.
- **Splitter lama tidak memiliki kunci**: Fee splitter yang di-deploy sebelum fitur kunci ada dapat mengalihkan fee tetapi tidak dapat dikunci, sehingga kreator selalu dapat mengalihkannya lagi. Halaman Profile menunjukkan jika kunci tidak tersedia.
- **Robinhood Chain**: Token baru memiliki fee splitter saat graduation, sehingga pengalihan hanya dapat dilakukan setelahnya.

---

## Jaminan Keamanan & Perlindungan

- **Likuiditas Tidak Dapat Disentuh**: Likuiditas tetap terkunci secara permanen, di liquidity locker pada Robinhood Chain dan di launch factory untuk pool Uniswap v4 di Arc. Community Takeover tidak dapat menarik, memigrasikan, atau menguras likuiditas pool.
- **Kontrak Token Bersifat Abadi**: Aturan token, total pasokan (1 Miliar), dan parameter transfer tidak dapat diubah oleh siapa pun.
- **Bagian Protokol Terpisah**: Pengalihan hanya mengubah penerima porsi Kreator. Pengalihan tidak dapat menyentuh bagian protokol atau porsi lain dalam pembagian.
- **Transparansi Non-Kustodial**: Seluruh klaim dan pengalihan fee tercatat on-chain untuk verifikasi publik.
