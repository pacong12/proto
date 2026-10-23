# Cookie & Local Storage Policy

<Badge variant="graduated">Last Updated: October 2026</Badge>

<Card>
Goton uses browser storage for essential app settings. Google Analytics is the only optional technology: it loads only after you accept it in the cookie banner, and you can withdraw that consent at any time. We never use advertising cookies.
</Card>

## 1. What Technologies We Use

- **Browser storage (`localStorage`)**: strictly necessary settings such as your theme, language, wallet session and your answers to the cookie banner and the terms. It is not sent to us or to anyone else.
- **Google Analytics cookies**: optional. Set only after you click **Accept** in the cookie banner.
- **Security cookie (`cf_clearance`)**: strictly necessary. Our hosting and security provider, Cloudflare, runs a small check script (`/cdn-cgi/challenge-platform/…`) to tell people from bots and stores the result in this cookie. It protects the site from automated abuse, is not used for advertising or tracking across sites, and is set without a banner choice because the site needs it to stay available.

## 2. Information Stored Locally

| Storage Key                           | Purpose                                                                  | Duration                   |
| :------------------------------------ | :----------------------------------------------------------------------- | :------------------------- |
| `proto_privacy_policy_accepted_v1`    | Remembers that you accepted the Terms of Service & Privacy Policy        | Persistent (until cleared) |
| `proto_cookie_consent_accepted_v1`    | Remembers whether you accepted or declined analytics cookies             | Persistent (until cleared) |
| `proto_selected_locale_v1`            | Your interface language                                                  | Persistent (until cleared) |
| `theme`                               | Your preference for Dark Mode or Light Mode                              | Persistent (until cleared) |
| `proto_wallet_*`, `wagmi.*`, `wc@2:*` | Your connected wallet session, so a page refresh does not disconnect you | Session / Persistent       |

## 3. Optional Analytics Cookies

If you accept analytics, the app loads Google Tag Manager (`gtm.js`) and Google Analytics (`gtag.js`). Google Analytics sets the cookies `_ga` and `_ga_<id>` (up to 2 years) and sends page-view and device data to Google, so we can understand how the app is used. If you decline, or close the banner without choosing, Google Analytics is not loaded and no analytics cookies are set.

- **No advertising trackers**: we do not load Facebook Pixel or other advertising or behavioral trackers.
- **No fingerprinting**: we do not fingerprint your hardware, browser canvas, or location.
- **No data sales**: no data is sold or shared with data brokers.

## 4. Changing or Withdrawing Your Choice

Click **Cookie settings** in the footer of the app at any time to see your current choice and change it. Withdrawing consent stops Google Analytics immediately and deletes its `_ga` cookies from your browser.

You can also clear all browser storage for the site in your browser settings:

- **Chrome / Brave**: Settings -> Privacy and security -> Site settings -> Cookies and site data.
- **Firefox**: Settings -> Privacy & Security -> Cookies and Site Data -> Clear Data.
- **Safari**: Preferences -> Privacy -> Manage Website Data.
