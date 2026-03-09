document.addEventListener('DOMContentLoaded', () => {
    const currentUrl = new URL(window.location.href);
    const blockedDomain = currentUrl.searchParams.get('blockedUrl');

    // 1. LOAD SETTINGS (Theme & Language)
    chrome.storage.local.get(['language', 'theme'], (data) => {
        // Apply Theme
        if (data.theme === 'dark') {
            document.body.classList.add('dark-mode');
        }

        // Apply Language
        const lang = data.language || 'fr'; // Default French
        const t = TRANSLATIONS[lang];

        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (t[key]) el.textContent = t[key];
        });
    });

    // 2. STANDARD LOGIC (Display domain, buttons)
    if (blockedDomain) {
        const displayElement = document.getElementById('blockedUrlDisplay');
        if (displayElement) displayElement.textContent = blockedDomain;

        const backBtn = document.getElementById('goBackButton');
        if (backBtn) {
            backBtn.addEventListener('click', () => window.history.back());
        }

        const bypassBtn = document.getElementById('bypassButton');
        if (bypassBtn) {
            bypassBtn.addEventListener('click', () => {
                chrome.runtime.sendMessage({ 
                    action: 'allowTemporary', 
                    domain: blockedDomain 
                }, () => {
                    window.location.href = `http://${blockedDomain}`;
                });
            });
        }
    }
});
