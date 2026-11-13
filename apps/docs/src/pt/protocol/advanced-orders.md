# Ordens Limit, Take-Profit e Stop-Loss

Além de comprar e vender ao preço ao vivo, o painel de trading tem mais duas abas: **Limit** e **TP / SL**. Ambas colocam uma ordem no contrato `GotonLimitOrders`, que retém seus fundos até a ordem executar ou você cancelá-la.

---

## Os Três Tipos de Ordem

| Ordem           | O que você deposita           | Executa quando                                                         |
| :-------------- | :---------------------------- | :--------------------------------------------------------------------- |
| **Limit buy**   | ETH (Robinhood) ou USDC (Arc) | O market cap cai ao seu alvo, e você recebe ao menos os tokens cotados |
| **Take profit** | Tokens                        | O market cap sobe ao seu alvo, e você recebe ao menos o valor cotado   |
| **Stop loss**   | Tokens                        | O market cap cai ao seu stop, e vende com seu limite de slippage       |

Os alvos são inseridos como um **market cap em USD**, que o app converte no preço on-chain e no mínimo que você receberá. Esse mínimo já considera a taxa do pool ou da curva, o imposto do token e a taxa de executor de 0,1%, então uma ordem executa quando o mercado atinge seu alvo, não depois.

Um take profit e um stop loss podem compartilhar um depósito (**one-cancels-other**): a primeira perna a executar fecha a ordem e a outra desaparece.

---

## Como as Ordens Executam

- **Qualquer um pode executar uma ordem** quando sua condição é atendida. A Goton opera um keeper que verifica as ordens abertas a cada 15 segundos e as executa, mas o contrato aceita qualquer executor.
- **O executor ganha 0,1%** do lado de cotação (a taxa de executor). O keeper só executa quando essa taxa cobre seu gas, então ordens muito pequenas podem esperar que outro as execute, ou que você cancele.
- **Stop losses usam um preço resistente a manipulação.** Em uma bonding curve, o stop dispara apenas quando tanto o preço spot da curva quanto seu TWAP (média ponderada no tempo de cerca de 10 a 20 minutos) estão em ou abaixo do seu stop. Em um pool Uniswap v4 funciona do mesmo modo, com o preço spot do pool e seu TWAP de 30 minutos do hook da Goton. De qualquer forma, o empurrão de preço de um único bloco não pode disparar seu stop, e um stop não dispara depois que o preço se recupera acima dele. Um stop espera até o preço ter histórico suficiente: cerca de 10 minutos em um token novo, e 30 minutos após graduar para seu pool. Você pode colocá-lo antes disso; ele se arma sozinho.
- **Cada execução é verificada contra a mudança do seu saldo.** O contrato mede o que de fato chegou à sua carteira, não o que um router reporta, e reembolsa o que sobrar de uma execução parcial.

---

## Custódia, Expiração e Cancelamento

- Seu depósito permanece no contrato até a ordem executar ou você cancelá-la. O contrato **não tem dono nem funções de admin**: os fundos em custódia só podem executar sua ordem nos seus termos ou retornar a você.
- Toda ordem tem uma expiração (1, 7 ou 30 dias). Depois disso ela não pode mais executar, mas **cancelar continua funcionando**, a qualquer momento, e devolve o depósito completo.
- Cancele pela lista **Open orders** sob o painel de trading.

---

## Histórico de Ordens e Notificações

- O painel sob o formulário de trading tem duas abas: **Open** e **History**. O History lista ordens executadas e canceladas com a perna que executou, o que você recebeu e um link para a transação de encerramento.
- Enquanto sua carteira está conectada, o app verifica suas ordens a cada 20 segundos em qualquer página e mostra uma notificação quando uma executa.

---

## Onde as Ordens Estão Disponíveis

| Cadeia          | Tokens em bonding curve | Pools Uniswap v4        |
| :-------------- | :---------------------- | :---------------------- |
| Robinhood Chain | Tokens da fábrica atual | Tokens graduados        |
| Arc Network     | — (Arc não tem curvas)  | Tokens da fábrica atual |

As abas Limit e TP / SL só aparecem em tokens onde uma ordem pode executar. Tokens de fábricas anteriores não as mostram.

Os endereços de contrato estão listados em [Contratos Inteligentes Verificados](/integration/contracts).
