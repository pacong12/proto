# Alertas de Preço e Market Cap

Defina um alerta em qualquer token e a Goton avisa você quando ele atinge seu alvo. Os alertas são vinculados à sua carteira e verificados no servidor, então continuam monitorando mesmo com a aba fechada e soam na próxima vez que você abrir o app.

---

## Criando um Alerta

1. Abra a página de **trade** de um token.
2. Clique no **sino de alerta** no cabeçalho de trading para abrir o popover de alertas.
3. Escolha:
   - **O que monitorar** — **Market cap** ou **Preço** (ambos em USD).
   - **Direção** — **Acima** ou **Abaixo** do seu limite.
   - **Limite** — o valor em USD a ser cruzado.
4. Crie-o. O alerta precisa de uma carteira conectada, pois é armazenado em nome da sua carteira.

Você pode manter vários alertas no mesmo token — por exemplo "preço acima de $0,01" e "market cap abaixo de $50K" ao mesmo tempo.

---

## Como os Alertas Soam

- A Goton verifica seus alertas abertos **no servidor**, continuamente, contra o preço e market cap mais recentes de cada token — então um alerta continua monitorando mesmo com sua aba fechada.
- Um alerta soa quando o valor cruza em sua direção: um alerta **acima** em ou sobre o limite, um **abaixo** em ou sob ele.
- Quando você abre o app, ele mostra uma notificação para cada alerta recém-disparado, e o popover marca os disparados com um ponto. Um alerta disparado para de monitorar — crie um novo para monitorar de novo.

---

## Gerenciando Alertas

- O popover lista seus alertas abertos e disparados para o token.
- Remova qualquer alerta da lista a qualquer momento.
- Os alertas são por carteira: conecte a mesma carteira para vê-los novamente em outro dispositivo.

---

## Notas

- Os limites são valores em **USD**. Um alerta de market cap monitora o market cap USD (fully-diluted) do token; um de preço monitora seu preço USD.
- Os alertas são apenas uma **notificação** — nunca realizam uma operação. Para agir automaticamente a um preço, use as [ordens Limit, Take-Profit e Stop-Loss](/pt/protocol/advanced-orders).
