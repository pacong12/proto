# Verifikasi Ulang Temuan Audit (2026-10-16)

Setiap temuan di `docs/audit/` dicek ulang terhadap kode saat ini dan, bila relevan, terhadap state
on-chain (Arc 5042 / Robinhood 4663 via RPC mainnet). Status:

- **Diperbaiki** — valid dan diperbaiki dalam perubahan ini (dengan test).
- **Sudah diperbaiki** — valid saat ditulis, sudah teratasi di kode sebelum perubahan ini.
- **Tidak valid** — klaim tidak sesuai kode/chain; alasannya dicatat.
- **Terbuka** — valid, belum diperbaiki.
- **Diterima sebagai risiko** — valid secara teori, sengaja tidak diperbaiki; alasannya dicatat.
- **Legacy** — hanya mengenai kontrak di `contracts/src/legacy/` yang tidak lagi dipakai stack aktif.

## Fakta on-chain yang mengubah konteks

- Uniswap v4 PoolManager `0x8366…0951` ada di Arc **dan** Robinhood dengan bytecode identik.
- Hook Robinhood yang ter-deploy (`0x6347…D9a7`) punya bit izin `0x19A7` (afterSwapReturnsDelta tanpa
  afterSwap) → `PoolManager.initialize` selalu revert. `BondingCurve` membungkusnya dalam `try/catch`,
  jadi **tidak ada satu pun token Robinhood yang pernah punya pool v4**.
- `ProtoLiquidityLockerV4.factory()` on-chain = EOA `0x555C…` (S15 terkonfirmasi).

## Kontrak (SECURITY-AUDIT / SECURITY-TICKETS / AUDIT-REPORT / RED-TEAM / TICKETS)

| ID                                                  | Status              | Catatan                                                                                                                                                                                                                                                              |
| :-------------------------------------------------- | :------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1 / Alpha / AUD-CRIT sqrtPrice terbalik            | Sudah diperbaiki    | `CurveMath.computeSqrtPriceX96` sudah `sqrt(token)/sqrt(eth)`; NatSpec yang masih salah dibetulkan. Pool kini diinisialisasi oleh `ProtoV4Graduator` (fork test: harga pool = harga akhir kurva).                                                                    |
| S2 / Bravo drain lintas token di locker V4          | Diperbaiki · Legacy | Segregasi sudah ada, tapi fallback ke `address(this).balance` membuka drain lagi → dihapus. Kontrak dipindah ke legacy (tidak pernah memegang posisi).                                                                                                               |
| S3 snapshot nol                                     | Diperbaiki          | "Perbaikan" `snap == 0 ? liveBalance` **membuka pencurian dividen** (holder baru punya `paid = 0`). Dikembalikan ke aman; stack aktif memakai `ProtoFeeSplitter` (checkpoint di setiap transfer + streaming).                                                        |
| S4 / T1499.004 factory tanpa `receive()`            | Diperbaiki          | Factory Robinhood kini menerima refund kurva dan meneruskannya ke kreator (unit test).                                                                                                                                                                               |
| S5 / Charlie pajak jual menguras cadangan           | Tidak valid         | Fix H-01 sudah membuat `balance == virtualTokenReserve`. Remediasi yang diterapkan (owner boleh `emergencyWithdraw` kurva **aktif** setelah 180 hari) justru memungkinkan owner menguras ETH holder → dicabut; hanya kurva yang sudah graduasi tapi belum dimigrasi. |
| S6 mint V3 full-range                               | Legacy              | Hanya `legacy/LaunchpadFactory` (V1).                                                                                                                                                                                                                                |
| S7 graduasi macet karena truncation                 | Sudah diperbaiki    | `shouldGraduate` mencakup `grossTokensOut == curveAvailable`.                                                                                                                                                                                                        |
| S8 / Foxtrot squatting vesting                      | Diperbaiki          | Jadwal dikunci per `(token, creator, beneficiary)`; test squatter.                                                                                                                                                                                                   |
| S9 / T1562 `setLiquidityPool` sekali pakai          | Tidak diikuti       | Lock sudah dihapus, tapi rekomendasinya berbahaya untuk v4: pajak transfer token pada transfer ke/dari PoolManager merusak `settle`. Pajak pasca-graduasi dipungut oleh hook.                                                                                        |
| S10 `pendingEthFees` tak terisi                     | Diperbaiki          | Hook lama juga memakai signature `IHooks` yang salah dan tidak di-mine. Diganti `core/ProtoV4Hook`; hook lama → legacy.                                                                                                                                              |
| S11 / AUD-LOW-02 / TKT-14 `BaseLaunchpadFactory`    | Diperbaiki          | Kode mati (tidak ada yang mewarisi) → dihapus.                                                                                                                                                                                                                       |
| S12 ETH mentah ke distributor                       | Sudah diperbaiki    | Wrap + `depositRewards`.                                                                                                                                                                                                                                             |
| S13 fee posisi v4 tak dikoleksi                     | Diperbaiki          | `collectFees` di `ProtoV4Graduator` / factory Arc (fork test).                                                                                                                                                                                                       |
| S14, S16 `LiquidityLocker` V1                       | Legacy              | Tidak diperbaiki.                                                                                                                                                                                                                                                    |
| S15 factory imutabel di locker V4                   | Legacy              | Graduator memakai `setLauncher` sekali-set.                                                                                                                                                                                                                          |
| S17 / T1068 cancel redirect instan                  | Diperbaiki          | Locker legacy: hanya batalkan proposal pending. Splitter baru: propose/accept 48 jam.                                                                                                                                                                                |
| S18 lonjakan pajak instan                           | Diperbaiki          | `setInitialTaxConfig` ditolak setelah pembeli pihak ketiga pertama (unit test).                                                                                                                                                                                      |
| Lead: hook tidak di-mine                            | Diperbaiki          | Terkonfirmasi on-chain. `script/lib/HookMiner.sol`, konstruktor hook memvalidasi bit alamat.                                                                                                                                                                         |
| Lead: kreator yang me-revert memblokir fee          | Diperbaiki          | Bagian kreator di splitter kini pull; swap tidak bisa diblokir kreator.                                                                                                                                                                                              |
| AUD-HIGH-01 / TKT-02 initial buy Pons               | Tidak berlaku       | Tidak ada integrasi factory Pons di kode.                                                                                                                                                                                                                            |
| AUD-HIGH-02 / TKT-03 isolasi distributor            | Diperbaiki          | Diganti splitter per token.                                                                                                                                                                                                                                          |
| AUD-HIGH-03 / TKT-04 / SDK-04 split hanya di DB     | Diperbaiki          | Arc: split dari form ditegakkan saat launch. Robinhood: kreator menetapkan split sekali sebelum pembeli pihak ketiga (`ProtoV4Graduator.setRevenueSplit`), dipakai saat graduasi (fork test).                                                                        |
| AUD-HIGH-04 / TKT-05 anti-snipe ke treasury kontrak | Sudah diperbaiki    | `setRestrictionExempt(protocolFeeRecipient)`.                                                                                                                                                                                                                        |
| AUD-HIGH-05 / TKT-06 buyback beku                   | Diperbaiki          | `ProtoV4Buyback` dengan batas harga TWAP hook ± 2% (fork test kedua chain, termasuk skenario manipulasi); `resetReferenceRate()` untuk `BuybackBurner` V3 legacy; keeper API hanya memicu.                                                                           |
| AUD-HIGH-06 / TKT-07 migrasi kustodial              | Diperbaiki          | `graduate(token)` permissionless → `ProtoV4Graduator`, posisi terkunci selamanya (fork test Robinhood).                                                                                                                                                              |
| AUD-HIGH-07 / TKT-08 `server.py`                    | Sudah diperbaiki    | File tidak ada di repo. Rotasi kredensial tidak bisa diverifikasi dari kode.                                                                                                                                                                                         |
| AUD-LOW-01 / TKT-13 `receive()` kurva               | Sudah diperbaiki    | Revert.                                                                                                                                                                                                                                                              |

## SDK (INTERNAL-SDKS-ABI-AUDIT)

| ID                                          | Status                  | Catatan                                                                                    |
| :------------------------------------------ | :---------------------- | :----------------------------------------------------------------------------------------- |
| SDK-01 overload `launchTokenV2`             | Sudah dimitigasi        | Tidak ada pemanggil overload 7 argumen lagi; launch lewat adapter chain.                   |
| SDK-02 konstanta 800M/200M                  | Diperbaiki              | Fallback estimasi `TradeView` memakai `getChainMathConfig` dan invariant x·y=k yang benar. |
| SDK-03 `TransactionIntent` tidak ditegakkan | Diterima sebagai risiko | Validasi di browser dapat dilewati; penegakan nyata ada on-chain dan di API.               |
| SDK-05 ABI ganda                            | Diperbaiki              | Semua ABI di-generate dari Foundry di `@proto/contracts-abi`.                              |

## Frontoffice (FRONTOFFICE-AUDIT)

| ID                                     | Status      | Catatan                                                                                                                              |
| :------------------------------------- | :---------- | :----------------------------------------------------------------------------------------------------------------------------------- |
| FO-01 "Swap Confirmed" sebelum mined   | Diperbaiki  | Menunggu receipt sukses; revert/pending ditampilkan.                                                                                 |
| FO-02 `minInitialTokensOut = 0`        | Tidak valid | Token dan kurva/pool dibuat di transaksi yang sama, jadi tidak ada yang bisa trading lebih dulu.                                     |
| FO-03 approve tak terbatas             | Diperbaiki  | Approve sejumlah yang dijual; beli tanpa approve (native value).                                                                     |
| FO-04 `acceptFeeRedirect` tidak ada    | Diperbaiki  | Form CTO: kirim pertama = propose, kirim ulang setelah 48 jam = accept (splitter).                                                   |
| FO-05 pajak gagal tapi DB disinkronkan | Diperbaiki  | Pajak hanya dikirim bila diterapkan on-chain; API kini membaca pajak dari chain.                                                     |
| FO-06 saldo kreator "phantom"          | Diperbaiki  | Membaca `creatorAccrued` splitter.                                                                                                   |
| FO-07 tanpa `chainId`                  | Diperbaiki  | Receipt di chain token; tolak bila wallet di chain lain; pajak Arc tidak bisa diubah.                                                |
| FO-08 status "Connected" palsu         | Diperbaiki  | Fallback alamat tersimpan dimatikan setelah AppKit melaporkan `disconnected`.                                                        |
| FO-09 `resolveSafeUrl` tanpa sanitasi  | Diperbaiki  | Satu helper `lib/safe-url.ts` (http(s), ipfs, gambar inline) menggantikan 4 duplikat.                                                |
| FO-10 profil hanya `localStorage`      | Diperbaiki  | Profil publik via API dengan sesi wallet pemilik.                                                                                    |
| FO-11 polling receipt 2.5 detik        | Diperbaiki  | Dampaknya lebih dari Low (launch sukses dilaporkan gagal, jual sebelum approve mined). Fallback `waitForTransactionReceipt` 2 menit. |

## API (API-AUDIT)

| ID                                              | Status                        | Catatan                                                                                                                   |
| :---------------------------------------------- | :---------------------------- | :------------------------------------------------------------------------------------------------------------------------ |
| API-01 persentase holder 0.00%                  | Diperbaiki                    | Satuan token dikonversi ke base unit; kreator dihitung dari trade-nya, bukan `initialBuyAmount` (jumlah quote).           |
| API-02 / Delta `sync` tanpa autentikasi         | Diperbaiki                    | Body tidak lagi dipercaya; pajak dan split dibaca dari token / hook / splitter on-chain.                                  |
| API-03 / AUD-MED-03 spoofing `cf-connecting-ip` | Diperbaiki                    | IP socket peer secara default; header proxy hanya dengan `TRUST_PROXY=true`.                                              |
| API-04 body chunked OOM                         | Diperbaiki                    | Pembacaan stream berbatas (test).                                                                                         |
| API-05 XSS konten IPFS                          | Sudah dimitigasi + diperketat | CSP `sandbox` + `nosniff` sudah ada; kini hanya gambar yang inline.                                                       |
| API-06 / AUD-MED-02 disk & unduhan IPFS         | Diperbaiki                    | Unduhan gateway berbatas stream dan tidak ditulis ke disk.                                                                |
| API-07 query N+1 `/dex/events`                  | Diperbaiki                    | Satu query berindeks per rentang blok; sekaligus memperbaiki `asset0` yang keliru dibagi harga USD.                       |
| API-08 `eth_getLogs` tanpa batch                | Diperbaiki                    | Batch 50 alamat.                                                                                                          |
| API-09 interaksi sosial tanpa tanda tangan      | Diperbaiki                    | Sesi wallet (`POST /api/auth/session`, HMAC 24 jam) wajib untuk like/repost/vote; vote anonim dengan alamat acak dihapus. |
| API-10 tanpa buffer reorg                       | Diperbaiki                    | `INDEXER_CONFIRMATIONS` (default 2).                                                                                      |
| TKT-10 integritas hash IPFS                     | Diperbaiki                    | Verifikasi CID untuk raw leaf dan UnixFS satu blok; gateway yang membalas halaman pemberitahuan (200 OK) kini ditolak.    |
| (baru) CID fallback ber-codec salah             | Diperbaiki                    | `generateDeterministicCid` melabeli hash byte mentah sebagai dag-pb; kini raw (`bafkrei…`).                               |
| Echo keeper `minAmountOut = 1`                  | Diperbaiki                    | Keeper melewati buyback bila belum ada rate acuan.                                                                        |
| (baru) `pollV4Swaps` arah beli/jual terbalik    | Diperbaiki                    | Delta v4 negatif = dibayar swapper; urutan currency & desimal quote kini benar (test dengan swap $IDEA asli).             |

## Audit Arc / Argus

Diverifikasi sebelumnya on-chain: V3 **ada** di Arc (bukan tidak ada); relayer gas-sponsored tidak muncul
di transaksi bukti; split Argus dipotong treasury dulu (bukan 80/10/10 tetap); fee $GOLDETTF adalah
dynamic fee; flag hook `0x2044`/`0x20cc` (termasuk `beforeInitialize`); "Canonical Hook Code Hash" adalah
alamat kontrak. Parameter Argus portal saat ini (tick 405400 / bond 376400) kini dipakai di Arc.

## DevOps & CI/CD (DEVOPS-CICD-AUDIT)

| ID                               | Status     | Catatan                                                                                                                   |
| :------------------------------- | :--------- | :------------------------------------------------------------------------------------------------------------------------ |
| DEVOPS-01 IP VPS di workflow     | Diperbaiki | Tanpa fallback IP; deploy butuh secret `VPS_HOST`. IP tetap ada di riwayat git.                                           |
| DEVOPS-02 scan non-blocking      | Diperbaiki | Gitleaks/CodeQL/Trivy memblokir; Slither `--fail-high` lolos setelah 8 positif palsu dianotasi.                           |
| DEVOPS-03 `trivy-action@master`  | Diperbaiki | Pin SHA v0.35.0. Periksa run 19–20 Maret 2026 (CVE-2026-33634) dan rotasi secret bila perlu.                              |
| DEVOPS-04 deploy dari PR         | Diperbaiki | Workflow deploy Cloudflare di GitHub dihapus; deploy hanya via integrasi Git Cloudflare dari `main`.                      |
| DEVOPS-05 container root / 777   | Diperbaiki | User `bun` + `su-exec`; diuji Docker. Healthcheck `localhost` (IPv6, selalu gagal) dan `DB_PATH` default ikut diperbaiki. |
| DEVOPS-06 password Redis default | Diperbaiki | `REDIS_PASSWORD` wajib. Nama env kontrak di compose diperbarui ke v4.                                                     |
| DEVOPS-07 skrip verifikasi usang | Diperbaiki | Ditulis ulang untuk stack v4.                                                                                             |
| DEVOPS-08 tanpa pre-commit       | Diperbaiki | Hook secret guard otomatis via `prepare`.                                                                                 |

## Disaster Recovery (DISASTER-RECOVERY-IR-AUDIT)

| ID                               | Status              | Catatan                                                                        |
| :------------------------------- | :------------------ | :----------------------------------------------------------------------------- |
| DR-01 tanpa circuit breaker      | Diperbaiki          | `EmergencyPause`: launch/buy/graduasi dapat dijeda; jalan keluar tidak pernah. |
| DR-02 satu RPC, `retryCount: 0`  | Diperbaiki          | Transport `fallback` di API, keeper, dan backfill.                             |
| DR-03 keeper macet karena nonce  | Diperbaiki          | Tunggu tx pending, ganti setelah 5 menit dengan fee +50% (test).               |
| DR-04 integritas & backup SQLite | Diperbaiki sebagian | `quick_check` + pemulihan otomatis + backup harian lokal. Off-site belum.      |
| DR-05 RPC frontend statis        | Tidak valid         | Frontend sudah memakai `fallback` sebelum audit.                               |
| DR-06 backfill tanpa market data | Diperbaiki          | Memakai indexer API (`indexRange`); skrip lama juga rusak.                     |

## Dokumentasi & i18n (DOCUMENTATION-I18N-AUDIT)

| ID                                       | Status                          | Catatan                                                                                  |
| :--------------------------------------- | :------------------------------ | :--------------------------------------------------------------------------------------- |
| DOC-01 klaim 80% buyback                 | Diperbaiki                      | Alur fee yang benar di 11 bahasa (beranda) dan en/id/zh (fees).                          |
| DOC-02 / DOC-05 angka kurva & target Arc | Diperbaiki                      | Arc kini v4 sejak launch; 69.000/8.400 USDC dan 800M dihapus; Robinhood 71,43%.          |
| DOC-03 alamat kontrak                    | Perlu diperbarui setelah deploy | Halaman integrasi masih memuat alamat deployment lama; ganti setelah stack v4 di-deploy. |
| DOC-07 PnL card hardcoded                | Diperbaiki                      | 14 kunci i18n × 11 bahasa.                                                               |

## Regulasi (REGULATORY-COMPLIANCE-AUDIT)

| ID                 | Status                 | Catatan                                                                                                                                             |
| :----------------- | :--------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------- |
| GRC-01 SEC / Howey | Terbuka (legal)        | Keputusan geoblocking dan terminologi.                                                                                                              |
| GRC-02 MiCA        | Diperbaiki sebagian    | Pajak terkunci sejak launch sudah ada; batas emisi dan disclaimer menunggu produk/compliance.                                                       |
| GRC-03 sanksi OFAC | Terbuka (legal/vendor) | Butuh vendor skrining. Dana per token sudah terisolasi per splitter.                                                                                |
| GRC-04 GDPR        | Diperbaiki sebagian    | IP di-hash di log, endpoint + tombol hapus data, kebijakan privasi diperbarui. Sisa: identitas pengendali data dan consent cookie Google Analytics. |

## Tidak diverifikasi

Angka simulasi Monte Carlo dan batas MEV di TOKENOMICS-STRESS-TEST (bagian "sell tax leakage" = S5, tidak valid).

## Slither medium findings (code scanning, 2026-10)

The 42 open Slither medium alerts in GitHub code scanning were reviewed against the code; none is
exploitable. Each site carries a `slither-disable-next-line` comment pointing here.

| Detector                 | Count | Verdict                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------ | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `reentrancy-no-eth`      | 6     | Not exploitable. `GotonV4Buyback.buyback`, `GotonV4Graduator.graduate` and `LaunchpadV2Factory.graduate` are `nonReentrant` (the graduator also accepts only its launcher, once per token); `GotonV4Hook.afterSwap` is `onlyPoolManager` and calls only the token's own splitter; `LaunchpadToken._transfer` calls the splitter's `setShare` before updating balances on purpose (dividend checkpoints must use pre-transfer balances) and the splitter accepts calls only from the token. |
| `divide-before-multiply` | 5     | Intentional. Tick flooring to the spacing (with the negative-tick correction), the Uniswap `TickMath` port, the Synthetix-style reward stream scaled by `PRECISION`, ceiling division in `CurveMath`, and `liquidityForAmount0`, which rounds liquidity down (leftover dust is placed in the next step).                                                                                                                                                                                   |
| `incorrect-equality`     | 8     | Not attacker-steerable: zero-amount and zero-supply checks, one oracle write per block (`nowTs == lastTimestamp`) and the curve being exactly sold out after the buy is capped.                                                                                                                                                                                                                                                                                                            |
| `unused-return`          | 23    | Only part of a returned tuple is needed (`getSlot0` fields), or the value is already known (`settle`, `modifyLiquidity` fee deltas on positions created in the same call).                                                                                                                                                                                                                                                                                                                 |

## Fuzzing findings (2026-10)

| ID       | Severity | Finding                                                                                                                                                                                                                                                                                                             | Status                                                                                                                                                                                                                                                                                                                |
| -------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CURVE-01 | Low      | `CurveMath.getAmountOutBuy` / `getAmountOutSell` compute the new reserve with `floor(k / reserve)`, so a trade can leave `k` short by less than one rounding step: a buyer receives at most 1 wei of token, a seller at most 1 wei of quote, more than the exact amount. Found by `test/fuzz/CurveMath.fuzz.t.sol`. | Fixed in source: both functions round the new reserve up, so `k` never decreases (fuzzed as a strict invariant), and `math-sdk` mirrors it. Takes effect for curves created by the next factory deployment; curves already deployed keep the 1 wei behavior, where the SDK preview is now at most 1 wei conservative. |

## Arc documentation review (2026-10)

Checked against docs.arc.io (EVM differences, stablecoin native model, AMM porting, blocklist compliance).

| ID     | Severity | Finding                                                                                                                                                                                                                                           | Status                                                                                                                                                                          |
| ------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ARC-01 | Medium   | `GotonFeeSplitter.distributeFees` pushed the protocol and liquidity shares during every swap. On Arc, USDC transfers to a blocklisted address revert, so a blocklisted treasury or liquidity vault would have reverted every swap of every token. | Fixed in source: both shares accrue and are paid by permissionless `releaseProtocolFees` / `releaseLiquidityFees`. Applies to tokens created after the next factory deployment. |
| ARC-02 | Low      | `launchFee` (both factories) and the protocol cut (`protocolFeeBps`, graduator `defaultSplit.protocolBps`) had no upper bound, so the owner could raise them without limit.                                                                       | Fixed in source: caps of 10 USDC (Arc), 0.01 ETH (Robinhood) and 30%.                                                                                                           |
| ARC-03 | Low      | The API's Arc launch relayer called a function the factory does not have, had no wallet, and would have made the relayer the token creator (`msg.sender`).                                                                                        | Fixed: relayer removed (#163). Arc gas is about $0.001 and creators hold USDC for the prebuy anyway.                                                                            |
| ARC-04 | Info     | Arc block timestamps have 1-second granularity with 0.5 s blocks; the anti-snipe tax steps per second, so two blocks share each step.                                                                                                             | Accepted: matches the intended 3-second schedule.                                                                                                                               |
| ARC-05 | Info     | Arc recommends testing value transfers on Arc testnet, since local forks do not reproduce blocklist or EIP-7708 behavior.                                                                                                                         | Open: run the launch flow on Arc testnet (chain 5042002) before the next factory deployment.                                                                                    |

`test/fuzz/GotonFeeSplitter.invariant.t.sol` runs random fee deposits, holder transfers, time jumps
and claims (256 runs x 500 calls) and checks that the splitter always holds enough for the creator
share, the buyback share and every holder's claimable dividend, and never pays out more than it
received.
