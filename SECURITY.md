# Security Policy

## Overview

Proto is a decentralized launchpad and liquidity bonding protocol operating across EVM-compatible networks, primarily Robinhood Chain (Chain ID: 4663) and Arc Network (Chain ID: 5042). We take the security of our smart contracts, backend indexer services, and client interfaces seriously.

## Supported Versions

Only the latest active release branch is eligible for active security patches and vulnerability triage.

| Version | Supported |
| ------- | --------- |
| 0.1.x   | Yes       |
| < 0.1.0 | No        |

## In-Scope Components

1. **Smart Contracts (`contracts/src/`)**:
   - `BondingCurve.sol`: Constant product bonding curve math, reserve invariants, and anti-snipe tax logic.
   - `LaunchpadFactory.sol`, `LaunchpadV2Factory.sol`, and `LaunchpadV2FactoryArc.sol`: Factory deployment, atomic pool initialization, and fee routing.
   - `LiquidityLocker.sol`: Permanent liquidity position lock mechanisms and fee claim distributions.
   - `HolderFeeDistributor.sol`: Cumulative reward-per-token dividend calculations.
   - `BuybackBurner.sol`: TWAP buyback execution, cooldown guards, and treasury protection.

2. **Backend API & Indexer (`apps/api/`)**:
   - Security Gate & `SecurityPolicy` transaction intent evaluation.
   - Real-time onchain event indexing and trade ingestion.
   - DevOps observability, authentication, and rate-limiting infrastructure.

3. **Frontend Web Client (`apps/frontoffice/`)**:
   - Non-custodial wallet transaction submission workflows.
   - Slippage protection and input validation.

## Out of Scope

- Vulnerabilities in third-party RPC endpoints or public node providers.
- Attacks requiring physical device access or compromised client operating systems.
- Loss of private keys, seed phrases, or user credentials.
- Known third-party library issues with upstream vendor advisories already published.

## Reporting a Vulnerability

If you discover a security vulnerability in the Proto protocol, please report it privately:

1. **GitHub Advisory**: Open a confidential report via [GitHub Private Vulnerability Reporting](https://github.com/pacong12/proto/security/advisories/new).
2. **Details Required**:
   - Descriptive title and affected component.
   - Detailed step-by-step reproduction steps or executable proof-of-concept (Foundry test preferred for contracts).
   - Assessment of potential impact and proposed remediation.

### Response Timeframes

- **Initial Acknowledgement**: Within 24 hours of receipt.
- **Triage & Severity Assessment**: Within 72 hours.
- **Patch Development & Deployment**: Prioritized based on CVSS severity rating.

## Responsible Disclosure & Safe Harbor

We commit to not pursuing legal action against security researchers who:

- Test systems within the scope defined above without degrading service performance or draining live user funds.
- Maintain confidentiality until a patch has been deployed and verified.
- Act in good faith to protect user assets and privacy.
