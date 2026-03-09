const WARNING_ID = 'averti-real-time-warning';

// Utility: Debounce function to limit rate of execution
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

function showWarning(blockedDomain, lang) {
    let warningBox = document.getElementById(WARNING_ID);
    if (!warningBox) {
        warningBox = document.createElement('div');
        warningBox.id = WARNING_ID;
        warningBox.className = 'averti-warning-box';
        document.body.appendChild(warningBox);
    }
    
    // Select language from shared TRANSLATIONS object
    const t = (TRANSLATIONS && TRANSLATIONS[lang]) ? TRANSLATIONS[lang] : (TRANSLATIONS ? TRANSLATIONS['fr'] : { alertTitle: "WARNING", alertMsg: "Dangerous site" });

    warningBox.innerHTML = `
        <span class="averti-icon">🚨</span>
        <strong>${t.alertTitle}</strong><br>
        ${t.alertMsg} <span class="averti-domain">${blockedDomain}</span>
    `;
    warningBox.classList.add('show');
}

function hideWarning() {
    const warningBox = document.getElementById(WARNING_ID);
    if (warningBox) warningBox.classList.remove('show');
}

// Debounced version of the checker (300ms delay)
const debouncedInputCheck = debounce((event) => {
    const inputVal = event.target.value.toLowerCase();
    if (inputVal.length < 3) { hideWarning(); return; }

    chrome.runtime.sendMessage({
        action: 'checkInput',
        input: inputVal
    }, (response) => {
        if (chrome.runtime.lastError) return;
        if (response && response.dangerousSite) {
            // Pass the user's language to the show function
            chrome.storage.local.get(['language'], (data) => {
                showWarning(response.dangerousSite, data.language || 'fr');
            });
        } else {
            hideWarning();
        }
    });
}, 300);

function handleInputCheck(event) {
    debouncedInputCheck(event);
}

// --- ENHANCED GOOGLE SEARCH MONITORING ---

// Monitor ALL input elements (search bars, address suggestions, etc.)
document.addEventListener('input', (event) => {
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
        handleInputCheck(event);
    }
}, true);

// Monitor keyup events for better real-time checking
document.addEventListener('keyup', (event) => {
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
        handleInputCheck(event);
    }
}, true);

// --- GOOGLE-SPECIFIC SEARCH BAR MONITORING ---

function monitorGoogleSearchBox() {
    // Google search box selectors (multiple versions for different Google UIs)
    const googleSearchSelectors = [
        'input[name="q"]',           // Main Google search box
        'textarea[name="q"]',        // New Google search box (textarea)
        'input[aria-label*="Search"]', // Search boxes with aria-label
        'input[type="search"]',      // Generic search inputs
        '.gLFyf',                    // Google search box class (desktop)
        '.gLFyf.gsfi',               // Google search box with autocomplete
        'input.lst-d-f',             // Google search input variant
        'textarea.gLFyf'             // Textarea variant
    ];

    // Apply monitoring to all Google search boxes
    googleSearchSelectors.forEach(selector => {
        const searchBoxes = document.querySelectorAll(selector);
        searchBoxes.forEach(searchBox => {
            if (!searchBox.hasAttribute('data-averti-monitored')) {
                searchBox.setAttribute('data-averti-monitored', 'true');
                
                // Add multiple event listeners for comprehensive coverage
                ['input', 'keyup', 'paste', 'change'].forEach(eventType => {
                    searchBox.addEventListener(eventType, handleInputCheck);
                });
            }
        });
    });
}

// Run monitoring immediately
monitorGoogleSearchBox();

// Run monitoring again after a short delay (for New Tab page)
setTimeout(monitorGoogleSearchBox, 500);
setTimeout(monitorGoogleSearchBox, 1000);
setTimeout(monitorGoogleSearchBox, 2000);

// Re-run monitoring when DOM changes (for dynamic Google interfaces)
const observer = new MutationObserver((mutations) => {
    monitorGoogleSearchBox();
});

// Wait for body to exist before observing
if (document.body) {
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
} else {
    document.addEventListener('DOMContentLoaded', () => {
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        monitorGoogleSearchBox();
    });
}

// Also monitor when page becomes visible (for tab switching)
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        monitorGoogleSearchBox();
    }
});

// Monitor when window loads (for New Tab page)
window.addEventListener('load', () => {
    monitorGoogleSearchBox();
});

// Monitor focus events (when user clicks into search box)
document.addEventListener('focusin', (event) => {
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
        if (!event.target.hasAttribute('data-averti-monitored')) {
            event.target.setAttribute('data-averti-monitored', 'true');
            ['input', 'keyup', 'paste', 'change'].forEach(eventType => {
                event.target.addEventListener(eventType, handleInputCheck);
            });
        }
    }
});

// --- ADDRESS BAR WARNING HANDLER ---

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'showAddressBarWarning') {
        chrome.storage.local.get(['language'], (data) => {
            // Extract domain from URL
            try {
                const url = new URL(request.url);
                showWarning(url.hostname, data.language || 'fr');
            } catch (e) {
                showWarning(request.url, data.language || 'fr');
            }
        });
    }
});

// --- GOOGLE SEARCH RESULTS MONITORING ---

function monitorSearchResults() {
    // Monitor search result links
    const searchLinks = document.querySelectorAll('a[href]');
    searchLinks.forEach(link => {
        if (!link.hasAttribute('data-averti-checked')) {
            link.setAttribute('data-averti-checked', 'true');
            
            link.addEventListener('mouseenter', (event) => {
                const url = event.target.href || event.target.closest('a').href;
                if (url) {
                    const urlLower = url.toLowerCase();
                    chrome.runtime.sendMessage({
                        action: 'checkInput',
                        input: urlLower
                    }, (response) => {
                        if (chrome.runtime.lastError) return;
                        if (response && response.dangerousSite) {
                            // Add visual warning to the link
                            event.target.style.backgroundColor = '#ffebee';
                            event.target.style.border = '2px solid #f44336';
                            event.target.title = '⚠️ WARNING: This site may be dangerous!';
                        }
                    });
                }
            });
        }
    });
}

// Monitor search results when they load
setTimeout(monitorSearchResults, 1000);

// Re-monitor when new results appear
observer.observe(document.body, {
    childList: true,
    subtree: true
});
