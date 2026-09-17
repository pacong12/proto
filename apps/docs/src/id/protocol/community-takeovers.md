# Pengambilalihan Komunitas (CTO)

Apa yang terjadi jika pengembang token tidak aktif atau meninggalkan proyek?

Berbeda dengan launchpad konvensional di mana proyek yang ditinggalkan developer langsung mati, Proto memiliki kerangka kerja **Community Takeover (CTO)** bawaan yang memungkinkan pemegang token aktif untuk menghidupkan kembali proyek dan mengklaim aliran fee kreator.

---

## Apa itu Community Takeover?

Community Takeover terjadi ketika anggota komunitas yang antusias berinisiatif untuk mengadopsi token yang ditinggalkan, mengambil alih pengelolaan media sosial, dan melanjutkan pertumbuhan komunitas.

Proto mendukung hal ini melalui pengalihan fee di level smart contract:

1. **Delegasi Sukarela Kreator**: Kreator awal dapat secara sukarela mengalihkan aliran fee 70% ke alamat dompet komunitas tepercaya, multisig, atau DAO melalui antarmuka **Profile**.
2. **Pengajuan Komunitas**: Jika kreator telah menghilang atau menjual seluruh kepemilikannya, komunitas dapat mengajukan bukti adopsi yang terverifikasi. Setelah diverifikasi, aliran fee kreator dialihkan untuk mendukung kas komunitas.

---

## Jaminan Keamanan & Perlindungan

- **Likuiditas Tidak Dapat Disentuh**: Likuiditas tetap terkunci secara permanen di dalam `LiquidityLocker.sol`. Community Takeover tidak dapat menarik, memigrasikan, atau menguras likuiditas pool.
- **Kontrak Token Bersifat Abadi**: Aturan token, total pasokan (1 Miliar), dan parameter transfer tidak dapat diubah oleh siapa pun.
- **Transparansi Non-Kustodial**: Seluruh klaim dan pengalihan fee tercatat secara terbuka di blockchain untuk verifikasi publik.
