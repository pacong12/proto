# Kebijakan Privasi

<Badge variant="graduated">Terakhir Diperbarui: September 2026</Badge>

<Card>
Proto Labs dan Protokol Proto mengoperasikan antarmuka peluncuran token non-kustodial dan pertukaran terdesentralisasi pada jaringan yang didukung. Kami memprioritaskan minimalisasi data, kedaulatan pengguna, dan privasi kriptografi.
</Card>

## 1. Informasi yang Tidak Kami Kumpulkan

Karena Proto bersifat non-kustodial dan langsung ke kontrak pintar:

- **Tanpa Kunci Privat**: Kami tidak pernah menghasilkan, menangani, atau menyimpan kunci privat atau seed phrase Anda.
- **Tanpa Akun Kustodial**: Tidak ada pendaftaran email, kata sandi, atau saldo pengguna kustodial.
- **Tanpa Pelacakan Finansial**: Kami tidak menjual data pengguna, profil aktivitas finansial, atau analitik perilaku.

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
