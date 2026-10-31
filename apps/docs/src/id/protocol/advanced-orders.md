# Order Limit, Take-Profit & Stop-Loss

Selain membeli dan menjual di harga live, panel trading punya dua tab lagi: **Limit** dan **TP / SL**. Keduanya memasang order di kontrak `GotonLimitOrders`, yang menyimpan dana Anda sampai order terisi atau Anda membatalkannya.

---

## Tiga Jenis Order

| Order           | Yang Anda setor                 | Terisi saat                                                                               |
| :-------------- | :------------------------------ | :---------------------------------------------------------------------------------------- |
| **Limit beli**  | ETH (Robinhood) atau USDC (Arc) | Market cap turun ke target Anda, sehingga Anda menerima minimal jumlah token yang dikutip |
| **Take profit** | Token                           | Market cap naik ke target Anda, sehingga Anda menerima minimal jumlah yang dikutip        |
| **Stop loss**   | Token                           | Market cap turun ke batas stop Anda, lalu menjual dengan batas slippage Anda              |

Target dimasukkan sebagai **market cap dalam USD**, lalu aplikasi mengubahnya menjadi harga on-chain dan jumlah minimal yang Anda terima. Jumlah minimal itu sudah memperhitungkan fee pool atau curve, pajak token, dan fee eksekutor 0,1%, sehingga order terisi saat pasar mencapai target Anda, tidak lebih lambat.

Take profit dan stop loss bisa memakai satu setoran yang sama (**one-cancels-other**): leg yang terisi pertama menutup order dan leg lainnya hilang.

---

## Cara Order Terisi

- **Siapa pun bisa mengisi order** begitu syaratnya terpenuhi. Goton menjalankan keeper yang memeriksa order terbuka setiap 15 detik dan mengisinya, tetapi kontrak menerima pemanggil mana pun.
- **Pengisi mendapat 0,1%** dari sisi quote (fee eksekutor). Keeper hanya mengisi jika fee itu menutup biaya gas, jadi order yang sangat kecil mungkin menunggu sampai ada pihak lain yang mengisinya, atau sampai Anda membatalkannya.
- **Stop loss memakai harga yang tahan manipulasi.** Di bonding curve, stop hanya terpicu jika harga spot curve dan TWAP-nya (harga rata-rata berbobot waktu selama sekitar 10 sampai 20 menit) sama-sama berada di atau di bawah harga stop Anda. Di pool Uniswap v4 caranya sama, dengan harga spot pool dan TWAP 30 menit dari hook Goton. Dalam kedua kasus, dorongan harga dalam satu blok tidak bisa memicu stop Anda, dan stop tidak terpicu lagi setelah harga pulih di atasnya. Stop menunggu sampai harga punya riwayat yang cukup: sekitar 10 menit pada token baru, dan 30 menit setelah token graduate ke pool-nya. Anda bisa memasangnya lebih awal; stop aktif dengan sendirinya.
- **Setiap pengisian dicek terhadap perubahan saldo Anda.** Kontrak mengukur apa yang benar-benar sampai ke dompet Anda, bukan apa yang dilaporkan router, dan mengembalikan sisa dari pengisian parsial.

---

## Escrow, Kedaluwarsa & Pembatalan

- Setoran Anda tetap di kontrak sampai order terisi atau Anda membatalkannya. Kontrak ini **tidak punya owner dan tidak punya fungsi admin**: dana escrow hanya bisa mengisi order sesuai syarat Anda atau kembali kepada Anda.
- Setiap order punya masa berlaku (1, 7, atau 30 hari). Setelah itu order tidak bisa terisi lagi, tetapi **pembatalan tetap berfungsi** kapan saja dan mengembalikan seluruh setoran.
- Batalkan dari daftar **Open orders** di bawah panel trading.

---

## Riwayat Order & Notifikasi

- Panel di bawah form trading punya dua tab: **Open** dan **History**. History menampilkan order yang terisi dan dibatalkan, beserta leg yang terisi, jumlah yang Anda terima, dan link ke transaksi penutupnya.
- Selama dompet Anda terhubung, aplikasi memeriksa order Anda setiap 20 detik di halaman mana pun dan menampilkan notifikasi saat ada yang terisi.

---

## Di Mana Order Tersedia

| Chain           | Token bonding curve         | Pool Uniswap v4             |
| :-------------- | :-------------------------- | :-------------------------- |
| Robinhood Chain | Token dari factory saat ini | Token yang sudah graduasi   |
| Arc Network     | — (Arc tidak punya curve)   | Token dari factory saat ini |

Tab Limit dan TP / SL hanya muncul pada token yang ordernya bisa terisi. Token dari factory sebelumnya tidak menampilkannya.

Alamat kontrak ada di [Kontrak Pintar Terverifikasi](/id/integration/contracts).
