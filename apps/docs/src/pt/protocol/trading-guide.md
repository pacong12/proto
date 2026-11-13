# Guia de Trading e Swaps

Comprar e vender tokens na Goton é projetado para ser rápido, responsivo e seguro. Cada operação é executada de forma não custodial pela sua carteira pessoal.

---

## Como Comprar Tokens

1. **Selecione um Token**: Navegue pela página **Explore** ou clique em qualquer cartão de token para abrir sua Trade View dedicada.
2. **Revise o Gráfico e as Métricas**:
   - Veja os candles de preço ao vivo e as tendências de volume de 24 horas.
   - Verifique se o token está atualmente **On Curve** (subindo em direção à graduação) ou **Graduated** (operando na DEX Uniswap).
   - Revise métricas de comunidade, principais holders e selos de status do criador.
3. **Escolha o Modo Compra**: No painel de trading à direita, garanta que a aba **Buy** esteja ativa.
4. **Insira o Valor**:
   - Digite o valor que deseja gastar (ETH na Robinhood Chain, USDC na Arc), ou use os botões de seleção rápida. Você também pode inserir o valor em USD.
   - O painel calcula automaticamente os tokens estimados a receber.
5. **Ajuste o Slippage (Opcional)**:
   - Clique no ícone de engrenagem para configurar sua tolerância de slippage (presets 0,5%, 1%, 2,5% e 5%, um valor personalizado, ou Auto).
   - A tolerância de slippage garante que sua ordem seja cancelada automaticamente se o preço se mover contra você além do limite escolhido.
6. **Confirme o Swap**: Clique em **Buy [Símbolo do Token]** e assine a transação na sua carteira.

---

## Como Vender Tokens

1. Abra a trade view do token que você possui.
2. Selecione a aba **Sell** no painel de trading.
3. Insira a quantidade de tokens que deseja vender, ou use os atalhos de porcentagem (`25%`, `50%`, `75%`, `100% / Max`).
4. Revise o pagamento estimado em ETH que você receberá.
5. Clique em **Sell [Símbolo do Token]**:
   - Primeira venda? Sua carteira solicitará uma aprovação inicial de um clique para permitir que o contrato inteligente processe seus tokens.
   - Confirme a transação de venda para receber ETH diretamente na sua carteira.

---

## Entendendo Impacto de Preço e Slippage

- **Impacto de Preço**: No trading descentralizado, comprar uma grande porcentagem dos tokens disponíveis desloca o preço para cima. Para tokens de bonding curve, o preço muda de forma previsível pela fórmula da curva ($x \cdot y = k$).
- **Slippage**: Protege você do front-running. Se outras operações ocorrerem entre o momento em que você clica em "Buy" e a confirmação do bloco, sua operação tem garantia de receber ao menos seus tokens mínimos esperados, ou será cancelada com segurança sem gastar seus fundos.

---

## Como Ler uma Página de Token

- **Market cap** é o valor total do token agora: preço × supply total (1 bilhão). Ele se move com o preço mesmo quando ninguém opera.
- **Volume 24h** é o valor de toda compra e venda nas últimas 24 horas. Um token pode ter market cap alto e nenhum volume: valioso, mas quieto.
- **Variação 24h** compara o preço com o de 24 horas atrás. Um token que não operou nessa janela mostra 0%.
- **Pressão de compra / venda** divide o volume recente em compras e vendas em 5 minutos, 1 hora, 6 horas ou 24 horas.
- **Holders** lista os maiores saldos. A bonding curve (ou o pool após a graduação) é rotulada como tal, não mostrada como um usuário.
- **Top traders** lista as compras, vendas, posição atual e lucro de cada carteira.
- O **gráfico** mostra o preço ou o market cap em candles de 1 segundo a 1 dia. Barras sem operações são desenhadas em cinza.
- No Explore, o pequeno **gráfico** ao lado de cada token é seu preço do lançamento até agora.

---

## Limit, Take-Profit e Stop-Loss

Para comprar ou vender em um alvo em vez do preço ao vivo, use as abas **Limit** e **TP / SL** do painel de trading. Veja [Ordens Limit, Take-Profit e Stop-Loss](/pt/protocol/advanced-orders).
