document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const activeToggle = document.getElementById('activeToggle');
    const schoolToggle = document.getElementById('schoolToggle');
    const siteInput = document.getElementById('siteInput');
    const addBtn = document.getElementById('addBtn');
    const customListContainer = document.getElementById('customListContainer');
    const countSpan = document.getElementById('count');
    const statusMsg = document.getElementById('statusMsg');
    const urlInput = document.getElementById('urlInput');
    const fetchUrlBtn = document.getElementById('fetchUrlBtn');
    const fileInput = document.getElementById('fileInput');
    const uploadFileBtn = document.getElementById('uploadFileBtn');
    const clearBtn = document.getElementById('clearBtn');
    const langSelector = document.getElementById('langSelector');
    const themeToggle = document.getElementById('themeToggle');

    // --- LOAD SETTINGS ---
    chrome.storage.local.get(['isActive', 'isSchoolMode', 'customSites', 'language', 'theme'], (data) => {
        activeToggle.checked = data.isActive !== false;
        schoolToggle.checked = data.isSchoolMode || false;
        
        const currentLang = data.language || 'fr';
        langSelector.value = currentLang;
        applyLanguage(currentLang);

        if (data.theme === 'dark') {
            document.body.classList.add('dark-mode');
        }

        renderList(data.customSites || []);
    });

    // --- THEME TOGGLE ---
    themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        const isDark = document.body.classList.contains('dark-mode');
        chrome.storage.local.set({ theme: isDark ? 'dark' : 'light' });
    });

    // --- LANGUAGE SWITCHER ---
    langSelector.addEventListener('change', () => {
        const selectedLang = langSelector.value;
        chrome.storage.local.set({ language: selectedLang });
        applyLanguage(selectedLang);
        updateSystemStatus();
    });

    function applyLanguage(lang) {
        const t = TRANSLATIONS[lang];
        
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (t[key]) el.textContent = t[key];
        });

        document.querySelectorAll('[data-placeholder]').forEach(el => {
            const key = el.getAttribute('data-placeholder');
            if (t[key]) el.placeholder = t[key];
        });
    }

    // --- TAB SWITCHING ---
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.getAttribute('data-tab');
            
            // Remove active class from all tabs
            tabs.forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
            
            // Add active class to clicked tab
            tab.classList.add('active');
            document.getElementById(tabName + 'Tab').classList.add('active');
        });
    });

    // --- TOGGLE SWITCHES ---
    activeToggle.addEventListener('change', () => {
        chrome.storage.local.set({ isActive: activeToggle.checked });
    });

    schoolToggle.addEventListener('change', () => {
        chrome.storage.local.set({ isSchoolMode: schoolToggle.checked });
    });

    // --- QUICK BLOCK ---
    addBtn.addEventListener('click', () => {
        const domain = cleanDomain(siteInput.value);
        if (domain) {
            addSitesToStorage([domain]);
            siteInput.value = '';
            showStatus('✓ Added successfully', 'success');
        } else {
            showStatus('❌ Invalid domain', 'error');
        }
    });

    // --- BULK IMPORT FROM URL ---
    fetchUrlBtn.addEventListener('click', async () => {
        const url = urlInput.value.trim();
        if (!url) {
            showStatus('❌ URL required', 'error');
            return;
        }

        showStatus('⏳ Fetching...', 'info');
        
        try {
            // Convert Google Sheets URL to export format
            let fetchUrl = url;
            let displayUrl = url;
            if (url.includes('docs.google.com/spreadsheets')) {
                // Extract spreadsheet ID and convert to CSV export URL
                const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
                if (match) {
                    const spreadsheetId = match[1];
                    fetchUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv`;
                    console.log('Converted Google Sheets URL to:', fetchUrl);
                }
            }

            const response = await fetch(fetchUrl);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const text = await response.text();
            const domains = parseCSVorText(text);
            
            if (domains.length > 0) {
                addSitesToStorage(domains);
                
                // Save the sync URL for automatic updates
                chrome.storage.local.set({ 
                    syncUrl: fetchUrl,
                    syncUrlDisplay: displayUrl,
                    lastSyncTime: Date.now()
                }, () => {
                    showStatus(`✓ Added ${domains.length} sites - Auto-sync enabled`, 'success');
                    updateSystemStatus();
                });
                
                urlInput.value = '';
            } else {
                showStatus('❌ No valid domains found', 'error');
            }
        } catch (error) {
            console.error('Fetch error:', error);
            showStatus(`❌ Failed: ${error.message}`, 'error');
        }
    });

    // --- UPLOAD FROM FILE ---
    uploadFileBtn.addEventListener('click', () => {
        const file = fileInput.files[0];
        if (!file) {
            showStatus('❌ File required', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target.result;
            const domains = parseCSVorText(text);
            
            if (domains.length > 0) {
                addSitesToStorage(domains);
                showStatus(`✓ Added ${domains.length} sites`, 'success');
                fileInput.value = '';
            } else {
                showStatus('❌ No valid domains found', 'error');
            }
        };
        reader.onerror = () => {
            showStatus('❌ File read error', 'error');
        };
        reader.readAsText(file);
    });

    // --- CLEAR ALL ---
    clearBtn.addEventListener('click', () => {
        if (confirm('Clear all custom sites?')) {
            chrome.storage.local.set({ customSites: [] }, () => {
                renderList([]);
                showStatus('✓ All sites cleared', 'success');
            });
        }
    });

    // --- SOURCE DROPDOWN ---
    const sourceBtn = document.getElementById('sourceBtn');
    const sourceMenu = document.getElementById('sourceMenu');
    const sourceTriangle = sourceBtn.querySelector('.source-triangle');
    const closeSourceMenu = document.getElementById('closeSourceMenu');
    
    function toggleSourceDropdown(show) {
        if (show) {
            sourceMenu.classList.add('show');
            sourceTriangle.classList.add('open');
            toggleNotifDropdown(false); // Close other dropdown
        } else {
            sourceMenu.classList.remove('show');
            sourceTriangle.classList.remove('open');
        }
    }

    sourceBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isShowing = sourceMenu.classList.contains('show');
        toggleSourceDropdown(!isShowing);
    });

    closeSourceMenu.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleSourceDropdown(false);
    });
    
    // --- NOTIFICATIONS ---
    const notifBtn = document.getElementById('notifBtn');
    const notifDropdown = document.getElementById('notifDropdown');
    const notifBadge = document.getElementById('notifBadge');
    const closeNotif = document.getElementById('closeNotif');
    const notifContent = document.getElementById('notifContent');
    const clearNotifBtn = document.getElementById('clearNotifBtn');

    function toggleNotifDropdown(show) {
        if (show) {
            notifDropdown.classList.add('show');
            toggleSourceDropdown(false); // Close other dropdown
            
            // Clear badge when opened
            if (notifBadge.classList.contains('show')) {
                notifBadge.classList.remove('show');
                // Update last seen count to current count
                chrome.storage.local.get(['customSites', 'officialThreats'], (data) => {
                    const total = (data.customSites?.length || 0) + (data.officialThreats?.length || 0);
                    chrome.storage.local.set({ lastSeenTotal: total });
                });
            }
        } else {
            notifDropdown.classList.remove('show');
        }
    }

    notifBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isShowing = notifDropdown.classList.contains('show');
        toggleNotifDropdown(!isShowing);
    });

    closeNotif.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleNotifDropdown(false);
    });

    clearNotifBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const lang = langSelector.value || 'fr';
        const t = TRANSLATIONS[lang];
        
        // Mark all as read by updating lastSeenTotal
        chrome.storage.local.get(['customSites', 'officialThreats'], (data) => {
            const total = (data.customSites?.length || 0) + (data.officialThreats?.length || 0);
            chrome.storage.local.set({ lastSeenTotal: total }, () => {
                notifBadge.classList.remove('show');
                notifContent.innerHTML = `<div class="notif-empty">${t.noNotifs || 'No new notifications'}</div>`;
            });
        });
    });

    notifDropdown.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    // Close dropdowns when clicking outside
    document.addEventListener('click', () => {
        toggleSourceDropdown(false);
        toggleNotifDropdown(false);
    });
    
    sourceMenu.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    // Check for new notifications
    function checkNotifications() {
        const lang = langSelector.value || 'fr';
        const t = TRANSLATIONS[lang];

        chrome.storage.local.get(['customSites', 'officialThreats', 'lastSeenTotal', 'lastSyncTime', 'syncUrlDisplay'], (data) => {
            const customCount = data.customSites?.length || 0;
            const officialCount = data.officialThreats?.length || 0;
            const currentTotal = customCount + officialCount;
            const lastSeen = data.lastSeenTotal || 0;
            
            const diff = currentTotal - lastSeen;
            
            if (diff > 0) {
                notifBadge.textContent = diff > 99 ? '99+' : diff;
                notifBadge.classList.add('show');
                
                // Generate notification content
                let html = '';
                const timeStr = new Date(data.lastSyncTime || Date.now()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                
                // If custom sites increased
                if (customCount > 0 && data.syncUrlDisplay) {
                    let sourceName = 'Custom URL';
                    if (data.syncUrlDisplay.includes('docs.google.com/spreadsheets')) sourceName = 'Google Sheets';
                    else if (data.syncUrlDisplay.includes('docs.google.com/document')) sourceName = 'Google Docs';
                    
                    html += `
                        <div class="notif-item">
                            <div class="notif-icon">📊</div>
                            <div class="notif-text">
                                ${diff} ${t.newSitesAdded || 'new sites added from'} <strong>${sourceName}</strong>
                                <div class="notif-time">${timeStr}</div>
                            </div>
                        </div>
                    `;
                } else if (diff > 0) {
                     html += `
                        <div class="notif-item">
                            <div class="notif-icon">🛡️</div>
                            <div class="notif-text">
                                ${t.dbUpdated || 'Database updated with'} ${diff} ${t.newThreats || 'new threats'}
                                <div class="notif-time">${timeStr}</div>
                            </div>
                        </div>
                    `;
                }
                
                notifContent.innerHTML = html;
            } else {
                notifBadge.classList.remove('show');
                notifContent.innerHTML = `<div class="notif-empty">${t.noNotifs || 'No new notifications'}</div>`;
            }
        });
    }

    // Call immediately and periodically
    checkNotifications();
    
    // --- SYSTEM STATUS ---
    // --- SYSTEM STATUS ---
    function updateSystemStatus() {
        const lang = langSelector.value || 'fr';
        const t = TRANSLATIONS[lang];
        
        const dot = document.getElementById('statusDot');
        const title = document.getElementById('statusTitle');
        const timeLabel = document.getElementById('statusTime');
        const countLabel = document.getElementById('statusCount');
        const sourceLabel = document.getElementById('sourceLabel');
        
        // Update dropdown content
        const officialCountEl = document.getElementById('officialCount');
        const customSourceItem = document.getElementById('customSourceItem');
        const customUrlEl = document.getElementById('customUrl');
        const customCountEl = document.getElementById('customCount');
        
        chrome.storage.local.get(['dbStatus', 'syncUrlDisplay', 'customSites', 'officialThreats'], (data) => {
            const status = data.dbStatus;
            
            // Update official count
            const officialCount = data.officialThreats?.length || 0;
            officialCountEl.textContent = `${officialCount.toLocaleString()} ${t.threats || 'threats'}`;
            
            // Update custom source info
            const customCount = data.customSites?.length || 0;
            if (data.syncUrlDisplay && customCount > 0) {
                customSourceItem.style.display = 'block';
                
                // Smart display label
                let sourceName = 'Custom URL';
                if (data.syncUrlDisplay.includes('docs.google.com/spreadsheets')) {
                    sourceName = 'Google Sheets';
                } else if (data.syncUrlDisplay.includes('docs.google.com/document')) {
                    sourceName = 'Google Docs';
                } else if (data.syncUrlDisplay.includes('dropbox.com')) {
                    sourceName = 'Dropbox';
                }
                
                customUrlEl.textContent = sourceName;
                customCountEl.textContent = `${customCount.toLocaleString()} ${t.sites || 'sites'} • ${t.autoSync || 'Auto-sync active'}`;
                sourceLabel.textContent = `${t.sources || 'Sources'} (2)`;
            } else if (customCount > 0) {
                customSourceItem.style.display = 'block';
                customUrlEl.textContent = t.manualEntries || 'Manual entries';
                customCountEl.textContent = `${customCount.toLocaleString()} ${t.sites || 'sites'}`;
                sourceLabel.textContent = `${t.sources || 'Sources'} (2)`;
            } else {
                customSourceItem.style.display = 'none';
                sourceLabel.textContent = `${t.sources || 'Sources'} (1)`;
            }
            
            if (!status) {
                dot.className = 'status-indicator updating';
                title.textContent = t.init || 'Initializing...';
                timeLabel.textContent = '...';
                countLabel.textContent = '0';
                return;
            }
            
            if (status.state === 'online') {
                dot.className = 'status-indicator';
                title.textContent = t.systemOp || 'System Online';
                const diff = Math.floor((Date.now() - status.timestamp) / 60000);
                timeLabel.textContent = `${t.lastUpdate || 'Updated'} ${diff}m ago`;
                countLabel.textContent = status.count ? `${status.count}` : '0';
            } else if (status.state === 'offline') {
                dot.className = 'status-indicator offline';
                title.textContent = t.updateFailed || 'Update Failed';
                timeLabel.textContent = t.usingCache || 'Using cache';
                countLabel.textContent = '0';
            } else if (status.state === 'updating') {
                dot.className = 'status-indicator updating';
                title.textContent = t.updating || 'Updating...';
                timeLabel.textContent = '...';
                countLabel.textContent = '...';
            }
        });
    }
    
    updateSystemStatus();
    setInterval(updateSystemStatus, 5000);

    // --- HELPER FUNCTIONS ---
    function addSitesToStorage(newSites) {
        chrome.storage.local.get(['customSites'], (data) => {
            const existing = data.customSites || [];
            const uniqueSet = new Set([...existing, ...newSites]);
            const updatedList = Array.from(uniqueSet).slice(0, 3000);
            chrome.storage.local.set({ customSites: updatedList }, () => {
                renderList(updatedList);
            });
        });
    }

    function renderList(sites) {
        customListContainer.innerHTML = '';
        countSpan.textContent = sites.length;
        
        if (sites.length === 0) {
            customListContainer.innerHTML = '<div class="empty-state">No custom sites blocked yet</div>';
            return;
        }
        
        sites.slice(0, 50).forEach(site => {
            const div = document.createElement('div');
            div.className = 'list-item';
            div.innerHTML = `
                <span>${site}</span>
                <span class="remove-btn" data-site="${site}">×</span>
            `;
            customListContainer.appendChild(div);
        });
        
        document.querySelectorAll('.remove-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const site = e.target.getAttribute('data-site');
                chrome.storage.local.get(['customSites'], (data) => {
                    const updated = (data.customSites || []).filter(s => s !== site);
                    chrome.storage.local.set({ customSites: updated }, () => {
                        renderList(updated);
                        showStatus('✓ Site removed', 'success');
                    });
                });
            });
        });
    }

    function parseCSVorText(text) {
        const domains = [];
        
        // Split by newlines and commas
        const lines = text.split(/[\r\n]+/);
        
        lines.forEach(line => {
            // Split by comma for CSV support
            const parts = line.split(',');
            parts.forEach(part => {
                const domain = cleanDomain(part);
                if (domain && domain.length > 3) {
                    domains.push(domain);
                }
            });
        });
        
        // Remove duplicates
        return [...new Set(domains)];
    }

    function cleanDomain(input) {
        if (!input) return null;
        
        // Remove quotes, whitespace, and convert to lowercase
        let cleaned = input.trim().toLowerCase()
            .replace(/['"]/g, '')
            .replace(/\s+/g, '');
        
        if (!cleaned) return null;
        
        try {
            // If it's a URL, extract the hostname
            if (cleaned.startsWith('http://') || cleaned.startsWith('https://')) {
                const url = new URL(cleaned);
                return url.hostname;
            }
            
            // Remove protocol if present
            cleaned = cleaned.replace(/^https?:\/\//, '');
            
            // Remove path
            cleaned = cleaned.split('/')[0];
            
            // Remove port if present
            cleaned = cleaned.split(':')[0];
            
            // Basic validation: should contain at least one dot
            if (!cleaned.includes('.')) return null;
            
            return cleaned;
        } catch (e) {
            console.error('Error cleaning domain:', input, e);
            return null;
        }
    }

    function showStatus(msg, type) {
        statusMsg.textContent = msg;
        statusMsg.className = 'status-message';
        
        if (type === 'success') {
            statusMsg.classList.add('success');
        } else if (type === 'error') {
            statusMsg.classList.add('error');
        }
        
        setTimeout(() => {
            statusMsg.className = 'status-message';
            statusMsg.textContent = '';
        }, 3000);
    }

    // --- PARTICLE EFFECT ---
    const canvas = document.getElementById('headerCanvas');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        let particles = [];
        const particleCount = 20; // Lightweight count
        
        function resize() {
            canvas.width = canvas.parentElement.offsetWidth;
            canvas.height = canvas.parentElement.offsetHeight;
        }
        
        class Particle {
            constructor() {
                this.x = Math.random() * canvas.width;
                this.y = Math.random() * canvas.height;
                this.vx = (Math.random() - 0.5) * 0.5;
                this.vy = (Math.random() - 0.5) * 0.5;
                this.size = Math.random() * 2 + 1;
            }
            
            update() {
                this.x += this.vx;
                this.y += this.vy;
                
                if (this.x < 0 || this.x > canvas.width) this.vx *= -1;
                if (this.y < 0 || this.y > canvas.height) this.vy *= -1;
            }
            
            draw() {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'; // Whiter/Brighter
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        
        function initParticles() {
            resize();
            particles = [];
            for (let i = 0; i < particleCount; i++) {
                particles.push(new Particle());
            }
        }
        
        function animate() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            particles.forEach(p => {
                p.update();
                p.draw();
                
                // Draw connections
                particles.forEach(p2 => {
                    const dx = p.x - p2.x;
                    const dy = p.y - p2.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    
                    if (dist < 60) {
                        ctx.beginPath();
                        ctx.strokeStyle = `rgba(255, 255, 255, ${0.4 - dist/200})`; // Brighter connections
                        ctx.lineWidth = 0.8;
                        ctx.moveTo(p.x, p.y);
                        ctx.lineTo(p2.x, p2.y);
                        ctx.stroke();
                    }
                });
            });
            
            requestAnimationFrame(animate);
        }
        
        initParticles();
        animate();
        window.addEventListener('resize', initParticles);
    }
});
