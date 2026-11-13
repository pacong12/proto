# Proteções Anti-Snipe e Lançamento Justo

Uma das maiores frustrações no trading de cripto é perder oportunidades iniciais para bots sniper automatizados que acaparam a liquidez do pool em milissegundos.

A Goton incorpora regras de contrato inteligente integradas e codificadas de forma fixa durante os primeiros blocos de um lançamento, para garantir que os membros comuns da comunidade tenham uma chance justa de participar.

---

## Como Funciona

A Goton emprega uma **taxa de sniper dinâmica e decrescente** em sua arquitetura de bonding curve:

- No segundo exato do lançamento ($t=0$), aplica-se um imposto automático de 99% a qualquer bot predatório que tente execução instantânea.
- A taxa decai rapidamente nos 3 segundos seguintes ($t=1 \to 25\%$, $t=2 \to 3\%$, $t \ge 3 \to 0\%$).
- Em segundos, o trading padrão sem imposto é retomado normalmente para traders humanos.

---

## Garantias de Transparência e Segurança

- **Sem Whitelists ou Gatekeepers**: Qualquer pessoa com uma carteira Web3 pode participar assim que a janela de lançamento justo abrir.
- **Sem Interruptores de Admin**: Os limites anti-snipe são matematicamente codificados no contrato e expiram sem intervenção humana.
- **Venda Sempre Habilitada**: Não há bloqueios artificiais nem períodos de espera para sacar os tokens comprados pelos usuários.
