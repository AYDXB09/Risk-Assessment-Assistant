# GroupGuard - Risk Assessment Tool

A simple, professional web tool for WhatsApp group administrators to evaluate phone numbers and messages for risk.

https://aydxb09.github.io/Risk-Assessment-Assistant/

## Features

- **Phone Audit**: Validates numbers via NumVerify API. Returns country, carrier, line type, and risk level.
- **Message Audit**: Local keyword analysis for scam, phishing, and impersonation detection.

## Files

| File | Purpose |
|------|---------|
| `index.html` | Main HTML structure |
| `style.css` | Styling (dark theme, minimal) |
| `script.js` | Frontend logic and API calls |
| `appsscript/Code.gs` | Apps Script backend for NumVerify |

## Notes

- The NumVerify API key is embedded in the Apps Script for security (not exposed in frontend).
- Message analysis runs entirely in the browser.
- No user data is stored.

