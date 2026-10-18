# Kebijakan Cookie & Penyimpanan Lokal

<Badge variant="graduated">Terakhir Diperbarui: Oktober 2026</Badge>

<Card>
Goton menggunakan penyimpanan peramban untuk pengaturan aplikasi yang diperlukan. Google Analytics adalah satu-satunya teknologi opsional: hanya dimuat setelah Anda menerimanya di banner cookie, dan persetujuan itu dapat Anda tarik kapan saja. Kami tidak pernah menggunakan cookie iklan.
</Card>

## 1. Teknologi yang Kami Gunakan

- **Penyimpanan peramban (`localStorage`)**: pengaturan yang benar-benar diperlukan seperti tema, bahasa, sesi dompet, serta jawaban Anda atas banner cookie dan ketentuan. Data ini tidak dikirim ke kami atau ke pihak lain.
- **Cookie Google Analytics**: opsional. Hanya dipasang setelah Anda mengklik **Accept** di banner cookie.
- **Cookie keamanan (`cf_clearance`)**: benar-benar diperlukan. Penyedia hosting dan keamanan kami, Cloudflare, menjalankan skrip pemeriksaan kecil (`/cdn-cgi/challenge-platform/…`) untuk membedakan manusia dari bot dan menyimpan hasilnya di cookie ini. Cookie ini melindungi situs dari penyalahgunaan otomatis, tidak dipakai untuk iklan atau pelacakan lintas situs, dan dipasang tanpa pilihan di banner karena situs memerlukannya agar tetap tersedia.

## 2. Informasi yang Tersimpan Secara Lokal

| Kunci Penyimpanan                     | Tujuan                                                                      | Durasi                     |
| :------------------------------------ | :-------------------------------------------------------------------------- | :------------------------- |
| `proto_privacy_policy_accepted_v1`    | Mengingat bahwa Anda telah menyetujui Ketentuan Layanan & Kebijakan Privasi | Persisten (hingga dihapus) |
| `proto_cookie_consent_accepted_v1`    | Mengingat apakah Anda menerima atau menolak cookie analitik                 | Persisten (hingga dihapus) |
| `proto_selected_locale_v1`            | Bahasa antarmuka Anda                                                       | Persisten (hingga dihapus) |
| `theme`                               | Preferensi Mode Gelap atau Mode Terang                                      | Persisten (hingga dihapus) |
| `proto_wallet_*`, `wagmi.*`, `wc@2:*` | Sesi dompet terhubung agar tidak terputus saat memuat ulang halaman         | Sesi / Persisten           |

## 3. Cookie Analitik Opsional

Jika Anda menerima analitik, Google Analytics (`gtag.js`) memasang cookie `_ga` dan `_ga_<id>` (hingga 2 tahun) dan mengirim data kunjungan halaman serta perangkat ke Google, agar kami memahami cara aplikasi digunakan. Jika Anda menolak, atau menutup banner tanpa memilih, Google Analytics tidak dimuat dan tidak ada cookie analitik yang dipasang.

- **Tanpa pelacak iklan**: kami tidak memuat Facebook Pixel atau pelacak iklan dan perilaku lainnya.
- **Tanpa sidik jari**: kami tidak melakukan fingerprinting perangkat keras, canvas peramban, atau lokasi Anda.
- **Tanpa penjualan data**: tidak ada data yang dijual atau dibagikan dengan broker data.

## 4. Mengubah atau Menarik Pilihan Anda

Klik **Pengaturan cookie** di footer aplikasi kapan saja untuk melihat dan mengubah pilihan Anda. Menarik persetujuan langsung menghentikan Google Analytics dan menghapus cookie `_ga` dari peramban Anda.

Anda juga dapat menghapus semua penyimpanan situs melalui pengaturan peramban:

- **Chrome / Brave**: Pengaturan -> Privasi dan keamanan -> Setelan situs -> Cookie dan data situs.
- **Firefox**: Pengaturan -> Privasi & Keamanan -> Cookie dan Data Situs -> Hapus Data.
- **Safari**: Preferensi -> Privasi -> Kelola Data Situs Web.
