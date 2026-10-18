# Cookie 与本地存储政策

<Badge variant="graduated">最近更新：2026 年 10 月</Badge>

<Card>
Goton 使用浏览器存储保存必要的应用设置。Google Analytics 是唯一的可选技术：仅在您于 Cookie 横幅中点击接受后才会加载，且您可随时撤回同意。我们从不使用广告 Cookie。
</Card>

## 1. 我们使用的技术说明

- **浏览器存储（`localStorage`）**：严格必要的设置，例如主题、语言、钱包会话，以及您对 Cookie 横幅和服务条款的选择。这些数据不会发送给我们或任何第三方。
- **Google Analytics Cookie**：可选。仅在您于 Cookie 横幅中点击 **Accept** 后设置。
- **安全 Cookie（`cf_clearance`）**：严格必要。我们的托管与安全服务商 Cloudflare 会运行一个小型检测脚本（`/cdn-cgi/challenge-platform/…`），用于区分真人与机器人，并将结果保存在此 Cookie 中。它用于保护网站免受自动化滥用，不用于广告或跨站追踪；由于网站需要它才能保持可用，因此无需在横幅中选择即会设置。

## 2. 本地存储的数据项

| 存储标识键                            | 用途说明                                 | 留存周期                 |
| :------------------------------------ | :--------------------------------------- | :----------------------- |
| `proto_privacy_policy_accepted_v1`    | 记录您已同意服务条款与隐私政策           | 持久保存（直至手动清除） |
| `proto_cookie_consent_accepted_v1`    | 记录您接受或拒绝了统计分析 Cookie        | 持久保存（直至手动清除） |
| `proto_selected_locale_v1`            | 您的界面语言                             | 持久保存（直至手动清除） |
| `theme`                               | 深色模式 (Dark) 或浅色模式 (Light) 偏好  | 持久保存（直至手动清除） |
| `proto_wallet_*`、`wagmi.*`、`wc@2:*` | 已连接钱包的会话，避免刷新页面后断开连接 | 会话或持久存储           |

## 3. 可选的统计分析 Cookie

如果您接受统计分析，Google Analytics（`gtag.js`）会设置 `_ga` 和 `_ga_<id>` Cookie（最长 2 年），并向 Google 发送页面访问和设备数据，帮助我们了解应用的使用情况。如果您拒绝，或未作选择直接关闭横幅，Google Analytics 不会加载，也不会设置任何统计分析 Cookie。

- **零广告追踪**：不加载 Facebook Pixel 或其他广告与行为追踪代码。
- **零设备指纹**：不采集硬件信息、Canvas 指纹或位置信息。
- **零数据出售**：不向任何数据中介出售或共享数据。

## 4. 更改或撤回您的选择

您可随时点击应用页脚中的 **Cookie 设置**，查看并更改当前选择。撤回同意会立即停止 Google Analytics，并从浏览器中删除其 `_ga` Cookie。

您也可以在浏览器设置中清除本站的全部存储数据。
