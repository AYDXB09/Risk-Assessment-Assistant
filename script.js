document.addEventListener('DOMContentLoaded', () => {
    const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwv73Mnjo2HeQHFVE7q-y_RxhIZkAmyyrB9o8-VlD3zuopzaSnwGlsVlljpWo6dZdgW/exec';

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

    // --- Copy Button Logic ---
    document.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.dataset.target;
            const text = document.getElementById(targetId).innerText;
            navigator.clipboard.writeText(text).then(() => {
                const icon = btn.querySelector('i');
                icon.className = 'fa-solid fa-check';
                setTimeout(() => icon.className = 'fa-regular fa-copy', 1500);
            });
        });
    });

    // --- Phone Analysis ---
    const phoneInput = document.getElementById('phone-input');
    const analyzePhoneBtn = document.getElementById('analyze-phone-btn');

    analyzePhoneBtn.addEventListener('click', async () => {
        const rawNumber = phoneInput.value.trim();
        if (!rawNumber) return;

        analyzePhoneBtn.disabled = true;
        analyzePhoneBtn.textContent = 'Checking...';

        try {
            const response = await fetch(`${APPS_SCRIPT_URL}?action=phone&number=${encodeURIComponent(rawNumber)}`);
            const data = await response.json();

            if (data.error) {
                displayPhoneResult('ERROR', data.error);
            } else {
                displayPhoneResult(data.riskLevel, data.report);
            }
        } catch (err) {
            displayPhoneResult('ERROR', `Connection failed.\nDetails: ${err.message}`);
        } finally {
            analyzePhoneBtn.disabled = false;
            analyzePhoneBtn.textContent = 'Analyze';
        }
    });

    function displayPhoneResult(level, report) {
        const container = document.getElementById('phone-results');
        const badge = document.getElementById('phone-risk-badge');
        const pre = document.getElementById('phone-report-text');

        container.classList.remove('hidden');
        badge.innerText = level;
        pre.innerText = report;

        badge.className = 'status-badge';
        if (level === 'HIGH' || level === 'ERROR') badge.classList.add('badge-high');
        else if (level === 'MEDIUM') badge.classList.add('badge-medium');
        else badge.classList.add('badge-low');
    }

    // --- Message Analysis (Local Heuristics) ---
    const messageInput = document.getElementById('message-input');
    const analyzeMessageBtn = document.getElementById('analyze-message-btn');

    analyzeMessageBtn.addEventListener('click', () => {
        const text = messageInput.value.trim();
        if (!text) return;
        analyzeMessage(text);
    });

    function analyzeMessage(text) {
        const lowerText = text.toLowerCase();

        let classification = 'SAFE';
        let confidence = 'LOW';
        let action = 'IGNORE';
        let flaggedExcerpts = [];
        let rulesBroken = [];

        const rules = [
            {
                category: 'SCAM / PHISHING',
                keywords: ['crypto', 'investment', 'bitcoin', 'usdt', 'forex', 'profit', 'return on investment', 'doubling', 'mining', 'binance', 'wallet'],
                rule: 'No unsolicited investment or crypto schemes.',
                severity: 'HIGH'
            },
            {
                category: 'SCAM / PHISHING',
                keywords: ['verification code', 'otp', 'send me the code', 'account access', 'login', 'password', 'click the link', 'verify your account'],
                rule: 'No requests for OTPs or account access.',
                severity: 'HIGH'
            },
            {
                category: 'SCAM / PHISHING',
                keywords: ['urgent', 'hurry', 'act now', 'immediate help', 'emergency', 'hospital', 'money transfer', 'wired'],
                rule: 'No urgent financial requests.',
                severity: 'MEDIUM'
            },
            {
                category: 'IMPERSONATION',
                keywords: ['whatsapp support', 'admin team', 'official staff', 'customer service', 'group admin', 'moderator'],
                rule: 'No impersonation of authority.',
                severity: 'HIGH'
            },
            {
                category: 'POLICY VIOLATION',
                keywords: ['t.me/', 'chat.whatsapp.com/'],
                rule: 'No unauthorized external group links.',
                severity: 'MEDIUM'
            }
        ];

        let score = 0;
        let hits = 0;
        let detectedCategory = null;

        rules.forEach(r => {
            let match = false;
            r.keywords.forEach(k => {
                if (lowerText.includes(k)) {
                    match = true;
                    flaggedExcerpts.push(`"${k}"`);
                }
            });

            if (match) {
                hits++;
                score += (r.severity === 'HIGH' ? 3 : 1);
                rulesBroken.push(r.rule);
                if (!detectedCategory || r.severity === 'HIGH') {
                    detectedCategory = r.category;
                }
            }
        });

        if (hits > 0) {
            classification = detectedCategory || 'POLICY VIOLATION';
            if (score >= 3) {
                confidence = 'HIGH';
                action = (classification.includes('SCAM') || classification.includes('IMPERSONATION')) ? 'REMOVE USER' : 'DELETE';
            } else {
                confidence = 'MEDIUM';
                action = 'WARN';
            }
        } else {
            if (text.length > 500) {
                classification = 'SPAM';
                flaggedExcerpts.push('Excessive message length');
                rulesBroken.push('Potential spam or flooding.');
                confidence = 'LOW';
                action = 'WARN';
            }
        }

        if (flaggedExcerpts.length === 0) flaggedExcerpts.push('None');
        if (rulesBroken.length === 0) {
            rulesBroken.push('None implicated.');
            classification = 'SAFE';
            action = 'IGNORE';
        }

        const report = `Classification: ${classification}
Flagged excerpts: ${[...new Set(flaggedExcerpts)].join(', ')}
Rule analysis: ${[...new Set(rulesBroken)].join(' ')}
Confidence level: ${confidence}
Admin action recommendation: ${action}`;

        displayMessageResult(classification, report);
    }

    function displayMessageResult(classification, report) {
        const container = document.getElementById('message-results');
        const badge = document.getElementById('message-risk-badge');
        const pre = document.getElementById('message-report-text');

        container.classList.remove('hidden');
        badge.innerText = classification;
        pre.innerText = report;

        badge.className = 'status-badge';
        if (classification.includes('SCAM') || classification.includes('IMPERSONATION')) {
            badge.classList.add('badge-high');
        } else if (classification.includes('VIOLATION') || classification.includes('SPAM')) {
            badge.classList.add('badge-medium');
        } else {
            badge.classList.add('badge-safe');
        }
    }
});
