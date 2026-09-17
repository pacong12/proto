# Kontrak Pintar Terverifikasi

Untuk menjaga transparansi dan keamanan, seluruh smart contract launchpad Proto di jaringan yang didukung bersifat publik, non-kustodial, dan dapat diverifikasi langsung di penjelajah blok resmi.

---

## 1. Robinhood Chain (Chain ID: 4663)

| Nama Kontrak                             | Alamat                                       | Fungsi                                               |
| :--------------------------------------- | :------------------------------------------- | :--------------------------------------------------- |
| **Launchpad Factory (v1 Direct Pool)**   | `0x48844223aBDceeb1Ce502F54d559681358E68200` | Meluncurkan token & menginisialisasi pool Uniswap V3 |
| **Launchpad Factory (v2 Bonding Curve)** | `0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e` | Meluncurkan token & mengelola kurva bonding aktif    |
| **Liquidity Locker**                     | `0x070233B6F46ccD61CA2B7bc1E13520c3fE4614E4` | Mengunci NFT posisi LP secara permanen               |
| **Uniswap V3 Factory**                   | `0x1f7d7550B1b028f7571E69A784071F0205FD2EfA` | Registri pool terdesentralisasi kanonikal            |
| **Position Manager**                     | `0x73991a25C818Bf1f1128dEAaB1492D45638DE0D3` | Pengelola posisi likuiditas terkonsentrasi           |
| **Swap Router**                          | `0xCaf681a66D020601342297493863E78C959E5cb2` | Rute pertukaran transaksi exact-input                |
| **Wrapped Ether (WETH)**                 | `0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73` | Token pembungkus Ether asli                          |

---

## 2. Arc Testnet (Chain ID: 5042002)

| Nama Kontrak                             | Alamat                                       | Fungsi                                               |
| :--------------------------------------- | :------------------------------------------- | :--------------------------------------------------- |
| **Launchpad Factory (v1 Direct Pool)**   | `0x92cB206557907e4955faEeBd387D9602872d52cA` | Meluncurkan token & menginisialisasi pool Uniswap V3 |
| **Launchpad Factory (v2 Bonding Curve)** | `0x9C7Ff544aAc9f4A4ECAE3ca8c110740888fF70E3` | Meluncurkan token & mengelola kurva bonding aktif    |
| **Liquidity Locker**                     | `0x561723e55C27929f8C5317532c331c2a26060782` | Mengunci NFT posisi LP secara permanen               |
| **Uniswap V3 Factory**                   | `0x867E249D61cb0951433FAfd72b15Acc63646D266` | Registri pool terdesentralisasi kanonikal            |
| **Position Manager**                     | `0x7bD82CA0E7fd5F4EfFFd69cb413CBf8E954c3660` | Pengelola posisi likuiditas terkonsentrasi           |
| **Swap Router**                          | `0x5b8953eFc63F70377fa8C23FBEE0EAD632B277Cd` | Rute pertukaran transaksi exact-input                |
| **Native Payment Token (USDC)**          | `0x3600000000000000000000000000000000000000` | Gas asli & mata uang pasangan dasar (6 desimal)      |

---

## Audit Keamanan

Seluruh logika kontrak pintar telah diuji secara ketat melalui analisis statis (Slither), pengujian formal siklus hidup (Foundry), dan rangkaian uji regresi monorepo. Posisi likuiditas dikunci secara abadi tanpa kunci admin, celah pencetakan, atau izin penarikan sepihak.
