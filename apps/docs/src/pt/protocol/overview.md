# O que é o Proto?

**Proto** é um protocolo descentralizado e não custodial de lançamento e negociação de tokens construído na **Robinhood Chain (Chain ID: 4663)** e **Arc Network (Chain ID: 5042)**.

Proporciona uma experiência segura e transparente para qualquer pessoa criar e negociar ativos digitais sem o risco de golpes de liquidez (_rug pulls_).

---

## Por que escolher o Proto?

1. **Zero Risco de Rug Pull**: Todas as posições de liquidez são trancadas no contrato `LiquidityLocker.sol` para sempre.
2. **Proteção Anti-Snipe**: Limites rigorosos de compra por transação e carteira protegem o lançamento contra robôs predatórios.
3. **Fornecimento Fixo**: Exatamente **1.000.000.000 de tokens** (1 Bilhão) sem função de emissão posterior.

---

## Dois Modelos de Lançamento

| Modelo               | Funcionamento                                                                                                                                | Ideal para                                                 |
| :------------------- | :------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------- |
| **v1 Direct Pool**   | Lançamento direto em um pool Uniswap V3 com 100% da liquidez permanentemente bloqueada.                                                      | Projetos que exigem profundidade DEX total desde o início. |
| **v2 Bonding Curve** | Começa em uma curva de preço algorítmica ($x \cdot y = k$) e migra automaticamente para a Uniswap ao atingir a meta (4.2 ETH ou 8.400 USDC). | Tokens de comunidade e memes.                              |
