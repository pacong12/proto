# Ajak Teman & Referral

Setiap profil punya kartu **Ajak teman** dengan tautan undangan pribadi. Saat seseorang membuka Goton lewat tautan Anda lalu menghubungkan dompet, dompet itu dikreditkan untuk Anda. Atribusi bersifat **off-chain dan first-touch**, jadi tanpa biaya gas dan tanpa perlu tanda tangan.

---

## Tautan Undangan Anda

Buka profil Anda sendiri dan cari kartu **Ajak teman**. Kartu itu menampilkan:

- **Tautan undangan** — `https://goton.fun/?ref=<username-anda>`, memakai username dompet Anda (mis. `aerobrassgriffin-79c8`). Alamat dompet juga bisa; username hanya lebih enak dibaca dan dibagikan.
- **Referred** — berapa dompet yang sudah Anda ajak.
- **Salin tautan** — menyalin tautan ke clipboard.

Kode `?ref=` yang sama ikut otomatis setiap kali Anda membagikan sesuatu dari dalam Goton — lihat [Ke mana tautan Anda ikut](#ke-mana-tautan-anda-ikut).

---

## Cara Kerja Atribusi

- **First-touch.** Tautan undangan pertama yang dibuka pengunjung adalah yang dihitung. Tautan itu diingat di browser mereka sampai mereka menghubungkan dompet, dan tautan undangan berikutnya **tidak** menimpanya.
- **Satu dompet, sekali.** Saat pengunjung menghubungkan dompet, dompet itu diatribusikan ke tautan Anda satu kali saja. Menghubungkan ulang, atau membuka tautan lain setelahnya, tidak mengubah apa pun.
- **Tidak bisa referral diri sendiri.** Membuka tautan sendiri lalu menghubungkan dompet sendiri tidak mencatat apa pun.
- **Username atau alamat.** `?ref=` berupa username akan di-resolve kembali ke dompet referrer sebelum dicatat; referrer yang belum pernah trading atau launch mungkin tidak bisa di-resolve lewat nama, dalam hal itu tautan berbentuk alamat adalah bentuk yang paling andal.

Karena atribusi bersifat first-touch dan off-chain, hal terburuk yang bisa dilakukan penyalahguna hanyalah menggelembungkan hitungan yang sifatnya kosmetik. Hitungan ini informatif saat ini — belum ada reward on-chain yang terkait.

---

## Ke mana tautan Anda ikut

Kode referral Anda ditambahkan ke tautan yang Anda bagikan dari dalam aplikasi, jadi berbagi aktivitas sekaligus memperluas jaringan Anda:

| Aksi                                | Yang dibagikan                                              |
| :---------------------------------- | :---------------------------------------------------------- |
| **Bagikan profil**                  | Tautan ke profil, membawa `?ref` dompet Anda yang terhubung |
| **Bagikan kartu PnL**               | Tautan kartu `/pnl/…` Anda dengan `?ref`                    |
| **Bagikan ke X** dari token / trade | Tautan halaman token dengan `?ref`                          |
| **Bagikan call** atau postingan     | Tautan `/post/…` dengan `?ref`                              |

Dalam semua kasus, kode yang dipakai adalah milik dompet **yang terhubung** — orang yang membagikan — jadi membagikan profil orang lain tetap mengkreditkan Anda.

---

## FAQ

**Apakah saya dapat sesuatu dari referral sekarang?** Belum. Hitungannya masih kosmetik untuk saat ini. Ketika reward diperkenalkan, atribusi diperkirakan pindah ke pemicu on-chain yang bertanda tangan (misalnya launch atau trade pertama si referee).

**Bisakah saya mengganti siapa yang mereferral saya?** Tidak. First-touch bersifat permanen begitu sebuah dompet terhubung.

**Tautan saya memakai username — apakah stabil?** Username diturunkan dari alamat dompet Anda, jadi tidak pernah berubah.
