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

| Nama Kontrak                       | Alamat                                       | Fungsi                                               |
| :--------------------------------- | :------------------------------------------- | :--------------------------------------------------- |
| **Launchpad Factory (Uniswap V4)** | `0xd7Bf86061CC5637b2b854d61007f8fD7CD6f0980` | Meluncurkan token langsung ke pool v4 terkunci       |
| **Goton V4 Hook**                  | `0xb5C88A6101e6b979Ad63Bf5e6302dF8F031360Cc` | Fee pool, anti-snipe dan oracle TWAP                 |
| **Goton V4 Router**                | `0xD8Ec94F07f590F8Ceb620A8D17Bb555fBde366f1` | Swap dibayar dengan USDC native                      |
| **Goton V4 Buyback**               | `0xb0C5fCBf9D0326cA2Ed0b2C49c5E754f36c78AFd` | Buyback dan burn yang dijaga TWAP                    |
| **Limit Orders**                   | `0x3983F223E7Ef0B3c24b3a8F76Db96ed4Bf349Ee6` | Order limit, take-profit dan stop-loss dengan escrow |
| **Uniswap V4 PoolManager**         | `0x8366a39CC670B4001A1121B8F6A443A643e40951` | Singleton v4 resmi                                   |
| **Token Quote (USDC)**             | `0x3600000000000000000000000000000000000000` | USDC ERC-20 resmi sebagai pasangan (6 desimal)       |
| **Factory Lama (pra-v4)**          | `0xf94d16c9E90fCd55b75D318d0104269146612abF` | Peluncuran sebelumnya; tidak ada token baru          |

---

## Audit Keamanan

Seluruh logika kontrak pintar telah diuji secara ketat melalui analisis statis (Slither), pengujian formal siklus hidup (Foundry), dan rangkaian uji regresi monorepo. Posisi likuiditas dikunci secara abadi tanpa kunci admin, celah pencetakan, atau izin penarikan sepihak.
