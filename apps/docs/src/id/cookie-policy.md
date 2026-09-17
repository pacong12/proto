# Kebijakan Cookie & Penyimpanan Lokal

<Badge variant="graduated">Terakhir Diperbarui: September 2026</Badge>

<Card>
Proto dibangun di atas prinsip privasi terdesentralisasi. Kami tidak menggunakan cookie pelacak, pelacak iklan komersial, atau skrip profiling pihak ketiga.
</Card>

## 1. Teknologi yang Kami Gunakan

Tidak seperti layanan web tradisional, Proto tidak menggunakan cookie HTTP persisten untuk melacak kebiasaan browsing Anda di berbagai situs web. Kami hanya menggunakan penyimpanan sisi klien asli peramban Anda (`localStorage` dan `sessionStorage`) khusus untuk fungsi antarmuka yang diperlukan.

## 2. Informasi yang Tersimpan Secara Lokal

Data berikut dapat disimpan dalam memori lokal peramban Anda:

| Kunci Penyimpanan                  | Tujuan                                                                        | Durasi                     |
| :--------------------------------- | :---------------------------------------------------------------------------- | :------------------------- |
| `proto_privacy_policy_accepted_v1` | Mengingat bahwa Anda telah menyetujui Ketentuan Layanan & Kebijakan Privasi   | Persisten (hingga dihapus) |
| `theme`                            | Menyimpan preferensi Mode Gelap atau Mode Terang                              | Persisten (hingga dihapus) |
| `wagmi.wallet` / `wc@2:client`     | Menyimpan sesi dompet terhubung agar tidak terputus saat memuat ulang halaman | Sesi / Persisten           |

## 3. Tanpa Pelacakan Pihak Ketiga

- **Nol Pelacak Iklan**: Kami tidak memuat Google Analytics, Facebook Pixel, atau pelacak perilaku komersial lainnya.
- **Nol Sidik Jari**: Kami tidak melakukan fingerprinting perangkat keras pengguna, canvas peramban, atau lokasi IP.
- **Nol Monetisasi Data**: Tidak ada pengenal atau data pengguna yang dikumpulkan, dijual, atau dibagikan dengan broker data.

## 4. Cara Mengelola Penyimpanan Lokal

Anda dapat menghapus atau menonaktifkan penyimpanan lokal kapan saja melalui pengaturan peramban Anda:

- **Chrome / Brave**: Pengaturan -> Privasi dan keamanan -> Setelan situs -> Cookie dan data situs.
- **Firefox**: Pengaturan -> Privasi & Keamanan -> Cookie dan Data Situs -> Hapus Data.
- **Safari**: Preferensi -> Privasi -> Kelola Data Situs Web.
