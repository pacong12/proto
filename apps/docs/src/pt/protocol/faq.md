# Perguntas Frequentes (FAQ)

Encontre respostas para perguntas comuns sobre trading, lançamento e gestão de tokens na Goton.

---

## Perguntas Gerais

### O que é a Goton?

A Goton é um launchpad cripto descentralizado e não custodial que suporta tanto a **Robinhood Chain** (L2) quanto a **Arc Network** (L1 de stablecoin da Circle). Ela permite que qualquer um lance tokens de supply fixo, opere com gráficos ao vivo e participe de lançamentos justos com liquidez permanentemente bloqueada.

### Um desenvolvedor pode dar rug pull ou drenar a liquidez?

**Não.** As posições de pool de liquidez criadas na Goton são mintadas diretamente no contrato inteligente de código aberto `LiquidityLocker.sol` e bloqueadas para sempre. Não há função de desbloqueio, backdoor ou chave de saque de admin.

### Quais carteiras são suportadas?

A Goton suporta todas as carteiras Web3 padrão compatíveis com Ethereum, incluindo:

- MetaMask
- Coinbase Wallet
- Rabby Wallet
- Rainbow Wallet
- Carteiras móveis compatíveis com WalletConnect / Reown

A Goton apenas conecta carteiras. Não há login por e-mail ou social, então o app nunca guarda uma chave por você.

---

## Trading e Swaps

### Por que minha operação falhou?

As operações geralmente falham por duas razões:

1. **Slippage Excedido**: Durante alta volatilidade, o preço mudou mais do que sua porcentagem de slippage configurada entre o clique e a confirmação do bloco. Aumente o slippage nas configurações de trading (ex.: de 1% para 2%).
2. **Saldo de Gas Insuficiente**: Sempre mantenha um pequeno saldo do token de gas nativo (ETH na Robinhood ou USDC na Arc) para pagar as taxas de execução da rede.

### Qual a diferença entre On Curve e Graduated?

- **On Curve (v2)**: O token opera atualmente na bonding curve matemática. O preço sobe conforme os tokens são comprados.
- **Graduated**: Na Robinhood Chain, a curva atingiu seu alvo de 4.2 ETH e o mercado passou permanentemente para um pool Uniswap v4 bloqueado. Na Arc Network, os tokens operam em um pool Uniswap v4 desde o lançamento e graduam in-pool quando o market cap passa de ~$45.000.

### Posso comprar ou vender a um preço-alvo?

Sim. As abas **Limit** e **TP / SL** colocam uma ordem que executa automaticamente quando o market cap atinge seu alvo, e você pode cancelá-la a qualquer momento. Veja [Ordens Limit, Take-Profit e Stop-Loss](/pt/protocol/advanced-orders).

### Qual a diferença entre Explore e Memestock?

O Explore lista todos os tokens. O Memestock lista apenas lançamentos com tese escrita cujo criador comprou e ainda mantém a maior parte da posição, ordenados por trading recente. Veja [Feed, Calls, Memestock e Seguir](/pt/protocol/social).

### Há alguma restrição de venda?

**Nunca.** Os usuários podem vender seus tokens a qualquer momento. A Goton nunca impõe bloqueios, períodos de espera de venda ou congelamentos de transferência aos holders.

---

## Criação de Tokens

### Quanto custa lançar um token?

A taxa de deploy do protocolo é **0.0005 ETH** na Robinhood Chain ou **Grátis (0 USDC)** na Arc Network (requer pré-compra inicial mínima de 4,50 USDC). Isso cobre o deploy do contrato inteligente, o minting do token e o bloqueio inicial de liquidez.

### Mais tokens podem ser mintados depois?

**Não.** Todo token criado na Goton tem um supply imutável e fixo de exatamente **1.000.000.000 tokens** (1 bilhão). O contrato não tem função de minting.

### Como os criadores ganham taxas?

As taxas e o imposto de cada token são divididos on-chain: **70% para a parte do criador na Robinhood Chain, 80% na Arc**, e o restante para o protocolo. O criador pode dividir essa parte uma vez, antes de o trading público começar, entre si mesmo, holders e buyback-and-burn. Veja [Taxas e Recompensas do Criador](/pt/protocol/fees-and-burns). Resgate as taxas acumuladas na sua página de **Perfil**.

---

## Rede e Suporte

### Que rede a Goton usa?

A Goton opera como um protocolo multi-cadeia suportando a **Robinhood Chain** (Chain ID: `4663`) e a **Arc Network** (Chain ID: `5042`).

### Onde posso obter ajuda?

Para assistência da comunidade, discussões e atualizações, participe dos nossos canais oficiais ou consulte nossos [Contratos Inteligentes Verificados](/integration/contracts).
