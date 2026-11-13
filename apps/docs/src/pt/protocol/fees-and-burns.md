# Taxas e Recompensas do Criador

A Goton alinha o sucesso de longo prazo dos criadores de tokens com suas comunidades, oferecendo uma das estruturas de taxas mais favoráveis a criadores de todo o ecossistema blockchain.

---

## Distribuição de Taxas

De onde vêm as taxas depende da cadeia:

- **Robinhood Chain**: enquanto um token está em sua bonding curve, cada operação na curva paga uma taxa de 1% ao protocolo. Após a graduação, o pool Uniswap v4 bloqueado cobra uma taxa de LP de 1%.
- **Arc Network**: o pool Uniswap v4 cobra uma taxa de LP de 1% desde o lançamento, além de um imposto opcional de compra/venda de 0–10% que o criador define no lançamento.

As taxas do pool e os impostos são divididos pelo divisor de taxas on-chain de cada token:

- **Para o tesouro** do protocolo: 30% na Robinhood Chain, 20% na Arc. Os contratos limitam a parte do protocolo a 30% e a taxa de lançamento a 10 USDC na Arc (0,01 ETH na Robinhood Chain).
- **O restante (70% ou 80%) é a parte do criador**, que o criador pode dividir uma vez, antes de o trading público começar, entre:
  - **Criador**: resgatável pelo criador (ou seu destinatário redirecionado).
  - **Holders**: transmitido aos holders do token de forma proporcional ao longo de 24 horas.
  - **Buyback & Burn**: recomprado no próprio pool do token pelo contrato `GotonV4Buyback` e enviado ao endereço morto. Cada recompra é limitada ao TWAP de 30 minutos do pool ± 2%, de modo que um preço manipulado apenas pausa a recompra até normalizar.
  - **Liquidez**: enviada ao cofre de liquidez do protocolo, que atualmente é o tesouro do protocolo. O app goton.fun não oferece essa opção, pois não adiciona liquidez ao próprio pool do token.

Por padrão, toda a parte do criador vai para o criador. A parte do protocolo não é usada para recompras.

---

## Como os Criadores Resgatam Recompensas

1. Conecte a carteira que originalmente criou o token.
2. Vá à sua página de **Perfil** (`/profile`).
3. Na seção **My Launches**, veja suas recompensas acumuladas não coletadas em ETH e tokens.
4. Clique em **Claim Fees** para sacar suas recompensas diretamente para sua carteira em uma única transação.

---

## Pagamentos de Equipe

Um criador pode compartilhar sua parte das taxas com uma equipe. Em **Advanced → Fee recipients** na página de criação, adicione carteiras da equipe com percentuais fixos (até 10 carteiras, somando 100%). O app então cria um `GotonTeamSplitter` para a equipe antes do lançamento:

- **Robinhood Chain**: o imposto do token vai para a equipe desde o lançamento. Após a graduação, redirecione as taxas do pool para a mesma equipe a partir do seu perfil (timelock de 48 horas).
- **Arc**: taxas e imposto chegam à equipe assim que o redirecionamento de pagamento proposto no lançamento se tornar ativo, 48 horas depois. Até lá, vão para o criador.

O contrato da equipe não tem dono e seus membros e participações nunca podem mudar. Qualquer um pode liberar as participações dos membros a partir da página do token (**About → Team payouts**); cada membro é sempre pago diretamente.

---

## Redirecionamento de Taxas (Community Takeovers)

Se um criador deseja recompensar sua comunidade ou entregar a liderança do projeto:

- Apenas o criador pode redirecionar a parte do criador das taxas para um tesouro DAO, multisig comunitário ou contrato de recompensas. Uma proposta pode ser aceita após um timelock de 48 horas, e o criador pode cancelá-la até que seja aceita.
- O criador pode então bloquear o destinatário permanentemente. O protocolo nunca pode mover as taxas de um criador.
- Esse recurso potencializa os community takeovers (CTO) ao transformar a receita do projeto em financiamento de propriedade da comunidade. Veja [Community Takeovers](./community-takeovers.md).
