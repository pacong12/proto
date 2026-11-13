# Reputasi Kreator

Setiap profil menampilkan **rekam jejak peluncuran** kreator — ringkasan cepat berbasis on-chain tentang apa yang sudah mereka rilis. Ini membantu trader menilai token baru dari riwayat dompet di baliknya.

---

## Yang Ditampilkan

Kartu reputasi di profil kreator meringkas setiap token yang diluncurkan dompet itu:

| Metrik               | Arti                                                                               |
| :------------------- | :--------------------------------------------------------------------------------- |
| **Launches**         | Berapa token yang dibuat dompet ini                                                |
| **Graduated**        | Berapa di antaranya yang menyelesaikan bonding curve dan pindah ke pool Uniswap v4 |
| **Active**           | Berapa yang masih hidup dan diperdagangkan                                         |
| **Graduation rate**  | Graduated ÷ launches, dalam persen                                                 |
| **Total market cap** | Gabungan market cap USD dari token-token kreator                                   |
| **Top token**        | Token terbesar kreator menurut market cap, dengan nama, simbol, dan market cap-nya |

---

## Cara Dihitung

- Angka-angka ini dibangun dari **data on-chain** — token yang di-deploy dompet itu dan kondisi pasarnya saat ini — bukan sesuatu yang diketik kreator.
- **Tidak ada yang dilaporkan sendiri.** Kreator tidak bisa mengedit angka ini; semuanya mencerminkan peluncuran yang terikat pada alamat.
- Sedang membangun sesuatu? Angka yang sama tersedia lewat [Public API](/id/integration/api).

---

## Membacanya sebagai Trader

- **Graduation rate** tinggi di beberapa peluncuran adalah sinyal lebih kuat daripada satu token yang graduated.
- Dompet dengan banyak launch tapi sedikit yang graduated atau active punya riwayat token yang mandek — layak ditimbang sebelum Anda membeli.
- Reputasi adalah satu masukan, bukan jaminan. Selalu gabungkan dengan likuiditas, holder, dan catatan keamanan token itu sendiri di [Panduan Trading](/id/protocol/trading-guide).
