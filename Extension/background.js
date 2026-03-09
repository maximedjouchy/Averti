// --- 1. CONFIGURATION ---
const OFFICIAL_FEED_URL = "https://phishing.army/download/phishing_army_blocklist_extended.txt";

// Fallback list (Always active for Demos)
const FALLBACK_THREATS = [
    "wicar.org", "sitedangereux.com", "malicious-phishing.net", 
    "badsiteexample.org", "internet-bad-guys.com", "win-spyware-scanner.com",
    "secure-paypal-login-update.com", "netflix-payment-update-required.com"
];

// Static School Mode List
const SCHOOL_MODE_SITES = [
  "pokerstars.com", "bet365.com", "pornhub.com", "onlyfans.com", 
  "gambling.com", "xhamster.com", "draftkings.com", "888casino.com"
];

const WARNING_PAGE_URL = chrome.runtime.getURL("warning.html");

// --- 2. CORE LOGIC ---

function updateBlockingRules() {
    chrome.storage.local.get(['isActive', 'isSchoolMode', 'customSites', 'officialThreats'], (data) => {
        
        // 1. OFF SWITCH
        if (data.isActive === false) {
            chrome.declarativeNetRequest.updateDynamicRules({
                removeRuleIds: Array.from({length: 5000}, (_, i) => i + 1),
                addRules: []
            });
            chrome.action.setBadgeText({ text: "OFF" });
            chrome.action.setBadgeBackgroundColor({ color: "#888" });
            return;
        }

        // 2. COMBINE LISTS
        // Start with Fallback threats so Demos ALWAYS work
        let sitesToBlock = [...FALLBACK_THREATS];

        // Add downloaded official threats
        if (data.officialThreats && data.officialThreats.length > 0) {
            sitesToBlock = [...sitesToBlock, ...data.officialThreats];
        }

        if (data.customSites) {
            sitesToBlock = [...sitesToBlock, ...data.customSites];
        }

        if (data.isSchoolMode) {
            sitesToBlock = [...sitesToBlock, ...SCHOOL_MODE_SITES];
        }

        // 3. CLEANUP & LIMIT
        sitesToBlock = [...new Set(sitesToBlock)];
        
        if (sitesToBlock.length > 4500) {
            // Keep Chrome happy (Max 5000 rules, save 500 for bypasses)
            sitesToBlock = sitesToBlock.slice(0, 4500);
        }

        // 4. GENERATE RULES
        const newRules = sitesToBlock.map((domain, index) => ({
            id: index + 1,
            priority: 1,
            action: {
                type: "redirect",
                redirect: { url: `${WARNING_PAGE_URL}?blockedUrl=${encodeURIComponent(domain)}` }
            },
            condition: {
                urlFilter: `||${domain}`, 
                resourceTypes: ["main_frame"]
            }
        }));

        // 5. APPLY RULES
        chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: Array.from({length: 5000}, (_, i) => i + 1),
            addRules: newRules
        }, () => {
            if (chrome.runtime.lastError) {
                console.error("Rule Update Failed:", chrome.runtime.lastError);
            } else {
                chrome.action.setBadgeText({ text: "ON" });
                chrome.action.setBadgeBackgroundColor({ color: "#00AA00" });
                console.log(`Averti Active. Blocking ${newRules.length} domains.`);
            }
        });
    });
}

// --- 3. DATA FETCHING ---

async function fetchOfficialFeed() {
    console.log("Averti: Downloading official threat database...");
    chrome.storage.local.set({ dbStatus: { state: 'updating', timestamp: Date.now() } });

    try {
        const response = await fetch(OFFICIAL_FEED_URL);
        if (!response.ok) throw new Error("Network response was not ok");
        
        const text = await response.text();
        const lines = text.split('\n');
        
        const validDomains = lines
            .map(line => line.trim().toLowerCase())
            .filter(line => line && !line.startsWith('#') && line.includes('.'));

        const optimizedList = validDomains.slice(0, 4000);
        
        chrome.storage.local.set({ 
            officialThreats: optimizedList,
            dbStatus: {
                state: 'online',         
                timestamp: Date.now(),
                count: optimizedList.length 
            }
        }, () => {
            console.log(`Averti: Database updated. Count: ${optimizedList.length}`);
            updateBlockingRules();
        });

    } catch (error) {
        console.error("Averti: Failed to download feed.", error);
        chrome.storage.local.set({ 
            dbStatus: {
                state: 'offline',        
                timestamp: Date.now(),
                error: error.message
            }
        });
    }
}

// --- CUSTOM URL SYNC (Google Sheets Auto-Update) ---
async function syncFromCustomUrl() {
    chrome.storage.local.get(['syncUrl'], async (data) => {
        if (!data.syncUrl) {
            console.log("Averti: No custom sync URL configured");
            return;
        }

        console.log("Averti: Syncing from custom URL...");
        
        try {
            const response = await fetch(data.syncUrl);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const text = await response.text();
            const domains = parseCSVorText(text);
            
            if (domains.length > 0) {
                chrome.storage.local.get(['customSites'], (storageData) => {
                    const existing = storageData.customSites || [];
                    
                    // Check if there are new domains
                    const existingSet = new Set(existing);
                    const newDomains = domains.filter(d => !existingSet.has(d));
                    
                    if (newDomains.length > 0) {
                        // Merge and update
                        const uniqueSet = new Set([...existing, ...domains]);
                        const updatedList = Array.from(uniqueSet).slice(0, 3000);
                        
                        chrome.storage.local.set({ 
                            customSites: updatedList,
                            lastSyncTime: Date.now()
                        }, () => {
                            console.log(`Averti: Custom URL synced. Added ${newDomains.length} new sites. Total: ${updatedList.length}`);
                            updateBlockingRules();
                        });
                    } else {
                        console.log("Averti: Custom URL sync - no new sites found");
                        chrome.storage.local.set({ lastSyncTime: Date.now() });
                    }
                });
            }
        } catch (error) {
            console.error("Averti: Custom URL sync failed:", error);
        }
    });
}

// Helper function to parse CSV/Text (same as popup.js)
function parseCSVorText(text) {
    const domains = [];
    const lines = text.split(/[\r\n]+/);
    
    lines.forEach(line => {
        const parts = line.split(',');
        parts.forEach(part => {
            const domain = cleanDomain(part);
            if (domain && domain.length > 3) {
                domains.push(domain);
            }
        });
    });
    
    return [...new Set(domains)];
}

function cleanDomain(input) {
    if (!input) return null;
    
    let cleaned = input.trim().toLowerCase()
        .replace(/['"]/g, '')
        .replace(/\s+/g, '');
    
    if (!cleaned) return null;
    
    try {
        if (cleaned.startsWith('http://') || cleaned.startsWith('https://')) {
            const url = new URL(cleaned);
            return url.hostname;
        }
        
        cleaned = cleaned.replace(/^https?:\/\//, '');
        cleaned = cleaned.split('/')[0];
        cleaned = cleaned.split(':')[0];
        
        if (!cleaned.includes('.')) return null;
        
        return cleaned;
    } catch (e) {
        return null;
    }
}

// --- 4. LISTENERS ---

chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local') updateBlockingRules();
});

chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.set({ 
        isActive: true, 
        isSchoolMode: false, 
        customSites: [],
        officialThreats: [] 
    });
    fetchOfficialFeed();
    
    // Daily update for official feed
    chrome.alarms.create("dailyUpdate", { periodInMinutes: 1440 });
    
    // Every 15 minutes for custom URL sync (Google Sheets)
    chrome.alarms.create("customUrlSync", { periodInMinutes: 15 });
});

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "dailyUpdate") {
        fetchOfficialFeed();
    } else if (alarm.name === "customUrlSync") {
        syncFromCustomUrl();
    }
});

chrome.runtime.onStartup.addListener(() => {
    updateBlockingRules();
});

// --- 5. OMNIBOX (ADDRESS BAR) INTEGRATION ---

// When user types in address bar, check for dangerous sites
chrome.omnibox.onInputChanged.addListener((text, suggest) => {
    chrome.storage.local.get(['officialThreats', 'customSites', 'isSchoolMode'], (data) => {
        let allThreats = [...FALLBACK_THREATS];
        if (data.officialThreats) allThreats = [...allThreats, ...data.officialThreats];
        if (data.customSites) allThreats = [...allThreats, ...data.customSites];
        if (data.isSchoolMode) allThreats = [...allThreats, ...SCHOOL_MODE_SITES];
        
        const inputLower = text.toLowerCase();
        const matchingThreats = allThreats.filter(site => 
            site.includes(inputLower) || inputLower.includes(site)
        );
        
        if (matchingThreats.length > 0) {
            const suggestions = matchingThreats.slice(0, 5).map(site => ({
                content: site,
                description: `🚨 <match>DANGER</match>: <url>${site}</url> - <dim>⛔ Blocked by Averti</dim>`
            }));
            suggest(suggestions);
            
            // Update default suggestion to show warning with red theme
            chrome.omnibox.setDefaultSuggestion({
                description: `�️ <match>⚠️ WARNING</match>: Dangerous site detected - <url>${matchingThreats[0]}</url>`
            });
        } else {
            // Reset to safe status with shield
            chrome.omnibox.setDefaultSuggestion({
                description: `🛡️ <match>✓ Safe</match> - No threats detected for: <url>${text}</url>`
            });
        }
    });
});

// Set initial default suggestion with red theme styling
chrome.omnibox.setDefaultSuggestion({
    description: '🛡️ <match>Averti Security Check</match> - Type a domain to verify safety'
});

// When user selects a suggestion or presses enter
chrome.omnibox.onInputEntered.addListener((text) => {
    chrome.storage.local.get(['officialThreats', 'customSites', 'isSchoolMode'], (data) => {
        let allThreats = [...FALLBACK_THREATS];
        if (data.officialThreats) allThreats = [...allThreats, ...data.officialThreats];
        if (data.customSites) allThreats = [...allThreats, ...data.customSites];
        if (data.isSchoolMode) allThreats = [...allThreats, ...SCHOOL_MODE_SITES];
        
        const isDangerous = allThreats.some(site => 
            site.includes(text.toLowerCase()) || text.toLowerCase().includes(site)
        );
        
        if (isDangerous) {
            // Redirect to warning page
            chrome.tabs.create({ 
                url: `${WARNING_PAGE_URL}?blockedUrl=${encodeURIComponent(text)}&source=omnibox`
            });
        } else {
            // Safe - open in Google search
            chrome.tabs.create({ 
                url: `https://www.google.com/search?q=${encodeURIComponent(text)}`
            });
        }
    });
});

// --- 6. TAB URL MONITORING (Address Bar Navigation) ---

// Monitor when user types URL directly in address bar
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.url) {
        chrome.storage.local.get(['isActive', 'officialThreats', 'customSites', 'isSchoolMode'], (data) => {
            if (data.isActive === false) return;
            
            let allThreats = [...FALLBACK_THREATS];
            if (data.officialThreats) allThreats = [...allThreats, ...data.officialThreats];
            if (data.customSites) allThreats = [...allThreats, ...data.customSites];
            if (data.isSchoolMode) allThreats = [...allThreats, ...SCHOOL_MODE_SITES];
            
            const urlLower = changeInfo.url.toLowerCase();
            const isDangerous = allThreats.some(site => urlLower.includes(site));
            
            if (isDangerous) {
                // Wait a bit for content script to load, then send message
                setTimeout(() => {
                    chrome.tabs.sendMessage(tabId, {
                        action: 'showAddressBarWarning',
                        url: changeInfo.url
                    }).catch(error => {
                        // Silently ignore if content script not ready
                        // This is normal for chrome:// pages, extension pages, etc.
                    });
                }, 100);
            }
        });
    }
});

// MESSAGE LISTENER (Handling Search & Bypass)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    
    // Case 1: Search Bar Check
    if (request.action === 'checkInput') {
        chrome.storage.local.get(['officialThreats', 'customSites', 'isSchoolMode'], (data) => {
            let allThreats = [...FALLBACK_THREATS]; // Include demo sites in search check
            if (data.officialThreats) allThreats = [...allThreats, ...data.officialThreats];
            if (data.customSites) allThreats = [...allThreats, ...data.customSites];
            if (data.isSchoolMode) allThreats = [...allThreats, ...SCHOOL_MODE_SITES];
            
            const isDangerous = allThreats.some(site => site.includes(request.input));
            sendResponse({ dangerousSite: isDangerous ? request.input : null });
        });
        return true; 
    }

    // Case 2: Smart Bypass
    if (request.action === 'allowTemporary') {
        const domain = request.domain;
        const ruleId = Math.floor(Math.random() * 4000) + 5000; // Use IDs 5000+
        
        const allowRule = {
            id: ruleId,
            priority: 2, // Priority 2 overrides Priority 1
            action: { type: "allow" },
            condition: { 
                urlFilter: `||${domain}`, 
                resourceTypes: ["main_frame"] 
            }
        };

        chrome.declarativeNetRequest.updateDynamicRules({
            addRules: [allowRule]
        }, () => {
            console.log(`Averti: Temporarily allowed ${domain}`);
            sendResponse({ success: true });
        });
        return true; 
    }
});
