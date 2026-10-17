# Fee Kreator & Mekanisme Pembakaran

Goton menyelaraskan keberlanjutan proyek antara kreator token dan komunitasnya dengan menawarkan struktur pembagian fee yang sangat menguntungkan kreator.

---

## Pembagian Fee 70/30

Sumber fee berbeda per jaringan:

- **Robinhood Chain**: selama token masih di kurva bonding, setiap transaksi di kurva membayar fee 1% ke protokol. Setelah lulus, pool Uniswap v4 yang terkunci mengenakan fee LP 1%.
- **Arc Network**: pool Uniswap v4 mengenakan fee LP 1% sejak peluncuran, ditambah pajak beli/jual opsional 0–10% yang ditetapkan kreator saat peluncuran.

Fee pool dan pajak dibagi oleh fee splitter on-chain milik setiap token:

- **30% untuk perbendaharaan protokol**.
- **70% untuk bagian kreator**, yang dapat dibagi kreator satu kali, sebelum perdagangan publik dimulai, ke:
  - **Kreator**: dapat diklaim kreator (atau penerima yang dialihkan).
  - **Holder**: dialirkan ke pemegang token secara proporsional selama 24 jam.
  - **Buyback & Burn**: dibelikan token di pool-nya sendiri oleh kontrak `GotonV4Buyback` lalu dikirim ke alamat mati. Setiap buyback dibatasi TWAP 30 menit pool ± 2%, sehingga harga yang dimanipulasi hanya menunda buyback sampai harga normal.
  - **Likuiditas**: dikirim ke vault likuiditas protokol, yang saat ini adalah treasury protokol. Aplikasi goton.fun tidak menawarkan opsi ini, karena tidak menambah likuiditas pool token itu sendiri.

Secara default seluruh 70% menjadi milik kreator. Bagian protokol tidak dipakai untuk buyback.

---

## Cara Kreator Mengklaim Pendapatan

1. Hubungkan dompet yang digunakan saat pertama kali membuat token.
2. Buka halaman **Profile** (`/profile`).
3. Pada bagian **My Launches**, lihat akumulasi saldo fee yang belum ditarik.
4. Klik tombol **Claim Fees** untuk menarik pendapatan fee langsung ke dompet Anda dalam satu transaksi.

---

## Pengalihan Fee (Community Takeovers)

Jika kreator ingin memberikan reward kepada komunitas atau menyerahkan kepemimpinan proyek:

- Kreator dapat mengalihkan aliran fee kreator ke perbendaharaan DAO, multisig komunitas, atau kontrak reward. Pengalihan berlaku 48 jam setelah diajukan dan dapat dibatalkan selama jeda tersebut.
- Fitur ini mendukung pengambilalihan komunitas (CTO) dengan mengubah pendapatan proyek menjadi modal yang dikelola langsung oleh komunitas.
