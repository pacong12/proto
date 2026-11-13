# Dividen Holder & Vesting

Tab **Dividends** di profil Anda adalah tempat dua jenis reward on-chain dikumpulkan: **dividen bagi-hasil fee untuk holder** pada token yang Anda pegang, dan **token ter-vesting** dari alokasi yang terbuka seiring waktu. Keduanya diklaim langsung ke dompet Anda.

---

## Dividen Holder

Sebagian token mengaktifkan **Holder Fee Sharing** saat launch. Untuk token itu, sebagian fee trading terakumulasi **pro-rata ke semua pemegang token** — bukan hanya kreator.

Di tab Dividends Anda akan melihat:

- **Total claimable** — reward Anda yang terakumulasi, didaftar per mata uang (ETH / WETH di Robinhood, USDC di Arc).
- **Entri per token** — setiap token yang Anda pegang yang berbagi fee, beserta jumlah yang menanti Anda.
- **Claim all** — kumpulkan dividen semua token sekaligus, atau klaim satu token dari barisnya.

Reward terus terakumulasi selama token diperdagangkan; mengklaim menyapu yang sudah terkumpul ke dompet Anda. Sebuah token hanya muncul di sini jika kreatornya mengaktifkan Holder Fee Sharing — lihat [Fee Kreator & Reward](/id/protocol/fees-and-burns) soal bagaimana pembagian fee dikonfigurasi.

---

## Vesting

Saat sebuah token memberi Anda alokasi yang terbuka seiring waktu (misalnya alokasi kreator atau kontributor), **jadwal vesting**-nya tampil di tab yang sama, per token:

| Kolom                      | Arti                                        |
| :------------------------- | :------------------------------------------ |
| **Total (masih terkunci)** | Token yang belum terbuka                    |
| **Claimed**                | Token yang sudah Anda rilis ke dompet       |
| **Claimable**              | Token terbuka yang bisa Anda rilis sekarang |
| **Cliff ends**             | Tanggal sebelum mana tidak ada yang terbuka |
| **Fully unlocked**         | Tanggal seluruh alokasi selesai ter-vesting |

Sebuah jadwal punya **cliff** (tidak ada yang rilis sampai tanggal itu) lalu terbuka bertahap sampai sepenuhnya ter-vesting. Dua aksi tersedia pada posisi vesting:

- **Claim tokens** — rilis token terbuka (unlocked) yang saat ini bisa diklaim ke dompet Anda.
- **Claim dividends** — kumpulkan dividen bagi-hasil fee holder yang diperoleh posisi vesting itu.

---

## Catatan

- Semuanya **on-chain**. Mengklaim adalah transaksi dompet; logika vesting dan bagi-hasil fee ada di kontrak token, tanpa admin yang bisa mengalihkan reward Anda.
- Tab ini menampilkan jumlah yang bisa Anda klaim dan vesting hanya di profil **Anda sendiri** (hubungkan dompet Anda). Jumlahnya diperbarui saat token diperdagangkan dan saat unlock melewati cliff-nya.
