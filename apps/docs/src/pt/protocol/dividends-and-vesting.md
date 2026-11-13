# Dividendos de Holders e Vesting

A aba **Dividends** do seu perfil é onde dois tipos de recompensas on-chain são coletados: **dividendos de compartilhamento de taxas para holders** dos tokens que você possui, e **tokens em vesting** de alocações que desbloqueiam ao longo do tempo. Ambos são resgatados diretamente para sua carteira.

---

## Dividendos de Holders

Alguns tokens ativam o **Holder Fee Sharing** no lançamento. Para esses tokens, uma parte das taxas de trading acumula **proporcionalmente para todos os holders** — não apenas o criador.

Na aba Dividends você verá:

- **Total claimable** — suas recompensas acumuladas, listadas por moeda (ETH / WETH na Robinhood, USDC na Arc).
- **Entradas por token** — cada token que você possui que compartilha taxas, com o valor esperando por você.
- **Claim all** — colete os dividendos de todos os tokens de uma vez, ou resgate um único token pela sua linha.

As recompensas continuam acumulando enquanto o token é negociado; resgatar varre o acumulado para sua carteira. Um token só aparece aqui se seu criador ativou o Holder Fee Sharing — veja [Taxas e Recompensas do Criador](/pt/protocol/fees-and-burns) sobre como a divisão de taxas é configurada.

---

## Vesting

Quando um token concede a você uma alocação que desbloqueia ao longo do tempo (por exemplo, uma alocação de criador ou contribuidor), seu **cronograma de vesting** aparece na mesma aba, por token:

| Campo                       | Significado                                      |
| :-------------------------- | :----------------------------------------------- |
| **Total (ainda bloqueado)** | Tokens ainda não desbloqueados                   |
| **Claimed**                 | Tokens que você já liberou para a carteira       |
| **Claimable**               | Tokens desbloqueados que você pode liberar agora |
| **Cliff ends**              | A data antes da qual nada desbloqueia            |
| **Fully unlocked**          | A data em que toda a alocação terminou o vesting |

Um cronograma tem um **cliff** (nada é liberado até essa data) e depois desbloqueia gradualmente até o vesting completo. Há duas ações em uma posição de vesting:

- **Claim tokens** — libere para sua carteira os tokens desbloqueados resgatáveis agora.
- **Claim dividends** — colete os dividendos de compartilhamento de taxas de holders ganhos por essa posição de vesting.

---

## Notas

- Tudo aqui é **on-chain**. Resgatar é uma transação de carteira; a lógica de vesting e de compartilhamento de taxas vive nos contratos do token, sem nenhum admin capaz de redirecionar suas recompensas.
- A aba mostra seus valores resgatáveis e seu vesting apenas no **seu próprio** perfil (conecte sua carteira). Os valores se atualizam conforme os tokens são negociados e os desbloqueios passam seu cliff.
