/* GroupGuard — Risk Assessment Assistant
 * 100% free, no AI. Phone audit tries the live NumVerify/APILayer backend
 * first, then transparently falls back to local heuristic analysis so the
 * tool always works. Message audit is fully local. */

document.addEventListener('DOMContentLoaded', () => {
    // Point this at your deployed Apps Script Web App.
    // If it is missing/unreachable/misconfigured, local analysis takes over automatically.
    const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbw6V70Bdin5d50vekH4IxKaez514O6wWvo0-vGsFAX8NQVYhggih4BP_uohanV6cU8m/exec';

    // ---------- Tabs ----------
    const tabs = document.querySelectorAll('.tab-btn');
    const contents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(`${tab.dataset.tab}-tab`).classList.add('active');
        });
    });

    // ---------- Copy buttons ----------
    document.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const text = document.getElementById(btn.dataset.target).innerText;
            navigator.clipboard.writeText(text).then(() => {
                const icon = btn.querySelector('i');
                icon.className = 'fa-solid fa-check';
                setTimeout(() => icon.className = 'fa-regular fa-copy', 1500);
            });
        });
    });

    // ---------- Helpers ----------
    const fetchWithTimeout = (url, ms) => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), ms);
        return fetch(url, { signal: controller.signal })
            .finally(() => clearTimeout(timer));
    };

    const setBtnLoading = (btn, loading, loadingText = 'Checking…', idleText = 'Analyze') => {
        btn.disabled = loading;
        btn.textContent = loading ? loadingText : idleText;
        btn.classList.toggle('loading', loading);
    };

    // ---------- Phone Analysis ----------
    const phoneInput = document.getElementById('phone-input');
    const analyzePhoneBtn = document.getElementById('analyze-phone-btn');

    analyzePhoneBtn.addEventListener('click', async () => {
        const rawNumber = phoneInput.value.trim();
        if (!rawNumber) { phoneInput.focus(); return; }

        const formatCheck = validateLocalFormat(rawNumber);
        if (!formatCheck.ok) {
            displayPhoneResult('ERROR', formatCheck.message, '');
            return;
        }

        setBtnLoading(analyzePhoneBtn, true);
        phoneInput.disabled = true;

        try {
            const response = await fetchWithTimeout(
                `${APPS_SCRIPT_URL}?action=phone&number=${encodeURIComponent(rawNumber)}`, 20000
            );
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();

            if (data.error) {
                // Live service answered with an error → graceful fallback.
                fallbackLocal(rawNumber, data.error);
            } else {
                displayPhoneResult(data.riskLevel, data.report, 'Live lookup');
            }
        } catch (err) {
            fallbackLocal(rawNumber, `Live service unavailable (${err.name === 'AbortError' ? 'timeout' : err.message}).`);
        } finally {
            setBtnLoading(analyzePhoneBtn, false);
            phoneInput.disabled = false;
        }
    });

    function fallbackLocal(rawNumber, reason) {
        const local = analyzePhoneLocally(rawNumber);
        // Prepend a note so admins know the live lookup failed but the tool still worked.
        const report = `[Live lookup failed: ${reason}]\nFalling back to local heuristic analysis.\n\n${local.report}`;
        displayPhoneResult(local.riskLevel, report, 'Local fallback');
    }

    function displayPhoneResult(level, report, source) {
        const container = document.getElementById('phone-results');
        const badge = document.getElementById('phone-risk-badge');
        const pre = document.getElementById('phone-report-text');
        const sourceEl = document.getElementById('phone-source');

        container.classList.remove('hidden');
        badge.innerText = level;
        pre.innerText = report;

        badge.className = 'status-badge';
        if (level === 'HIGH' || level === 'ERROR') badge.classList.add('badge-high');
        else if (level === 'MEDIUM') badge.classList.add('badge-medium');
        else badge.classList.add('badge-low');

        sourceEl.textContent = source || '';
        sourceEl.classList.toggle('hidden', !source);
    }

    /* ----- Local phone heuristics (redundancy layer) ----- */
    function validateLocalFormat(raw) {
        const digits = raw.replace(/\D/g, '');
        if (!digits) return { ok: false, message: 'Please enter a phone number.' };
        if (digits.length < 7 || digits.length > 15) {
            return { ok: false, message: `A phone number must be 7–15 digits (got ${digits.length}).` };
        }
        return { ok: true, digits };
    }

    function analyzePhoneLocally(raw) {
        const { ok, digits, message } = validateLocalFormat(raw);
        if (!ok) return { riskLevel: 'ERROR', recommendation: 'MANUAL CHECK', report: message || 'Invalid input.' };

        const notes = [];
        let score = 0;

        // Basic sanity
        if (digits.length < 10) { score += 2; notes.push('Number is unusually short.'); }
        if (digits.length > 13) { notes.push('Number is unusually long.'); }

        // Country code recognition (common prefixes)
        const cc = leadingCountryCode(digits);
        if (cc) notes.push(`Leading prefix suggests country code ${cc.code} (${cc.name}).`);
        else { score += 2; notes.push('Leading digits do not match any common country code.'); }

        // Pattern risk: repeated / sequential / repetitive digits
        const allSame = /^(\d)\1+$/.test(digits);
        const sequential = /0123456789|1234567890|9876543210|1098765432/.test(digits);
        const repeatedBlock = /(\d)\1{4,}/.test(digits);            // 5+ same digits in a row
        const alternating = /^(\d\d)\1{3,}$/.test(digits);          // 1212121212

        if (allSame || alternating) { score += 3; notes.push('Number uses a repetitive digit pattern typical of fake numbers.'); }
        else if (sequential) { score += 2; notes.push('Number contains a sequential digit pattern.'); }
        else if (repeatedBlock) { score += 1; notes.push('Number contains a long run of repeated digits.'); }

        // Known risky/reserved prefixes (US-based examples)
        const expensive = /^1?900|^1?976/.test(digits);
        if (expensive) { score += 3; notes.push('Number matches a known premium-rate (900/976) range.'); }

        // Decide
        let riskLevel, recommendation;
        if (score >= 4) { riskLevel = 'HIGH'; recommendation = 'BLOCK'; }
        else if (score >= 2) { riskLevel = 'MEDIUM'; recommendation = 'MONITOR'; }
        else { riskLevel = 'LOW'; recommendation = 'ALLOW'; }

        if (notes.length === 0) notes.push('No obvious risk signatures detected.');

        const report = [
            `Risk level: ${riskLevel}`,
            `Admin recommendation: ${recommendation}`,
            `Carrier: Not available (offline analysis)`,
            `Line type: Not available (offline analysis)`,
            `Notes on uncertainty: ${notes.join(' ')}`
        ].join('\n');

        return { riskLevel, recommendation, report };
    }

    // Small table of common E.164 country codes for offline hinting.
    const CC_TABLE = [
        { code: '93', name: 'Afghanistan' }, { code: '1', name: 'United States / Canada' },
        { code: '7', name: 'Russia / Kazakhstan' }, { code: '20', name: 'Egypt' },
        { code: '27', name: 'South Africa' }, { code: '30', name: 'Greece' },
        { code: '31', name: 'Netherlands' }, { code: '32', name: 'Belgium' },
        { code: '33', name: 'France' }, { code: '34', name: 'Spain' },
        { code: '36', name: 'Hungary' }, { code: '39', name: 'Italy' },
        { code: '40', name: 'Romania' }, { code: '41', name: 'Switzerland' },
        { code: '43', name: 'Austria' }, { code: '44', name: 'United Kingdom' },
        { code: '45', name: 'Denmark' }, { code: '46', name: 'Sweden' },
        { code: '47', name: 'Norway' }, { code: '48', name: 'Poland' },
        { code: '49', name: 'Germany' }, { code: '51', name: 'Peru' },
        { code: '52', name: 'Mexico' }, { code: '54', name: 'Argentina' },
        { code: '55', name: 'Brazil' }, { code: '56', name: 'Chile' },
        { code: '57', name: 'Colombia' }, { code: '60', name: 'Malaysia' },
        { code: '61', name: 'Australia' }, { code: '62', name: 'Indonesia' },
        { code: '63', name: 'Philippines' }, { code: '64', name: 'New Zealand' },
        { code: '65', name: 'Singapore' }, { code: '66', name: 'Thailand' },
        { code: '81', name: 'Japan' }, { code: '82', name: 'South Korea' },
        { code: '84', name: 'Vietnam' }, { code: '86', name: 'China' },
        { code: '90', name: 'Turkey' }, { code: '91', name: 'India' },
        { code: '92', name: 'Pakistan' }, { code: '94', name: 'Sri Lanka' },
        { code: '95', name: 'Myanmar' }, { code: '971', name: 'UAE' },
        { code: '972', name: 'Israel' }, { code: '966', name: 'Saudi Arabia' },
        { code: '880', name: 'Bangladesh' }, { code: '234', name: 'Nigeria' },
        { code: '233', name: 'Ghana' }, { code: '254', name: 'Kenya' }
    ];

    function leadingCountryCode(digits) {
        for (let len = 3; len >= 1; len--) {
            const prefix = digits.slice(0, len);
            const hit = CC_TABLE.find(c => c.code === prefix);
            if (hit) return hit;
        }
        return null;
    }

    // ---------- Message Analysis (local heuristics) ----------
    const messageInput = document.getElementById('message-input');
    const analyzeMessageBtn = document.getElementById('analyze-message-btn');

    analyzeMessageBtn.addEventListener('click', () => {
        const text = messageInput.value.trim();
        if (!text) { messageInput.focus(); return; }
        displayMessageResult(...analyzeMessage(text));
    });

    function analyzeMessage(text) {
        const lower = text.toLowerCase();

        // Rules: { category, pattern (regex) or keywords[], rule, severity }
        const keywordRules = [
            {
                category: 'SCAM / PHISHING',
                keywords: ['crypto', 'investment', 'bitcoin', 'usdt', 'forex', 'mining', 'binance',
                    'double your money', 'guaranteed profit', 'passive income', 'get rich'],
                rule: 'No unsolicited investment or crypto schemes.',
                severity: 'HIGH'
            },
            {
                category: 'SCAM / PHISHING',
                keywords: ['otp', 'verification code', 'send me the code', 'account access',
                    'confirm your password', 'click the link', 'verify your account', 'reset your password'],
                rule: 'No requests for OTPs or account access.',
                severity: 'HIGH'
            },
            {
                category: 'SCAM / PHISHING',
                keywords: ['urgent', 'hurry', 'act now', 'immediate', 'emergency', 'money transfer',
                    'wire transfer', 'western union', 'paypal friend', 'send money'],
                rule: 'No urgent financial requests.',
                severity: 'MEDIUM'
            },
            {
                category: 'IMPERSONATION',
                keywords: ['whatsapp support', 'official staff', 'admin team', 'customer service',
                    'group moderator', 'telegram support', 'official account'],
                rule: 'No impersonation of authority.',
                severity: 'HIGH'
            },
            {
                category: 'POLICY VIOLATION',
                keywords: ['t.me/', 'chat.whatsapp.com/', 'join group', 'invite link', 'referral link'],
                rule: 'No unauthorized external group links.',
                severity: 'MEDIUM'
            },
            {
                category: 'ADULT / ADULT SERVICES',
                keywords: ['sex', 'nude', 'porn', 'onlyfans', 'escort', 'hookup'],
                rule: 'No adult content or services.',
                severity: 'HIGH'
            },
            {
                category: 'SPAM',
                keywords: ['congratulations', 'you have won', 'you won', 'free gift', 'claim your prize',
                    'lucky winner', 'limited time offer', 'cash prize'],
                rule: 'No unsolicited prize or giveaway content.',
                severity: 'MEDIUM'
            }
        ];

        const patternRules = [
            {
                category: 'SCAM / PHISHING',
                pattern: /\b0x[a-fA-F0-9]{20,}\b|\b(?:T|tron)[A-Za-z0-9]{30,}\b/,
                rule: 'Crypto wallet addresses detected.',
                severity: 'HIGH'
            },
            {
                category: 'SCAM / PHISHING',
                pattern: /\b(?:\$\s?\d{2,}(?:,\d{3})*|\d{1,3}(?:,\d{3})*\s?(?:USD|USDT|GBP|EUR))\b/,
                rule: 'Large monetary amounts mentioned.',
                severity: 'MEDIUM'
            },
            {
                category: 'SCAM / PHISHING',
                pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/,
                rule: 'Email address shared for contact.',
                severity: 'MEDIUM'
            },
            {
                category: 'POLICY VIOLATION',
                pattern: /(?:https?:\/\/|www\.)[^\s]+/gi,
                rule: 'External hyperlink(s) present.',
                severity: 'MEDIUM'
            },
            {
                category: 'SPAM',
                pattern: /\b(\d{10,})|[\s]\+\d{7,}\b/,
                rule: 'Embedded phone number(s).',
                severity: 'LOW'
            }
        ];

        let score = 0;
        let hits = 0;
        let detectedCategory = null;
        let worstSeverity = 'LOW';
        const flaggedExcerpts = [];
        const rulesBroken = [];

        const SEVERITY_WEIGHT = { HIGH: 3, MEDIUM: 2, LOW: 1 };

        // Word-boundary keyword check to reduce false positives.
        keywordRules.forEach(r => {
            let matched = false;
            r.keywords.forEach(k => {
                const re = new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');
                if (re.test(lower)) {
                    matched = true;
                    flaggedExcerpts.push(`"${k}"`);
                }
            });
            if (matched) {
                hits++;
                score += SEVERITY_WEIGHT[r.severity];
                rulesBroken.push(r.rule);
                if (SEVERITY_WEIGHT[r.severity] > SEVERITY_WEIGHT[worstSeverity]) worstSeverity = r.severity;
                if (!detectedCategory || SEVERITY_WEIGHT[r.severity] > SEVERITY_WEIGHT[worstSeverity]) {
                    detectedCategory = r.category;
                }
            }
        });

        patternRules.forEach(r => {
            const matches = text.match(r.pattern);
            if (matches) {
                hits++;
                score += SEVERITY_WEIGHT[r.severity];
                flaggedExcerpts.push(`[${matches[0].slice(0, 30)}${matches[0].length > 30 ? '…' : ''}]`);
                rulesBroken.push(r.rule);
                if (SEVERITY_WEIGHT[r.severity] > SEVERITY_WEIGHT[worstSeverity]) worstSeverity = r.severity;
                if (!detectedCategory || SEVERITY_WEIGHT[r.severity] > SEVERITY_WEIGHT[worstSeverity]) {
                    detectedCategory = r.category;
                }
            }
        });

        // Message-size heuristic (flooding)
        if (text.length > 500 && hits === 0) {
            hits++;
            score += 1;
            flaggedExcerpts.push('Excessive message length');
            rulesBroken.push('Potential spam or flooding.');
        }

        let classification, confidence, action;
        if (hits === 0) {
            classification = 'SAFE';
            confidence = 'HIGH';
            action = 'IGNORE';
        } else {
            confidence = score >= 3 ? 'HIGH' : (score >= 2 ? 'MEDIUM' : 'LOW');
            if (worstSeverity === 'HIGH') {
                classification = detectedCategory || 'SCAM / PHISHING';
                action = (classification === 'IMPERSONATION' || classification === 'SCAM / PHISHING') ? 'REMOVE USER' : 'DELETE';
            } else {
                classification = detectedCategory || 'POLICY VIOLATION';
                action = 'WARN';
            }
        }

        const report = [
            `Classification: ${classification}`,
            `Admin action recommendation: ${action}`,
            `Confidence level: ${confidence}`,
            `Flagged excerpts: ${[...new Set(flaggedExcerpts)].join(', ') || 'None'}`,
            `Rule analysis: ${[...new Set(rulesBroken)].join(' ') || 'None implicated.'}`
        ].join('\n');

        return [classification, report];
    }

    function displayMessageResult(classification, report) {
        const container = document.getElementById('message-results');
        const badge = document.getElementById('message-risk-badge');
        const pre = document.getElementById('message-report-text');
        const sourceEl = document.getElementById('message-source');

        container.classList.remove('hidden');
        badge.innerText = classification;
        pre.innerText = report;

        badge.className = 'status-badge';
        if (classification === 'SAFE') badge.classList.add('badge-safe');
        else if (classification.includes('SCAM') || classification.includes('IMPERSONATION') || classification.includes('ADULT')) {
            badge.classList.add('badge-high');
        } else if (classification.includes('VIOLATION') || classification.includes('SPAM')) {
            badge.classList.add('badge-medium');
        } else {
            badge.classList.add('badge-medium');
        }

        sourceEl.textContent = 'Local analysis';
        sourceEl.classList.remove('hidden');
    }
});
