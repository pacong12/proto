# Kontrak Pintar Terverifikasi

Untuk menjaga transparansi dan keamanan, seluruh smart contract launchpad Goton di jaringan yang didukung bersifat publik, non-kustodial, dan dapat diverifikasi langsung di penjelajah blok resmi.

---

## 1. Robinhood Chain (Chain ID: 4663)

| Nama Kontrak                          | Alamat                                       | Fungsi                                                                       |
| :------------------------------------ | :------------------------------------------- | :--------------------------------------------------------------------------- |
| **Launchpad Factory (Bonding Curve)** | `0x0b85876120e797Ca19655C0B81a0C25573f3Fc18` | Meluncurkan token & mengelola kurva bonding aktif                            |
| **Graduator (Uniswap V4)**            | `0xaEF6Fff944007b94a51F37e82cf5235fDBF9b771` | Memindahkan curve yang selesai ke pool v4 terkunci; siapa pun bisa memanggil |
| **Goton V4 Hook**                     | `0xb5C88A6101e6b979Ad63Bf5e6302dF8F031360Cc` | Fee pool, anti-snipe dan oracle TWAP                                         |
| **Goton V4 Router**                   | `0x5F88CE2BeD0f2639133b5EeB8b8fFE1fD50BA2dc` | Swap di pool yang sudah graduate                                             |
| **Goton V4 Buyback**                  | `0x240547f435Fe98B8B3F14036936D3a3e0EE87213` | Buyback dan burn yang dijaga TWAP                                            |
| **Limit Orders**                      | `0x2f3212D06104eEbb5bA4FA934B9B55b906dC3F61` | Order limit, take-profit dan stop-loss dengan escrow                         |
| **Liquidity Locker (Uniswap V4)**     | `0x7A1AD6AD30B1c9e276eD80a853E8dA897fE5D63E` | Mengunci NFT posisi LP secara permanen                                       |
| **Uniswap V3 Factory**                | `0x1f7d7550B1b028f7571E69A784071F0205FD2EfA` | Registri pool terdesentralisasi kanonikal                                    |
| **Position Manager**                  | `0x73991a25C818Bf1f1128dEAaB1492D45638DE0D3` | Pengelola posisi likuiditas terkonsentrasi                                   |
| **Swap Router**                       | `0xCaf681a66D020601342297493863E78C959E5cb2` | Rute pertukaran transaksi exact-input                                        |
| **Wrapped Ether (WETH)**              | `0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73` | Token pembungkus Ether asli                                                  |

---

## 2. Arc Network (Mainnet, Chain ID: 5042)

| Nama Kontrak                          | Alamat                                       | Fungsi                                            |
| :------------------------------------ | :------------------------------------------- | :------------------------------------------------ |
| **Launchpad Factory (Bonding Curve)** | `0xf94d16c9E90fCd55b75D318d0104269146612abF` | Meluncurkan token & mengelola kurva bonding aktif |
| **Liquidity Locker**                  | `0x173FF5D4eF626869a5a35FF0EA0c56c0A7e4Cd8b` | Mengunci NFT posisi LP secara permanen            |
| **Uniswap V3 Factory**                | `0xf0db7b58379503491d857dB50AC9ece64c653918` | Registri pool terdesentralisasi kanonikal         |
| **Position Manager**                  | `0x39654A85A4C05127f5Fd6ED22CAeC077A0fB1377` | Pengelola posisi likuiditas terkonsentrasi        |
| **Swap Router**                       | `0x53BF6B0684Ec7eF91e1387Da3D1a1769bC5A6F77` | Rute pertukaran transaksi exact-input             |
| **Token Kuota Kanonikal (USDC)**      | `0x3600000000000000000000000000000000000000` | Pasangan aset ERC-20 USDC resmi (6 desimal)       |

---

## Audit Keamanan

Seluruh logika kontrak pintar telah diuji secara ketat melalui analisis statis (Slither), pengujian formal siklus hidup (Foundry), dan rangkaian uji regresi monorepo. Posisi likuiditas dikunci secara abadi tanpa kunci admin, celah pencetakan, atau izin penarikan sepihak.
