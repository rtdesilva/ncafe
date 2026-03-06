// ==============================================
// N-CAFE STAFF APP - REBUILT FROM SCRATCH
// ==============================================

const app = document.getElementById('app');
const loginScreen = document.getElementById('login-screen');
let orders = [];

// STATE
const staffState = {
    currentTab: 'home', // 'orders', 'scanner', 'stock', 'comms', 'home'
    commsTab: 'broadcast', // 'broadcast', 'inbox'
    stockCategory: 'all', // NEW: Stock Filter
    stockSearch: '', // NEW: Stock Search
    selectedChat: null,
    chats: [],
    chatMessages: [],
    inboxListener: null,
    activeChatListener: null,
    orderFilter: 'active', // NEW: Filter for orders
    orderSearch: '', // NEW: Search for orders
    dateFilter: 'today',
    startDate: new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0') + '-' + String(new Date().getDate()).padStart(2, '0'),
    endDate: new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0') + '-' + String(new Date().getDate()).padStart(2, '0'),
    homeFilter: 'all', // 'all', 'preparing', 'ready'
    isDarkMode: localStorage.getItem('ncafe_staff_dark_mode') === 'true'
};

// INITIAL DARK MODE APPLY
if (staffState.isDarkMode) {
    document.documentElement.classList.add('dark');
} else {
    document.documentElement.classList.remove('dark');
}

// ==============================================
// 1. AUTHENTICATION & SECURE ROUTING
// ==============================================

auth.onAuthStateChanged(async (user) => {
    if (user && user.email) {
        try {
            // Verify role against staff_users collection
            let role = 'customer';
            const userDoc = await db.collection('staff_users').doc(user.uid).get();

            if (userDoc.exists) {
                role = userDoc.data().role;
            } else {
                // Fallback email search
                const snap = await db.collection('staff_users').where('email', '==', user.email).get();
                if (!snap.empty) {
                    role = snap.docs[0].data().role;
                }
            }

            // Admins, Managers, and Staff are allowed
            if (['admin', 'manager', 'staff'].includes(role)) {
                // Authorized — Reveal Dashboard
                if (loginScreen) loginScreen.classList.add('hidden');
                if (app) app.classList.remove('hidden');

                // Initialize Dashboard
                render();

                // Sync Activity
                const updates = {
                    lastLogin: Date.now(),
                    lastActivity: firebase.firestore.FieldValue.serverTimestamp(),
                    lastLoginServer: firebase.firestore.FieldValue.serverTimestamp(),
                    lastLoginString: new Date().toISOString()
                };

                await db.collection('staff_users').doc(user.uid).set(updates, { merge: true });

                // Redundantly update matching emails
                const staffSnap = await db.collection('staff_users').get();
                staffSnap.forEach(doc => {
                    if (doc.data().email && doc.data().email.toLowerCase() === user.email.toLowerCase()) {
                        doc.ref.set(updates, { merge: true });
                    }
                });
            } else {
                // Unauthorized Access
                console.warn("RESTRICTION: Unauthorized role attempted to access staff portal.");
                auth.signOut();
                if (loginScreen) loginScreen.classList.remove('hidden');
                if (app) app.classList.add('hidden');

                const errEl = document.getElementById('login-error');
                if (errEl) {
                    errEl.innerText = "Unauthorized Access. Staff privileges required.";
                    errEl.classList.remove('hidden');
                }
            }
        } catch (e) {
            console.error("Auth verification failed:", e);
            auth.signOut();
        }
    } else {
        // Logged Out — Show Login Form
        if (loginScreen) loginScreen.classList.remove('hidden');
        if (app) app.classList.add('hidden');
    }
});

let vaultAuthorizedEmail = null;

// --- PIN VAULT LOGIC ---
(function initPinVault() {
    const pinStep = document.getElementById('staff-pin-step');
    const loginForm = document.getElementById('staff-login-form');
    if (!pinStep || !loginForm) return;

    let currentInput = '';
    let failedPinAttempts = 0;
    let lockoutUntil = 0;
    const dots = pinStep.querySelectorAll('.ncafe-pin-dot');
    const pinError = document.getElementById('staff-pin-error');

    const updateLockoutUI = () => {
        const remaining = Math.ceil((lockoutUntil - Date.now()) / 1000);
        if (remaining > 0) {
            if (pinError) {
                pinError.innerText = `Terminal Locked: Try again in ${remaining}s`;
                pinError.classList.remove('hidden');
            }
            return true;
        } else {
            if (pinError && pinError.innerText.includes('Locked')) {
                pinError.classList.add('hidden');
                pinError.innerText = '';
            }
            return false;
        }
    };

    const handleInput = async (val) => {
        if (updateLockoutUI()) return;
        if (val === 'clear') {
            currentInput = '';
        } else if (currentInput.length < 4) {
            currentInput += val;
        }

        // Update dots
        dots.forEach((dot, idx) => {
            if (idx < currentInput.length) {
                dot.classList.add('bg-primary', 'border-primary');
                dot.classList.remove('border-gray-300', 'dark:border-dark-muted');
            } else {
                dot.classList.remove('bg-primary', 'border-primary');
                dot.classList.add('border-gray-300', 'dark:border-dark-muted');
            }
        });

        if (currentInput.length === 4) {
            try {
                const snap = await db.collection('staff_users')
                    .where('pin', '==', currentInput)
                    .where('status', '==', 'active')
                    .get();

                if (!snap.empty) {
                    const userData = snap.docs[0].data();
                    failedPinAttempts = 0; // RESET ON SUCCESS

                    // AUTHORIZE: Store the email internally for cross-check
                    vaultAuthorizedEmail = userData.email || '';

                    // SECURITY: Clear the email input for manual typing (don't auto-fill)
                    const emailInput = document.getElementById('staff-email');
                    if (emailInput) {
                        emailInput.value = '';
                        emailInput.placeholder = 'Enter authorized email';
                    }

                    pinStep.classList.add('hidden');
                    loginForm.classList.remove('hidden');
                } else {
                    // FALLBACK: Check against the master system PIN (e.g., 1111)
                    // This allows the admin to set up staff pins from either portal
                    const masterPin = window.systemSettings?.systemPin || '1111';
                    if (currentInput === masterPin) {
                        failedPinAttempts = 0; // RESET ON SUCCESS
                        vaultAuthorizedEmail = 'admin@ncafe.com';

                        const emailInput = document.getElementById('staff-email');
                        if (emailInput) {
                            emailInput.value = '';
                            emailInput.placeholder = 'Enter admin email';
                        }

                        pinStep.classList.add('hidden');
                        loginForm.classList.remove('hidden');
                    } else {
                        throw new Error("Invalid PIN");
                    }
                }
            } catch (err) {
                failedPinAttempts++;
                if (failedPinAttempts >= 3) {
                    lockoutUntil = Date.now() + 60000;
                    updateLockoutUI();
                    // Auto-refresh timer
                    const timer = setInterval(() => {
                        if (!updateLockoutUI()) clearInterval(timer);
                    }, 1000);
                } else if (pinError) {
                    pinError.innerText = `Invalid PIN. ${3 - failedPinAttempts} attempts remaining.`;
                    pinError.classList.remove('hidden');
                    setTimeout(() => { if (lockoutUntil <= Date.now()) pinError.classList.add('hidden'); }, 2000);
                }

                // Fail - shake and clear
                pinStep.animate([
                    { transform: 'translateX(-10px)' },
                    { transform: 'translateX(10px)' },
                    { transform: 'translateX(-10px)' },
                    { transform: 'translateX(10px)' },
                    { transform: 'translateX(0)' }
                ], { duration: 300 });

                dots.forEach(d => {
                    d.classList.remove('border-primary', 'bg-primary');
                    d.classList.add('border-red-500', 'bg-red-500');
                });

                setTimeout(() => {
                    currentInput = '';
                    dots.forEach(d => {
                        d.classList.remove('border-red-500', 'bg-red-500', 'bg-primary', 'border-primary');
                        d.classList.add('border-gray-300', 'dark:border-dark-muted');
                    });
                }, 500);
            }
        }
    };

    pinStep.querySelectorAll('.staff-pin-btn').forEach(btn => {
        const val = btn.getAttribute('data-val');
        if (val) btn.addEventListener('click', () => handleInput(val));
    });
})();

// INLINE LOGIN HANDLER
document.getElementById('staff-login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorMessage = document.getElementById('login-error');
    const submitBtn = document.getElementById('staff-login-btn');
    errorMessage.classList.add('hidden');

    const email = document.getElementById('staff-email').value.trim();
    const password = document.getElementById('staff-password').value;

    // SECURITY IDENTITY MATCH
    if (vaultAuthorizedEmail && email.toLowerCase() !== vaultAuthorizedEmail.toLowerCase()) {
        errorMessage.innerText = "Security Mismatch: The entered account does not match the authorized PIN identity.";
        errorMessage.classList.remove('hidden');
        submitBtn.innerHTML = '<span>Secure Login</span><i data-lucide="arrow-right" class="w-4 h-4 group-hover:translate-x-1 transition-transform"></i>';
        submitBtn.disabled = false;
        lucide.createIcons();
        return;
    }

    submitBtn.innerHTML = '<i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i> Authenticating...';
    submitBtn.disabled = true;
    lucide.createIcons();

    try {
        await auth.signInWithEmailAndPassword(email, password);
        // onAuthStateChanged will handle the transition seamlessly
    } catch (error) {
        console.error("Login Error:", error);
        errorMessage.innerText = "Authentication failed. Invalid email or password.";
        errorMessage.classList.remove('hidden');
        submitBtn.innerHTML = '<span>Secure Login</span><i data-lucide="arrow-right" class="w-4 h-4 group-hover:translate-x-1 transition-transform"></i>';
        submitBtn.disabled = false;
        lucide.createIcons();
    }
});

function updateDateFilter(type) {
    staffState.dateFilter = type;
    const today = new Date();

    if (type === 'today') {
        const d = new Date();
        const ds = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        staffState.startDate = ds;
        staffState.endDate = ds;
    } else if (type === 'yesterday') {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        const ds = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        staffState.startDate = ds;
        staffState.endDate = ds;
    } else if (type === 'last7') {
        const d = new Date();
        const endDs = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        d.setDate(d.getDate() - 6);
        const startDs = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        staffState.startDate = startDs;
        staffState.endDate = endDs;
    } else if (type === 'last30') {
        const d = new Date();
        const endDs = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        d.setDate(d.getDate() - 29);
        const startDs = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        staffState.startDate = startDs;
        staffState.endDate = endDs;
    } else if (type === 'custom') {
        const d = new Date();
        const startDs = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        d.setDate(d.getDate() + 2); // 2 days future (3 days total)
        const endDs = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        staffState.startDate = startDs;
        staffState.endDate = endDs;
    }
    render();
}

function handleDateChange(field, value) {
    staffState[field] = value;
    staffState.dateFilter = 'custom';
    render();
}

function toggleDarkMode() {
    staffState.isDarkMode = !staffState.isDarkMode;
    localStorage.setItem('ncafe_staff_dark_mode', staffState.isDarkMode);
    if (staffState.isDarkMode) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
    render();
}

async function handleLogout() {
    try {
        await auth.signOut();
        localStorage.removeItem('ncafe_user_role');
        window.location.reload(); // Quick refresh kicks them cleanly back to the local login screen
    } catch (error) {
        console.error("Logout Error:", error);
    }
}

window.openProfileModal = async function () {
    // 1. Ensure auth state is fully loaded synchronously
    const user = await new Promise((resolve) => {
        const unsubscribe = auth.onAuthStateChanged((u) => {
            unsubscribe();
            resolve(u);
        });
    });

    let name = user?.displayName || 'Staff Member';
    const email = user?.email || 'Unknown Email';
    const role = localStorage.getItem('ncafe_user_role') || 'staff';

    // 2. Fetch name from staff_users collection (Try UID first, then Email)
    if (user && user.email) {
        try {
            let userDoc = await db.collection('staff_users').doc(user.uid).get();

            if (userDoc.exists && userDoc.data().name) {
                name = userDoc.data().name;
            } else {
                // Fallback: Search by email if document was created with Auto-ID
                const snapshot = await db.collection('staff_users').where('email', '==', user.email).get();
                if (!snapshot.empty) {
                    const data = snapshot.docs[0].data();
                    if (data.name) name = data.name;
                }
            }
        } catch (e) {
            console.error("Error fetching staff name:", e);
        }
    }

    const roleColors = {
        'admin': 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 border-red-200 dark:border-red-800',
        'manager': 'text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/30 border-purple-200 dark:border-purple-800',
        'staff': 'text-primary dark:text-primary bg-primary/10 border-primary/20'
    };

    const roleStyle = roleColors[role] || roleColors['staff'];
    const formattedRole = role.charAt(0).toUpperCase() + role.slice(1);

    const modal = document.createElement('div');
    modal.id = 'profile-modal';
    modal.className = 'fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in';
    modal.innerHTML = `
        <div class="bg-white dark:bg-dark-surface rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-transparent dark:border-dark-border animate-scale-in">
            <div class="flex justify-between items-center mb-6">
                <h3 class="text-lg font-[900] text-secondary dark:text-gray-100">Staff Profile</h3>
                <button onclick="document.getElementById('profile-modal').remove()" class="p-2 hover:bg-gray-100 dark:hover:bg-dark-bg rounded-full transition-colors">
                    <i data-lucide="x" class="w-5 h-5 text-gray-500"></i>
                </button>
            </div>

            <div class="space-y-4">
                <div class="flex flex-col items-center justify-center py-4">
                    <div class="w-20 h-20 bg-gray-100 dark:bg-dark-bg border-4 border-white dark:border-dark-border shadow-md rounded-full flex items-center justify-center mb-3">
                        <span class="text-3xl font-black text-secondary dark:text-gray-200">${name.charAt(0).toUpperCase()}</span>
                    </div>
                    <h4 class="text-xl font-bold text-secondary dark:text-gray-100">${name}</h4>
                    <span class="mt-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest border ${roleStyle}">
                        ${formattedRole}
                    </span>
                </div>

                <div class="bg-gray-50 dark:bg-dark-bg rounded-2xl p-4 border border-gray-100 dark:border-dark-border">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 bg-white dark:bg-dark-surface rounded-full shadow-sm flex items-center justify-center text-gray-500">
                            <i data-lucide="mail" class="w-5 h-5"></i>
                        </div>
                        <div class="flex-1 min-w-0">
                            <p class="text-[10px] font-black text-gray-400 dark:text-dark-muted uppercase tracking-widest mb-0.5">Account Email</p>
                            <p class="text-sm font-bold text-secondary dark:text-gray-200 truncate">${email}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    lucide.createIcons();
};

// ==============================================
// RENDER
// ==============================================

function render() {
    app.innerHTML = '';

    // Header (Always Visible)
    const header = document.createElement('header');
    header.className = 'bg-secondary dark:bg-dark-surface text-white p-6 sticky top-0 z-20 shadow-lg border-b dark:border-dark-border transition-colors duration-300';
    header.innerHTML = `
        <div class="flex justify-between items-center">
            <div>
                <h1 class="text-xl font-[900] tracking-tight">Staff Portal</h1>
                <p class="text-xs text-gray-400 dark:text-dark-muted font-bold tracking-widest uppercase">N-Cafe Manager</p>
            </div>
            <div class="flex items-center gap-3">
                <!-- Theme Toggle Switch -->
                <div onclick="toggleDarkMode()" class="w-14 h-8 bg-white/10 dark:bg-dark-bg/50 rounded-full p-1 cursor-pointer transition-all active:scale-95 group">
                    <div class="h-6 w-6 rounded-full bg-white dark:bg-primary shadow-sm flex items-center justify-center transition-all ${staffState.isDarkMode ? 'translate-x-6' : 'translate-x-0'}">
                        <i data-lucide="${staffState.isDarkMode ? 'sun' : 'moon'}" class="w-4 h-4 text-primary dark:text-white"></i>
                    </div>
                </div>
                <!-- Profile/Settings Button -->
                <div onclick="openProfileModal()" class="w-10 h-10 bg-white/10 hover:bg-white/20 text-white rounded-xl flex items-center justify-center cursor-pointer transition-all active:scale-95 border border-white/10">
                    <i data-lucide="user" class="w-5 h-5"></i>
                </div>
                <!-- Logout Button -->
                <div onclick="handleLogout()" class="w-10 h-10 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl flex items-center justify-center cursor-pointer transition-all shadow-sm active:scale-95 border border-red-500/20">
                    <i data-lucide="log-out" class="w-5 h-5"></i>
                </div>
            </div>
        </div>
    `;
    app.appendChild(header);

    // Content based on current tab
    if (staffState.currentTab === 'home') {
        renderHome();
    } else if (staffState.currentTab === 'orders') {
        renderOrders();
    } else if (staffState.currentTab === 'scanner') {
        renderScanner();
    } else if (staffState.currentTab === 'stock') {
        renderStock();
    } else if (staffState.currentTab === 'comms') {
        renderComms();
    }

    // Floating Navigation
    renderNavigation();

    lucide.createIcons();
}

function renderHome() {
    const content = document.createElement('main');
    content.className = 'p-6 pb-24';

    const preparing = orders.filter(o => o.status === 'preparing');
    const ready = orders.filter(o => o.status === 'ready');

    // UI Helpers (Premium Narrow Tile Design)
    const getTileClass = (type, color) => {
        const isActive = staffState.homeFilter === type;
        const colorHex = color === 'orange' ? '#f97316' : '#22c55e';
        const base = "relative p-6 rounded-[2.5rem] transition-all cursor-pointer border-[3px] h-32 flex flex-col justify-between overflow-hidden ";
        const stateClasses = isActive
            ? `border-[${colorHex}] bg-white dark:bg-dark-surface shadow-2xl scale-[1.02] active:scale-[0.98]`
            : `border-gray-200 dark:border-transparent bg-gray-50/80 dark:bg-[#111827] opacity-60 hover:opacity-100`;
        return base + stateClasses;
    };

    content.innerHTML = `
        <div class="space-y-6">
            <div class="grid grid-cols-2 gap-4">
                <!-- Preparing Tile -->
                <div onclick="staffState.homeFilter = staffState.homeFilter === 'preparing' ? 'all' : 'preparing'; render()" 
                    class="${getTileClass('preparing', 'orange')}">
                    <div class="flex justify-between items-start">
                        <div class="p-3 bg-orange-500/10 rounded-2xl text-orange-600 dark:text-orange-500">
                            <i data-lucide="chef-hat" class="w-6 h-6"></i>
                        </div>
                        <span class="text-4xl font-black text-orange-600 dark:text-orange-500 mt-2">${preparing.length}</span>
                    </div>
                    <p class="text-[11px] font-black text-orange-600 dark:text-orange-500/80 uppercase tracking-[0.15em] ml-1">PREPARING</p>
                </div>
                
                <!-- Ready Tile -->
                <div onclick="staffState.homeFilter = staffState.homeFilter === 'ready' ? 'all' : 'ready'; render()" 
                    class="${getTileClass('ready', 'green')}">
                    <div class="flex justify-between items-start">
                        <div class="p-3 bg-[#22c55e]/10 rounded-2xl text-[#22c55e]">
                            <i data-lucide="bell" class="w-6 h-6"></i>
                        </div>
                        <span class="text-4xl font-black text-[#22c55e] mt-2">${ready.length}</span>
                    </div>
                    <p class="text-[11px] font-black text-[#22c55e]/80 uppercase tracking-[0.15em] ml-1">READY</p>
                </div>
            </div>

            <!-- Monitor List -->
            <div class="space-y-8 animate-fade-in">
                ${(staffState.homeFilter === 'all' || staffState.homeFilter === 'preparing') ? `
                <div class="space-y-4">
                    <div class="flex items-center justify-between mb-2 px-1">
                        <div class="flex items-center gap-2">
                            <span class="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                            <h2 class="text-sm font-black text-secondary dark:text-gray-100 uppercase tracking-widest">Active Preparing</h2>
                        </div>
                        ${staffState.homeFilter !== 'all' ? `<button onclick="staffState.homeFilter='all'; render()" class="text-[10px] font-bold text-primary underline">Show All</button>` : ''}
                    </div>
                    
                    <div class="grid gap-4">
                        ${preparing.length === 0 ? `
                            <div class="bg-gray-50 dark:bg-dark-surface/50 border-2 border-dashed border-gray-100 dark:border-dark-border rounded-2xl py-8 text-center text-gray-400 text-xs font-bold">
                                No orders currently preparing.
                            </div>
                        ` : preparing.map(o => `
                            <!-- Compact Mini-Card Design -->
                            <div class="bg-white dark:bg-[#111827] p-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xl transition-all hover:scale-[1.01] active:scale-[0.98]">
                                <div class="flex justify-between items-start mb-1">
                                    <span class="text-[10px] font-black text-gray-400 dark:text-gray-500 tracking-tighter uppercase">#${o.id.slice(-12)}</span>
                                    <span class="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase">${new Date(o.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>

                                <div class="mb-3">
                                    <h3 class="text-base font-black text-secondary dark:text-white leading-tight mb-1 truncate">${o.user?.id || 'Guest'}</h3>
                                    <span class="inline-block px-2 py-0.5 border border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-500 rounded-md text-[9px] font-black uppercase tracking-widest">PREPARING</span>
                                </div>
                                
                                <div class="space-y-0.5 mb-4">
                                    ${o.items.map(i => `
                                        <div class="text-xs font-bold text-gray-600 dark:text-gray-400">
                                            <span class="text-primary dark:text-orange-500 mr-1">${i.quantity}x</span> ${i.name}
                                        </div>
                                    `).join('')}
                                </div>

                                <div class="grid grid-cols-2 gap-2">
                                    <button onclick="updateStatus('${o.id}', 'ready')" 
                                        class="py-3 bg-[#22c55e] hover:bg-[#16a34a] text-white rounded-xl text-xs font-black transition-all shadow-lg shadow-green-500/10 flex items-center justify-center gap-2 active:scale-95">
                                        Mark Ready
                                    </button>
                                    <button onclick="updateStatus('${o.id}', 'completed')" 
                                        class="py-3 bg-[#3b82f6] hover:bg-[#2563eb] text-white rounded-xl text-xs font-black transition-all shadow-lg shadow-blue-500/10 flex items-center justify-center gap-2 active:scale-95">
                                        Complete
                                    </button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                ` : ''}

                ${(staffState.homeFilter === 'all' || staffState.homeFilter === 'ready') ? `
                <div class="space-y-4">
                    <div class="flex items-center justify-between mb-2 px-1">
                        <div class="flex items-center gap-2">
                            <span class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                            <h2 class="text-sm font-black text-secondary dark:text-gray-100 uppercase tracking-widest">Ready for Pickup</h2>
                        </div>
                        ${staffState.homeFilter !== 'all' ? `<button onclick="staffState.homeFilter='all'; render()" class="text-[10px] font-bold text-primary underline">Show All</button>` : ''}
                    </div>
                    
                    <div class="grid gap-4">
                        ${ready.length === 0 ? `
                            <div class="bg-gray-50 dark:bg-dark-surface/50 border-2 border-dashed border-gray-100 dark:border-dark-border rounded-2xl py-8 text-center text-gray-400 text-xs font-bold">
                                Nothing ready for pickup.
                            </div>
                        ` : ready.map(o => `
                            <!-- Compact Mini-Card Design -->
                            <div class="bg-white dark:bg-[#111827] p-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xl border-l-[6px] border-l-[#22c55e] transition-all hover:scale-[1.01] active:scale-[0.98]">
                                <div class="flex justify-between items-start mb-1">
                                    <span class="text-[10px] font-black text-gray-400 dark:text-gray-500 tracking-tighter uppercase">#${o.id.slice(-12)}</span>
                                    <span class="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase">${new Date(o.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>

                                <div class="mb-3">
                                    <h3 class="text-base font-black text-secondary dark:text-white leading-tight mb-1 truncate">${o.user?.id || 'Guest'}</h3>
                                    <span class="inline-block px-2 py-0.5 border border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-500 rounded-md text-[9px] font-black uppercase tracking-widest">READY</span>
                                </div>
                                
                                <div class="space-y-0.5 mb-4">
                                    ${o.items.map(i => `
                                        <div class="text-xs font-bold text-gray-600 dark:text-gray-400">
                                            <span class="text-primary dark:text-orange-500 mr-1">${i.quantity}x</span> ${i.name}
                                        </div>
                                    `).join('')}
                                </div>

                                <div class="grid grid-cols-1">
                                    <button onclick="updateStatus('${o.id}', 'completed')" 
                                        class="py-3 bg-[#3b82f6] hover:bg-[#2563eb] text-white rounded-xl text-xs font-black transition-all shadow-lg shadow-blue-500/10 flex items-center justify-center gap-2 active:scale-95">
                                        Complete
                                    </button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                ` : ''}
            </div>
        </div>
    `;

    app.appendChild(content);
}

function renderOrders() {
    const content = document.createElement('main');
    content.className = 'p-6 pb-24';

    // Stats - Filtered by Date (for revenue and completed logs)
    const filteredByDate = orders.filter(o => {
        if (!o.date) return false;
        const d = (o.date && typeof o.date.toDate === 'function') ? o.date.toDate() : new Date(o.date);
        if (isNaN(d.getTime())) return false;

        const orderDate = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        return orderDate >= staffState.startDate && orderDate <= staffState.endDate;
    });

    const revenue = filteredByDate
        .filter(o => o.status === 'completed')
        .reduce((sum, o) => sum + (o.total || 0), 0);

    // Active orders are ALWAYS tracked across all time to prevent kitchen oversight
    const activeOrdersCount = orders.filter(o => o.status === 'preparing' || o.status === 'ready').length;
    const completedOrdersCount = filteredByDate.filter(o => o.status === 'completed').length;

    // UI Helpers (Premium Narrow Tile Design)
    const getTileClass = (type, color) => {
        const isActive = (staffState.orderFilter || 'active') === type;
        const colorHex = color === 'orange' ? '#f97316' : '#22c55e';
        const base = "relative p-6 rounded-[2.5rem] transition-all cursor-pointer border-[3px] h-32 flex flex-col justify-between overflow-hidden ";
        const stateClasses = isActive
            ? `border-[${colorHex}] bg-white dark:bg-dark-surface shadow-2xl scale-[1.02] active:scale-[0.98]`
            : `border-gray-200 dark:border-transparent bg-gray-50/80 dark:bg-[#111827] opacity-60 hover:opacity-100`;
        return base + stateClasses;
    };

    content.innerHTML = `
        <div class="space-y-6">
            <!-- Summary Dashboard -->
            <div class="grid grid-cols-2 gap-4">
                <!-- Active Orders Tile -->
                <div onclick="staffState.orderFilter='active'; render()" 
                    class="${getTileClass('active', 'orange')}">
                    <div class="flex justify-between items-start">
                        <div class="p-3 bg-orange-500/10 rounded-2xl text-orange-600 dark:text-orange-500">
                            <i data-lucide="activity" class="w-6 h-6"></i>
                        </div>
                        <span class="text-4xl font-black text-orange-600 dark:text-orange-500 mt-2">${activeOrdersCount}</span>
                    </div>
                    <p class="text-[11px] font-black text-orange-600 dark:text-orange-500/80 uppercase tracking-[0.15em] ml-1">ACTIVE</p>
                </div>
                
                <!-- Completed Orders Tile -->
                <div onclick="staffState.orderFilter='completed'; render()" 
                    class="${getTileClass('completed', 'green')}">
                    <div class="flex justify-between items-start">
                        <div class="p-3 bg-[#22c55e]/10 rounded-2xl text-[#22c55e]">
                            <i data-lucide="check-circle" class="w-6 h-6"></i>
                        </div>
                        <span class="text-4xl font-black text-[#22c55e] mt-2">${completedOrdersCount}</span>
                    </div>
                    <p class="text-[11px] font-black text-[#22c55e]/80 uppercase tracking-[0.15em] ml-1">COMPLETED</p>
                </div>
            </div>

            <div class="bg-secondary dark:bg-dark-surface text-white p-6 rounded-3xl relative overflow-hidden border dark:border-dark-border transition-colors shadow-lg">
                <div class="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-10 -mt-10"></div>
                <div class="relative z-10 flex justify-between items-center">
                    <div>
                        <p class="text-gray-400 dark:text-dark-muted font-bold text-[10px] mb-1 uppercase tracking-[0.2em]">Live Revenue</p>
                        <h3 class="text-3xl font-[900] text-primary">LKR ${revenue.toLocaleString()}</h3>
                    </div>
                    <i data-lucide="trending-up" class="w-10 h-10 text-white/20"></i>
                </div>
            </div>

            <!-- Date Filter & Search Combined -->
            <div class="bg-white dark:bg-dark-surface p-6 rounded-3xl border border-gray-100 dark:border-dark-border shadow-sm space-y-4">
                <div class="flex flex-wrap gap-2">
                    ${['today', 'yesterday', 'last7', 'last30', 'custom'].map(type => `
                        <button onclick="updateDateFilter('${type}')" class="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${staffState.dateFilter === type ? 'bg-primary text-white shadow-md shadow-orange-500/20' : 'bg-gray-100 dark:bg-dark-bg text-gray-500 dark:text-dark-muted'}">
                            ${type === 'last30' ? '30 days' : type}
                        </button>
                    `).join('')}
                </div>

                ${staffState.dateFilter === 'custom' ? `
                    <div class="grid grid-cols-2 gap-3 animate-fade-in">
                        <input type="date" value="${staffState.startDate}" onchange="handleDateChange('startDate', this.value)" class="bg-gray-50 dark:bg-dark-bg p-3 rounded-xl text-xs font-bold border border-gray-100 dark:border-dark-border outline-none dark:text-gray-100">
                        <input type="date" value="${staffState.endDate}" onchange="handleDateChange('endDate', this.value)" class="bg-gray-50 dark:bg-dark-bg p-3 rounded-xl text-xs font-bold border border-gray-100 dark:border-dark-border outline-none dark:text-gray-100">
                    </div>
                ` : ''}

                <div class="relative">
                    <i data-lucide="search" class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-dark-muted"></i>
                    <input type="text" placeholder="Search Order ID, Name..." 
                        value="${staffState.orderSearch}"
                        oninput="staffState.orderSearch = this.value; window.updateOrdersList()"
                        class="w-full bg-gray-50 dark:bg-dark-bg border border-gray-100 dark:border-dark-border rounded-xl pl-11 pr-4 py-3 text-sm font-bold text-secondary dark:text-gray-100 placeholder:text-gray-300 dark:placeholder:text-gray-600 focus:border-primary outline-none transition-all">
                </div>
            </div>

            <div class="flex justify-between items-center">
                 <h2 id="orders-list-title" class="text-lg font-black dark:text-gray-100 uppercase tracking-tight">Order Log</h2>
                 <div id="orders-reset-container"></div>
            </div>
            
            <div id="orders-list-container" class="space-y-3">
                <!-- Populated by updateOrdersList -->
            </div>
        </div>
    `;

    app.appendChild(content);
    window.updateOrdersList();
}

window.updateOrdersList = function () {
    const filter = staffState.orderFilter || 'active';
    const searchQuery = (staffState.orderSearch || '').toLowerCase();

    // 1. Apply Filtering Logic
    let filteredOrders = [];
    let listTitle = 'Active Orders';

    if (searchQuery) {
        // GLOBAL SEARCH OVERRIDE: Search everything regardless of status/date
        const cleanQuery = searchQuery.replace(/#/g, '');
        filteredOrders = orders.filter(o => {
            const id = String(o.id || '').toLowerCase().replace(/#/g, '');
            const userName = String(o.user?.name || '').toLowerCase();
            const userId = String(o.user?.id || '').toLowerCase();
            const itemMatch = o.items && o.items.some(i => String(i.name || '').toLowerCase().includes(cleanQuery));

            return id.includes(cleanQuery) || userName.includes(cleanQuery) || userId.includes(cleanQuery) || itemMatch;
        });
        listTitle = `Search: "${searchQuery}"`;
    } else {
        // NORMAL FILTERED VIEW (Status + Date)
        const displayOrders = orders.filter(o => {
            if (!o.date) return false;
            // Robust Date Parsing (Handles ISO strings or Firestore Timestamps)
            const d = (o.date && typeof o.date.toDate === 'function') ? o.date.toDate() : new Date(o.date);
            if (isNaN(d.getTime())) return false;

            const orderDate = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
            const withinDate = orderDate >= staffState.startDate && orderDate <= staffState.endDate;
            const isActive = o.status === 'preparing' || o.status === 'ready';
            return withinDate || isActive;
        });

        if (filter === 'preparing') {
            filteredOrders = displayOrders.filter(o => o.status === 'preparing');
            listTitle = 'Preparing Orders';
        } else if (filter === 'ready') {
            filteredOrders = displayOrders.filter(o => o.status === 'ready');
            listTitle = 'Ready Orders';
        } else if (filter === 'completed') {
            filteredOrders = displayOrders.filter(o => o.status === 'completed');
            listTitle = 'Completed Orders';
        } else if (filter === 'total') {
            // BACKUP VERSION BEHAVIOR: 'Total' shows EVERYTHING regardless of date
            filteredOrders = orders;
            listTitle = 'All Time Orders';
        } else {
            // Default Active View
            filteredOrders = displayOrders.filter(o => o.status !== 'completed' && o.status !== 'cancelled');
            listTitle = 'Active Orders';
        }
    }

    // 4. Update DOM
    const listContainer = document.getElementById('orders-list-container');
    const titleEl = document.getElementById('orders-list-title');
    const resetContainer = document.getElementById('orders-reset-container');

    if (listContainer) {
        if (filteredOrders.length === 0) {
            listContainer.innerHTML = `
                <div class="text-center py-12 text-gray-400">
                    <i data-lucide="search-x" class="w-16 h-16 mx-auto mb-4 opacity-50"></i>
                    <p class="font-bold">No orders found</p>
                    <p class="text-sm mt-2">${searchQuery ? `Matching "${searchQuery}"` : `Filter: ${listTitle}`}</p>
                </div>
            `;
        } else {
            listContainer.innerHTML = filteredOrders.map(order => {
                const isPreparing = order.status === 'preparing';
                const isReady = order.status === 'ready';
                const isCompleted = order.status === 'completed';

                // Robust date parsing
                const orderDateObj = (order.date && typeof order.date.toDate === 'function') ? order.date.toDate() : new Date(order.date);
                const timeStr = isNaN(orderDateObj.getTime()) ? '' : orderDateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const dateStr = isNaN(orderDateObj.getTime()) ? '' : orderDateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

                return `
                <!-- Compact Mini-Card Design (Order Log) -->
                <div class="bg-white dark:bg-[#111827] p-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xl transition-all hover:scale-[1.01] active:scale-[0.98] ${isReady ? 'border-l-[6px] border-l-[#22c55e]' : ''} ${isCompleted ? 'opacity-90 grayscale-[0.2]' : ''}">
                    <div class="flex justify-between items-start mb-1">
                        <span class="text-[10px] font-black text-gray-400 dark:text-gray-500 tracking-tighter uppercase">#${order.id.slice(-12)}</span>
                        <div class="text-right leading-none">
                            <div class="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase">${dateStr}</div>
                            <div class="text-[9px] font-bold text-gray-400/80 dark:text-gray-500/80 uppercase mt-0.5">${timeStr}</div>
                        </div>
                    </div>

                    <div class="mb-3">
                        <h3 class="text-base font-black text-secondary dark:text-white leading-tight mb-1 truncate">${order.user?.id || 'Guest'}</h3>
                        <span class="inline-block px-2 py-0.5 border ${isPreparing ? 'border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-500' : (isReady ? 'border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-500' : 'border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-500')} rounded-md text-[9px] font-black uppercase tracking-widest">
                            ${order.status.toUpperCase()}
                        </span>
                    </div>
                    
                    <div class="space-y-0.5 mb-4">
                        ${order.items.map(i => `
                            <div class="text-xs font-bold text-gray-600 dark:text-gray-400">
                                <span class="text-primary dark:text-orange-500 mr-1">${i.quantity}x</span> ${i.name}
                            </div>
                        `).join('')}
                    </div>

                    ${!isCompleted ? `
                    <div class="grid ${isPreparing ? 'grid-cols-2' : 'grid-cols-1'} gap-2">
                        ${isPreparing ? `
                            <button onclick="updateStatus('${order.id}', 'ready')" 
                                class="py-3 bg-[#22c55e] hover:bg-[#16a34a] text-white rounded-xl text-xs font-black transition-all shadow-lg shadow-green-500/10 flex items-center justify-center gap-2 active:scale-95">
                                Mark Ready
                            </button>
                        ` : ''}
                        <button onclick="updateStatus('${order.id}', 'completed')" 
                            class="py-3 bg-[#3b82f6] hover:bg-[#2563eb] text-white rounded-xl text-xs font-black transition-all shadow-lg shadow-blue-500/10 flex items-center justify-center gap-2 active:scale-95">
                            Complete
                        </button>
                    </div>
                    ` : `
                    <div class="pt-2 border-t border-gray-100 dark:border-gray-800 flex justify-between items-center gap-4">
                        <button onclick="viewBill('${order.id}')" class="flex-1 py-2.5 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-700 text-secondary dark:text-gray-300 rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-2 active:scale-95 border border-gray-200 dark:border-gray-700 uppercase tracking-widest">
                            <i data-lucide="receipt" class="w-3 h-3"></i> View Bill
                        </button>
                        <div class="text-xs font-black text-secondary dark:text-white shrink-0">LKR ${(order.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    </div>
                    `}
                </div>
                `;
            }).join('');
        }
    }

    if (titleEl) {
        titleEl.textContent = `${listTitle} (${filteredOrders.length})`;
    }

    if (resetContainer) {
        resetContainer.innerHTML = filter !== 'active' ? `<button onclick="staffState.orderFilter='active'; render()" class="text-xs font-bold text-primary">Reset Filter</button>` : '';
    }

    // Re-init lucide
    lucide.createIcons();
}


function renderScanner() {
    const content = document.createElement('main');
    content.className = 'p-6 pb-24';

    content.innerHTML = `
        <div class="flex flex-col items-center justify-center h-full text-center py-4">
            <div class="w-64 h-64 bg-black rounded-3xl relative flex items-center justify-center mb-6 overflow-hidden shadow-2xl">
                <!-- Video Feed -->
                <video id="qr-video" class="w-full h-full object-cover" playsinline muted></video>
                
                <!-- Overlay -->
                <div id="scanner-overlay" class="absolute inset-0 border-4 border-primary/50 rounded-3xl z-10 pointer-events-none hidden">
                    <div class="absolute inset-x-0 top-1/2 h-0.5 bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)] animate-scan"></div>
                </div>

                <!-- Placeholder / Start Button -->
                <div id="scanner-placeholder" class="absolute inset-0 flex flex-col items-center justify-center z-20 bg-gray-900 text-white p-4">
                    <div class="p-3 bg-white/10 rounded-full mb-3">
                        <i data-lucide="camera" class="w-8 h-8"></i>
                    </div>
                    <p class="text-xs font-bold mb-3 max-w-[200px]">Camera access required to scan QR codes</p>
                    <button onclick="startScanner()" class="bg-primary text-white px-6 py-2 rounded-xl text-sm font-bold shadow-lg shadow-orange-500/20 active:scale-95 transition-all">
                        Start Camera
                    </button>
                    ${!window.isSecureContext ? '<p class="text-[10px] text-red-400 mt-2 font-bold bg-white/10 px-2 py-1 rounded">HTTPS Required</p>' : ''}
                </div>
            </div>
            
            <h2 class="text-xl font-[900] text-secondary dark:text-gray-100 mb-1">Scan Customer QR</h2>
            <p class="text-gray-400 dark:text-dark-muted text-sm mb-6 px-6">Point camera at the customer's order QR code.</p>
            
            <!-- Manual Entry -->
            <div class="w-full bg-white dark:bg-dark-surface p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-dark-border max-w-sm transition-colors">
                <p class="text-xs text-gray-400 dark:text-dark-muted mb-2 font-bold text-left ml-1">Manual Order Lookup</p>
                <div class="flex gap-2">
                    <input id="manual-input" type="text" placeholder="ORD..." class="flex-1 p-3 bg-gray-50 dark:bg-dark-bg/60 border border-gray-200 dark:border-dark-border rounded-xl text-sm font-bold text-secondary dark:text-gray-100 outline-none focus:border-primary focus:bg-white dark:focus:bg-dark-bg transition-all uppercase placeholder:text-gray-300 dark:placeholder:text-gray-600">
                    <button onclick="handleValidScan(document.getElementById('manual-input').value)" class="bg-primary text-white p-3 rounded-xl hover:bg-orange-600 active:scale-95 transition-all shadow-lg shadow-orange-500/20">
                        <i data-lucide="arrow-right" class="w-5 h-5"></i>
                    </button>
                </div>
            </div>

            <!-- Scan Result Container -->
            <div id="scan-result" class="w-full max-w-sm mt-6 empty:hidden"></div>
        </div>
    `;

    app.appendChild(content);

    // Stop partial streams if any exist (cleanup)
    if (window.scannerStream) {
        window.scannerStream.getTracks().forEach(track => track.stop());
    }
}

window.startScanner = async function () {
    const video = document.getElementById('qr-video');
    const placeholder = document.getElementById('scanner-placeholder');
    const overlay = document.getElementById('scanner-overlay');

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showToast("Scanner Error", "Camera API not supported in this browser.", "error");
        return;
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" }
        });

        window.scannerStream = stream;
        video.srcObject = stream;
        video.setAttribute("playsinline", true); // required to tell iOS safari we don't want fullscreen
        video.play();

        requestAnimationFrame(() => {
            placeholder.classList.add('hidden');
            overlay.classList.remove('hidden');
            scanFrame(); // Start processing frames (mock for now, or integrated if lib added)
        });

    } catch (err) {
        console.error("Camera Error:", err);
        showToast("Camera Access Error", "Please allow camera permissions and ensure you are on a secure connection (HTTPS).", "error");
    }
};

window.scanFrame = function () {
    const video = document.getElementById('qr-video');

    // Stop if tab switched or stream ended
    if (!video || !window.scannerStream || staffState.currentTab !== 'scanner') return;

    // Check if video is ready
    if (video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth > 0) {
        // Create canvas for processing (optimized with willReadFrequently)
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", { willReadFrequently: true });

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        try {
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

            // Check if jsQR is loaded
            if (typeof jsQR !== 'undefined') {
                const code = jsQR(imageData.data, imageData.width, imageData.height, {
                    inversionAttempts: "dontInvert",
                });

                if (code && code.data) {
                    // Success!
                    // Check if different from last scan to avoid UI flickering?
                    // For now just pass it. handleValidScan is idempotent-ish (just updates UI).
                    handleValidScan(code.data);
                }
            }
        } catch (e) {
            console.warn("Scan error:", e);
        }
    }

    // Loop
    requestAnimationFrame(scanFrame);
};

window.handleValidScan = function (scannedText) {
    const resultContainer = document.getElementById('scan-result');
    if (!scannedText) return;

    // Normalize
    const query = scannedText.trim();

    // Find Order
    const order = orders.find(o => o.id === query); // Exact match first

    if (!order) {
        resultContainer.innerHTML = `
            <div class="bg-red-50 p-4 rounded-xl border border-red-100 flex items-center gap-3 text-left animate-in slide-in-from-bottom-2">
                <div class="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0 text-red-500">
                    <i data-lucide="alert-circle" class="w-5 h-5"></i>
                </div>
                <div>
                    <h4 class="font-bold text-red-600 text-sm">Order Not Found</h4>
                    <p class="text-xs text-red-400">ID "${query}" does not exist.</p>
                </div>
            </div>
        `;
        lucide.createIcons();
        return;
    }

    // Render Found Order
    resultContainer.innerHTML = `
        <div class="bg-white dark:bg-dark-surface p-0 rounded-2xl border border-gray-200 dark:border-dark-border shadow-xl overflow-hidden text-left animate-in slide-in-from-bottom-4 zoom-in-95 transition-colors">
            <!-- Header -->
            <div class="bg-secondary dark:bg-dark-bg p-4 text-white flex justify-between items-start border-b dark:border-dark-border">
                <div>
                    <span class="text-[10px] font-bold text-gray-400 dark:text-dark-muted uppercase tracking-wider block mb-1">Items Verified</span>
                    <h3 class="text-xl font-[900] tracking-tight dark:text-gray-100">#${order.id}</h3>
                </div>
                <div class="bg-white/10 px-3 py-1 rounded-lg">
                    <span class="text-xs font-bold ${order.status === 'completed' ? 'text-green-400' : 'text-orange-300'} uppercase">${order.status}</span>
                </div>
            </div>
            
            <!-- Items -->
            <div class="p-4 bg-gray-50 dark:bg-dark-surface/50 border-b border-gray-100 dark:border-dark-border max-h-40 overflow-y-auto">
                ${order.items.map(item => `
                    <div class="flex justify-between items-center mb-2 last:mb-0 text-sm">
                        <span class="font-bold text-gray-600 dark:text-gray-300 transition-colors">${item.quantity}x ${item.name}</span>
                    </div>
                `).join('')}
            </div>

            <!-- Actions -->
            <div class="p-4 grid grid-cols-2 gap-3">
                ${order.status === 'preparing' ? `
                    <button onclick="updateStatus('${order.id}', 'ready'); handleValidScan('${order.id}')" 
                        class="col-span-2 bg-green-500 text-white py-3 rounded-xl font-bold text-sm hover:bg-green-600 shadow-lg shadow-green-500/20 active:scale-95 transition-all flex items-center justify-center gap-2">
                        <i data-lucide="bell" class="w-4 h-4"></i> Mark Ready
                    </button>
                ` : ''}
                
                ${order.status === 'ready' ? `
                    <button onclick="updateStatus('${order.id}', 'completed'); handleValidScan('${order.id}')" 
                        class="col-span-2 bg-blue-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-blue-700 shadow-lg shadow-blue-500/20 active:scale-95 transition-all flex items-center justify-center gap-2">
                        <i data-lucide="check-circle-2" class="w-4 h-4"></i> Complete Order
                    </button>
                ` : ''}

                ${order.status === 'completed' ? `
                    <div class="col-span-2 text-center py-2 text-green-600 font-bold text-sm flex items-center justify-center gap-2">
                        <i data-lucide="check-check" class="w-5 h-5"></i> Order is Completed
                    </div>
                ` : ''}
            </div>
        </div>
    `;
    lucide.createIcons();
}

// Helper function to generate HTML for stock items
function generateStockItemsHTML(filteredItems, menuItems) {
    if (filteredItems.length === 0) {
        return `
            <div class="text-center py-10 text-gray-400">
                <i data-lucide="package-search" class="w-12 h-12 mx-auto mb-2 opacity-50"></i>
                <p class="font-bold text-sm">No items found</p>
                <p class="text-[10px] text-gray-300 font-mono mt-1 mb-2">
                    Total: ${menuItems.length} | 
                    Src: ${menuItems[0] && menuItems[0].name === 'System Offline' ? 'EMERGENCY' : (window.DEFAULT_MENU && menuItems === window.DEFAULT_MENU ? 'DEFAULT' : 'DataStore')}
                </p>
                ${(staffState.stockSearch === '' && staffState.stockCategory === 'all') ? `
                    <button onclick="DataStore.resetMenuToDefaults(); window.updateStockView()" class="mt-4 px-4 py-2 bg-primary text-white rounded-lg text-xs font-bold shadow-lg shadow-orange-500/20 active:scale-95 transition-transform">
                        Reload Default Menu
                    </button>
                ` : `
                    <button onclick="staffState.stockSearch=''; staffState.stockCategory='all'; window.updateStockView()" class="mt-2 text-primary font-bold text-xs">Clear Filters</button>
                `}
            </div>
        `;
    }

    return filteredItems.map(item => `
        <div class="bg-white dark:bg-dark-surface p-3 rounded-xl border ${item.isAvailable ? 'border-gray-100 dark:border-dark-border' : 'border-red-100 dark:border-red-500/20 bg-red-50/20'} flex items-center justify-between transition-all">
            <div class="flex items-center gap-3">
                <div class="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 dark:bg-dark-bg relative">
                    <img src="${item.image || ''}" class="w-full h-full object-cover ${!item.isAvailable ? 'grayscale opacity-50' : ''}" onerror="this.src='https://placehold.co/100'">
                    ${!item.isAvailable ? '<div class="absolute inset-0 bg-black/30 flex items-center justify-center"><i data-lucide="slash" class="w-4 h-4 text-white"></i></div>' : ''}
                </div>
                <div>
                    <h4 class="font-bold text-sm text-secondary dark:text-gray-100 ${!item.isAvailable ? 'text-gray-500 dark:text-dark-muted' : ''}">${item.name || 'Unnamed Item'}</h4>
                    <p class="text-[10px] text-gray-400 dark:text-dark-muted font-bold uppercase tracking-wider">${item.category || 'Misc'}</p>
                </div>
            </div>
            
            <button onclick="toggleStock(${item.id})" 
                class="relative w-14 h-8 rounded-full transition-colors duration-200 ${item.isAvailable ? 'bg-green-500' : 'bg-gray-200'}">
                <div class="absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-sm transition-transform duration-200 ${item.isAvailable ? 'translate-x-6' : 'translate-x-0'} flex items-center justify-center">
                    <i data-lucide="${item.isAvailable ? 'check' : 'x'}" class="w-3 h-3 ${item.isAvailable ? 'text-green-500' : 'text-gray-300'}"></i>
                </div>
            </button>
        </div>
    `).join('');
}

// Function to update only the stock items list
window.updateStockView = function () {
    try {
        const stockListEl = document.getElementById('stock-list');
        const itemCountEl = document.getElementById('stock-item-count');

        if (!stockListEl || !itemCountEl) {
            // If elements don't exist, it means renderStock hasn't run yet or tab is not stock
            return;
        }

        let menuItems = (window.DataStore && DataStore.getMenu()) || [];

        // FALLBACK 1: Check window.menuItems
        if (menuItems.length === 0 && window.menuItems && window.menuItems.length > 0) {
            menuItems = window.menuItems;
        }

        // FALLBACK 2: Check window.DEFAULT_MENU (Explicitly exposed from data.js)
        if (menuItems.length === 0 && window.DEFAULT_MENU && window.DEFAULT_MENU.length > 0) {
            menuItems = window.DEFAULT_MENU;
        }

        // FALLBACK 3: Emergency Hardcoded Data (If data.js is completely dead)
        if (menuItems.length === 0) {
            menuItems = [
                { id: 101, name: "System Offline", category: "Pastries", price: 0, isAvailable: false, image: "https://placehold.co/100?text=Offline" }
            ];
        }

        // Filter Items
        const filteredItems = Array.isArray(menuItems) ? menuItems.filter(item => {
            if (!item) return false;
            const matchesCategory = staffState.stockCategory === 'all' || item.category === staffState.stockCategory;
            const itemName = item.name ? item.name.toLowerCase() : '';
            const matchesSearch = itemName.includes((staffState.stockSearch || '').toLowerCase());
            return matchesCategory && matchesSearch;
        }) : [];

        stockListEl.innerHTML = generateStockItemsHTML(filteredItems, menuItems);
        itemCountEl.textContent = `${filteredItems.length} Items`;

        // Re-initialize Lucide icons for newly added elements
        lucide.createIcons();

    } catch (err) {
        console.error("Update Stock View Error:", err);
        const stockListEl = document.getElementById('stock-list');
        if (stockListEl) {
            stockListEl.innerHTML = `<div class="p-4 text-red-500">Error updating stock view: ${err.message}</div>`;
        }
    }
};


function renderStock() {
    try {
        const content = document.createElement('main');
        content.className = 'p-6 pb-24';

        const cats = window.categories || [{ id: 'all', name: 'All' }];

        content.innerHTML = `
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-lg font-bold dark:text-gray-100">Live Inventory</h2>
                <span id="stock-item-count" class="bg-gray-100 dark:bg-dark-surface text-gray-600 dark:text-dark-muted px-3 py-1 rounded-full text-xs font-bold border dark:border-dark-border">Loading...</span>
            </div>

            <!-- Search & Filter -->
            <div class="mb-6 space-y-4">
                <div class="relative">
                    <i data-lucide="search" class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-dark-muted"></i>
                    <input type="text" placeholder="Search items..." 
                        value="${staffState.stockSearch}"
                        oninput="staffState.stockSearch = this.value; window.updateStockView()"
                        class="w-full bg-gray-50 dark:bg-dark-bg/60 border border-gray-100 dark:border-dark-border rounded-xl pl-11 pr-4 py-3 text-sm font-bold text-secondary dark:text-gray-100 placeholder:text-gray-300 dark:placeholder:text-gray-600 focus:bg-white dark:focus:bg-dark-bg focus:border-primary/30 outline-none transition-all shadow-sm">
                </div>
                
                <div class="flex overflow-x-auto hide-scrollbar gap-4 pb-4 px-1">
                ${cats.map(cat => `
                    <button onclick="staffState.stockCategory = '${cat.id}'; window.updateStockView()" class="flex flex-col items-center gap-2 min-w-[64px] group transition-all active:scale-95">
                        <div class="w-16 h-16 rounded-2xl flex items-center justify-center transition-all ${staffState.stockCategory === cat.id ? 'bg-primary text-white shadow-lg shadow-orange-500/30' : 'bg-gray-50 dark:bg-dark-surface text-gray-400 dark:text-dark-muted border border-gray-100 dark:border-dark-border group-hover:bg-gray-100 dark:group-hover:bg-dark-bg'}">
                            <i data-lucide="${cat.icon || 'circle'}" class="w-7 h-7"></i>
                        </div>
                        <span class="text-xs font-bold tracking-wide ${staffState.stockCategory === cat.id ? 'text-primary' : 'text-gray-400 dark:text-dark-muted'} transition-colors">${cat.name}</span>
                    </button>
                `).join('')}
            </div>
            </div>
            
            <div id="stock-list" class="space-y-3">
                <!-- Stock items will be loaded here by updateStockView -->
                <div class="text-center py-10 text-gray-400">
                    <div class="w-8 h-8 border-2 border-gray-200 border-t-primary rounded-full animate-spin mx-auto mb-3"></div>
                    <p class="font-bold text-sm">Loading stock items...</p>
                </div>
            </div>
        `;

        app.appendChild(content);
        window.updateStockView(); // Initial load of stock items

    } catch (err) {
        console.error("Render Stock Error:", err);
        app.innerHTML = `<div class="p-4 text-red-500">Error rendering stock: ${err.message}</div>`;
    }
}

// Add Toggle Function to Window for Global Access
window.toggleStock = function (id) {
    const menuItems = DataStore.getMenu(); // Get latest
    const itemIndex = menuItems.findIndex(i => i.id === id);

    if (itemIndex !== -1) {
        // Toggle
        menuItems[itemIndex].isAvailable = !menuItems[itemIndex].isAvailable;

        // Save
        DataStore.saveMenu(menuItems);

        // Optimistic UI update (optional, but render() is fast enough usually)
        render();

        // Toast (Optional enhancement)
        const status = menuItems[itemIndex].isAvailable ? 'In Stock' : 'Out of Stock';
        console.log(`Updated ${menuItems[itemIndex].name} to ${status}`);
    }
};

// Listen for live updates
window.addEventListener('menu-updated', () => {
    if (staffState.currentTab === 'stock') {
        render();
    }
});



function renderComms() {
    const content = document.createElement('main');
    content.className = 'p-6 pb-24 h-screen flex flex-col';

    content.innerHTML = `
        <div class="mb-6 flex justify-center">
            <div class="bg-gray-100 dark:bg-dark-surface p-1.5 rounded-2xl flex gap-1 border border-gray-200 dark:border-dark-border w-full max-w-md shadow-inner">
                <button onclick="staffState.commsTab = 'broadcast'; render()" 
                    class="flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${staffState.commsTab === 'broadcast' ? 'bg-white dark:bg-dark-bg text-primary shadow-md shadow-gray-200/50 dark:shadow-none' : 'text-gray-500 dark:text-dark-muted hover:text-gray-700 dark:hover:text-gray-300'}">
                    Broadcast
                </button>
                <button onclick="staffState.commsTab = 'inbox'; render()" 
                    class="flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${staffState.commsTab === 'inbox' ? 'bg-white dark:bg-dark-bg text-primary shadow-md shadow-gray-200/50 dark:shadow-none' : 'text-gray-500 dark:text-dark-muted hover:text-gray-700 dark:hover:text-gray-300'}">
                    Inbox
                </button>
            </div>
        </div>

        ${staffState.commsTab === 'broadcast' ? `
            <div class="flex-1 overflow-y-auto hide-scrollbar space-y-6">
                <!-- Send Form -->
                <div class="bg-white dark:bg-dark-surface p-6 rounded-3xl border border-gray-100 dark:border-dark-border shadow-xl shadow-gray-100/10 dark:shadow-none relative overflow-hidden transition-colors">
                    <div class="absolute top-0 right-0 w-32 h-32 bg-orange-50 dark:bg-orange-500/5 rounded-full -mr-10 -mt-10 opacity-60"></div>
                    
                    <div class="relative z-10 mb-6 font-bold">
                        <div class="w-12 h-12 bg-orange-50 dark:bg-dark-bg rounded-2xl flex items-center justify-center text-primary mb-3">
                            <i data-lucide="megaphone" class="w-6 h-6"></i>
                        </div>
                        <h3 class="font-bold text-lg text-secondary dark:text-gray-100">New Announcement</h3>
                        <p class="text-xs text-gray-400 dark:text-dark-muted font-bold tracking-tight">Send notifications to all active customers</p>
                    </div>
                    
                    <form onsubmit="sendBroadcast(event)" class="space-y-5 relative z-10">
                        <div>
                            <label class="block text-xs font-bold text-gray-500 dark:text-dark-muted mb-2 ml-1">Title</label>
                            <div class="relative">
                                <i data-lucide="type" class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-600"></i>
                                <input type="text" name="title" placeholder="e.g. Happy Hour Special!" required
                                    class="w-full bg-gray-50 dark:bg-dark-bg/60 border border-gray-100 dark:border-dark-border rounded-xl pl-11 pr-4 py-3 text-sm font-bold text-secondary dark:text-gray-100 placeholder:text-gray-300 dark:placeholder:text-gray-600 focus:bg-white dark:focus:bg-dark-bg focus:border-primary/30 focus:ring-4 focus:ring-primary/10 outline-none transition-all">
                            </div>
                        </div>
                        
                        <div>
                            <label class="block text-xs font-bold text-gray-500 dark:text-dark-muted mb-2 ml-1">Message</label>
                            <div class="relative">
                                <i data-lucide="align-left" class="absolute left-4 top-4 w-4 h-4 text-gray-400 dark:text-gray-600"></i>
                                <textarea name="message" rows="3" placeholder="Tell them what's special..." required
                                    class="w-full bg-gray-50 dark:bg-dark-bg/60 border border-gray-100 dark:border-dark-border rounded-xl pl-11 pr-4 py-3 text-sm font-medium text-secondary dark:text-gray-100 placeholder:text-gray-300 dark:placeholder:text-gray-600 focus:bg-white dark:focus:bg-dark-bg focus:border-primary/30 focus:ring-4 focus:ring-primary/10 outline-none transition-all resize-none"></textarea>
                            </div>
                        </div>
                        
                        <div>
                            <label class="block text-xs font-bold text-gray-500 mb-2 ml-1">Notification Type</label>
                            <div class="grid grid-cols-3 gap-3">
                                <label class="cursor-pointer group">
                                    <input type="radio" name="type" value="offer" class="peer sr-only" checked>
                                    <div class="bg-white dark:bg-dark-bg border-2 border-gray-100 dark:border-dark-border peer-checked:border-primary peer-checked:bg-orange-50 dark:peer-checked:bg-primary/10 rounded-2xl p-3 text-center transition-all group-hover:border-primary/30">
                                        <div class="w-8 h-8 mx-auto -mt-1 mb-1 rounded-full bg-gray-50 dark:bg-dark-surface peer-checked:bg-white dark:peer-checked:bg-primary flex items-center justify-center transition-colors">
                                            <i data-lucide="ticket-percent" class="w-4 h-4 text-gray-400 dark:text-dark-muted peer-checked:text-primary dark:peer-checked:text-white transition-colors"></i>
                                        </div>
                                        <span class="text-[10px] font-bold text-gray-400 dark:text-dark-muted peer-checked:text-primary transition-colors">Offer</span>
                                    </div>
                                </label>
                                <label class="cursor-pointer group">
                                    <input type="radio" name="type" value="info" class="peer sr-only">
                                    <div class="bg-white dark:bg-dark-bg border-2 border-gray-100 dark:border-dark-border peer-checked:border-blue-500 peer-checked:bg-blue-50 dark:peer-checked:bg-blue-500/10 rounded-2xl p-3 text-center transition-all group-hover:border-blue-200">
                                        <div class="w-8 h-8 mx-auto -mt-1 mb-1 rounded-full bg-gray-50 dark:bg-dark-surface peer-checked:bg-white dark:peer-checked:bg-blue-500 flex items-center justify-center transition-colors">
                                            <i data-lucide="info" class="w-4 h-4 text-gray-400 dark:text-dark-muted peer-checked:text-blue-500 dark:peer-checked:text-white transition-colors"></i>
                                        </div>
                                        <span class="text-[10px] font-bold text-gray-400 dark:text-dark-muted peer-checked:text-blue-500 transition-colors">Info</span>
                                    </div>
                                </label>
                                <label class="cursor-pointer group">
                                    <input type="radio" name="type" value="alert" class="peer sr-only">
                                    <div class="bg-white dark:bg-dark-bg border-2 border-gray-100 dark:border-dark-border peer-checked:border-red-500 peer-checked:bg-red-50 dark:peer-checked:bg-red-500/10 rounded-2xl p-3 text-center transition-all group-hover:border-red-200">
                                        <div class="w-8 h-8 mx-auto -mt-1 mb-1 rounded-full bg-gray-50 dark:bg-dark-surface peer-checked:bg-white dark:peer-checked:bg-red-500 flex items-center justify-center transition-colors">
                                            <i data-lucide="alert-triangle" class="w-4 h-4 text-gray-400 dark:text-dark-muted peer-checked:text-red-500 dark:peer-checked:text-white transition-colors"></i>
                                        </div>
                                        <span class="text-[10px] font-bold text-gray-400 dark:text-dark-muted peer-checked:text-red-500 transition-colors">Alert</span>
                                    </div>
                                </label>
                            </div>
                        </div>
                        
                        <button type="submit" class="w-full bg-primary text-white py-4 rounded-xl font-bold shadow-lg shadow-orange-500/30 hover:bg-orange-600 transition active:scale-95 flex items-center justify-center gap-2 mt-2 group">
                            <span>Send Broadcast</span>
                            <i data-lucide="send" class="w-4 h-4 group-hover:translate-x-1 transition-transform"></i>
                        </button>
                    </form>
                </div>
                
                <div class="px-2">
                    <h3 class="text-xs font-bold text-gray-400 dark:text-dark-muted mb-4 uppercase tracking-wider flex items-center gap-2">
                        <span>Past Activity</span>
                        <div class="h-px bg-gray-100 dark:bg-dark-border flex-1"></div>
                    </h3>
                    <div id="recent-broadcasts" class="space-y-4 pl-4 border-l-2 border-gray-100 dark:border-dark-border ml-2">
                        <!-- Loaded dynamically -->
                        <div class="flex items-center gap-2 text-gray-300 text-xs py-2">
                             <div class="w-4 h-4 border-2 border-gray-200 border-t-primary rounded-full animate-spin"></div>
                             <span>Loading history...</span>
                        </div>
                    </div>
                </div>
            </div>
        ` : `
            <!-- Inbox View -->
            ${staffState.selectedChat ? renderChatInterface() : renderInboxList()}
        `}
    `;

    app.appendChild(content);

    // Load Inbox if in inbox view
    if (staffState.commsTab === 'inbox' && !staffState.inboxListener) {
        initInboxListener();
    }
    // Load Broadcast History
    if (staffState.commsTab === 'broadcast') {
        loadBroadcastHistory();
    }
}


function initInboxListener() {
    console.log('Starting Inbox Listener...');
    staffState.inboxListener = db.collection('chats').orderBy('timestamp', 'desc').onSnapshot(snap => {
        staffState.chats = [];
        snap.forEach(doc => {
            staffState.chats.push({ id: doc.id, ...doc.data() });
        });
        if (staffState.currentTab === 'comms' && staffState.commsTab === 'inbox') {
            render();
        }
    });
}

function renderInboxList() {
    if (staffState.chats.length === 0) {
        return `
            <div class="flex flex-col items-center justify-center h-64 text-center">
             <div class="w-20 h-20 bg-gray-50 dark:bg-dark-surface rounded-full flex items-center justify-center mb-4 transition-colors">
                    <i data-lucide="message-circle" class="w-8 h-8 text-gray-300 dark:text-dark-muted"></i>
                </div>
                <p class="text-secondary dark:text-gray-100 font-bold transition-colors">No Messages</p>
                <p class="text-xs text-gray-400 dark:text-dark-muted mt-1 font-bold">Customer inquiries will appear here</p>
            </div>
        `;
    }

    return `
        <div class="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
             ${staffState.chats.map(chat => `
                <div onclick="selectChat('${chat.customerId}')" class="bg-white dark:bg-dark-surface p-4 rounded-2xl border border-gray-100 dark:border-dark-border shadow-sm active:scale-95 transition-all cursor-pointer flex justify-between items-center group hover:border-primary/30 hover:shadow-md">
                    <div class="flex items-center gap-4">
                        <div class="relative">
                            <div class="w-12 h-12 bg-gray-100 dark:bg-dark-bg rounded-full flex items-center justify-center overflow-hidden border-2 border-white dark:border-dark-border shadow-sm group-hover:border-orange-100 dark:group-hover:border-primary/30 transition-colors">
                                <span class="font-bold text-lg text-gray-500 dark:text-dark-muted group-hover:text-primary transition-colors">${chat.customerName[0].toUpperCase()}</span>
                            </div>
                            <div class="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-dark-bg rounded-full"></div>
                        </div>
                        <div>
                            <div class="font-[800] text-sm text-secondary dark:text-gray-100 mb-0.5 transition-colors">${chat.customerName}</div>
                            <div class="text-xs text-gray-400 dark:text-dark-muted font-bold line-clamp-1 max-w-[160px] group-hover:text-primary/70 transition-colors">${chat.lastMessage}</div>
                        </div>
                    </div>
                    <div class="flex flex-col items-end gap-2">
                         <span class="text-[10px] text-gray-300 dark:text-dark-muted font-bold">${chat.timestamp ? new Date(chat.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                        ${chat.unreadCount > 0 ? `
                            <div class="w-5 h-5 bg-primary text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-lg shadow-orange-500/30">
                                ${chat.unreadCount}
                            </div>
                        ` : `
                            <i data-lucide="chevron-right" class="w-4 h-4 text-gray-300 dark:text-dark-muted group-hover:text-primary transition-colors"></i>
                        `}
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}


function selectChat(customerId) {
    const chat = staffState.chats.find(c => c.customerId === customerId);
    staffState.selectedChat = chat;

    // Reset messages and listener
    staffState.chatMessages = [];
    if (staffState.activeChatListener) {
        staffState.activeChatListener(); // Unsubscribe
    }


    // Subscribe to messages
    // Removing orderBy from query to avoid need for composite index. Sorting client-side.
    staffState.activeChatListener = db.collection('messages')
        .where('customerId', '==', customerId)
        .onSnapshot(snap => {
            staffState.chatMessages = [];
            snap.forEach(doc => staffState.chatMessages.push({ id: doc.id, ...doc.data() }));

            // Sort by timestamp (ascending)
            staffState.chatMessages.sort((a, b) => {
                const ta = a.timestamp?.seconds || 0;
                const tb = b.timestamp?.seconds || 0;
                return ta - tb;
            });


            // Smart update: Only update message list if already visible
            const container = document.getElementById('staff-chat-container');
            if (container) {
                container.innerHTML = `
                    <div class="text-center py-6">
                        <span class="text-[10px] font-bold text-gray-400 dark:text-dark-muted bg-gray-100 dark:bg-dark-surface px-3 py-1 rounded-full uppercase tracking-wider transition-colors">Today</span>
                    </div>
                ` + staffState.chatMessages.map(msg => {
                    const isStaff = msg.direction === 'staff_to_customer';
                    const time = msg.timestamp ? new Date(msg.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...';

                    return `
                        <div class="flex flex-col ${isStaff ? 'items-end' : 'items-start'} animate-fade-in">
                            <div class="max-w-[75%] p-4 rounded-2xl text-sm relative shadow-sm ${isStaff
                            ? 'bg-secondary dark:bg-primary text-white rounded-tr-none'
                            : 'bg-white dark:bg-dark-surface text-secondary dark:text-gray-100 border border-gray-100 dark:border-dark-border rounded-tl-none'
                        }">
                                ${msg.text}
                            </div>
                            <span class="text-[10px] text-gray-400 dark:text-dark-muted mt-1 px-1 font-bold transition-colors">${time}</span>
                        </div>
                    `;
                }).join('');
                scrollToBottom();
            } else {
                // Initial render upon selection or refresh
                render();
                scrollToBottom();
            }
        });

    render();
}


function closeChat() {
    staffState.selectedChat = null;
    if (staffState.activeChatListener) {
        staffState.activeChatListener();
        staffState.activeChatListener = null;
    }
    render();
}

function renderChatInterface() {
    const chat = staffState.selectedChat;
    if (!chat) return '';

    return `
        <div class="fixed inset-0 z-[60] bg-white dark:bg-dark-bg flex flex-col animate-slide-up max-w-md mx-auto shadow-2xl transition-colors">
            <!-- Chat Header -->
            <div class="bg-white/80 dark:bg-dark-surface/80 backdrop-blur-md p-4 border-b border-gray-100 dark:border-dark-border flex items-center gap-4 sticky top-0 z-10 shadow-sm transition-colors">
                <button onclick="closeChat()" class="p-2 -ml-2 hover:bg-gray-100 dark:hover:bg-dark-bg rounded-full transition active:scale-90 text-secondary dark:text-gray-100">
                    <i data-lucide="chevron-left" class="w-6 h-6"></i>
                </button>
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-gray-100 dark:bg-dark-bg rounded-full flex items-center justify-center font-bold text-gray-500 dark:text-dark-muted">
                         ${chat.customerName[0].toUpperCase()}
                    </div>
                    <div>
                        <h3 class="font-[800] text-secondary dark:text-gray-100 leading-tight transition-colors">${chat.customerName}</h3>
                        <p class="text-[10px] text-green-500 font-bold flex items-center gap-1 transition-colors">
                            <span class="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                            Online
                        </p>
                    </div>
                </div>
            </div>
            
            <!-- Messages List -->
            <div id="staff-chat-container" class="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50 dark:bg-dark-bg/50">
                <div class="text-center py-6">
                    <span class="text-[10px] font-bold text-gray-400 dark:text-dark-muted bg-gray-100 dark:bg-dark-surface px-3 py-1 rounded-full uppercase tracking-wider transition-colors">Today</span>
                </div>
                
                ${staffState.chatMessages.map(msg => {
        const isStaff = msg.direction === 'staff_to_customer';
        const time = msg.timestamp ? new Date(msg.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...';

        return `
                        <div class="flex flex-col ${isStaff ? 'items-end' : 'items-start'} animate-fade-in shadow-sm">
                            <div class="max-w-[75%] p-4 rounded-2xl text-sm relative ${isStaff
                ? 'bg-secondary dark:bg-primary text-white rounded-tr-none'
                : 'bg-white dark:bg-dark-surface text-secondary dark:text-gray-100 border border-gray-100 dark:border-dark-border rounded-tl-none'
            }">
                                ${msg.text}
                            </div>
                            <span class="text-[10px] text-gray-400 dark:text-dark-muted mt-1 px-1 font-bold transition-colors">${time}</span>
                        </div>
                    `;
    }).join('')}
            </div>
            
            <!-- Reply Input -->
            <form onsubmit="sendStaffReply(event, '${chat.customerId}')" class="p-4 bg-white dark:bg-dark-surface border-t border-gray-100 dark:border-dark-border flex gap-3 items-center pb-8 safe-area-bottom transition-colors">
                <button type="button" class="p-2 text-gray-400 dark:text-dark-muted hover:text-secondary dark:hover:text-primary transition-colors">
                    <i data-lucide="plus" class="w-6 h-6"></i>
                </button>
                
                <div class="flex-1 bg-gray-100 dark:bg-dark-bg rounded-full flex items-center px-4 transition-all focus-within:ring-2 focus-within:ring-primary/20 focus-within:bg-white dark:focus-within:bg-dark-bg">
                    <input type="text" name="message" placeholder="Type your reply..." required autocomplete="off"
                        class="flex-1 bg-transparent border-none py-3 text-sm font-bold text-secondary dark:text-gray-100 outline-none placeholder:text-gray-400 dark:placeholder:text-gray-600">
                </div>
                
                <button type="submit" class="w-12 h-12 bg-primary text-white rounded-full flex items-center justify-center shadow-lg shadow-orange-500/20 hover:bg-orange-600 transition active:scale-90 shrink-0">
                    <i data-lucide="send-horizontal" class="w-5 h-5 ml-0.5"></i>
                </button>
            </form>
        </div>
    `;
}



async function sendStaffReply(e, customerId) {
    e.preventDefault();
    const form = e.target;
    // Safety check just in case
    if (!form || !form.message) {
        console.error("Form not found or invalid");
        return;
    }

    const text = form.message.value.trim();
    if (!text) return;

    form.reset();

    // Focus back on input
    const input = form.querySelector('input[name="message"]');
    if (input) input.focus();

    // OPTIMISTIC UI UPDATE
    // Create a temporary message object
    const tempMsg = {
        id: 'temp-' + Date.now(),
        text: text,
        customerId: customerId,
        senderId: 'staff',
        direction: 'staff_to_customer',
        timestamp: { toDate: () => new Date() }, // Mock Firestore timestamp
        read: false
    };

    // Add to local state
    staffState.chatMessages.push(tempMsg);

    // Manually trigger the smart update logic (reusing logic from selectChat)
    const container = document.getElementById('staff-chat-container');
    if (container) {
        const time = tempMsg.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const msgHTML = `
            <div class="flex flex-col items-end animate-fade-in">
                <div class="max-w-[75%] p-4 rounded-2xl text-sm relative shadow-sm bg-secondary dark:bg-primary text-white rounded-tr-none">
                    ${tempMsg.text}
                </div>
                <span class="text-[10px] text-gray-400 dark:text-dark-muted mt-1 px-1 font-bold">${time}</span>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', msgHTML);
        scrollToBottom();
    }

    const batch = db.batch();

    // 1. Add Message
    const msgRef = db.collection('messages').doc();
    batch.set(msgRef, {
        text: text,
        customerId: customerId,
        senderId: 'staff',
        direction: 'staff_to_customer',
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        read: false
    });

    // 2. Update Chat Metadata (reset unread count for staff, maybe increment for customer)
    const chatRef = db.collection('chats').doc(customerId);
    // Use set with merge to be safe
    batch.set(chatRef, {
        lastMessage: text,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        unreadCount: 0
    }, { merge: true });

    try {
        await batch.commit();
        // Listener will eventually fire and replace our temp message with the real one
    } catch (err) {
        console.error(err);
        showToast("Communication Error", "Failed to send your reply. Please try again.", "error");
    }
}


function scrollToBottom() {
    setTimeout(() => {
        const container = document.getElementById('staff-chat-container');
        if (container) container.scrollTop = container.scrollHeight;
    }, 100);
}

async function sendBroadcast(e) {
    e.preventDefault();
    const form = e.target;
    // Basic confirmation
    const confirmed = await showConfirm({
        title: 'Send Broadcast',
        message: 'Are you sure you want to send this broadcast to all customers?',
        confirmText: 'Send Now',
        isDanger: false
    });
    if (!confirmed) return;

    const data = {
        title: form.title.value,
        message: form.message.value,
        type: form.type.value,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        active: true
    };

    try {
        await db.collection('notifications').add(data);
        showToast("Broadcast Sent", "All users have been notified successfully.", "success");
        form.reset();
        loadBroadcastHistory();
    } catch (err) {
        console.error(err);
        showToast("Broadcast Error", "Failed to send broadcast. Check your network connection.", "error");
    }
}


function loadBroadcastHistory() {
    db.collection('notifications').orderBy('timestamp', 'desc').limit(5).get().then(snap => {
        const container = document.getElementById('recent-broadcasts');
        if (!container) return;

        if (snap.empty) {
            container.innerHTML = `
                <div class="bg-gray-50 rounded-xl p-4 text-center border border-dashed border-gray-200">
                    <p class="text-xs text-gray-400 font-medium">No broadcasts sent yet</p>
                </div>
            `;
            return;
        }

        container.innerHTML = snap.docs.map(doc => {
            const n = doc.data();
            const date = n.timestamp ? new Date(n.timestamp.toDate()).toLocaleDateString() : 'Just now';

            let iconBox = '';
            if (n.type === 'offer') {
                iconBox = `<div class="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-primary"><i data-lucide="ticket-percent" class="w-4 h-4"></i></div>`;
            } else if (n.type === 'alert') {
                iconBox = `<div class="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-500"><i data-lucide="alert-triangle" class="w-4 h-4"></i></div>`;
            } else {
                iconBox = `<div class="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-500"><i data-lucide="info" class="w-4 h-4"></i></div>`;
            }

            return `
                <div class="relative pl-6 pb-2 group">
                    <div class="absolute -left-[9px] top-0 w-4 h-4 bg-white dark:bg-dark-surface border-2 border-gray-200 dark:border-dark-border group-hover:border-primary rounded-full transition-colors"></div>
                    <div class="bg-white dark:bg-dark-surface p-4 rounded-2xl border border-gray-100 dark:border-dark-border shadow-sm group-hover:shadow-md dark:group-hover:shadow-primary/5 transition-all flex gap-3 items-start">
                        ${iconBox}
                        <div class="flex-1 min-w-0">
                            <div class="flex justify-between items-start mb-0.5">
                                <span class="font-bold text-sm text-secondary dark:text-gray-100 truncate pr-2">${n.title}</span>
                                <span class="text-[10px] text-gray-300 dark:text-dark-muted font-bold whitespace-nowrap">${date}</span>
                            </div>
                            <p class="text-xs text-gray-400 dark:text-dark-muted font-bold line-clamp-2 leading-relaxed">${n.message}</p>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        lucide.createIcons();
    });
}




function renderNavigation() {
    const nav = document.createElement('nav');
    // Constrained width and centered, attached to bottom
    nav.className = 'fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white/95 dark:bg-dark-surface/95 backdrop-blur-md border-t border-x border-gray-100 dark:border-dark-border rounded-t-3xl px-6 py-4 z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] transition-colors';
    nav.innerHTML = `
        <div class="flex justify-between items-end relative">
            <!-- Home (First) -->
            <button onclick="switchTab('home')" class="flex flex-col items-center gap-1.5 w-12 group nav-btn" data-tab="home">
                <i data-lucide="home" class="w-6 h-6 ${staffState.currentTab === 'home' ? 'text-primary' : 'text-gray-400 dark:text-dark-muted group-hover:text-primary'} transition-all duration-300"></i>
                <span class="text-[10px] font-black tracking-tight ${staffState.currentTab === 'home' ? 'text-primary' : 'text-gray-400 dark:text-dark-muted group-hover:text-primary'} transition-all duration-300">Home</span>
            </button>

            <!-- Stock (Second) -->
            <button onclick="switchTab('stock')" class="flex flex-col items-center gap-1.5 w-12 group nav-btn" data-tab="stock">
                <i data-lucide="box" class="w-6 h-6 ${staffState.currentTab === 'stock' ? 'text-primary' : 'text-gray-400 dark:text-dark-muted group-hover:text-primary'} transition-all duration-300"></i>
                <span class="text-[10px] font-black tracking-tight ${staffState.currentTab === 'stock' ? 'text-primary' : 'text-gray-400 dark:text-dark-muted group-hover:text-primary'} transition-all duration-300">Stock</span>
            </button>

            <!-- Scan (Middle) -->
            <button onclick="switchTab('scanner')" class="flex flex-col items-center gap-1 w-12 group nav-btn" data-tab="scanner">
                <div class="w-16 h-16 bg-secondary dark:bg-dark-bg text-white rounded-2xl flex items-center justify-center -mt-10 border-4 border-white dark:border-dark-surface shadow-2xl transition-all duration-500 active:scale-90 group-hover:shadow-primary/30">
                     <i data-lucide="scan-line" class="w-8 h-8 ${staffState.currentTab === 'scanner' ? 'text-primary' : 'text-white group-hover:text-primary'} transition-colors"></i>
                </div>
                <span class="text-[10px] font-black tracking-tight ${staffState.currentTab === 'scanner' ? 'text-primary' : 'text-gray-400 dark:text-dark-muted group-hover:text-primary'} transition-all duration-300 mt-1.5">Scan</span>
            </button>

            <!-- Orders (Fourth) -->
            <button onclick="switchTab('orders')" class="flex flex-col items-center gap-1.5 w-12 group nav-btn" data-tab="orders">
                <i data-lucide="clipboard-list" class="w-6 h-6 ${staffState.currentTab === 'orders' ? 'text-primary' : 'text-gray-400 dark:text-dark-muted group-hover:text-primary'} transition-all duration-300"></i>
                <span class="text-[10px] font-black tracking-tight ${staffState.currentTab === 'orders' ? 'text-primary' : 'text-gray-400 dark:text-dark-muted group-hover:text-primary'} transition-all duration-300">Orders</span>
            </button>

            <!-- Comms (Last) -->
            <button onclick="switchTab('comms')" class="flex flex-col items-center gap-1.5 w-12 group nav-btn" data-tab="comms">
                <i data-lucide="message-circle" class="w-6 h-6 ${staffState.currentTab === 'comms' ? 'text-primary' : 'text-gray-400 dark:text-dark-muted group-hover:text-primary'} transition-all duration-300"></i>
                <span class="text-[10px] font-black tracking-tight ${staffState.currentTab === 'comms' ? 'text-primary' : 'text-gray-400 dark:text-dark-muted group-hover:text-primary'} transition-all duration-300">Comms</span>
            </button>
        </div>
    `;
    app.appendChild(nav);
}



// ==============================================
// TAB SWITCHING
// ==============================================

function switchTab(tab) {
    staffState.currentTab = tab;
    render();
}

// ==============================================
// ACTIONS
// ==============================================

async function updateStatus(orderId, newStatus) {
    console.log('📝 Updating order #' + orderId + ' to ' + newStatus);

    try {
        await db.collection('orders').doc(orderId).update({
            status: newStatus,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        console.log('✅ Order updated');
    } catch (error) {
        console.error('❌ Update failed:', error);
        showToast("Update Failed", "We couldn't update the order status. Please try again.", "error");
    }
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

// ==============================================
// VIEW BILL MODAL
// ==============================================

window.viewBill = function (orderId) {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    let existingModal = document.getElementById('bill-modal');
    if (existingModal) existingModal.remove();

    const orderDateObj = (order.date && typeof order.date.toDate === 'function') ? order.date.toDate() : new Date(order.date);
    const dateStr = isNaN(orderDateObj.getTime()) ? '' : orderDateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    const timeStr = isNaN(orderDateObj.getTime()) ? '' : orderDateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const modal = document.createElement('div');
    modal.id = 'bill-modal';
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in';
    modal.innerHTML = `
        <div class="bg-white dark:bg-dark-surface w-full max-w-sm rounded-[2rem] shadow-2xl border border-gray-100 dark:border-dark-border overflow-hidden flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-4 zoom-in-95 duration-300 ease-out">
            <div class="p-5 border-b border-gray-100 dark:border-dark-border flex justify-between items-center bg-gray-50/50 dark:bg-dark-bg/50 text-left">
                <div class="flex items-center gap-3">
                    <div class="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary shadow-inner">
                        <i data-lucide="receipt" class="w-6 h-6"></i>
                    </div>
                    <div>
                        <h3 class="font-[900] text-secondary dark:text-gray-100 leading-tight">Order Receipt</h3>
                        <div class="flex items-center gap-2 mt-0.5">
                            <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest">#${order.id.slice(-12)}</p>
                            <span class="inline-block px-1.5 py-0.5 bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-500 rounded text-[8px] font-black uppercase tracking-widest">${order.status}</span>
                        </div>
                    </div>
                </div>
                <button onclick="document.getElementById('bill-modal').remove()" class="w-8 h-8 flex items-center justify-center bg-gray-100 dark:bg-gray-800 text-gray-500 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-all active:scale-95">
                    <i data-lucide="x" class="w-4 h-4"></i>
                </button>
            </div>
            
            <div class="p-6 overflow-y-auto custom-scrollbar text-left">
                <div class="flex justify-between items-center border-b border-dashed border-gray-200 dark:border-gray-700 pb-4 mb-5">
                    <div>
                        <p class="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">Customer</p>
                        <p class="text-xs font-black text-secondary dark:text-gray-200">${order.user?.id || 'Guest'}</p>
                        ${order.user?.name ? `<p class="text-[10px] font-bold text-gray-500 mt-0.5">${order.user.name}</p>` : ''}
                    </div>
                    <div class="text-right">
                        <p class="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">Date</p>
                        <p class="text-xs font-black text-secondary dark:text-gray-300">${dateStr}</p>
                        <p class="text-[10px] font-bold text-gray-400 mt-0.5">${timeStr}</p>
                    </div>
                </div>

                <div class="space-y-4 mb-6">
                    <p class="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3">Order Items</p>
                    ${order.items.map(item => `
                        <div class="flex justify-between items-start">
                            <div class="flex gap-3">
                                <span class="text-sm font-black text-primary">${item.quantity}x</span>
                                <div>
                                    <p class="text-sm font-bold text-secondary dark:text-gray-300 leading-tight">${item.name}</p>
                                    ${item.notes ? `<p class="text-[10px] italic font-medium text-gray-400 mt-1">${item.notes}</p>` : ''}
                                </div>
                            </div>
                            <span class="text-sm font-bold text-secondary dark:text-gray-300">LKR ${(item.price * item.quantity).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                    `).join('')}
                </div>

                <div class="bg-gray-50 dark:bg-[#111827] p-5 rounded-2xl border border-gray-100 dark:border-gray-800 space-y-3">
                    <div class="flex justify-between items-center">
                        <span class="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Subtotal</span>
                        <span class="text-xs font-bold text-secondary dark:text-gray-300">LKR ${(order.subtotal || order.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    ${order.tax ? `
                    <div class="flex justify-between items-center">
                        <span class="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Tax</span>
                        <span class="text-xs font-bold text-secondary dark:text-gray-300">LKR ${order.tax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    ` : ''}
                    <div class="flex justify-between items-center pt-3 border-t border-gray-200 dark:border-gray-700">
                        <span class="text-sm font-black text-secondary dark:text-gray-100 uppercase tracking-widest">Total</span>
                        <span class="text-xl font-black text-primary">LKR ${(order.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                </div>
            </div>
            
            <div class="p-5 border-t border-gray-100 dark:border-dark-border bg-gray-50/50 dark:bg-dark-bg/50">
                <button onclick="window.print()" class="w-full py-3.5 bg-secondary dark:bg-white text-white dark:text-secondary rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 active:scale-95 shadow-xl relative overflow-hidden group">
                    <span class="relative z-10 flex items-center gap-2">
                        <i data-lucide="printer" class="w-4 h-4"></i> Print Bill
                    </span>
                    <div class="absolute inset-0 bg-white/20 dark:bg-black/10 scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-300"></div>
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    lucide.createIcons();
};

// ==============================================
// REAL-TIME LISTENER
// ==============================================

db.collection('orders').onSnapshot((snapshot) => {
    orders = [];
    snapshot.forEach((doc) => {
        orders.push({ id: doc.id, ...doc.data() });
    });

    // Robust Sort by date (newest first)
    orders.sort((a, b) => {
        const dateA = (a.date && typeof a.date.toDate === 'function') ? a.date.toDate() : new Date(a.date);
        const dateB = (b.date && typeof b.date.toDate === 'function') ? b.date.toDate() : new Date(b.date);
        return dateB - dateA;
    });

    console.log('🔄 Orders synced:', orders.length);
    // Only render if the app is visible (meaning auth is successful)
    if (app && !app.classList.contains('hidden')) {
        render();
    }
});

// ==============================================
// INITIALIZE
// ==============================================

// render() happens after auth validation
console.log('✅ N-Cafe Staff App Loaded');
