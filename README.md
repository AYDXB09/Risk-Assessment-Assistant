# GroupGuard - Risk Assessment Tool

A simple, professional web tool for WhatsApp group administrators to evaluate phone numbers and messages for risk.

## Setup Instructions

### 1. Deploy the Apps Script Backend

1. Go to [script.google.com](https://script.google.com) and create a new project.
2. Copy the contents of `appsscript/Code.gs` into the editor.
3. Click **Deploy** > **New deployment**.
4. Choose **Web app** as the type.
5. Set:
   - Execute as: **Me**
   - Who has access: **Anyone**
6. Click **Deploy** and authorize the app.
7. Copy the **Web app URL**.

### 2. Configure the Frontend

1. Open `script.js`.
2. Replace `YOUR_APPS_SCRIPT_WEB_APP_URL_HERE` with your deployed URL.
3. Save the file.

### 3. Host on GitHub Pages

1. Create a new GitHub repository.
2. Upload `index.html`, `style.css`, and `script.js` to the repository.
3. Go to **Settings** > **Pages**.
4. Select **Deploy from a branch** and choose `main` (or `master`).
5. Your site will be live at `https://yourusername.github.io/reponame/`.

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
