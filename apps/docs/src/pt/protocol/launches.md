# Lançando um Token

Criar seu próprio token na Goton leva menos de dois minutos e não requer nenhuma experiência em programação ou desenvolvimento blockchain.

---

## Guia de Lançamento Passo a Passo

### 1. Conecte sua Carteira

Vá para [%APP_HOST%](%APP_URL%) e clique em **Connect Wallet** na barra de navegação superior. Garanta que sua carteira esteja conectada à **Robinhood Chain** (Chain ID: 4663).

### 2. Vá para a Página Create

Clique em **Create** ou navegue diretamente para `/launchpad/create`.

### 3. Preencha os Detalhes do Token

Insira as informações essenciais do seu token:

- **Nome do Token**: O nome completo (ex.: `Robin Gold`).
- **Símbolo (Ticker)**: De 3 a 6 letras maiúsculas (ex.: `GOLD`).
- **Descrição**: Uma breve introdução descrevendo seu token, propósito ou visão da comunidade.
- **Logo do Token**: Envie um arquivo de imagem (PNG, JPG, SVG ou WebP). A Goton comprime automaticamente sua imagem e a fixa com segurança no IPFS.

### 4. Adicione Links da Comunidade (Opcional)

Você pode incluir links oficiais para que traders verifiquem e entrem no seu projeto:

- URL do site
- Handle oficial do X (Twitter)
- Link do Telegram da comunidade

### 5. Compra Inicial (Opcional)

Se desejar comprar uma alocação inicial como criador ao preço de lançamento, insira o valor (ETH na Robinhood Chain, USDC na Arc). Uma compra inicial também é o que lista um lançamento no [Memestock](/pt/protocol/social#memestock), junto com uma descrição escrita.

### 6. Confirme e Faça o Deploy

Clique em **Launch Token** e confirme a transação na sua carteira:

- **Taxa de Lançamento**: Fixa em `0.0005 ETH` na Robinhood Chain, ou `0 USDC` na Arc Network (lançamento grátis com mínimo de 4,50 USDC de pré-compra).
- Assim que a transação confirma, seu token está ativo, verificável e negociável imediatamente!

---

## O que Acontece com o Supply do Token?

Todo token criado na Goton tem um supply estritamente fixo:

- **Supply Total**: Exatamente **1.000.000.000 tokens** (1 bilhão).
- **Decimais**: 18.
- **Sem Minting**: Não existe função para mintar tokens adicionais após o lançamento.
- **Sem Pausa**: O token não pode ser congelado nem colocado em lista negra.

---

## Graduação

- **Robinhood Chain**: um token opera em sua bonding curve até a curva arrecadar **4.2 ETH**. A curva então fecha, e seu ETH e tokens restantes passam para um pool Uniswap v4 cuja liquidez fica bloqueada para sempre. A graduação é permissionless: o keeper da Goton a aciona em cerca de 30 segundos, e se alguém operar primeiro, sua transação a aciona.
- **Arc Network**: não há curva. Um token opera em seu pool Uniswap v4 bloqueado desde o primeiro bloco.

Após a graduação, o token continua operando na mesma página; o app roteia as operações para o pool.
