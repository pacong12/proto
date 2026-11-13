# Profil & Identitas

Setiap dompet di Goton punya profil publik dan **pseudonym** bawaan, jadi orang punya nama dan halaman sejak trade pertama mereka — tanpa pendaftaran. Anda bisa menyesuaikan profil kapan pun dompet Anda terhubung.

---

## Pseudonym Anda

Begitu sebuah dompet muncul, Goton memberinya username deterministik yang diturunkan dari alamatnya — sebuah kata sifat, material, dan arketipe, ditambah tag pendek dari alamat, misalnya **AeroBrassGriffin#79c8**. Darinya muncul tiga bentuk, semua menunjuk ke dompet yang sama:

- **Nama tampilan** — `AeroBrassGriffin#79c8`
- **Handle** — `@AeroBrassGriffin#79c8`
- **Slug** — `aerobrassgriffin-79c8` (bentuk yang aman untuk URL)

Karena diturunkan dari alamat, pseudonym Anda **tidak pernah berubah** dan sama di seluruh aplikasi. Ini juga yang dipakai [tautan referral](/id/protocol/referrals) Anda.

---

## URL Profil

Sebuah profil terbuka dari beberapa path yang setara, semuanya mengarah ke dompet yang sama:

- `/u/<alamat>`, `/profile/<alamat>`, `/user/<alamat>`, `/@<alamat>`
- `/<username>` — slug-nya, mis. `/aerobrassgriffin-79c8`

URL berbentuk alamat ditulis ulang ke bentuk `/<username>` yang rapi. Nama, slug, atau handle yang diketik akan di-resolve kembali ke alamatnya, jadi berbagi nama sama baiknya dengan berbagi alamat.

---

## Mengedit Profil Anda

Di profil **Anda sendiri** (dengan dompet terhubung), **Edit Profile** memungkinkan Anda menyesuaikan identitas kreator publik:

| Kolom             | Catatan                                               |
| :---------------- | :---------------------------------------------------- |
| **Cover banner**  | Gambar yang diunggah dari perangkat Anda              |
| **Foto profil**   | Avatar yang diunggah dari perangkat Anda              |
| **Nama tampilan** | Maksimal 32 karakter; menimpa pseudonym secara publik |
| **Bio**           | Deskripsi singkat — strategi, alpha Anda, apa saja    |
| **X (Twitter)**   | Handle Anda                                           |
| **Telegram**      | Handle Anda                                           |

Gambar yang diunggah disimpan di IPFS; sisanya disimpan untuk dompet Anda. Anda juga bisa **menghapus** data sosial Anda untuk mengosongkan kolom kustom dan kembali ke pseudonym.

---

## Yang Ditampilkan Sebuah Profil

Setiap profil — milik Anda atau siapa pun — mengumpulkan aktivitas dompet itu di satu tempat:

- **[Reputasi Kreator](/id/protocol/reputation)** — rekam jejak peluncuran mereka.
- **[Portofolio](/id/protocol/portfolio)** — performa dan kepemilikan saat ini.
- **Posts & Calls** — aktivitas [feed](/id/protocol/social) mereka.
- **Created Tokens** — token yang diluncurkan dompet itu.
- **[Dividen Holder & Vesting](/id/protocol/dividends-and-vesting)** — reward yang bisa diklaim (profil sendiri).
- **[Ajak teman](/id/protocol/referrals)** — tautan undangan mereka (profil sendiri).

---

## Catatan

- Profil bersifat **publik** dan dibangun dari aktivitas on-chain plus kolom opsional yang Anda isi. Ia tidak mengekspos apa pun di luar yang disediakan chain dan editan Anda sendiri.
- Tidak ada akun, email, atau kata sandi — dompet Anda _adalah_ identitas Anda.
