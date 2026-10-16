# GMGN.AI & DEX Listing Submission Guide

Panduan dan template resmi untuk mengajukan integrasi Launchpad dan indexing token ke **GMGN.AI**, **DexScreener**, dan **GeckoTerminal** di **Robinhood Chain (Chain ID: 4663)**.

---

## 1. Data Kontrak Protokol Resmi

| Parameter | Nilai Onchain | Keterangan |
| :--- | :--- | :--- |
| **Chain** | Robinhood Chain | EVM Layer 2 |
| **Chain ID** | `4663` | Network ID |
| **Deployer & Fee Recipient** | `0x555C0456641d5ff4Fb47E24D6472b4a16aC1b0c2` | Protocol Treasury |
| **Launchpad Factory (Bonding Curve)** | `0xbA42499Cfe59abc05120A100EEc4f859F476034F` | Factory bonding curve — satu-satunya yang aktif |
| **Liquidity Locker** | `0x070233B6F46ccD61CA2B7bc1E13520c3fE4614E4` | Kontrak pengunci likuiditas permanen pasca-graduasi |
| **WETH Address** | `0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73` | Paired Asset Utama |
| **Uniswap V3 Factory** | `0x1f7d7550B1b028f7571E69A784071F0205FD2EfA` | Canonical Uniswap V3 di RH Chain (untuk pool pasca-graduasi) |
| **Uniswap V3 Position Manager** | `0x73991a25C818Bf1f1128dEAaB1492D45638DE0D3` | NonfungiblePositionManager |

---

## 2. Arsitektur: Pure Bonding Curve

Goton Launchpad menggunakan arsitektur **Pure Bonding Curve** (V2). Token tidak langsung dibuat di Uniswap V3 — melainkan diperdagangkan di dalam kontrak bonding curve hingga mencapai target graduasi **4.2 ETH**, setelah itu likuiditas secara otomatis dipindah ke Uniswap V3 dan dikunci permanen.

### TokenLaunched Event (Bonding Curve Factory)

- **Signature**: `TokenLaunched(address,address,address,uint256,uint256)`
- **ABI Definition**:

```solidity
event TokenLaunched(
    address indexed token,
    address indexed deployer,
    address indexed curve,
    uint256 initialBuyAmount,
    uint256 supply
);
```

### TokenGraduated Event (pasca-4.2 ETH)

```solidity
event TokenGraduated(
    address indexed token,
    address indexed pool,
    uint256 liquidityAmount
);
```

---

## 3. Template Surat Pengajuan GMGN.AI

```text
Subject: New Bonding Curve Launchpad Integration - Robinhood Chain (4663)

Hi GMGN Team,

We have deployed a Pure Bonding Curve launchpad on Robinhood Chain (Chain ID: 4663).
Tokens trade on an internal AMM until 4.2 ETH is reached, then graduate automatically
to Uniswap V3 with liquidity locked permanently.

=== PROTOCOL SPECIFICATION ===
- Platform Name: Goton Launchpad
- Website: https://yourdomain.com
- Documentation: https://docs.yourdomain.com
- Network: Robinhood Chain (Chain ID: 4663)
- Architecture: Pure Bonding Curve (no direct pool at launch)
- Launchpad Factory: 0xbA42499Cfe59abc05120A100EEc4f859F476034F
- Liquidity Locker: 0x070233B6F46ccD61CA2B7bc1E13520c3fE4614E4
- Graduation Target: 4.2 ETH
- Underlying DEX (post-graduation): Uniswap V3
  - Factory: 0x1f7d7550B1b028f7571E69A784071F0205FD2EfA
  - Base Asset: WETH (0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73)
  - Pool Fee: 10000 (1%)

Thank you!
```

---

## 4. Alur Listing Otomatis DexScreener & GeckoTerminal

1. **Syarat Muncul Otomatis**:
   - Token harus memiliki minimal **1 transaksi swap** di bonding curve.
   - Setelah graduasi, pool Uniswap V3 terdaftar otomatis.
2. **Cek Pasangan Pool (pasca-graduasi)**:
   - URL DexScreener: `https://dexscreener.com/robinhood/<ALAMAT_POOL>`
   - URL GeckoTerminal: `https://www.geckoterminal.com/robinhood/pools/<ALAMAT_POOL>`
3. **Klaim Profil / Update Token Info**:
   - Buka `https://marketplace.dexscreener.com/product/token-info`
   - Masukkan alamat pool/token untuk menambahkan logo kustom, website, dan channel media sosial.
