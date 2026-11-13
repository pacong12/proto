# Perfis e Identidade

Toda carteira na Goton tem um perfil público e um **pseudônimo** embutido, então as pessoas têm um nome e uma página desde sua primeira operação — sem cadastro. Você pode personalizar seu perfil sempre que sua carteira estiver conectada.

---

## Seu Pseudônimo

No momento em que uma carteira aparece, a Goton lhe dá um nome de usuário determinístico derivado de seu endereço — um adjetivo, um material e um arquétipo, mais uma etiqueta curta do endereço, por exemplo **AeroBrassGriffin#79c8**. Dele surgem três formas, todas apontando para a mesma carteira:

- **Nome de exibição** — `AeroBrassGriffin#79c8`
- **Handle** — `@AeroBrassGriffin#79c8`
- **Slug** — `aerobrassgriffin-79c8` (a forma segura para URL)

Como é derivado do endereço, seu pseudônimo **nunca muda** e é o mesmo em todo o app. É também o que seu [link de indicação](/pt/protocol/referrals) usa.

---

## URLs de Perfil

Um perfil abre a partir de vários caminhos equivalentes, todos resolvem para a mesma carteira:

- `/u/<endereço>`, `/profile/<endereço>`, `/user/<endereço>`, `/@<endereço>`
- `/<usuário>` — o slug, ex. `/aerobrassgriffin-79c8`

Uma URL com endereço é reescrita para a forma limpa `/<usuário>`. Um nome, slug ou handle digitado é resolvido de volta ao seu endereço, então compartilhar um nome funciona tão bem quanto compartilhar um endereço.

---

## Editando seu Perfil

No **seu próprio** perfil (com sua carteira conectada), **Edit Profile** permite personalizar sua identidade pública de criador:

| Campo                | Observações                                                  |
| :------------------- | :----------------------------------------------------------- |
| **Banner de capa**   | Uma imagem enviada do seu dispositivo                        |
| **Foto de perfil**   | Um avatar enviado do seu dispositivo                         |
| **Nome de exibição** | Até 32 caracteres; sobrepõe o pseudônimo publicamente        |
| **Bio**              | Uma descrição curta — estratégias, seu alpha, qualquer coisa |
| **X (Twitter)**      | Seu handle                                                   |
| **Telegram**         | Seu handle                                                   |

As imagens enviadas são armazenadas no IPFS; o resto do perfil é salvo para sua carteira. Você também pode **apagar** seus dados sociais para limpar os campos personalizados e voltar ao pseudônimo.

---

## O que um Perfil Mostra

Todo perfil — o seu ou o de qualquer um — reúne a atividade daquela carteira em um só lugar:

- **[Reputação do Criador](/pt/protocol/reputation)** — seu histórico de lançamentos.
- **[Portfólio](/pt/protocol/portfolio)** — desempenho e posições atuais.
- **Posts & Calls** — sua atividade no [feed](/pt/protocol/social).
- **Created Tokens** — os tokens que a carteira lançou.
- **[Dividendos de Holders e Vesting](/pt/protocol/dividends-and-vesting)** — recompensas resgatáveis (perfil próprio).
- **[Convide amigos](/pt/protocol/referrals)** — seu link de convite (perfil próprio).

---

## Notas

- Um perfil é **público** e construído a partir da atividade on-chain mais os campos opcionais que você definir. Não expõe nada além do que a cadeia e suas próprias edições fornecem.
- Não existe conta, e-mail ou senha — sua carteira _é_ sua identidade.
