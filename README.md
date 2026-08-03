# GroupGuard - Risk Assessment Assistant

A free, **no-AI**, standalone web tool for WhatsApp group administrators to quickly evaluate phone numbers and messages for risk.

Live demo: [https://aydxb09.github.io/Risk-Assessment-Assistant/](https://aydxb09.github.io/Risk-Assessment-Assistant/)

## Features

- **Phone Audit**: Validates numbers against the NumVerify (APILayer) API — returns carrier, line type, and country.
  - **Built-in redundancy**: if the live API is unavailable, misconfigured, out of quota, or times out, the tool transparently **falls back to local heuristic analysis** so it *always* produces a result. The report tells you which source was used.
- **Message Audit**: Fully local, browser-side heuristic analysis for scam, phishing, impersonation, policy violations, spam, and adult content. No data ever leaves the device.
- **No AI, no subscription, no hidden costs** — message analysis costs nothing, and phone lookup works on a free APILayer tier.

## Files

| File | Purpose |
|------|---------|
| `index.html` | Main HTML structure |
| `style.css` | Styling (dark theme, responsive) |
| `script.js` | Frontend logic, live-API call with local fallback |
| `appsscript/Code.gs` | Optional Apps Script backend proxy for NumVerify |

## Setup

The tool works out of the box for **Message Audit** (100% local). For **live phone lookup**, do the following.

### 1. (Optional) Deploy the Apps Script backend

1. Go to [script.google.com](https://script.google.com) and create a new project.
2. Copy the contents of `appsscript/Code.gs` into the editor.
3. Replace `NUMVERIFY_API_KEY` with your own key (see step 3).
4. Click **Deploy** > **New deployment** > **Web app**.
5. Set: Execute as **Me**, Who has access **Anyone**.
6. Deploy, authorize, and copy the **Web app URL**.

### 2. (Optional) Configure the frontend

Open `script.js` and replace `APPS_SCRIPT_URL` with your deployed web app URL.

> If you skip this step, the live lookup simply fails and the tool automatically uses local analysis — nothing else breaks.

### 3. Get a (free) API key

1. Create a free account at [apilayer.com](https://apilayer.com/marketplace/number_verification-api).
2. Copy your API key and paste it into `appsscript/Code.gs`.

> **Security warning:** the committed `Code.gs` contains a placeholder, not a real key. Never commit a real API key to a public repository. The Apps Script you already deployed keeps the live lookup working — only edit the key in your own Apps Script project, not in this repo.

### 4. Host on GitHub Pages

1. Upload `index.html`, `style.css`, and `script.js` to your repository.
2. Go to **Settings** > **Pages** > **Deploy from a branch** and select `main`.
3. Your site is live at `https://yourusername.github.io/reponame/`.

## Notes

- Phone numbers and messages are analyzed on demand. **No user data is stored or logged.**
- Message analysis is entirely local. For phone analysis, only the number you enter is sent to the lookup service.
- The tool is designed to degrade gracefully: it will never be a dead end because the live service failed.
