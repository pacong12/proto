# Convide Amigos e Indicações

Todo perfil tem um cartão **Convide amigos** com um link de convite pessoal. Quando alguém abre a Goton pelo seu link e conecta uma carteira, essa carteira é creditada a você. A atribuição é **off-chain e de primeiro toque (first-touch)**, então não custa gas nem exige assinatura.

---

## Seu Link de Convite

Abra seu próprio perfil e encontre o cartão **Convide amigos**. Ele mostra:

- **Seu link de convite** — `https://goton.fun/?ref=<seu-usuário>`, usando o nome de usuário da sua carteira (ex.: `aerobrassgriffin-79c8`). Um endereço de carteira também funciona; o nome de usuário só é mais fácil de ler e compartilhar.
- **Referred** — quantas carteiras você já indicou.
- **Copiar link** — copia o link para sua área de transferência.

O mesmo código `?ref=` é adicionado automaticamente sempre que você compartilha algo de dentro da Goton — veja [Para onde seu link viaja](#para-onde-seu-link-viaja).

---

## Como a Atribuição Funciona

- **Primeiro toque.** O primeiro link de convite que um visitante abre é o que conta. Ele é lembrado no navegador dele até conectar uma carteira, e um link posterior **não** o sobrescreve.
- **Uma carteira, uma vez.** Quando o visitante conecta uma carteira, ela é atribuída ao seu link uma única vez. Reconectar, ou abrir outro link depois, não muda nada.
- **Sem auto-indicação.** Abrir seu próprio link e conectar sua própria carteira não registra nada.
- **Nome de usuário ou endereço.** Um `?ref=` que é um nome de usuário é resolvido de volta à carteira do indicador antes de ser registrado; um indicador que nunca operou ou lançou pode não ser resolvido por nome, caso em que um link com endereço é a forma mais confiável.

Como a atribuição é de primeiro toque e off-chain, o pior que um abusador pode fazer é inflar uma contagem cosmética. A contagem é informativa hoje — ainda não há recompensas on-chain associadas.

---

## Para onde seu link viaja

Seu código de indicação é adicionado aos links que você compartilha de dentro do app, então compartilhar sua atividade também expande sua rede:

| Ação                                   | O que é compartilhado                                             |
| :------------------------------------- | :---------------------------------------------------------------- |
| **Compartilhar perfil**                | Um link para o perfil, levando o `?ref` da sua carteira conectada |
| **Compartilhar cartão PnL**            | O link do seu cartão `/pnl/…` com `?ref`                          |
| **Compartilhar no X** de token / trade | O link da página do token com `?ref`                              |
| **Compartilhar um call** ou post       | O link `/post/…` com `?ref`                                       |

Em todos os casos, o código é o da carteira **conectada** — a pessoa que compartilha — então compartilhar o perfil de outra pessoa ainda credita você.

---

## FAQ

**Ganho algo com indicações hoje?** Ainda não. A contagem é cosmética por enquanto. Quando recompensas forem introduzidas, espera-se que a atribuição passe para um gatilho on-chain assinado (como o primeiro lançamento ou trade do indicado).

**Posso mudar quem me indicou?** Não. O primeiro toque é permanente assim que uma carteira se conecta.

**Meu link usa meu nome de usuário — ele é estável?** O nome de usuário é derivado do seu endereço de carteira, então nunca muda.
