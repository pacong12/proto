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

| Modelo                                 | Funcionamento                                                                                                                                                                                                                | Ideal para                                                   |
| :------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------- |
| **Robinhood: Bonding Curve**           | Negociação em uma curva de preço ($x \cdot y = k$). Cerca de 714,3 M de tokens (71,43%) são vendidos na curva; ao arrecadar 4,2 ETH o mercado se gradua para um pool Uniswap v4 bloqueado com os ~285,7 M restantes.         | Tokens de comunidade e memes.                                |
| **Arc: Uniswap v4 desde o lançamento** | Todo o fornecimento é colocado como liquidez de um lado em um pool Uniswap v4 desde o primeiro bloco (valor inicial ≈ US$ 2.480). O token se gradua dentro do pool ao passar de ≈ US$ 45.000 de capitalização, sem migração. | Tokens que devem negociar na Uniswap desde o primeiro bloco. |
