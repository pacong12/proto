# Community Takeovers (CTO)

O que acontece se o desenvolvedor de um token quiser se afastar de um projeto?

Na Goton, um criador pode entregar seu fluxo de taxas à comunidade que leva o projeto adiante. Essa é sempre a decisão do próprio criador. Ninguém mais, incluindo o protocolo, pode mover as taxas de um criador.

---

## O que é um Community Takeover?

Um Community Takeover ocorre quando membros da comunidade adotam um token, assumem o marketing, atualizam os links sociais e mantêm o crescimento da comunidade.

A Goton apoia isso por meio de um redirecionamento no divisor de taxas do token:

1. **Propor**: O criador propõe uma carteira comunitária, multisig ou endereço DAO na página de **Perfil** (aba **Created**, **Manage CTO**).
2. **Aguardar 48 horas**: A proposta não pode entrar em vigor durante esse timelock, para que todos a vejam chegando. O criador pode cancelá-la até que seja aceita. Uma nova proposta substitui a anterior e reinicia a espera.
3. **Aceitar**: Após o timelock, o criador ou o destinatário proposto aceita. A partir daí, a parte do criador das taxas vai para o novo destinatário.
4. **Bloquear (opcional)**: O criador pode bloquear o destinatário atual permanentemente. Isso não pode ser desfeito e descarta qualquer proposta pendente, então aceite o novo destinatário antes de bloquear.

Até o destinatário ser bloqueado, o criador pode iniciar um novo redirecionamento a qualquer momento, novamente com o timelock de 48 horas.

O valor redirecionado depende do token. O criador escolhe como a parte do criador é dividida, então o redirecionamento cobre apenas a porção atribuída ao **Criador**. As porções de holders, buyback e liquidez mantêm seus destinos. Veja [Taxas e Recompensas do Criador](./fees-and-burns.md).

---

## Como Pedir um Takeover

1. **Organize um destinatário**: Configure um multisig ou DAO controlado pela comunidade, em vez da carteira pessoal de um membro.
2. **Peça ao criador**: Contate o criador publicamente e compartilhe o endereço do destinatário, para que o pedido possa ser verificado por todos.
3. **Acompanhe a proposta**: Assim que o criador propuser o endereço, verifique se é exatamente o que vocês acordaram.
4. **Aceite após 48 horas**: O destinatário pode aceitar sem esperar pelo criador.
5. **Peça o bloqueio e verifique-o**: Sem o bloqueio, o criador ainda pode redirecionar as taxas depois.

Para verificar on-chain, abra o divisor de taxas do token no explorador de blocos e leia estes valores:

- `creatorRecipient()`: o endereço que recebe as taxas agora.
- `creatorRecipientLocked()`: `true` significa que esse endereço nunca pode mudar.
- `pendingCreatorRecipient()` e `pendingCreatorRecipientValidAfter()`: qualquer proposta aguardando seu timelock.

A página de trading do token também mostra um selo **Community** quando as taxas vão para alguém diferente do criador, e seu tooltip indica quando o destinatário está bloqueado.

Alguns limites a ter em mente:

- **Sem criador, sem redirecionamento**: Se um criador desapareceu e nunca propôs um redirecionamento, o fluxo de taxas permanece com ele. Uma comunidade ainda pode adotar o token socialmente, mas nem ela nem a Goton podem reivindicar essas taxas.
- **Divisores antigos não têm bloqueio**: Divisores de taxas implantados antes de o bloqueio existir podem redirecionar mas não bloquear, então o criador sempre pode redirecionar de novo. A página de Perfil mostra quando o bloqueio não está disponível.
- **Robinhood Chain**: Um token obtém seu divisor de taxas na graduação, então um redirecionamento só é possível depois disso.

---

## Garantias de Segurança e Proteção

- **A Liquidez é Intocável**: A liquidez permanece bloqueada permanentemente, no liquidity locker da Robinhood Chain e na fábrica de lançamento para os pools Uniswap v4 da Arc. Um Community Takeover não pode sacar, migrar ou drenar a liquidez do pool.
- **O Contrato do Token é Imutável**: As regras do token, o supply total (1 bilhão) e os parâmetros de transferência não podem ser modificados nem reconfigurados por ninguém.
- **A Parte do Protocolo é Separada**: Um redirecionamento muda apenas quem recebe a porção do criador. Não pode tocar na parte do protocolo nem nas outras porções da divisão.
- **Transparência Não Custodial**: Todos os resgates de taxas e redirecionamentos são registrados on-chain para verificação pública.
