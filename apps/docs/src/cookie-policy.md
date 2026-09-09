# Cookie & Local Storage Policy

<Badge variant="graduated">Last Updated: September 2026</Badge>

<Card>
Proto is built on the core principle of decentralized privacy. We do not use tracking cookies, commercial ad trackers, or third-party profiling scripts.
</Card>

## 1. What Technologies We Use

Unlike traditional web services, Proto does not use persistent HTTP cookies to track your browsing habits across different websites. Instead, we use your browser's native client-side storage (`localStorage` and `sessionStorage`) strictly for necessary interface state.

## 2. Information Stored Locally

The following data keys may be stored in your browser's local memory:

| Storage Key                        | Purpose                                                                            | Duration                   |
| :--------------------------------- | :--------------------------------------------------------------------------------- | :------------------------- |
| `proto_privacy_policy_accepted_v1` | Remembers that you reviewed and accepted the Terms of Service & Privacy Policy     | Persistent (until cleared) |
| `theme`                            | Stores your preference for Dark Mode or Light Mode                                 | Persistent (until cleared) |
| `wagmi.wallet` / `wc@2:client`     | Stores your connected wallet session handle to avoid disconnecting on page refresh | Session / Persistent       |

## 3. No Third-Party Tracking

- **Zero Advertising Trackers**: We do not load Google Analytics, Facebook Pixels, or commercial behavioral trackers.
- **Zero Fingerprinting**: We do not fingerprint user hardware, browser canvas, or IP locations.
- **Zero Data Monetization**: No telemetry or user identifiers are collected, sold, or shared with data brokers.

## 4. How to Manage Local Storage

You can clear or disable local storage at any time through your browser settings:

- **Chrome / Brave**: Settings -> Privacy and security -> Site settings -> Cookies and site data.
- **Firefox**: Settings -> Privacy & Security -> Cookies and Site Data -> Clear Data.
- **Safari**: Preferences -> Privacy -> Manage Website Data.
