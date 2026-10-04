# Kontrak Pintar Terverifikasi

Untuk menjaga transparansi dan keamanan, seluruh smart contract launchpad Proto di jaringan yang didukung bersifat publik, non-kustodial, dan dapat diverifikasi langsung di penjelajah blok resmi.

---

## 1. Robinhood Chain (Chain ID: 4663)

| Nama Kontrak                             | Alamat                                       | Fungsi                                               |
| :--------------------------------------- | :------------------------------------------- | :--------------------------------------------------- |
| **Launchpad Factory (v1 Direct Pool)**   | `0xcC547D4EC0eF85FE506D2b2EEe02Be3620178B16` | Meluncurkan token & menginisialisasi pool Uniswap V3 |
| **Launchpad Factory (v2 Bonding Curve)** | `0xbA42499Cfe59abc05120A100EEc4f859F476034F` | Meluncurkan token & mengelola kurva bonding aktif    |
| **Liquidity Locker**                     | `0xf60664BEadbcBe25aFFdae0e7E2a41a819c81FCe` | Mengunci NFT posisi LP secara permanen               |
| **Uniswap V3 Factory**                   | `0x1f7d7550B1b028f7571E69A784071F0205FD2EfA` | Registri pool terdesentralisasi kanonikal            |
| **Position Manager**                     | `0x73991a25C818Bf1f1128dEAaB1492D45638DE0D3` | Pengelola posisi likuiditas terkonsentrasi           |
| **Swap Router**                          | `0xCaf681a66D020601342297493863E78C959E5cb2` | Rute pertukaran transaksi exact-input                |
| **Wrapped Ether (WETH)**                 | `0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73` | Token pembungkus Ether asli                          |

---

## 2. Arc Network (Mainnet, Chain ID: 5042)

| Nama Kontrak                             | Alamat                                       | Fungsi                                               |
| :--------------------------------------- | :------------------------------------------- | :--------------------------------------------------- |
| **Launchpad Factory (v1 Direct Pool)**   | `0xED31e7ec603651803784196003903aCa05550552` | Meluncurkan token & menginisialisasi pool Uniswap V3 |
| **Launchpad Factory (v2 Bonding Curve)** | `0x2ae8BE8C8F19665396b362859d51bdec09e59AEa` | Meluncurkan token & mengelola kurva bonding aktif    |
| **Liquidity Locker**                     | `0x9909ac8759dB233f546b644EF2CBDE1b3Af1dCE0` | Mengunci NFT posisi LP secara permanen               |
| **Uniswap V3 Factory**                   | `0xf0db7b58379503491d857dB50AC9ece64c653918` | Registri pool terdesentralisasi kanonikal            |
| **Position Manager**                     | `0x39654A85A4C05127f5Fd6ED22CAeC077A0fB1377` | Pengelola posisi likuiditas terkonsentrasi           |
| **Swap Router**                          | `0x53BF6B0684Ec7eF91e1387Da3D1a1769bC5A6F77` | Rute pertukaran transaksi exact-input                |
| **Native Payment Token (USDC)**          | `0x3600000000000000000000000000000000000000` | Gas asli & mata uang pasangan dasar (6 desimal)      |

---

## Audit Keamanan

Seluruh logika kontrak pintar telah diuji secara ketat melalui analisis statis (Slither), pengujian formal siklus hidup (Foundry), dan rangkaian uji regresi monorepo. Posisi likuiditas dikunci secara abadi tanpa kunci admin, celah pencetakan, atau izin penarikan sepihak.
