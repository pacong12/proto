# Kebijakan Privasi

<StatusBadge variant="graduated">Terakhir Diperbarui: Oktober 2026</StatusBadge>

<Card>
Goton Labs dan Protokol Goton mengoperasikan antarmuka peluncuran token non-kustodial dan pertukaran terdesentralisasi pada jaringan yang didukung. Kami memprioritaskan minimalisasi data, kedaulatan pengguna, dan privasi kriptografi.
</Card>

## 1. Informasi yang Tidak Kami Kumpulkan

Karena Goton bersifat non-kustodial dan langsung ke kontrak pintar:

- **Tanpa Kunci Privat**: Kami tidak pernah menghasilkan, menangani, atau menyimpan kunci privat atau seed phrase Anda.
- **Tanpa Akun Kustodial**: Tidak ada pendaftaran email, kata sandi, atau saldo pengguna kustodial.
- **Tanpa Penjualan Data**: Kami tidak menjual data pengguna atau profil aktivitas finansial.

## 2. Informasi yang Diproses On-Chain

Ketika Anda berinteraksi dengan smart contract Proto:

- **Alamat Dompet Publik**: Alamat publik Anda berinteraksi langsung dengan kontrak Factory dan Liquidity Pool.
- **Data Transaksi**: Peluncuran token, kunci likuiditas, klaim fee, dan swap disiarkan secara publik dan dicatat secara permanen di buku besar terdistribusi blockchain.
- **Panggilan RPC Publik**: Kueri JSON-RPC standar (`eth_call`, `eth_getBalance`, `eth_getLogs`) dilayani oleh node RPC jaringan yang ditentukan.

## 3. Penggunaan Penyimpanan Lokal

Aplikasi frontoffice hanya menyimpan status preferensi terbatas di `localStorage` peramban Anda:

- Status koneksi dompet dan pengenal penyedia aktif terakhir.
- Preferensi tema warna (Mode Gelap / Terang).
- Konfirmasi persetujuan syarat & kebijakan privasi (`proto_privacy_policy_accepted_v1`).

Anda dapat menghapus penyimpanan peramban kapan saja untuk menghapus pengaturan lokal ini.

## 3a. Data Off-chain, Analitik & Hak Anda

- **Fitur sosial**: komentar, like, repost, vote sentimen, follow, dan profil kreator yang Anda kirim disimpan oleh API Goton bersama alamat dompet Anda dan ditampilkan secara publik.
- **Log server**: API menyimpan log permintaan untuk keamanan dan pembatasan laju. Alamat IP klien hanya dicatat dalam bentuk hash satu arah.
- **Analitik**: hanya jika Anda menerima cookie analitik, aplikasi web memuat Google Analytics (`gtag.js`), yang memasang cookie dan mengirim data kunjungan halaman serta perangkat ke Google. Persetujuan dapat ditarik kapan saja melalui **Pengaturan cookie** di footer aplikasi (lihat [Kebijakan Cookie](/id/cookie-policy)).
- **Penghapusan**: Anda dapat menghapus komentar, like, repost, vote sentimen, follow, dan profil kapan saja melalui **Profile → Edit Profile → Hapus data sosial saya** (API: `DELETE /api/users/{address}/data`, dikonfirmasi dengan tanda tangan baru dari dompet tersebut). Catatan on-chain tidak dapat dihapus oleh siapa pun.

## 4. Protokol & Infrastruktur Pihak Ketiga

Interaksi dapat melewati infrastruktur terdesentralisasi:

- **Robinhood Chain (L2) dan Arc Network**: Eksekusi blok dan konsensus transaksi.
- **Uniswap v4**: Kontrak pool manager yang menyimpan likuiditas terkunci dan mengeksekusi swap.
- **Google Analytics**: Analitik kunjungan halaman di aplikasi web (lihat bagian 3a).
- **Gateway IPFS**: Hosting terdesentralisasi untuk ikon token dan metadata yang mendeskripsikan dirinya sendiri.

## 5. Keamanan & Invarian

Semua layanan backend protokol menerapkan kebijakan keamanan _fail-closed_ (`INV-BE-3`) dan menolak penandatanganan langsung (`INV-BE-1`). Posisi smart contract dikunci secara permanen di locker non-kustodial (`INV-SC-2`).

<Card>
Untuk pertanyaan hukum, pengungkapan protokol, atau dukungan teknis, kunjungi [repositori GitHub](https://github.com/pacong12/proto) atau ikuti kanal komunitas resmi.
</Card>
