# Listing DEX & Agregator

Data rujukan untuk indexer dan agregator (DEX Screener, GeckoTerminal, GMGN dan sejenisnya) yang ingin mencantumkan token Goton. Goton juga menyediakan sendiri endpoint adapter DEX Screener; lihat [Public API](/id/integration/api#adapter-dex-screener).

---

## Cara Kerja Trading

- **Robinhood Chain (4663)**: token diperdagangkan di bonding curve miliknya sendiri hingga curve mengumpulkan **4,2 ETH**. Setelah itu token graduate ke pool **Uniswap v4** berpasangan dengan **ETH native**, dan likuiditasnya terkunci selamanya.
- **Arc Network (5042)**: tidak ada curve. Token diperdagangkan di pool **Uniswap v4** berpasangan dengan **USDC** sejak blok pertama, dan likuiditasnya terkunci selamanya.

Setiap pool v4 Goton memakai hook Goton, **fee LP 1%** (`fee = 10000`) dan `tickSpacing = 200`.

---

## Robinhood Chain (4663)

| Kontrak                | Alamat                                       |
| :--------------------- | :------------------------------------------- |
| Launchpad Factory      | `0x0b85876120e797Ca19655C0B81a0C25573f3Fc18` |
| Graduator              | `0xaEF6Fff944007b94a51F37e82cf5235fDBF9b771` |
| Goton V4 Hook          | `0xb5C88A6101e6b979Ad63Bf5e6302dF8F031360Cc` |
| Uniswap V4 PoolManager | `0x8366a39CC670B4001A1121B8F6A443A643e40951` |
| Aset quote di pool     | ETH native (`address(0)`)                    |

**Event**

```solidity
// Factory: a token and its bonding curve are created.
event TokenLaunchedV2(
    address indexed token,
    address indexed curve,
    address indexed creator,
    string name,
    string symbol,
    uint256 initialBuy
);

// Bonding curve: every buy and sell before graduation.
event Trade(address indexed trader, bool indexed isBuy, uint256 ethAmount, uint256 tokenAmount, uint256 feeEth);

// Factory: the curve's liquidity moved into its locked v4 pool.
event TokenGraduated(address indexed token, bytes32 indexed poolId, address splitter);
```

Setelah graduate, transaksi berupa event `Swap` Uniswap v4 standar di PoolManager untuk `poolId` tersebut.

---

## Arc Network (5042)

| Kontrak                | Alamat                                                        |
| :--------------------- | :------------------------------------------------------------ |
| Launchpad Factory (v4) | `0xd7Bf86061CC5637b2b854d61007f8fD7CD6f0980`                  |
| Goton V4 Hook          | `0xb5C88A6101e6b979Ad63Bf5e6302dF8F031360Cc`                  |
| Uniswap V4 PoolManager | `0x8366a39CC670B4001A1121B8F6A443A643e40951`                  |
| Aset quote di pool     | USDC `0x3600000000000000000000000000000000000000` (6 desimal) |

**Event**

```solidity
// Factory: a token is created directly in its locked v4 pool.
event TokenLaunchedV4(
    address indexed token,
    bytes32 indexed poolId,
    address indexed creator,
    address splitter,
    string name,
    string symbol,
    uint256 prebuyUsdc6,
    uint256 creatorTokens
);
```

Transaksi berupa event `Swap` Uniswap v4 di PoolManager untuk `poolId` tersebut.

---

## Fakta Token

- Suplai tetap **1.000.000.000** token, 18 desimal, tanpa fungsi mint.
- Saat peluncuran, kreator dapat menetapkan pajak beli dan jual 0–10%, yang dibagi on-chain antara bagian kreator dan protokol. Lihat [Fee Kreator & Hadiah](/id/protocol/fees-and-burns).
- Factory lama masih memiliki token yang tetap diindeks, tetapi tidak menerima peluncuran baru. Semua alamat terkini ada di [Kontrak Pintar Terverifikasi](/id/integration/contracts).

---

## Template Pengajuan

Kirim dalam bahasa Inggris, karena sebagian besar tim agregator bekerja dalam bahasa Inggris:

```text
Subject: Goton launchpad listing - Robinhood Chain (4663) and Arc (5042)

Hi team,

Goton (https://goton.fun) is a fixed-supply token launchpad.

- Robinhood Chain (4663): tokens trade on a bonding curve until 4.2 ETH, then graduate
  into a Uniswap v4 pool against native ETH with liquidity locked for good.
  Factory 0x0b85876120e797Ca19655C0B81a0C25573f3Fc18 (TokenLaunchedV2, TokenGraduated),
  curve Trade events before graduation.
- Arc (5042): tokens launch straight into a Uniswap v4 pool against USDC
  (0x3600000000000000000000000000000000000000), liquidity locked.
  Factory 0xd7Bf86061CC5637b2b854d61007f8fD7CD6f0980 (TokenLaunchedV4).
- Uniswap v4 PoolManager on both chains: 0x8366a39CC670B4001A1121B8F6A443A643e40951,
  Goton hook 0xb5C88A6101e6b979Ad63Bf5e6302dF8F031360Cc, fee 10000, tickSpacing 200.
- DEX Screener adapter: https://goton.fun/dex/{latest-block,asset,pair,events}, dexId "goton".
- Docs: https://docs.goton.fun

Thank you!
```
