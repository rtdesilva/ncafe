// ADMIN STATE
let adminState = {
    currentView: 'dashboard', // 'dashboard', 'menu', 'orders', 'customers'
    isSidebarOpen: window.innerWidth >= 768,
    isModalOpen: false,
    modalMode: 'add',
    editingItem: null,
    selectedCategory: 'all', // New state for menu filtering
    dateFilter: 'today',
    startDate: new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0') + '-' + String(new Date().getDate()).padStart(2, '0'),
    endDate: new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0') + '-' + String(new Date().getDate()).padStart(2, '0'),
    orderSearch: '', // Search query for orders
    customerSearch: '', // Search query for customers
    selectedCustomer: null, // For viewing customer order history
    orderFilter: 'active', // 'active', 'completed', 'total'
    commsTab: 'broadcast',
    chats: [],
    selectedChat: null,
    chatMessages: [],
    inboxListener: null,
    activeChatListener: null,
    staffSearch: '', // Search query for staff
    menuSearch: '', // Search query for menu
    editingStaffItem: null,
    modalStaffMode: 'add',
    isStaffModalUnlocked: false,
    isSettingsSaving: false,
    isDarkMode: localStorage.getItem('ncafe_admin_dark_mode') === 'true'
};

// --- SETTINGS REACTIVITY ---
window.addEventListener('settings-updated', () => {
    if (adminState.currentView === 'settings') {
        renderAdmin();
    }
});

const loginScreen = document.getElementById('login-screen');
const adminAppContainer = document.getElementById('admin-app');

auth.onAuthStateChanged(async (user) => {
    if (user && user.email) {
        try {
            // Verify 'admin' role against staff_users collection
            let role = 'staff';
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

            if (role === 'admin') {
                // Authorized — Reveal Dashboard
                if (loginScreen) loginScreen.classList.add('hidden');
                if (adminAppContainer) adminAppContainer.classList.remove('hidden');

                // Initialize Dashboard
                renderAdmin();

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
                console.warn("RESTRICTION: Non-admin attempted to access admin portal.");
                auth.signOut();
                if (loginScreen) loginScreen.classList.remove('hidden');
                if (adminAppContainer) adminAppContainer.classList.add('hidden');

                const errEl = document.getElementById('login-error');
                if (errEl) {
                    errEl.innerText = "Unauthorized Access. Admin role required.";
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
        if (adminAppContainer) adminAppContainer.classList.add('hidden');
    }
});

let vaultAuthorizedEmail = null;

// --- PIN VAULT LOGIC ---
(function initPinVault() {
    const pinStep = document.getElementById('admin-pin-step');
    const loginForm = document.getElementById('admin-login-form');
    if (!pinStep || !loginForm) return;

    let currentInput = '';
    let failedPinAttempts = 0;
    let lockoutUntil = 0;
    const dots = pinStep.querySelectorAll('.ncafe-pin-dot');
    const pinError = document.getElementById('admin-pin-error');

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
                    const emailInput = document.getElementById('admin-email');
                    if (emailInput) {
                        emailInput.value = '';
                        emailInput.placeholder = 'Enter authorized email';
                    }

                    pinStep.classList.add('hidden');
                    loginForm.classList.remove('hidden');
                } else {
                    // FALLBACK: Check against the master system PIN (e.g., 1111)
                    // This ensures the main admin can always gain access to set individual PINs
                    const masterPin = window.systemSettings?.systemPin || '1111';
                    if (currentInput === masterPin) {
                        failedPinAttempts = 0; // RESET ON SUCCESS
                        vaultAuthorizedEmail = 'admin@ncafe.com'; // Default master admin

                        const emailInput = document.getElementById('admin-email');
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

    pinStep.querySelectorAll('.admin-pin-btn').forEach(btn => {
        const val = btn.getAttribute('data-val');
        if (val) btn.addEventListener('click', () => handleInput(val));
    });
})();

// INLINE LOGIN HANDLER
document.getElementById('admin-login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorMessage = document.getElementById('login-error');
    const submitBtn = document.getElementById('admin-login-btn');
    errorMessage.classList.add('hidden');

    const email = document.getElementById('admin-email').value.trim();
    const password = document.getElementById('admin-password').value;

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
        // onAuthStateChanged will handle the transition
    } catch (error) {
        console.error("Login Error:", error);
        errorMessage.innerText = "Authentication failed. Invalid email or password.";
        errorMessage.classList.remove('hidden');
        submitBtn.innerHTML = '<span>Secure Login</span><i data-lucide="arrow-right" class="w-4 h-4 group-hover:translate-x-1 transition-transform"></i>';
        submitBtn.disabled = false;
        lucide.createIcons();
    }
});

// INITIAL DARK MODE APPLY
if (adminState.isDarkMode) {
    document.documentElement.classList.add('dark');
} else {
    document.documentElement.classList.remove('dark');
}

function toggleDarkMode() {
    adminState.isDarkMode = !adminState.isDarkMode;
    localStorage.setItem('ncafe_admin_dark_mode', adminState.isDarkMode);
    if (adminState.isDarkMode) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
    renderAdmin();
    if (adminState.currentView === 'statistics') setTimeout(initCharts, 0);
}

// DOM ELEMENTS
const adminApp = document.getElementById('admin-app');

// AUTHENTICATION LOGIC
async function handleLogout() {
    try {
        await auth.signOut();
        localStorage.removeItem('ncafe_user_role');
        window.location.reload(); // Reloads the window, which drops them at the login screen seamlessly
    } catch (error) {
        console.error("Logout Error:", error);
    }
}

// UTILS
function formatPrice(price) {
    return 'LKR ' + price.toLocaleString();
}

// RENDER FUNCTION
function renderAdmin() {
    adminApp.innerHTML = '';

    // Sidebar logic for mobile
    const sidebarClass = adminState.isSidebarOpen ? 'translate-x-0' : '-translate-x-full';

    const sidebar = `
        <aside class="fixed inset-y-0 left-0 z-40 w-64 bg-white dark:bg-dark-surface border-r border-gray-100 dark:border-dark-border transition-transform duration-300 md:translate-x-0 ${sidebarClass} flex flex-col shadow-xl md:shadow-none">
            <div class="p-8 flex items-center gap-3">
                 <div class="w-10 h-10 bg-gradient-to-br from-primary to-orange-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-orange-500/30">
                    <i data-lucide="coffee" class="w-6 h-6"></i>
                 </div>
                 <div>
                    <span class="text-xl font-[900] tracking-tight text-secondary dark:text-gray-100 block leading-none">N-Cafe</span>
                    <span class="text-[10px] font-bold text-gray-400 dark:text-dark-muted tracking-widest uppercase">Admin</span>
                 </div>
            </div>

            <nav class="flex-1 px-4 space-y-2 mt-4">
                ${renderSidebarItem('layout-dashboard', 'Dashboard', 'dashboard')}
                ${renderSidebarItem('coffee', 'Menu Management', 'menu')}
                ${renderSidebarItem('clipboard-list', 'Orders', 'orders')}
                ${renderSidebarItem('users', 'Customers', 'customers')}
                ${renderSidebarItem('shield-half', 'Staff & Admins', 'staff')}
                ${renderSidebarItem('trending-up', 'Statistics', 'statistics')}
                ${renderSidebarItem('message-square', 'Communications', 'comms')}
                ${renderSidebarItem('credit-card', 'Prepaid Cards', 'cards')}
                ${renderSidebarItem('settings', 'Settings', 'settings')}
            </nav>

            <div class="p-4 mt-auto">
                 <button onclick="handleLogout()" class="w-full flex items-center gap-3 px-4 py-3 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-colors font-bold text-sm">
                    <i data-lucide="log-out" class="w-5 h-5"></i>
                    Sign Out
                </button>
            </div>
        </aside>
        
        <!-- Mobile Overlay -->
        ${adminState.isSidebarOpen ? `<div onclick="toggleSidebar()" class="fixed inset-0 bg-black/20 z-30 md:hidden backdrop-blur-sm"></div>` : ''}
    `;

    // Main Content
    let contentHtml = '';
    if (adminState.currentView === 'dashboard') {
        contentHtml = renderDashboardView();
    } else if (adminState.currentView === 'menu') {
        contentHtml = renderMenuView();
    } else if (adminState.currentView === 'orders') {
        contentHtml = renderOrdersView();
    } else if (adminState.currentView === 'customers') {
        contentHtml = renderCustomersView();
    } else if (adminState.currentView === 'comms') {
        contentHtml = renderCommsView();
    } else if (adminState.currentView === 'statistics') {
        contentHtml = renderStatsView();
    } else if (adminState.currentView === 'staff') {
        contentHtml = renderStaffView();
    } else if (adminState.currentView === 'settings') {
        contentHtml = renderSettingsView();
    } else if (adminState.currentView === 'cards') {
        contentHtml = renderCardsView();
    } else {
        contentHtml = renderDashboardView(); // Default
    }

    const mainLayout = `
        <main class="flex-1 h-screen overflow-y-auto bg-gray-50/50 dark:bg-dark-bg md:ml-64 transition-all">
            <!-- Header -->
            <header class="bg-white dark:bg-dark-surface border-b border-gray-100 dark:border-dark-border sticky top-0 z-20 px-8 py-4 flex justify-between items-center transition-colors duration-300">
                <div class="flex items-center gap-4">
                     <button onclick="toggleSidebar()" class="p-2 -ml-2 hover:bg-gray-100 dark:hover:bg-dark-border rounded-lg md:hidden text-secondary dark:text-gray-100">
                        <i data-lucide="menu" class="w-6 h-6"></i>
                    </button>
                    <h1 class="text-2xl font-[800] capitalize text-secondary dark:text-gray-100">${adminState.currentView === 'menu' ? 'Menu Management' : adminState.currentView}</h1>
                </div>
                
                <div class="flex items-center gap-4">
                    <!-- Theme Toggle Switch -->
                    <div onclick="toggleDarkMode()" class="w-14 h-8 bg-gray-100 dark:bg-dark-bg/50 rounded-full p-1 cursor-pointer transition-all active:scale-95 group shadow-sm">
                        <div class="h-6 w-6 rounded-full bg-white dark:bg-primary shadow-sm flex items-center justify-center transition-all ${adminState.isDarkMode ? 'translate-x-6' : 'translate-x-0'}">
                            <i data-lucide="${adminState.isDarkMode ? 'sun' : 'moon'}" class="w-4 h-4 text-primary dark:text-white"></i>
                        </div>
                    </div>
                    <div class="flex items-center gap-3 border-l border-gray-100 dark:border-dark-border pl-6 transition-colors">
                         <div class="text-right hidden sm:block">
                            <p class="text-sm font-bold text-secondary dark:text-gray-100">Admin</p>
                            <p class="text-xs text-gray-400 dark:text-dark-muted font-bold">Manager</p>
                         </div>
                         <div class="w-10 h-10 bg-gray-100 dark:bg-dark-bg rounded-xl flex items-center justify-center text-gray-400 dark:text-gray-500 group shadow-sm">
                            <i data-lucide="user" class="w-5 h-5"></i>
                         </div>
                    </div>
                </div>
            </header>

            <div class="p-8 max-w-[1600px] mx-auto animate-fade-in relative">
                ${contentHtml}
            </div>
        </main>
    `;

    // Modal
    const modal = adminState.isModalOpen ? (adminState.currentView === 'staff' ? renderStaffModal() : renderModal()) : (adminState.selectedCustomer ? renderCustomerHistoryModal() : '');

    adminApp.innerHTML = sidebar + mainLayout + modal;
    lucide.createIcons();

    // Init Charts if in stats view
    if (adminState.currentView === 'statistics') {
        setTimeout(initCharts, 0);
    }
}

// COMPONENT RENDERERS
function renderSidebarItem(icon, label, view) {
    const isActive = adminState.currentView === view;
    const activeClass = isActive
        ? 'bg-secondary dark:bg-primary text-white shadow-lg shadow-gray-900/20'
        : 'text-gray-500 dark:text-dark-muted hover:bg-gray-100 dark:hover:bg-dark-bg/50 hover:text-secondary dark:hover:text-white';

    return `
        <button onclick="switchView('${view}')" class="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all font-bold text-sm ${activeClass}">
            <i data-lucide="${icon}" class="w-5 h-5"></i>
            ${label}
        </button>
    `;
}

// DATE HELPERS
function updateDateFilter(type) {
    adminState.dateFilter = type;
    const today = new Date();

    if (type === 'today') {
        const d = new Date();
        const ds = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        adminState.startDate = ds;
        adminState.endDate = ds;
    } else if (type === 'yesterday') {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        const ds = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        adminState.startDate = ds;
        adminState.endDate = ds;
    } else if (type === 'last7') {
        const d = new Date();
        const endDs = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        d.setDate(d.getDate() - 6);
        const startDs = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        adminState.startDate = startDs;
        adminState.endDate = endDs;
    } else if (type === 'last30') {
        const d = new Date();
        const endDs = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        d.setDate(d.getDate() - 29);
        const startDs = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        adminState.startDate = startDs;
        adminState.endDate = endDs;
    } else if (type === 'thisMonth') {
        const d = new Date();
        const firstDay = new Date(d.getFullYear(), d.getMonth(), 1);
        const startDs = firstDay.getFullYear() + '-' + String(firstDay.getMonth() + 1).padStart(2, '0') + '-' + String(firstDay.getDate()).padStart(2, '0');
        const endDs = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        adminState.startDate = startDs;
        adminState.endDate = endDs;
    }
    renderAdmin();
}

function handleDateChange(field, value) {
    adminState[field] = value;
    adminState.dateFilter = 'custom';
    renderAdmin();
}

function renderDashboardView() {
    // REAL DATA
    const allOrders = DataStore.getOrders();
    const today = new Date().toDateString();

    const preparing = allOrders.filter(o => o.status === 'preparing');
    const ready = allOrders.filter(o => o.status === 'ready');

    // Revenue: Only orders created today
    const completedToday = allOrders.filter(o => o.status === 'completed' && new Date(o.date).toDateString() === today);
    const liveRevenue = completedToday.reduce((acc, o) => acc + (o.total || 0), 0);

    const activeCount = preparing.length + ready.length;

    return `
        <!-- Live Metrics Header -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div class="bg-secondary dark:bg-dark-surface text-white p-6 rounded-2xl shadow-lg shadow-gray-900/10 relative overflow-hidden group border border-transparent dark:border-dark-border">
                <div class="relative z-10">
                    <p class="text-xs font-bold text-gray-400 dark:text-dark-muted uppercase tracking-wider mb-1 group-hover:text-white transition-colors">Live Revenue</p>
                    <h3 class="text-3xl font-[900] dark:text-primary">${formatPrice(liveRevenue)}</h3>
                </div>
                <div class="absolute right-0 top-0 h-full w-24 bg-white/5 skew-x-12 -mr-4 group-hover:bg-white/10 transition-colors"></div>
            </div>
            
            <div class="bg-white dark:bg-dark-surface p-6 rounded-2xl border border-gray-100 dark:border-dark-border shadow-sm flex flex-col justify-center transition-colors">
                <p class="text-xs font-bold text-gray-400 dark:text-dark-muted uppercase tracking-wider mb-1">Active Orders</p>
                <div class="flex items-baseline gap-2">
                    <h3 class="text-3xl font-[900] text-primary">${activeCount}</h3>
                    <span class="text-xs font-bold text-gray-300">orders</span>
                </div>
            </div>

            <div class="bg-white dark:bg-dark-surface p-6 rounded-2xl border border-gray-100 dark:border-dark-border shadow-sm flex flex-col justify-center transition-colors">
                 <p class="text-xs font-bold text-gray-400 dark:text-dark-muted uppercase tracking-wider mb-1">Preparing</p>
                <h3 class="text-3xl font-[900] text-orange-500">${preparing.length}</h3>
            </div>

            <div class="bg-white dark:bg-dark-surface p-6 rounded-2xl border border-gray-100 dark:border-dark-border shadow-sm flex flex-col justify-center transition-colors">
                 <p class="text-xs font-bold text-gray-400 dark:text-dark-muted uppercase tracking-wider mb-1">Ready</p>
                <h3 class="text-3xl font-[900] text-green-500">${ready.length}</h3>
            </div>
        </div>

        <!-- Kanban Board -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-280px)] min-h-[600px]">
            
            <!-- Preparing Column -->
            <div class="bg-gray-100/50 dark:bg-dark-surface/30 rounded-3xl p-4 border border-gray-200/50 dark:border-dark-border/50 flex flex-col h-full">
                <div class="flex items-center justify-between mb-4 px-2">
                    <h3 class="font-[900] text-gray-600 flex items-center gap-2">
                        <span class="relative flex h-3 w-3">
                          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                          <span class="relative inline-flex rounded-full h-3 w-3 bg-orange-500"></span>
                        </span>
                        Preparing
                    </h3>
                    <span class="bg-white px-2.5 py-1 rounded-lg text-xs font-bold text-gray-500 shadow-sm border border-gray-100">${preparing.length}</span>
                </div>
                <div class="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-hide pb-4">
                    ${preparing.length === 0
            ? `<div class="h-40 flex flex-col items-center justify-center text-gray-300 dark:text-gray-600 font-bold text-sm border-2 border-dashed border-gray-200 dark:border-dark-border/50 rounded-2xl bg-gray-50/50 dark:bg-dark-bg/30 transition-colors">
                            <i data-lucide="chef-hat" class="w-8 h-8 mb-2 opacity-50"></i>
                            Kitchen is idle
                           </div>`
            : preparing.map(o => renderLiveOrderCard(o)).join('')}
                </div>
            </div>

            <!-- Ready Column -->
            <div class="bg-gray-100/50 dark:bg-dark-surface/30 rounded-3xl p-4 border border-gray-200/50 dark:border-dark-border/50 flex flex-col h-full">
                <div class="flex items-center justify-between mb-4 px-2">
                    <h3 class="font-[900] text-gray-600 flex items-center gap-2">
                         <span class="relative flex h-3 w-3">
                          ${ready.length > 0 ? `<span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>` : ''}
                          <span class="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                        </span>
                        Ready
                    </h3>
                    <span class="bg-white px-2.5 py-1 rounded-lg text-xs font-bold text-gray-500 shadow-sm border border-gray-100">${ready.length}</span>
                </div>
                <div class="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-hide pb-4">
                    ${ready.length === 0
            ? `<div class="h-40 flex flex-col items-center justify-center text-gray-300 dark:text-gray-600 font-bold text-sm border-2 border-dashed border-gray-200 dark:border-dark-border/50 rounded-2xl bg-gray-50/50 dark:bg-dark-bg/30 transition-colors">
                            <i data-lucide="bell" class="w-8 h-8 mb-2 opacity-50"></i>
                            No orders ready
                           </div>`
            : ready.map(o => renderLiveOrderCard(o)).join('')}
                </div>
            </div>

        </div>
    `;
}

function renderLiveOrderCard(order) {
    const isPrep = order.status === 'preparing';
    const isReady = order.status === 'ready';
    const itemsList = order.items.map(i => `<span class="text-secondary dark:text-primary font-bold">${i.quantity}x</span> <span class="dark:text-gray-300 transition-colors">${i.name}</span>`).join(', ');
    const user = order.user || {};
    const userName = user.name || user.id || 'Guest';

    return `
        <div class="bg-white dark:bg-dark-surface p-4 rounded-xl border border-gray-200 dark:border-dark-border shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
            <!-- Left Colored Bar based on status -->
            <div class="absolute left-0 top-0 bottom-0 w-1 ${isPrep ? 'bg-orange-500' : (isReady ? 'bg-green-500' : 'bg-blue-500')}"></div>
            
            <div class="pl-2">
                <div class="flex justify-between items-start mb-3">
                    <div>
                        <span class="font-[900] text-secondary dark:text-gray-100 text-lg tracking-tight">#${order.id}</span>
                         <div class="flex items-center gap-1.5 mt-0.5">
                            <i data-lucide="user" class="w-3 h-3 text-gray-400 dark:text-dark-muted"></i>
                            <p class="text-xs font-bold text-gray-500 dark:text-dark-muted truncate max-w-[120px]">${userName}</p>
                         </div>
                    </div>
                    <span class="text-[10px] font-bold text-gray-400 dark:text-dark-muted bg-gray-50 dark:bg-dark-bg px-2 py-1 rounded-lg border border-gray-100 dark:border-dark-border">
                        ${new Date(order.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                </div>
                
                <p class="text-sm text-gray-600 dark:text-dark-muted mb-4 line-clamp-3 leading-relaxed">${itemsList}</p>
                
                <div class="flex items-center gap-2 mt-auto pt-2 border-t border-gray-50 dark:border-dark-border">
                    <span class="font-bold text-sm text-secondary dark:text-gray-100">${formatPrice(order.total)}</span>
                    
                    <div class="flex-1 flex justify-end gap-2">
                         ${isPrep ? `
                            <button onclick="updateAdminOrderStatus('${order.id}', 'ready')" class="bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-lg text-xs font-bold transition-all shadow-lg shadow-green-500/20 active:scale-95 flex items-center gap-1">
                                <i data-lucide="bell" class="w-3 h-3"></i> Ready
                            </button>
                        ` : ''}
                        
                        ${isReady ? `
                            <button onclick="updateAdminOrderStatus('${order.id}', 'completed')" class="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg text-xs font-bold transition-all shadow-lg shadow-blue-500/20 active:scale-95 flex items-center gap-1">
                                <i data-lucide="check" class="w-3 h-3"></i> Done
                            </button>
                        ` : ''}

                        ${!isPrep && !isReady ? `
                            <span class="text-xs font-bold text-gray-300 flex items-center gap-1">
                                <i data-lucide="check-circle-2" class="w-3 h-3"></i> Completed
                            </span>
                        ` : ''}
                    </div>
                </div>
            </div>
        </div>
    `;
}

function updateAdminOrderStatus(id, status) {
    // Show Optimistic Toast? No need, waiting for real time is safer to avoid drift.
    // Call DataStore to update Firebase
    DataStore.updateOrderStatus(id, status);
}

function renderMenuView() {
    const menuItems = DataStore.getMenu();
    const searchQuery = (adminState.menuSearch || '').toLowerCase();
    
    const filteredItems = menuItems.filter(item => {
        const matchesCategory = adminState.selectedCategory === 'all' || item.category === adminState.selectedCategory;
        const matchesSearch = !searchQuery || 
            item.name.toLowerCase().includes(searchQuery) || 
            (item.category && item.category.toLowerCase().includes(searchQuery)) ||
            (item.subCategory && item.subCategory.toLowerCase().includes(searchQuery));
        return matchesCategory && matchesSearch;
    });

    return `
        <div class="bg-white dark:bg-dark-surface p-6 rounded-3xl border border-gray-100 dark:border-dark-border shadow-sm relative">
            <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
                <div class="w-full md:w-auto">
                     <h3 class="text-xl font-[900] dark:text-gray-100">Menu Management</h3>
                     <p class="text-gray-400 dark:text-dark-muted text-xs font-bold">${filteredItems.length} specialty items identified</p>
                </div>
               
                <div class="flex-1 w-full max-w-xl relative group">
                    <i data-lucide="search" class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-dark-muted group-focus-within:text-primary transition-colors"></i>
                    <input type="text" 
                        placeholder="Search for food..." 
                        value="${adminState.menuSearch || ''}"
                        oninput="updateMenuList(this.value)"
                        class="w-full pl-12 pr-4 py-3.5 bg-gray-50 dark:bg-dark-bg/60 border border-gray-100 dark:border-dark-border rounded-2xl text-sm font-bold text-secondary dark:text-gray-100 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder:text-gray-300 dark:placeholder:text-gray-600">
                </div>

                <button onclick="openAddModal()" class="shrink-0 bg-primary text-white px-6 py-3.5 rounded-2xl text-sm font-bold hover:bg-orange-600 transition-all shadow-lg shadow-orange-500/20 active:scale-95 flex items-center gap-2">
                    <i data-lucide="plus" class="w-5 h-5 text-white"></i> Add Item
                </button>
            </div>

            <!-- Categories Filter -->
            <div class="flex items-center gap-6 overflow-x-auto pb-4 mb-8 scrollbar-hide">
                ${categories.map(cat => {
        const isActive = adminState.selectedCategory === cat.id;
        return `
                    <button onclick="selectCategory('${cat.id}')" class="flex flex-col items-center gap-3 group shrink-0 transition-all active:scale-95">
                        <div class="w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300 ${isActive
                ? 'bg-primary text-white shadow-lg shadow-orange-500/40 border-primary'
                : 'bg-white dark:bg-dark-bg/50 border border-gray-100 dark:border-dark-border text-gray-400 dark:text-dark-muted group-hover:border-primary/50 dark:group-hover:border-primary/50'}">
                            <i data-lucide="${cat.icon}" class="w-7 h-7"></i>
                        </div>
                        <span class="text-xs font-black tracking-tight ${isActive ? 'text-primary' : 'text-gray-400 dark:text-dark-muted'}">${cat.name}</span>
                    </button>
                    `;
    }).join('')}
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                ${filteredItems.length === 0 ? `<div class="col-span-full text-center py-10 text-gray-400 dark:text-dark-muted font-bold">No items found in this category.</div>` :
            filteredItems.map(item => `
                    <div class="border border-gray-100 dark:border-dark-border rounded-2xl p-4 flex flex-col gap-4 hover:shadow-md transition-shadow bg-white dark:bg-dark-surface relative group">
                        <div class="relative w-full aspect-video rounded-xl overflow-hidden bg-gray-50 dark:bg-dark-bg transition-colors">
                            <img src="${item.image}" class="w-full h-full object-cover">
                            ${!item.isAvailable ? '<div class="absolute inset-0 bg-black/50 flex items-center justify-center text-white font-bold text-xs">Unavailable</div>' : ''}
                        </div>
                        
                        <div>
                            <div class="flex justify-between items-start mb-1">
                                <h4 class="font-bold text-secondary dark:text-gray-100 text-sm line-clamp-1 transition-colors">${item.name}</h4>
                                <span class="text-primary font-bold text-xs whitespace-nowrap transition-colors">LKR ${item.price}</span>
                            </div>
                            <p class="text-xs text-gray-400 dark:text-dark-muted mb-3 transition-colors">${item.category} • ${item.subCategory}</p>
                            
                            <div class="flex gap-2 text-center">
                                <button onclick="openEditModal(${item.id})" class="flex-1 py-2 border border-gray-200 dark:border-dark-border rounded-lg text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-bg transition-colors leading-none">Edit</button>
                                <button onclick="toggleAvailability(${item.id})" class="flex-1 py-2 ${item.isAvailable ? 'bg-red-50 dark:bg-red-500/10 text-red-500 hover:bg-red-100 dark:hover:bg-red-500/20' : 'bg-green-50 dark:bg-green-500/10 text-green-500 hover:bg-green-100 dark:hover:bg-green-500/20'} rounded-lg text-xs font-bold transition-colors leading-none">
                                    ${item.isAvailable ? 'Disable' : 'Enable'}
                                </button>
                            </div>
                            <button onclick="deleteMenuItem(${item.id})" class="absolute top-2 right-2 p-1 bg-white/80 rounded-full text-red-500 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50" title="Delete Item">
                                <i data-lucide="trash-2" class="w-4 h-4"></i>
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function updateMenuList(query) {
    adminState.menuSearch = query;
    renderAdmin(); // Full Re-render to update counts and grid
    
    // Restore focus to search input
    const searchInput = document.querySelector('input[placeholder="Search for food..."]');
    if (searchInput) {
        searchInput.focus();
        const val = searchInput.value;
        searchInput.value = '';
        searchInput.value = val;
    }
}

function renderOrdersView() {
    const orders = getFilteredOrders();

    return `
        <!-- Order Type Segmented Control -->
        <div class="mb-6 flex justify-center">
            <div class="bg-gray-100 dark:bg-dark-surface p-1.5 rounded-2xl flex gap-1 border border-gray-200 dark:border-dark-border w-full max-w-lg shadow-inner">
                <button onclick="adminState.orderFilter = 'active'; renderAdmin()" 
                    class="flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${adminState.orderFilter === 'active' ? 'bg-white dark:bg-dark-bg text-primary shadow-md shadow-gray-200/50 dark:shadow-none' : 'text-gray-500 dark:text-dark-muted hover:text-gray-700 dark:hover:text-gray-300'}">
                    Active
                </button>
                <button onclick="adminState.orderFilter = 'completed'; renderAdmin()" 
                    class="flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${adminState.orderFilter === 'completed' ? 'bg-white dark:bg-dark-bg text-primary shadow-md shadow-gray-200/50 dark:shadow-none' : 'text-gray-500 dark:text-dark-muted hover:text-gray-700 dark:hover:text-gray-300'}">
                    Completed
                </button>
                <button onclick="adminState.orderFilter = 'total'; renderAdmin()" 
                    class="flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${adminState.orderFilter === 'total' ? 'bg-white dark:bg-dark-bg text-primary shadow-md shadow-gray-200/50 dark:shadow-none' : 'text-gray-500 dark:text-dark-muted hover:text-gray-700 dark:hover:text-gray-300'}">
                    All
                </button>
            </div>
        </div>

        <!-- Date Filter Control -->
        <div class="bg-white dark:bg-dark-surface p-4 rounded-3xl border border-gray-100 dark:border-dark-border shadow-sm mb-6 flex flex-col md:flex-row justify-between items-center gap-4">
            <div class="flex items-center gap-2">
                <i data-lucide="calendar-days" class="w-5 h-5 text-primary"></i>
                <h3 class="font-bold text-secondary dark:text-gray-100 text-sm">Date Range:</h3>
                <select onchange="updateDateFilter(this.value)" class="bg-gray-50 dark:bg-dark-bg border border-gray-200 dark:border-dark-border text-gray-700 dark:text-gray-200 text-sm font-bold rounded-lg focus:ring-primary focus:border-primary block p-2 outline-none">
                    <option value="today" ${adminState.dateFilter === 'today' ? 'selected' : ''}>Today</option>
                    <option value="yesterday" ${adminState.dateFilter === 'yesterday' ? 'selected' : ''}>Yesterday</option>
                    <option value="last7" ${adminState.dateFilter === 'last7' ? 'selected' : ''}>Last 7 Days</option>
                    <option value="last30" ${adminState.dateFilter === 'last30' ? 'selected' : ''}>Last 30 Days</option>
                    <option value="thisMonth" ${adminState.dateFilter === 'thisMonth' ? 'selected' : ''}>This Month</option>
                    <option value="custom" ${adminState.dateFilter === 'custom' ? 'selected' : ''}>Custom Range</option>
                </select>
            </div>
            
            <div class="flex items-center gap-2">
                <input type="date" value="${adminState.startDate}" onchange="handleDateChange('startDate', this.value)" class="bg-gray-50 border border-gray-200 text-gray-700 text-sm font-bold rounded-lg p-2 outline-none focus:border-primary">
                <span class="text-gray-400 font-bold">-</span>
                <input type="date" value="${adminState.endDate}" onchange="handleDateChange('endDate', this.value)" class="bg-gray-50 border border-gray-200 text-gray-700 text-sm font-bold rounded-lg p-2 outline-none focus:border-primary">
            </div>
        </div>

        <!-- Search Control -->
        <div class="bg-white dark:bg-dark-surface p-4 rounded-3xl border border-gray-100 dark:border-dark-border shadow-sm mb-6">
            <div class="relative">
                <i data-lucide="search" class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-dark-muted"></i>
                <input type="text" 
                    placeholder="Search orders by ID, Customer, or Item..." 
                    value="${adminState.orderSearch || ''}"
                    oninput="updateOrdersList(this.value)"
                    class="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-dark-bg/50 border border-gray-200 dark:border-dark-border rounded-xl text-sm font-bold text-secondary dark:text-gray-100 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-gray-300 dark:placeholder:text-gray-600"
                >
            </div>
        </div>

        <div id="orders-list-container" class="bg-white dark:bg-dark-surface p-6 rounded-3xl border border-gray-100 dark:border-dark-border shadow-sm">
            ${renderOrdersListHTML(orders)}
        </div>
    `;
}


// ===================== CUSTOMERS VIEW & LOGIC =====================

function getUniqueCustomers() {
    const orders = DataStore.getOrders();
    const customersMap = new Map();

    orders.forEach(order => {
        const user = order.user || {};
        const id = user.id || ' Guest'; // Use email or guest

        // Skip purely anonymous/guest if desired, but we'll include them for now as 'Guest'
        if (id === 'Guest' && !customersMap.has('Guest')) {
            customersMap.set('Guest', {
                id: 'Guest',
                name: 'Guest User',
                email: 'N/A',
                phone: 'N/A',
                totalOrders: 0,
                totalSpent: 0,
                lastOrderDate: order.date
            });
        }

        if (!customersMap.has(id)) {
            customersMap.set(id, {
                id: id,
                name: user.name || id.split('@')[0] || 'Unknown',
                email: user.email || id || 'N/A', // Assuming ID is email for logged in users
                phone: user.phone || 'N/A',
                totalOrders: 0,
                totalSpent: 0,
                lastOrderDate: order.date
            });
        }

        const customer = customersMap.get(id);
        customer.totalOrders += 1;
        customer.totalSpent += (order.total || 0);
        // keep most recent date
        if (new Date(order.date) > new Date(customer.lastOrderDate)) {
            customer.lastOrderDate = order.date;
            // Update profile info if newer order has better info
            if (user.name) customer.name = user.name;
            if (user.phone) customer.phone = user.phone;
        }
    });

    return Array.from(customersMap.values());
}

function getFilteredCustomers() {
    let customers = getUniqueCustomers();
    const query = (adminState.customerSearch || '').toLowerCase();

    if (query) {
        customers = customers.filter(c =>
            c.name.toLowerCase().includes(query) ||
            c.email.toLowerCase().includes(query) ||
            c.phone.toLowerCase().includes(query)
        );
    }
    return customers;
}

function renderCustomersView() {
    const customers = getFilteredCustomers();

    return `
        <!-- Search Control -->
        <div class="bg-white dark:bg-dark-surface p-4 rounded-3xl border border-gray-100 dark:border-dark-border shadow-sm mb-6">
            <div class="relative">
                <i data-lucide="search" class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-dark-muted"></i>
                <input type="text" 
                    placeholder="Search customers by Name, Email or Phone..." 
                    value="${adminState.customerSearch || ''}"
                    oninput="updateCustomersList(this.value)"
                    class="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-dark-bg/50 border border-gray-200 dark:border-dark-border rounded-xl text-sm font-bold text-secondary dark:text-gray-100 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-gray-300 dark:placeholder:text-gray-600"
                >
            </div>
        </div>

        <div id="customers-list-container" class="bg-white dark:bg-dark-surface p-6 rounded-3xl border border-gray-100 dark:border-dark-border shadow-sm">
            ${renderCustomersListHTML(customers)}
        </div>
    `;
}

function renderCustomersListHTML(customers) {
    return `
        <div class="flex justify-between items-center mb-6">
             <h3 class="text-lg font-bold dark:text-gray-100">Customers</h3>
             <span class="text-xs font-bold text-gray-400 dark:text-dark-muted bg-gray-50 dark:bg-dark-bg px-3 py-1 rounded-full border dark:border-dark-border">${customers.length} customers found</span>
        </div>
       
        ${customers.length === 0 ? `<div class="text-center py-10 text-gray-400 dark:text-dark-muted font-bold">No customers found matching your criteria.</div>` : `
        <div class="overflow-x-auto">
            <table class="w-full text-sm text-left">
                <thead class="text-gray-400 dark:text-dark-muted font-medium border-b border-gray-50 dark:border-dark-border">
                    <tr>
                        <th class="pb-3 pl-0 sm:pl-2">Customer</th>
                        <th class="pb-3 hidden sm:table-cell">Contact Info</th>
                        <th class="pb-3 hidden sm:table-cell">Total Orders</th>
                        <th class="pb-3 hidden sm:table-cell">Total Spent</th>
                        <th class="pb-3 hidden sm:table-cell">Last Active</th>
                        <th class="pb-3 text-right">Actions</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-50 dark:divide-dark-border">
                    ${customers.sort((a, b) => b.totalSpent - a.totalSpent).map(customer => `
                        <tr class="group hover:bg-gray-50 dark:hover:bg-dark-bg transition-colors">
                             <td class="py-4 pl-0 sm:pl-2 align-top">
                                <div class="flex items-center gap-3">
                                    <div class="w-10 h-10 rounded-full bg-gray-100 dark:bg-dark-bg flex items-center justify-center text-primary font-bold transition-colors">
                                        ${customer.name ? customer.name.charAt(0).toUpperCase() : 'U'}
                                    </div>
                                    <div>
                                        <div class="font-bold text-secondary dark:text-gray-100 transition-colors">${customer.name}</div>
                                        <div class="text-xs text-gray-400 dark:text-dark-muted transition-colors">ID: ${customer.id.length > 10 ? customer.id.slice(0, 8) + '...' : customer.id}</div>
                                    </div>
                                </div>
                            </td>

                            <td class="hidden sm:table-cell py-4 align-top">
                                <div class="flex flex-col gap-1 text-xs">
                                    <div class="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                                        <i data-lucide="mail" class="w-3 h-3 text-gray-400"></i> ${customer.email}
                                    </div>
                                    <div class="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                                        <i data-lucide="phone" class="w-3 h-3 text-gray-400"></i> ${customer.phone}
                                    </div>
                                </div>
                            </td>

                            <td class="hidden sm:table-cell py-4 font-bold text-gray-600 dark:text-gray-400 align-top pl-4">${customer.totalOrders}</td>
                            
                            <td class="hidden sm:table-cell py-4 font-bold text-primary align-top">${formatPrice(customer.totalSpent)}</td>

                            <td class="hidden sm:table-cell py-4 text-xs text-gray-500 dark:text-dark-muted align-top">${new Date(customer.lastOrderDate).toLocaleDateString()}</td>

                            <td class="py-4 align-top text-right">
                                <button onclick="viewCustomerHistory('${customer.id}')" class="bg-gray-100 dark:bg-dark-bg/50 hover:bg-gray-200 dark:hover:bg-dark-bg text-secondary dark:text-gray-200 px-3 py-2 rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-2 border dark:border-dark-border">
                                    <i data-lucide="history" class="w-3 h-3"></i> History
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        `}
    `;
}

function updateCustomersList(query) {
    adminState.customerSearch = query;
    const customers = getFilteredCustomers();
    const container = document.getElementById('customers-list-container');
    if (container) {
        container.innerHTML = renderCustomersListHTML(customers);
        lucide.createIcons();
    }
}

function viewCustomerHistory(customerId) {
    adminState.selectedCustomer = customerId;
    renderAdmin(); // Re-render to show modal
}

function closeCustomerHistory() {
    adminState.selectedCustomer = null;
    renderAdmin();
}

function renderCustomerHistoryModal() {
    const customerId = adminState.selectedCustomer;
    const allOrders = DataStore.getOrders();
    // Filter orders for this customer
    const customerOrders = allOrders.filter(o =>
        (o.user && o.user.id === customerId) ||
        (customerId === 'Guest' && (!o.user || !o.user.id || o.user.id === 'Guest'))
    );

    // Calculate total spent for this specific history view
    const totalSpent = customerOrders.reduce((acc, o) => acc + (o.total || 0), 0);
    const firstOrder = customerOrders.length > 0 ? customerOrders[0] : {};
    const customerName = (customerId !== 'Guest' && firstOrder.user) ? (firstOrder.user.name || customerId) : 'Guest User';

    return `
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" onclick="closeCustomerHistory()"></div>
            <div class="bg-white dark:bg-dark-surface rounded-3xl p-6 w-full max-w-4xl relative z-10 shadow-2xl animate-fade-in max-h-[90vh] flex flex-col border border-transparent dark:border-dark-border">
                <div class="flex justify-between items-center mb-6">
                    <div>
                        <h3 class="text-xl font-[900] text-secondary dark:text-gray-100">Order History</h3>
                        <p class="text-sm text-gray-500 dark:text-dark-muted font-bold">${customerName} • <span class="text-primary">${customerOrders.length} Orders</span> • Total: ${formatPrice(totalSpent)}</p>
                    </div>
                    <button onclick="closeCustomerHistory()" class="p-2 hover:bg-gray-100 dark:hover:bg-dark-bg rounded-full transition-colors">
                        <i data-lucide="x" class="w-5 h-5 text-gray-500 dark:text-dark-muted"></i>
                    </button>
                </div>

                <div class="overflow-x-auto pr-2">
                     ${customerOrders.length === 0 ? `<div class="text-center py-10 text-gray-400 dark:text-dark-muted font-bold">No history available.</div>` : `
                    <table class="w-full text-sm text-left">
                        <thead class="text-gray-400 dark:text-gray-500 font-bold border-b border-gray-100 dark:border-gray-800 uppercase tracking-wider text-[10px] bg-white dark:bg-dark-surface sticky top-0">
                            <tr>
                                <th class="pb-3 pl-0 sm:pl-2">Order</th>
                                <th class="pb-3 hidden sm:table-cell">Date</th>
                                <th class="pb-3 hidden sm:table-cell">Items</th>
                                <th class="pb-3 hidden sm:table-cell">Amount</th>
                                <th class="pb-3 text-right sm:text-left">Status</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
                            ${customerOrders.sort((a, b) => new Date(b.date) - new Date(a.date)).map(order => {
        const firstItem = order.items[0];
        const moreCount = order.items.length - 1;
        return `
                                <tr class="group hover:bg-gray-50 dark:hover:bg-[#111827] transition-colors">
                                    <td class="py-4 pl-0 sm:pl-2 align-top w-auto">
                                        <div class="hidden sm:block">
                                            <div class="font-[900] text-gray-500 dark:text-gray-400">#${order.id}</div>
                                        </div>
                                        
                                        <div class="sm:hidden flex gap-3">
                                             <img src="${firstItem.image}" class="w-12 h-12 rounded-lg object-cover bg-gray-100 dark:bg-dark-bg border border-gray-200 dark:border-gray-800 flex-shrink-0">
                                             <div class="flex flex-col gap-0.5">
                                                <div class="flex items-center gap-2">
                                                    <span class="font-[900] text-secondary dark:text-gray-100 text-sm">#${order.id.slice(-8)}</span>
                                                    <span class="text-[10px] font-bold text-gray-400 dark:text-gray-500">${new Date(order.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                </div>
                                                <div class="text-xs font-bold text-gray-600 dark:text-gray-400 line-clamp-1">${firstItem.name} ${moreCount > 0 ? `+${moreCount}` : ''}</div>
                                                <div class="text-xs font-[800] text-primary">${formatPrice(order.total)}</div>
                                             </div>
                                        </div>
                                    </td>
                                    
                                    <td class="py-4 text-xs font-bold text-gray-600 dark:text-gray-400 hidden sm:table-cell align-top whitespace-nowrap pr-4">
                                        ${new Date(order.date).toLocaleDateString()}<br>${new Date(order.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </td>

                                    <td class="hidden sm:table-cell py-4 text-secondary dark:text-gray-300 font-bold w-48 align-top">
                                        <div class="flex items-center gap-2">
                                            <div class="w-8 h-8 rounded-lg bg-gray-100 dark:bg-dark-bg border border-gray-200 dark:border-gray-800 flex-shrink-0 overflow-hidden shadow-sm">
                                                 <img src="${firstItem.image}" class="w-full h-full object-cover mix-blend-multiply dark:mix-blend-normal">
                                            </div>
                                            <div class="line-clamp-1 text-xs font-bold text-secondary dark:text-gray-200">
                                                ${firstItem.name} ${moreCount > 0 ? `<span class="text-gray-400 dark:text-gray-500 font-black">+${moreCount}</span>` : ''}
                                            </div>
                                        </div>
                                    </td>

                                    <td class="py-4 font-[900] text-secondary dark:text-gray-100 hidden sm:table-cell align-top tracking-tight">${formatPrice(order.total)}</td>
                                    <td class="py-4 align-top text-right sm:text-left">
                                        <span class="bg-gray-100 dark:bg-dark-bg text-gray-600 dark:text-gray-400 px-3 py-1.5 rounded-lg text-[10px] uppercase font-black tracking-widest inline-block border border-gray-200 dark:border-dark-border">${order.status}</span>
                                    </td>
                                </tr>
                            `}).join('')}
                        </tbody>
                    </table>
                    `}
                </div>
            </div>
        </div>
    `;
}

function renderStatCard(title, value, growth, isPositive, icon) {
    return `
        <div class="bg-white p-3 sm:p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between h-full">
            <div class="flex items-start justify-between mb-1 sm:mb-4">
                <div class="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wide truncate w-full pr-1">${title}</div>
                <div class="hidden sm:flex w-8 h-8 rounded-full bg-orange-50 items-center justify-center text-primary">
                    <i data-lucide="${icon}" class="w-4 h-4"></i>
                </div>
            </div>
            <div>
                <h3 class="text-lg sm:text-2xl font-[900] text-secondary truncate tracking-tight">${value}</h3>
                 ${growth !== '0%' ? `
                 <div class="flex items-center gap-1 mt-0.5 sm:mt-1">
                     <span class="${isPositive ? 'text-green-500' : 'text-red-500'} text-[10px] font-bold flex items-center gap-0.5">
                        ${isPositive ? '↑' : '↓'} ${growth}
                     </span>
                 </div>` : ''}
            </div>
        </div>
    `;
}

// REAL STAFF DATA FROM FIREBASE
let localStaff = [];

db.collection('staff_users').onSnapshot((snapshot) => {
    localStaff = [];
    snapshot.forEach((doc) => {
        localStaff.push({ id: doc.id, ...doc.data() });
    });

    // Sort so newest or active show up first
    localStaff.sort((a, b) => b.status.localeCompare(a.status));

    if (adminState.currentView === 'staff') {
        renderAdmin();
    }
});

function getFilteredStaff() {
    let staff = localStaff;
    const query = (adminState.staffSearch || '').toLowerCase();

    if (query) {
        staff = staff.filter(s =>
            s.name.toLowerCase().includes(query) ||
            s.email.toLowerCase().includes(query) ||
            s.role.toLowerCase().includes(query)
        );
    }
    return staff;
}

function renderStaffView() {
    const staff = getFilteredStaff();
    const adminCount = localStaff.filter(s => s.role === 'admin' && s.status === 'active').length;
    const activeStaffCount = localStaff.filter(s => s.role === 'staff' && s.status === 'active').length;
    const suspendedCount = localStaff.filter(s => s.status === 'suspended').length;

    return `
        <div class="flex justify-between items-center mb-6">
            <div>
                <h2 class="text-2xl font-[900] text-secondary dark:text-gray-100">Staff & Admins</h2>
                <p class="text-[10px] font-bold text-gray-400 dark:text-dark-muted uppercase tracking-widest mt-1">Manage Access Intelligently</p>
            </div>
            <button onclick="openAddStaffModal()" class="bg-primary hover:bg-orange-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all focus:ring-4 focus:ring-primary/20 flex items-center gap-2 shadow-lg shadow-primary/30">
                <i data-lucide="user-plus" class="w-4 h-4"></i> Add Account
            </button>
        </div>

        <div class="grid grid-cols-3 gap-4 mb-6">
            <div class="bg-gradient-to-br from-indigo-500 to-purple-600 p-4 rounded-2xl text-white border border-indigo-400/50 shadow-md">
                <div class="flex justify-between items-start mb-2">
                    <p class="text-[10px] font-black uppercase tracking-wider text-indigo-100">Admins</p>
                    <i data-lucide="shield" class="w-5 h-5 text-indigo-200"></i>
                </div>
                <h3 class="text-3xl font-[900]">${adminCount}</h3>
            </div>
            <div class="bg-white dark:bg-dark-surface p-4 rounded-2xl border border-gray-100 dark:border-dark-border shadow-sm">
                <div class="flex justify-between items-start mb-2">
                    <p class="text-[10px] font-black uppercase tracking-wider text-gray-400 dark:text-dark-muted">Active Staff</p>
                    <i data-lucide="users" class="w-5 h-5 text-primary"></i>
                </div>
                <h3 class="text-3xl font-[900] text-secondary dark:text-gray-100">${activeStaffCount}</h3>
            </div>
             <div class="bg-white dark:bg-dark-surface p-4 rounded-2xl border border-gray-100 dark:border-dark-border shadow-sm">
                <div class="flex justify-between items-start mb-2">
                    <p class="text-[10px] font-black uppercase tracking-wider text-gray-400 dark:text-dark-muted">Suspended</p>
                    <i data-lucide="user-minus" class="w-5 h-5 text-red-400"></i>
                </div>
                <h3 class="text-3xl font-[900] text-red-500">${suspendedCount}</h3>
            </div>
        </div>

        <div class="bg-white dark:bg-dark-surface p-4 rounded-3xl border border-gray-100 dark:border-dark-border shadow-sm mb-6">
            <div class="relative">
                <i data-lucide="search" class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-dark-muted"></i>
                <input type="text" 
                    placeholder="Search by name, email or role..." 
                    value="${adminState.staffSearch || ''}"
                    oninput="updateStaffList(this.value)"
                    class="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-dark-bg/50 border border-gray-200 dark:border-dark-border rounded-xl text-sm font-bold text-secondary dark:text-gray-100 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-gray-300 dark:placeholder:text-gray-600"
                >
            </div>
        </div>

        <div class="bg-white dark:bg-dark-surface rounded-3xl border border-gray-100 dark:border-dark-border shadow-sm overflow-hidden auto-height-transition">
            <div class="overflow-x-auto hide-scrollbar">
                <table class="w-full text-left border-collapse">
                    <thead class="text-gray-400 dark:text-gray-500 font-bold border-b border-gray-100 dark:border-dark-border uppercase tracking-widest text-[10px] bg-gray-50 dark:bg-dark-bg">
                        <tr>
                            <th class="p-4 pl-6 whitespace-nowrap">User</th>
                            <th class="p-4 whitespace-nowrap">Role</th>
                            <th class="p-4 whitespace-nowrap">Status</th>
                            <th class="p-4 whitespace-nowrap hidden md:table-cell">Last Login</th>
                            <th class="p-4 text-right pr-6 whitespace-nowrap">Actions</th>
                        </tr>
                    </thead>
                    <tbody id="staff-table-body" class="divide-y divide-gray-100 dark:divide-dark-border text-sm">
                        ${renderStaffListHTML(staff)}
                    </tbody>
                </table>
            </div>
        </div>
        ${adminState.isModalOpen && adminState.currentView === 'staff' ? renderStaffModal() : ''}
    `;
}

function renderStaffListHTML(staffList) {
    if (staffList.length === 0) {
        return `
            <tr>
                <td colspan="5" class="p-12 text-center text-gray-400 dark:text-dark-muted font-bold bg-white dark:bg-dark-surface">
                    <div class="flex flex-col items-center justify-center gap-3">
                        <i data-lucide="users-xs" class="w-12 h-12 opacity-50"></i>
                        <p>No accounts found.</p>
                    </div>
                </td>
            </tr>
        `;
    }

    return staffList.map(user => `
        <tr class="hover:bg-gray-50/50 dark:hover:bg-dark-bg transition-colors bg-white dark:bg-dark-surface group">
            <td class="p-4 pl-6">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full bg-gray-100 dark:bg-dark-bg flex items-center justify-center text-gray-400 shrink-0">
                        <i data-lucide="user" class="w-5 h-5"></i>
                    </div>
                    <div>
                        <p class="font-bold text-secondary dark:text-gray-100">${user.name}</p>
                        <p class="text-xs text-gray-400 dark:text-dark-muted font-medium">${user.email}</p>
                    </div>
                </div>
            </td>
            <td class="p-4">
                <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border 
                    ${user.role === 'admin'
            ? 'bg-purple-50 text-purple-600 border-purple-200 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/20'
            : 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20'}">
                    <i data-lucide="${user.role === 'admin' ? 'shield-check' : 'user'}" class="w-3 h-3"></i>
                    ${user.role}
                </span>
            </td>
            <td class="p-4">
                 <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border 
                    ${user.status === 'active'
            ? 'bg-green-50 text-green-600 border-green-200 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/20'
            : 'bg-red-50 text-red-600 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20'}">
                    ${user.status}
                </span>
            </td>
            <td class="p-4 hidden md:table-cell text-gray-400 dark:text-dark-muted text-xs font-bold">
                ${(() => {
            const l = user.lastLogin || user.lastLoginServer || user.lastLoginString || user.lastActivity;
            if (!l) return `<span title="Document ID: ${user.id}">Never</span>`;
            try {
                let d = (typeof l.toDate === 'function') ? l.toDate() : new Date(l);
                if (isNaN(d.getTime())) return `<span title="Document ID: ${user.id}">Never</span>`;
                return `<span title="Document ID: ${user.id}">${d.toLocaleDateString()}</span>`;
            } catch (e) { return `<span title="Document ID: ${user.id}">Never</span>`; }
        })()}
            </td>
            <td class="p-4 pr-6 text-right">
                <div class="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onclick="openEditStaffModal('${user.id}')" class="p-2 hover:bg-gray-100 dark:hover:bg-dark-border text-gray-400 dark:text-dark-muted hover:text-primary transition-colors rounded-lg" title="Edit Account">
                        <i data-lucide="pencil" class="w-4 h-4"></i>
                    </button>
                    ${user.email !== 'admin@ncafe.com' ? `
                        ${user.status === 'active' ? `
                        <button onclick="toggleStaffStatus('${user.id}')" class="p-2 hover:bg-orange-50 dark:hover:bg-orange-500/10 text-gray-400 dark:text-dark-muted hover:text-orange-500 transition-colors rounded-lg" title="Suspend Account">
                            <i data-lucide="user-minus" class="w-4 h-4"></i>
                        </button>
                        ` : `
                        <button onclick="toggleStaffStatus('${user.id}')" class="p-2 hover:bg-green-50 dark:hover:bg-green-500/10 text-gray-400 dark:text-dark-muted hover:text-green-500 transition-colors rounded-lg" title="Reactivate Account">
                            <i data-lucide="user-check" class="w-4 h-4"></i>
                        </button>
                        `}
                        <button onclick="deleteStaff('${user.id}')" class="p-2 hover:bg-red-50 dark:hover:bg-red-500/10 text-gray-400 dark:text-dark-muted hover:text-red-500 transition-colors rounded-lg" title="Delete Account">
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                        </button>
                    ` : ''}
                </div>
            </td>
        </tr>
    `).join('');
}

window.updateStaffList = function (query) {
    adminState.staffSearch = query;
    const tbody = document.getElementById('staff-table-body');
    if (tbody) {
        tbody.innerHTML = renderStaffListHTML(getFilteredStaff());
        lucide.createIcons();
    }
}

function openAddStaffModal() {
    adminState.modalStaffMode = 'add';
    adminState.editingStaffItem = null;
    adminState.isStaffModalUnlocked = false;
    adminState.isModalOpen = true;
    renderAdmin();
}

window.openEditStaffModal = function (id) {
    const user = localStaff.find(s => s.id === id);
    if (!user) return;
    adminState.modalStaffMode = 'edit';
    adminState.editingStaffItem = { ...user };
    adminState.isStaffModalUnlocked = false;
    adminState.isModalOpen = true;
    renderAdmin();
};

window.toggleStaffStatus = async function (id) {
    const userIndex = localStaff.findIndex(s => s.id === id);
    if (userIndex > -1) {
        // PROTECTION: Prevent suspension of main admin
        if (localStaff[userIndex].email === 'admin@ncafe.com') {
            showToast("System Protection", "The main system administrator account cannot be suspended.", "error");
            return;
        }

        const pinVerified = await showPinPrompt();
        if (!pinVerified) {
            showToast("Security", "Action cancelled: PIN verification failed.", "error");
            return;
        }

        const newStatus = localStaff[userIndex].status === 'active' ? 'suspended' : 'active';
        const confirmed = await showConfirm({
            title: newStatus === 'suspended' ? 'Suspend Account' : 'Reactivate Account',
            message: `Are you sure you want to ${newStatus === 'suspended' ? 'suspend' : 'reactivate'} this account?`,
            confirmText: newStatus === 'suspended' ? 'Yes, Suspend' : 'Yes, Reactivate',
            isDanger: newStatus === 'suspended'
        });
        if (confirmed) {
            try {
                await db.collection('staff_users').doc(id).update({ status: newStatus });
            } catch (error) {
                console.error("Error updating status:", error);
                showToast("Update Failed", "We couldn't update the user's status. Please try again.", "error");
            }
        }
    }
}

window.deleteStaff = async function (id) {
    const user = localStaff.find(s => s.id === id);
    if (user && user.email === 'admin@ncafe.com') {
        showToast("System Protection", "The main system administrator account cannot be deleted.", "error");
        return;
    }

    const pinVerified = await showPinPrompt();
    if (!pinVerified) {
        showToast("Security", "Action cancelled: PIN verification failed.", "error");
        return;
    }

    const confirmed = await showConfirm({
        title: 'Delete Account',
        message: 'Are you sure you want to PERMANENTLY delete this account? This action cannot be undone.',
        confirmText: 'Yes, Delete',
        isDanger: true
    });
    if (confirmed) {
        try {
            await db.collection('staff_users').doc(id).delete();
        } catch (error) {
            console.error("Error deleting user:", error);
            showToast("Delete Failed", "Failed to remove the account from the database.", "error");
        }
    }
}

function renderStaffModal() {
    const isEdit = adminState.modalStaffMode === 'edit';
    const user = adminState.editingStaffItem || {};

    return `
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" onclick="closeModal()"></div>
            <div class="bg-white dark:bg-dark-surface rounded-3xl p-6 w-full max-w-lg relative z-10 shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto border border-transparent dark:border-dark-border">
                <div class="flex justify-between items-center mb-6">
                    <h3 class="text-lg font-[900] text-secondary dark:text-gray-100">${isEdit ? 'Edit Account' : 'Create New Account'}</h3>
                    <button onclick="closeModal()" class="p-2 hover:bg-gray-100 dark:hover:bg-dark-bg rounded-full transition-colors">
                        <i data-lucide="x" class="w-5 h-5 text-gray-500 dark:text-dark-muted"></i>
                    </button>
                </div>

                <form onsubmit="saveStaffAccount(event)" class="space-y-4">
                    <!-- Security Unlock Section -->
                    <div class="mb-6">
                        <div id="unlock-btn-container">
                            ${adminState.isStaffModalUnlocked ? `
                                <div class="flex items-center gap-2 text-green-500 font-bold text-[10px] uppercase tracking-widest py-3 px-4 bg-green-50 dark:bg-green-500/10 rounded-xl border border-green-200 dark:border-green-500/20 shadow-sm">
                                    <i data-lucide="unlock" class="w-4 h-4"></i>
                                    Authorization Granted - Access Unlocked
                                </div>
                            ` : `
                                <button type="button" onclick="unlockAccountSecurity()" class="w-full py-3 bg-gray-50 dark:bg-dark-bg border border-gray-200 dark:border-dark-border rounded-xl text-[10px] font-black uppercase tracking-widest text-secondary dark:text-gray-200 flex items-center justify-center gap-2 hover:bg-orange-50 hover:text-primary hover:border-primary/30 transition-all active:scale-95 shadow-sm">
                                    <i data-lucide="lock" class="w-4 h-4"></i>
                                    Unlock for ${isEdit ? 'Editing' : 'Creation'}
                                </button>
                            `}
                        </div>
                    </div>

                    <div>
                        <label class="block text-xs font-bold text-gray-400 dark:text-dark-muted mb-1">Full Name</label>
                        <input type="text" name="name" value="${user.name || ''}" required 
                            ${!adminState.isStaffModalUnlocked ? 'disabled' : ''}
                            class="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-bg focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all font-bold text-secondary dark:text-gray-100 text-sm disabled:opacity-50">
                    </div>
                    
                    <div>
                        <label class="block text-xs font-bold text-gray-400 dark:text-dark-muted mb-1">Email Address</label>
                        <input type="email" name="email" id="modal-email" value="${user.email || ''}" required 
                            ${!adminState.isStaffModalUnlocked ? 'disabled' : ''}
                            class="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-bg focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all font-bold text-secondary dark:text-gray-100 text-sm disabled:opacity-50 disabled:cursor-not-allowed">
                        ${isEdit && user.email === 'admin@ncafe.com' ? '<p class="text-[10px] text-orange-500 mt-1 font-bold italic">⚠️ Caution: Changing the master admin email affects system login.</p>' : ''}
                    </div>

                    ${!isEdit ? `
                    <div>
                        <label class="block text-xs font-bold text-gray-400 dark:text-dark-muted mb-1">Temporary Password</label>
                        <input type="password" name="password" required minlength="6" 
                            ${!adminState.isStaffModalUnlocked ? 'disabled' : ''}
                            class="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-bg focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all font-bold text-secondary dark:text-gray-100 text-sm disabled:opacity-50">
                        <p class="text-[10px] text-gray-400 mt-1">Must be at least 6 characters.</p>
                    </div>
                    ` : `
                    <div class="pt-4 border-t border-gray-100 dark:border-dark-border">
                        <div class="flex items-center justify-between mb-2">
                            <label class="block text-[10px] font-black text-gray-400 dark:text-dark-muted uppercase tracking-tight">Security & Password</label>
                            <button type="button" onclick="sendStaffResetEmail('${user.email}')" 
                                ${!adminState.isStaffModalUnlocked ? 'disabled' : ''}
                                class="text-[10px] font-black text-primary hover:text-orange-600 transition-colors uppercase tracking-widest flex items-center gap-1 disabled:opacity-50">
                                <i data-lucide="mail" class="w-3 h-3"></i>
                                Send Reset Link
                            </button>
                        </div>
                        <div class="relative">
                            <input type="password" name="new_password" id="modal-password" placeholder="Leave blank to keep current" minlength="6" 
                                ${!adminState.isStaffModalUnlocked ? 'disabled' : ''}
                                class="w-full px-4 py-2 text-xs rounded-lg border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-bg focus:border-primary outline-none transition-all font-bold text-secondary dark:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed">
                            <p class="text-[9px] text-gray-400 mt-2 leading-relaxed">Passwords can only be force-changed if the email is also updated. Use <b>Send Reset Link</b> for existing emails.</p>
                        </div>
                    </div>
                    `}

                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-xs font-bold text-gray-400 dark:text-dark-muted mb-1">Account Role</label>
                            <select name="role" ${user.email === 'admin@ncafe.com' ? 'disabled' : ''} ${!adminState.isStaffModalUnlocked ? 'disabled' : ''}
                                class="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-bg focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all font-bold text-secondary dark:text-gray-100 text-sm disabled:opacity-50">
                                <option value="staff" ${(!user.role || user.role === 'staff') ? 'selected' : ''}>Staff (POS Only)</option>
                                <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin (Full Access)</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-400 dark:text-dark-muted mb-1">Personal Login PIN</label>
                            <input type="password" name="pin" value="${user.pin || ''}" maxlength="4" placeholder="4 digits" required
                                ${!adminState.isStaffModalUnlocked ? 'disabled' : ''}
                                class="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-bg focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all font-bold text-secondary dark:text-gray-100 text-sm disabled:opacity-50 tracking-[0.5em] text-center">
                        </div>
                    </div>


                    <div class="pt-4 border-t border-gray-100 dark:border-dark-border flex justify-end gap-3">
                        <button type="button" onclick="closeModal()" class="px-5 py-2.5 rounded-xl font-bold text-gray-500 hover:bg-gray-100 dark:text-dark-muted dark:hover:bg-dark-bg transition-colors text-sm">Cancel</button>
                        <button type="submit" 
                            ${!adminState.isStaffModalUnlocked ? 'disabled' : ''}
                            class="bg-primary hover:bg-orange-600 text-white px-6 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-orange-500/30 text-sm flex items-center gap-2 disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed">
                             <i data-lucide="${isEdit ? 'save' : 'plus-circle'}" class="w-4 h-4"></i>
                            ${isEdit ? 'Save Changes' : 'Create Account'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;
}

window.unlockAccountSecurity = async function () {
    const pinVerified = await showPinPrompt();
    if (pinVerified) {
        adminState.isStaffModalUnlocked = true;
        renderAdmin();
        showToast("Access Granted", "Security settings have been unlocked.", "success");
    } else {
        showToast("Access Denied", "Incorrect PIN or verification cancelled.", "error");
    }
};

window.sendStaffResetEmail = function(email) {
    if (!email) return;
    
    firebase.auth().sendPasswordResetEmail(email)
        .then(() => {
            showToast("Mail Sent", "Password reset instructions sent to: " + email, "success");
        })
        .catch(error => {
            console.error("Reset Error:", error);
            showToast("Mail Failed", "Could not send reset email: " + error.message, "error");
        });
};

window.saveStaffAccount = async function (e) {
    e.preventDefault();
    if (!adminState.isStaffModalUnlocked) {
        showToast("Access Denied", "Please unlock with PIN before saving.", "error");
        return;
    }
    const fd = new FormData(e.target);
    const isEdit = adminState.modalStaffMode === 'edit';

    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalContent = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Saving...';
    submitBtn.disabled = true;
    lucide.createIcons();

    try {
        if (isEdit) {
            const id = adminState.editingStaffItem.id;
            const email = adminState.editingStaffItem.email;
            const newEmail = fd.get('email');
            const newPassword = fd.get('new_password');

            // PROTECTION: Prevent role changes for main admin
            if (email === 'admin@ncafe.com' && fd.get('role') !== 'admin') {
                showToast("System Protection", "The main system administrator role cannot be changed.", "error");
                submitBtn.innerHTML = originalContent;
                submitBtn.disabled = false;
                lucide.createIcons();
                return;
            }

            // CASE 1: Updating SELF (Current Admin)
            if (auth.currentUser.email === email) {
                try {
                    if (newEmail && newEmail !== email) {
                        await auth.currentUser.updateEmail(newEmail);
                    }
                    if (newPassword) {
                        await auth.currentUser.updatePassword(newPassword);
                    }
                } catch (error) {
                    console.error("Auth Update Error:", error);
                    let msg = "Failed to update authentication details.";
                    if (error.code === 'auth/requires-recent-login') {
                        msg = "Security: Please sign out and sign in again to change these credentials.";
                    }
                    showToast("Security Error", msg, "error");
                    submitBtn.innerHTML = originalContent;
                    submitBtn.disabled = false;
                    lucide.createIcons();
                    return;
                }

                await db.collection('staff_users').doc(id).update({
                    name: fd.get('name'),
                    role: fd.get('role'),
                    email: newEmail,
                    pin: fd.get('pin')
                });
            }
            // CASE 2: Migrating / Re-creating STAFF (Another user)
            else if (newEmail !== email || newPassword) {
                // SECURITY: If email is SAME, Firebase client SDK blocks password updates for other users.
                if (newPassword && newEmail === email) {
                    showToast("Security Limit", "For security, passwords for existing emails can only be changed via the 'Send Reset Link' button.", "warning");
                    submitBtn.innerHTML = originalContent;
                    submitBtn.disabled = false;
                    lucide.createIcons();
                    return;
                }

                // We use a secondary app to create the NEW version of the user
                const appName = "MigrationApp_" + Date.now();
                const migrationApp = firebase.initializeApp(firebaseConfig, appName);

                try {
                    // 1. Create the new user record
                    // Note: If email is same, this fails (Firebase limit). User must change email.
                    const cred = await migrationApp.auth().createUserWithEmailAndPassword(newEmail, newPassword || "temppass123");

                    // 2. Cleanup migration app
                    await migrationApp.auth().signOut();
                    await migrationApp.delete();

                    // 3. Move Firestore data: Delete old doc, create new doc with target info
                    // This effectively "migrates" the staff member to the new credentials
                    await db.collection('staff_users').doc(id).delete();
                    await db.collection('staff_users').doc(cred.user.uid).set({
                        name: fd.get('name'),
                        email: newEmail,
                        role: fd.get('role'),
                        pin: fd.get('pin'),
                        status: adminState.editingStaffItem.status || 'active',
                        createdAt: adminState.editingStaffItem.createdAt || firebase.firestore.FieldValue.serverTimestamp(),
                        lastLogin: adminState.editingStaffItem.lastLogin || Date.now()
                    });

                    showToast("Success", "Account migrated to new credentials!", "success");
                } catch (error) {
                    console.error("Migration Error:", error);
                    let msg = "Could not migrate account.";
                    if (error.code === 'auth/email-already-in-use') {
                        msg = "Firebase requires a new email to change passwords for other users. Please change the email slightly or use a different one.";
                    }
                    showToast("Security Limit", msg, "error");
                    submitBtn.innerHTML = originalContent;
                    submitBtn.disabled = false;
                    lucide.createIcons();
                    return;
                }
            }
            // CASE 3: Only metadata change (Name/Role)
            else {
                await db.collection('staff_users').doc(id).update({
                    name: fd.get('name'),
                    role: fd.get('role'),
                    pin: fd.get('pin')
                });
            }

            closeModal();
        } else {
            // NEW ACCOUNT: Requires PIN before creation
            const pinVerified = await showPinPrompt();
            if (!pinVerified) {
                showToast("Security", "Action cancelled: PIN verification failed.", "error");
                submitBtn.innerHTML = originalContent;
                submitBtn.disabled = false;
                lucide.createIcons();
                return;
            }

            // TRICK: Use a secondary Firebase App to create the user so the current Admin does NOT get logged out
            const appName = "SecondaryTempApp_" + Date.now();
            const secondaryApp = firebase.initializeApp(firebaseConfig, appName);

            try {
                const cred = await secondaryApp.auth().createUserWithEmailAndPassword(fd.get('email'), fd.get('password'));

                // Immediately log the secondary app out and destroy it
                await secondaryApp.auth().signOut();
                await secondaryApp.delete();

                // Now safely save the new user's metadata to the database under their new secure UID using the PRIMARY app
                await db.collection('staff_users').doc(cred.user.uid).set({
                    name: fd.get('name'),
                    email: fd.get('email'),
                    role: fd.get('role'),
                    pin: fd.get('pin'),
                    status: 'active',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    lastLogin: Date.now() // initial placeholder
                });

                showToast("Success", "Account created successfully!", "success");
                closeModal();
            } catch (err) {
                // Cleanup if it failed
                await secondaryApp.delete();
                
                if (err.code === 'auth/email-already-in-use') {
                    showToast("Security Limit", "This email is still registered in Firebase from a previous session. Please use a different email (e.g., staff2a@ncafe.com) or contact support to clear the old session.", "error");
                    submitBtn.innerHTML = originalContent;
                    submitBtn.disabled = false;
                    lucide.createIcons();
                    return;
                }
                throw err;
            }
        }
    } catch (error) {
        console.error("Save Error:", error);
        showToast("Save Error", "Failed to save account details. Check your connection.", "error");
        submitBtn.innerHTML = originalContent;
        submitBtn.disabled = false;
        lucide.createIcons();
    }
};

// MODAL RENDERER
function renderModal() {
    const isEdit = adminState.modalMode === 'edit';
    const item = adminState.editingItem || {};

    return `
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" onclick="closeModal()"></div>
            <div class="bg-white dark:bg-dark-surface rounded-3xl p-6 w-full max-w-lg relative z-10 shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto border border-transparent dark:border-dark-border">
                <div class="flex justify-between items-center mb-6">
                    <h3 class="text-lg font-[900] text-secondary dark:text-gray-100">${isEdit ? 'Edit Item' : 'Add New Item'}</h3>
                    <button onclick="closeModal()" class="p-2 hover:bg-gray-100 dark:hover:bg-dark-bg rounded-full transition-colors">
                        <i data-lucide="x" class="w-5 h-5 text-gray-500 dark:text-dark-muted"></i>
                    </button>
                </div>

                <form onsubmit="saveItem(event)" class="space-y-4">
                    <div>
                        <label class="block text-xs font-bold text-gray-400 dark:text-dark-muted mb-1 transition-colors">Item Name</label>
                        <input type="text" name="name" value="${item.name || ''}" required class="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-bg focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all font-bold text-secondary dark:text-gray-100 text-sm">
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-xs font-bold text-gray-400 dark:text-dark-muted mb-1 transition-colors">Price (LKR)</label>
                            <input type="number" name="price" value="${item.price || ''}" required class="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-bg focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all font-bold text-secondary dark:text-gray-100 text-sm">
                        </div>
                        <div>
                             <label class="block text-xs font-bold text-gray-400 dark:text-dark-muted mb-1 transition-colors">Category</label>
                             <select name="category" required class="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-bg focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all font-bold text-secondary dark:text-gray-100 text-sm">
                                <option value="Pastries" ${item.category === 'Pastries' ? 'selected' : ''}>Pastries</option>
                                <option value="Desserts" ${item.category === 'Desserts' ? 'selected' : ''}>Desserts</option>
                                <option value="Hot Drinks" ${item.category === 'Hot Drinks' ? 'selected' : ''}>Hot Drinks</option>
                                <option value="Cold Drinks" ${item.category === 'Cold Drinks' ? 'selected' : ''}>Cold Drinks</option>
                             </select>
                        </div>
                    </div>

                    <div>
                        <label class="block text-xs font-bold text-gray-400 dark:text-dark-muted mb-1 transition-colors">Sub Category</label>
                        <input type="text" name="subCategory" value="${item.subCategory || ''}" placeholder="e.g. Savory, Cakes, Coffee..." required class="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-bg focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all font-bold text-secondary dark:text-gray-100 text-sm">
                    </div>

                    <!-- IMAGE UPLOAD SECTION -->
                    <div>
                        <label class="block text-xs font-bold text-gray-400 mb-1">Product Image</label>
                        
                        <!-- Hidden Input stores the Base64 string or original URL -->
                        <!-- FIX: Do not put item.image in value here to avoid Base64 truncation in DOM -->
                        <input type="hidden" name="finalImage" id="encoded-image" value="">
                        
                        <div class="flex items-start gap-4">
                            <!-- Preview -->
                            <div id="image-preview-container" class="w-20 h-20 bg-gray-100 rounded-xl border border-gray-200 flex items-center justify-center overflow-hidden shrink-0 ${!item.image ? 'hidden' : ''}">
                                <img id="image-preview" src="${item.image || ''}" class="w-full h-full object-cover">
                            </div>
                            
                            <div class="flex-1">
                                <label class="block w-full cursor-pointer group">
                                    <div class="flex items-center justify-center w-full h-20 border-2 border-dashed border-gray-200 dark:border-dark-border/50 rounded-xl hover:bg-gray-50 dark:hover:bg-dark-bg transition-all group-hover:text-primary">
                                        <div class="flex flex-col items-center justify-center pt-2 pb-3">
                                            <i data-lucide="upload-cloud" class="w-6 h-6 text-gray-400 dark:text-dark-muted mb-1 group-hover:text-primary transition-colors"></i>
                                            <p class="mb-0 text-[10px] text-gray-500 dark:text-dark-muted font-bold">Click to upload image</p>
                                        </div>
                                    </div>
                                    <input type="file" accept="image/*" class="hidden" onchange="handleImageUpload(this)">
                                </label>
                                <p class="text-[10px] text-gray-400 mt-1 pl-1">Max size 2MB. Auto-resized to 500px.</p>
                            </div>
                        </div>
                        
                        <!-- Legacy URL Input Toggle -->
                        <details class="mt-2 text-[10px] text-gray-400 cursor-pointer">
                            <summary class="hover:text-primary font-bold select-none">Or use image URL</summary>
                            <input type="url" placeholder="Paste direct image link..." 
                                oninput="document.getElementById('encoded-image').value = this.value; document.getElementById('image-preview').src = this.value; document.getElementById('image-preview-container').classList.remove('hidden');"
                                class="w-full mt-2 px-3 py-2 rounded-lg border border-gray-200 outline-none focus:border-primary text-gray-600">
                        </details>
                    </div>

                     <div>
                        <label class="block text-xs font-bold text-gray-400 mb-1">Description</label>
                        <textarea name="description" rows="3" required class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all font-bold text-secondary text-sm">${item.description || ''}</textarea>
                    </div>

                    <div class="pt-4 flex gap-3">
                        <button type="button" onclick="closeModal()" class="flex-1 py-3.5 rounded-xl font-bold text-sm text-gray-500 hover:bg-gray-100 transition-colors">Cancel</button>
                        <button type="submit" class="flex-1 py-3.5 rounded-xl font-bold text-sm bg-secondary text-white hover:bg-gray-800 transition-colors shadow-lg shadow-gray-900/20">
                            ${isEdit ? 'Save Changes' : 'Add Item'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;
}

// LOGIC
function switchView(view) {
    adminState.currentView = view;
    if (window.innerWidth < 768) {
        adminState.isSidebarOpen = false;
    }
    renderAdmin();
}

function toggleSidebar() {
    adminState.isSidebarOpen = !adminState.isSidebarOpen;
    renderAdmin();
}

// MENU ACTIONS
function selectCategory(cat) {
    adminState.selectedCategory = cat;
    renderAdmin();
}

function toggleAvailability(id) {
    const menuItems = DataStore.getMenu();
    const item = menuItems.find(i => i.id === id);
    if (item) {
        item.isAvailable = !item.isAvailable;
        DataStore.saveMenuItem(item);
        // renderAdmin(); // Listener will trigger render
    }
}

function openAddModal() {
    adminState.modalMode = 'add';
    adminState.editingItem = null;
    adminState.isModalOpen = true;
    renderAdmin();
}

function openEditModal(id) {
    const menuItems = DataStore.getMenu();
    const item = menuItems.find(i => i.id === id);
    if (item) {
        adminState.modalMode = 'edit';
        adminState.editingItem = { ...item };
        adminState.isModalOpen = true;
        renderAdmin();
    }
}

function closeModal() {
    adminState.isModalOpen = false;
    adminState.editingItem = null;
    adminState.editingStaffItem = null;
    adminState.isStaffModalUnlocked = false;
    renderAdmin();
}

// IMAGE PROCESSING HELPER
window.handleImageUpload = function (input) {
    const file = input.files[0];
    if (!file) return;

    // Size Check (2MB Limit)
    if (file.size > 2 * 1024 * 1024) {
        showToast("File Error", "The selected image is too large. Please use an image under 2MB.", "error");
        input.value = ""; // Clear
        return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
        const img = new Image();
        img.onload = function () {
            // Resize Logic
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            const MAX_WIDTH = 500;
            const MAX_HEIGHT = 500;

            if (width > height) {
                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }
            } else {
                if (height > MAX_HEIGHT) {
                    width *= MAX_HEIGHT / height;
                    height = MAX_HEIGHT;
                }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            // Convert to Base64 (JPEG 70% quality)
            const dataUrl = canvas.toDataURL('image/jpeg', 0.7);

            // Update UI
            document.getElementById('encoded-image').value = dataUrl;
            document.getElementById('image-preview').src = dataUrl;
            document.getElementById('image-preview-container').classList.remove('hidden');
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
};

function saveItem(event) {
    event.preventDefault();
    const menuItems = DataStore.getMenu();
    const formData = new FormData(event.target);
    const newItem = {
        name: formData.get('name'),
        price: parseInt(formData.get('price')),
        category: formData.get('category'),
        subCategory: formData.get('subCategory'),
        // image: formData.get('finalImage'), // OLD logic
        description: formData.get('description'),
        isAvailable: true // Default to true for new items
    };

    // FIX PREVENT DISAPPEARING IMAGES
    // If no new image was uploaded/pasted (hidden input empty), keep the existing one
    let newImage = formData.get('finalImage');
    if (!newImage && adminState.modalMode === 'edit' && adminState.editingItem) {
        newImage = adminState.editingItem.image;
    }
    newItem.image = newImage;

    if (!newItem.image) {
        newItem.image = 'https://placehold.co/400x300?text=No+Image'; // Fallback
    }

    if (adminState.modalMode === 'add') {
        // Generate new ID
        const newId = menuItems.length > 0 ? Math.max(...menuItems.map(i => i.id)) + 1 : 101;
        newItem.id = newId;
    } else if (adminState.modalMode === 'edit') {
        newItem.id = adminState.editingItem.id;
        newItem.isAvailable = adminState.editingItem.isAvailable; // Preserve availability
    }

    DataStore.saveMenuItem(newItem); // Persist single item
    closeModal();
}

async function deleteMenuItem(id) {
    const confirmed = await showConfirm({
        title: 'Delete Item',
        message: 'Are you sure you want to delete this menu item?',
        confirmText: 'Yes, Delete',
        isDanger: true
    });
    if (confirmed) {
        DataStore.deleteMenuItem(id);
        // renderAdmin(); // Listener will trigger render
    }
}


// HELPERS FOR ORDERS VIEW
function getFilteredOrders() {
    const allOrders = DataStore.getOrders();
    const query = (adminState.orderSearch || '').toLowerCase();
    const filter = adminState.orderFilter || 'active';

    // If searching, we skip date filtering initially to find matches across all time
    if (query) {
        return allOrders.filter(o =>
            (o.id && o.id.toString().toLowerCase().includes(query)) ||
            (o.user && o.user.name && o.user.name.toLowerCase().includes(query)) ||
            (o.user && o.user.id && o.user.id.toLowerCase().includes(query)) ||
            (o.items && o.items.some(i => i.name.toLowerCase().includes(query)))
        );
    }

    // Normal Filtered View
    return allOrders.filter(o => {
        if (!o.date) return false;

        // Active orders always bypass date filters so they are never lost
        const isActive = o.status === 'preparing' || o.status === 'ready';

        // Robust Date Parsing
        const d = (o.date && typeof o.date.toDate === 'function') ? o.date.toDate() : new Date(o.date);
        if (isNaN(d.getTime())) return false;

        const orderDate = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        const withinDate = orderDate >= adminState.startDate && orderDate <= adminState.endDate;

        // Apply Segmented Filter Logic
        if (filter === 'active') {
            return isActive;
        } else if (filter === 'completed') {
            return o.status === 'completed' && withinDate;
        } else { // 'total'
            return withinDate || isActive;
        }
    });
}

function renderOrdersListHTML(orders) {
    return `
        <div class="flex justify-between items-center mb-6">
             <h3 class="text-lg font-bold dark:text-gray-100">Orders History</h3>
             <span class="text-xs font-bold text-gray-500 bg-gray-100 dark:bg-dark-bg dark:text-gray-300 px-3 py-1.5 rounded-full border border-gray-200 dark:border-dark-border">${orders.length} orders found</span>
        </div>
       
        ${orders.length === 0 ? `<div class="text-center py-10 text-gray-400 dark:text-gray-500 font-bold">No orders found matching your criteria.</div>` : `
        <div class="overflow-x-auto">
            <table class="w-full text-sm text-left">
                <thead class="text-gray-400 dark:text-gray-500 font-bold border-b border-gray-100 dark:border-gray-800 uppercase tracking-wider text-[10px]">
                    <tr>
                        <th class="pb-3 pl-0 sm:pl-2">Order</th>
                        <th class="pb-3 hidden sm:table-cell">Date</th>
                        <th class="pb-3 hidden sm:table-cell">Customer</th>
                        <th class="pb-3 hidden sm:table-cell">Items</th>
                        <th class="pb-3 hidden sm:table-cell">Amount</th>
                        <th class="pb-3 text-right sm:text-left">Status</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
                    ${orders.sort((a, b) => new Date(b.date) - new Date(a.date)).map(order => {
        const firstItem = order.items[0];
        const moreCount = order.items.length - 1;
        const userId = (order.user && order.user.id) ? order.user.id : 'Guest';
        return `
                        <tr class="group hover:bg-gray-50 dark:hover:bg-[#111827] transition-colors">
                            <!-- Mobile: Combined Info | Desktop: ID -->
                            <td class="py-4 pl-0 sm:pl-2 align-top w-auto">
                                <div class="hidden sm:block">
                                    <div class="font-[900] text-gray-500 dark:text-gray-400">#${order.id}</div>
                                </div>
                                
                                <div class="sm:hidden flex gap-3">
                                     <img src="${firstItem.image}" class="w-12 h-12 rounded-lg object-cover bg-gray-100 dark:bg-dark-bg border border-gray-200 dark:border-gray-800 flex-shrink-0">
                                     <div class="flex flex-col gap-0.5">
                                        <div class="flex items-center gap-2">
                                            <span class="font-[900] text-secondary dark:text-gray-100 text-sm">#${order.id}</span>
                                            <span class="text-[10px] font-bold text-gray-400 dark:text-gray-500">${new Date(order.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                        <div class="text-xs font-bold text-gray-600 dark:text-gray-400 line-clamp-1">${firstItem.name} ${moreCount > 0 ? `+${moreCount}` : ''}</div>
                                        <div class="text-xs font-[800] text-primary">${formatPrice(order.total)} • <span class="text-gray-500 dark:text-gray-400">${userId}</span></div>
                                     </div>
                                </div>
                            </td>

                            <td class="py-4 text-xs font-bold text-gray-600 dark:text-gray-400 hidden sm:table-cell align-top whitespace-nowrap pr-8">${new Date(order.date).toLocaleString()}</td>
                            <td class="py-4 font-medium text-gray-500 dark:text-gray-400 hidden sm:table-cell align-top">${userId}</td>
                            
                            <td class="hidden sm:table-cell py-4 text-secondary dark:text-gray-300 font-bold w-64 align-top">
                                <div class="flex items-center gap-3">
                                    <div class="w-10 h-10 rounded-xl bg-gray-100 dark:bg-dark-bg border border-gray-200 dark:border-gray-800 flex-shrink-0 overflow-hidden shadow-sm">
                                         <img src="${firstItem.image}" class="w-full h-full object-cover mix-blend-multiply dark:mix-blend-normal">
                                    </div>
                                    <div class="line-clamp-1 text-sm font-bold text-secondary dark:text-gray-200">
                                        ${firstItem.name} ${moreCount > 0 ? `<span class="text-gray-400 dark:text-gray-500 font-black">+${moreCount}</span>` : ''}
                                    </div>
                                </div>
                            </td>

                            <td class="py-4 font-[900] text-secondary dark:text-gray-100 hidden sm:table-cell align-top text-lg tracking-tight">${formatPrice(order.total)}</td>
                            <td class="py-4 align-top text-right sm:text-left">
                                <span class="bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-500 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest whitespace-nowrap inline-block border border-orange-200 dark:border-orange-500/20 shadow-sm">${order.status}</span>
                            </td>
                        </tr>
                    `}).join('')}
                </tbody>
            </table>
        </div>
        `}
    `;
}

function updateOrdersList(query) {
    adminState.orderSearch = query;
    const orders = getFilteredOrders();
    const container = document.getElementById('orders-list-container');
    if (container) {
        container.innerHTML = renderOrdersListHTML(orders);
    }
}

// ===================== COMMUNICATIONS =====================

function renderCommsView() {
    if (adminState.commsTab === 'inbox' && !adminState.inboxListener) {
        initInboxListener();
    }
    if (adminState.commsTab === 'broadcast') {
        setTimeout(loadBroadcastHistory, 50);
    }
    return `
        <div class="mb-6 flex justify-center">
            <div class="bg-gray-100 dark:bg-dark-surface p-1.5 rounded-2xl flex gap-1 border border-gray-200 dark:border-dark-border w-full max-w-md shadow-inner">
                <button onclick="adminState.commsTab = 'broadcast'; renderAdmin()" 
                    class="flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${adminState.commsTab === 'broadcast' ? 'bg-white dark:bg-dark-bg text-primary shadow-md shadow-gray-200/50 dark:shadow-none' : 'text-gray-500 dark:text-dark-muted hover:text-gray-700 dark:hover:text-gray-300'}">
                    Broadcast
                </button>
                <button onclick="adminState.commsTab = 'inbox'; renderAdmin()" 
                    class="flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${adminState.commsTab === 'inbox' ? 'bg-white dark:bg-dark-bg text-primary shadow-md shadow-gray-200/50 dark:shadow-none' : 'text-gray-500 dark:text-dark-muted hover:text-gray-700 dark:hover:text-gray-300'}">
                    Inbox
                </button>
            </div>
        </div>

        ${adminState.commsTab === 'broadcast' ? `
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
            ${adminState.selectedChat ? renderChatInterface() : renderInboxList()}
        `}
    `;
}

function initInboxListener() {
    console.log('Starting Inbox Listener...');
    adminState.inboxListener = db.collection('chats').orderBy('timestamp', 'desc').onSnapshot(snap => {
        adminState.chats = [];
        snap.forEach(doc => {
            adminState.chats.push({ id: doc.id, ...doc.data() });
        });
        if (adminState.currentView === 'comms' && adminState.commsTab === 'inbox') {
            renderAdmin();
        }
    });
}

function renderInboxList() {
    if (adminState.chats.length === 0) {
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
             ${adminState.chats.map(chat => `
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
    const chat = adminState.chats.find(c => c.customerId === customerId);
    adminState.selectedChat = chat;

    // Reset messages and listener
    adminState.chatMessages = [];
    if (adminState.activeChatListener) {
        adminState.activeChatListener(); // Unsubscribe
    }

    // Subscribe to messages
    adminState.activeChatListener = db.collection('messages')
        .where('customerId', '==', customerId)
        .onSnapshot(snap => {
            adminState.chatMessages = [];
            snap.forEach(doc => adminState.chatMessages.push({ id: doc.id, ...doc.data() }));

            // Sort by timestamp (ascending)
            adminState.chatMessages.sort((a, b) => {
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
                ` + adminState.chatMessages.map(msg => {
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
                renderAdmin();
                scrollToBottom();
            }
        });

    renderAdmin();
}

function closeChat() {
    adminState.selectedChat = null;
    if (adminState.activeChatListener) {
        adminState.activeChatListener();
        adminState.activeChatListener = null;
    }
    renderAdmin();
}

function renderChatInterface() {
    const chat = adminState.selectedChat;
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
                
                ${adminState.chatMessages.map(msg => {
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
    if (!form || !form.message) return;

    const text = form.message.value.trim();
    if (!text) return;

    form.reset();
    const input = form.querySelector('input[name="message"]');
    if (input) input.focus();

    // OPTIMISTIC UI UPDATE
    const tempMsg = {
        id: 'temp-' + Date.now(),
        text: text,
        customerId: customerId,
        senderId: 'staff',
        direction: 'staff_to_customer',
        timestamp: { toDate: () => new Date() }, // Mock Firestore timestamp
        read: false
    };

    adminState.chatMessages.push(tempMsg);
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
    const msgRef = db.collection('messages').doc();
    batch.set(msgRef, {
        text: text,
        customerId: customerId,
        senderId: 'staff',
        direction: 'staff_to_customer',
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        read: false
    });

    const chatRef = db.collection('chats').doc(customerId);
    batch.set(chatRef, {
        lastMessage: text,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        unreadCount: 0
    }, { merge: true });

    try {
        await batch.commit();
    } catch (err) {
        console.error(err);
        showToast("Message Error", "Failed to send your reply. Please try again.", "error");
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
        showToast("Broadcast Sent", "Notification sent successfully to all users.", "success");
        form.reset();
        loadBroadcastHistory();
    } catch (err) {
        console.error(err);
        showToast("Broadcast Error", "Failed to send the notification. Check your network.", "error");
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

// ===================== STATISTICS =====================
let revenueChartInstance = null;
let categoryChartInstance = null;
let itemChartInstance = null;

function renderStatsView() {
    const orders = DataStore.getOrders();

    // Date range text for the header
    const dFilter = adminState.dateFilter;
    const filterText = dFilter === 'today' ? "Today" :
        dFilter === 'yesterday' ? "Yesterday" :
            dFilter === 'last7' ? "Last 7 Days" :
                dFilter === 'last30' ? "Last 30 Days" :
                    dFilter === 'thisMonth' ? "This Month" : "Custom Range";

    // Filter strictly by date
    const inDateOrders = orders.filter(o => {
        if (!o.date) return false;
        const d = (o.date && typeof o.date.toDate === 'function') ? o.date.toDate() : new Date(o.date);
        const str = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        return str >= adminState.startDate && str <= adminState.endDate;
    });

    // KPI Calculations
    let totalRevenue = 0;
    let totalOrders = inDateOrders.length;

    inDateOrders.forEach(o => {
        totalRevenue += o.total || 0;
    });

    const aov = totalOrders > 0 ? (totalRevenue / totalOrders) : 0;

    return `
        <!-- Date Filter Control -->
        <div class="bg-white dark:bg-dark-surface p-4 rounded-3xl border border-gray-100 dark:border-dark-border shadow-sm mb-6 flex flex-col md:flex-row justify-between items-center gap-4">
            <div class="flex items-center gap-2">
                <i data-lucide="calendar-days" class="w-5 h-5 text-primary"></i>
                <h3 class="font-bold text-secondary dark:text-gray-100 text-sm">Analyze:</h3>
                <select onchange="updateDateFilter(this.value)" class="bg-gray-50 dark:bg-dark-bg border border-gray-200 dark:border-dark-border text-gray-700 dark:text-gray-200 text-sm font-bold rounded-lg focus:ring-primary focus:border-primary block p-2 outline-none">
                    <option value="today" ${adminState.dateFilter === 'today' ? 'selected' : ''}>Today</option>
                    <option value="yesterday" ${adminState.dateFilter === 'yesterday' ? 'selected' : ''}>Yesterday</option>
                    <option value="last7" ${adminState.dateFilter === 'last7' ? 'selected' : ''}>Last 7 Days</option>
                    <option value="last30" ${adminState.dateFilter === 'last30' ? 'selected' : ''}>Last 30 Days</option>
                    <option value="thisMonth" ${adminState.dateFilter === 'thisMonth' ? 'selected' : ''}>This Month</option>
                    <option value="custom" ${adminState.dateFilter === 'custom' ? 'selected' : ''}>Custom Range</option>
                </select>
            </div>
            
            <div class="flex items-center gap-2">
                <input type="date" value="${adminState.startDate}" onchange="handleDateChange('startDate', this.value)" class="bg-gray-50 dark:bg-dark-bg border border-gray-200 dark:border-dark-border text-gray-700 dark:text-gray-200 text-sm font-bold rounded-lg p-2 outline-none focus:border-primary">
                <span class="text-gray-400 font-bold">-</span>
                <input type="date" value="${adminState.endDate}" onchange="handleDateChange('endDate', this.value)" class="bg-gray-50 dark:bg-dark-bg border border-gray-200 dark:border-dark-border text-gray-700 dark:text-gray-200 text-sm font-bold rounded-lg p-2 outline-none focus:border-primary">
            </div>
        </div>

        <!-- KPI Cards -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div class="bg-white dark:bg-dark-surface p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-dark-border relative overflow-hidden group">
                <div class="absolute -right-6 -top-6 w-24 h-24 bg-primary/10 dark:bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/20 transition-colors"></div>
                <div class="flex items-center gap-4 mb-2">
                    <div class="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
                        <i data-lucide="banknote" class="w-5 h-5"></i>
                    </div>
                    <h3 class="text-gray-500 dark:text-dark-muted font-bold text-sm">Total Revenue</h3>
                </div>
                <h2 class="text-3xl font-[900] text-secondary dark:text-gray-100 mb-1">${formatPrice(totalRevenue)}</h2>
                <p class="text-[10px] text-gray-400 dark:text-dark-muted font-bold uppercase tracking-wider">${filterText}</p>
            </div>
            
            <div class="bg-white dark:bg-dark-surface p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-dark-border relative overflow-hidden group">
                <div class="absolute -right-6 -top-6 w-24 h-24 bg-blue-500/10 dark:bg-blue-500/5 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-colors"></div>
                <div class="flex items-center gap-4 mb-2">
                    <div class="w-10 h-10 bg-blue-500/10 text-blue-500 rounded-xl flex items-center justify-center">
                        <i data-lucide="shopping-bag" class="w-5 h-5"></i>
                    </div>
                    <h3 class="text-gray-500 dark:text-dark-muted font-bold text-sm">Total Orders</h3>
                </div>
                <h2 class="text-3xl font-[900] text-secondary dark:text-gray-100 mb-1">${totalOrders}</h2>
                <p class="text-[10px] text-gray-400 dark:text-dark-muted font-bold uppercase tracking-wider">${filterText}</p>
            </div>

            <div class="bg-white dark:bg-dark-surface p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-dark-border relative overflow-hidden group">
                <div class="absolute -right-6 -top-6 w-24 h-24 bg-green-500/10 dark:bg-green-500/5 rounded-full blur-2xl group-hover:bg-green-500/20 transition-colors"></div>
                <div class="flex items-center gap-4 mb-2">
                    <div class="w-10 h-10 bg-green-500/10 text-green-500 rounded-xl flex items-center justify-center">
                        <i data-lucide="calculator" class="w-5 h-5"></i>
                    </div>
                    <h3 class="text-gray-500 dark:text-dark-muted font-bold text-sm">Avg. Order Value</h3>
                </div>
                <h2 class="text-3xl font-[900] text-secondary dark:text-gray-100 mb-1">${formatPrice(aov)}</h2>
                <p class="text-[10px] text-gray-400 dark:text-dark-muted font-bold uppercase tracking-wider">${filterText}</p>
            </div>
        </div>

        <!-- Main Revenue Chart -->
        <div class="bg-white dark:bg-dark-surface p-6 rounded-3xl border border-gray-100 dark:border-dark-border shadow-sm mb-6">
            <div class="flex justify-between items-center mb-6">
                <h3 class="font-[800] text-secondary dark:text-gray-100">Revenue Trend</h3>
            </div>
            <div class="h-64 sm:h-80 w-full relative">
                <canvas id="revenueChart"></canvas>
            </div>
        </div>

        <!-- Split Bottom Charts -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div class="bg-white dark:bg-dark-surface p-6 rounded-3xl border border-gray-100 dark:border-dark-border shadow-sm">
                <h3 class="font-[800] text-secondary dark:text-gray-100 mb-6">Top Selling Items</h3>
                <div class="h-60 w-full relative">
                    <canvas id="itemChart"></canvas>
                </div>
            </div>
            <div class="bg-white dark:bg-dark-surface p-6 rounded-3xl border border-gray-100 dark:border-dark-border shadow-sm">
                <h3 class="font-[800] text-secondary dark:text-gray-100 mb-6">Sales by Category</h3>
                <div class="h-60 w-full relative flex justify-center">
                    <canvas id="categoryChart"></canvas>
                </div>
            </div>
        </div>
    `;
}

function initCharts() {
    if (!document.getElementById('revenueChart')) return; // Safety check

    const isDark = adminState.isDarkMode;
    const textColor = isDark ? '#94A3B8' : '#6B7280';
    const gridColor = isDark ? '#1E293B' : '#F3F4F6';

    const orders = DataStore.getOrders();

    // Aggregation maps
    let dailyRev = {};
    let itemMap = {};
    let catMap = {};

    // Determine the array of dates we are charting over
    const start = new Date(adminState.startDate);
    const end = new Date(adminState.endDate);

    // Fill every day in range with 0 to ensure continuous line
    for (let dt = new Date(start); dt <= end; dt.setDate(dt.getDate() + 1)) {
        const str = dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
        dailyRev[str] = 0;
    }

    orders.forEach(o => {
        let shouldInclude = false;

        if (o.date) {
            const d = (o.date && typeof o.date.toDate === 'function') ? o.date.toDate() : new Date(o.date);
            const str = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

            if (str >= adminState.startDate && str <= adminState.endDate) {
                if (dailyRev[str] !== undefined) {
                    dailyRev[str] += o.total || 0;
                }
                shouldInclude = true;
            }
        }

        // Items and Cats
        if (shouldInclude && o.items) {
            o.items.forEach(item => {
                const qty = item.quantity || 1;
                itemMap[item.name] = (itemMap[item.name] || 0) + qty;
                const cat = item.category || 'Other';
                catMap[cat] = (catMap[cat] || 0) + qty;
            });
        }
    });

    // 1. REVENUE CHART
    const revLabels = Object.keys(dailyRev).sort();
    const revData = revLabels.map(l => dailyRev[l]);

    // Format labels as MM/DD
    const displayLabels = revLabels.map(l => {
        const parts = l.split('-');
        return parts[1] + '/' + parts[2];
    });

    const ctxRev = document.getElementById('revenueChart').getContext('2d');

    // Create Gradient
    let gradient = ctxRev.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, 'rgba(255, 107, 0, 0.5)'); // Primary orange transparent
    gradient.addColorStop(1, 'rgba(255, 107, 0, 0.0)');

    if (revenueChartInstance) revenueChartInstance.destroy();
    revenueChartInstance = new Chart(ctxRev, {
        type: 'line',
        data: {
            labels: displayLabels,
            datasets: [{
                label: 'Revenue (LKR)',
                data: revData,
                borderColor: '#FF6B00',
                backgroundColor: gradient,
                borderWidth: 3,
                pointBackgroundColor: '#ffffff',
                pointBorderColor: '#FF6B00',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6,
                fill: true,
                tension: 0.4 // Smooth curves
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: isDark ? '#1E293B' : '#ffffff',
                    titleColor: isDark ? '#ffffff' : '#000000',
                    bodyColor: isDark ? '#94A3B8' : '#6B7280',
                    borderColor: gridColor,
                    borderWidth: 1,
                    padding: 12,
                    displayColors: false,
                    callbacks: {
                        label: function (context) {
                            return 'LKR ' + context.parsed.y.toLocaleString();
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: textColor, font: { family: 'Inter', weight: 'bold' } }
                },
                y: {
                    grid: { color: gridColor, drawBorder: false },
                    ticks: {
                        color: textColor,
                        font: { family: 'Inter', weight: 'bold' },
                        callback: function (value) {
                            return value >= 1000 ? (value / 1000) + 'k' : value;
                        }
                    },
                    beginAtZero: true
                }
            }
        }
    });

    // 2. TOP ITEMS CHART
    // Sort items by qty desc, take top 5
    const topItemsArray = Object.keys(itemMap).map(k => ({ name: k, qty: itemMap[k] }))
        .sort((a, b) => b.qty - a.qty).slice(0, 5);

    const itemLabels = topItemsArray.map(i => i.name.length > 15 ? i.name.substring(0, 15) + '...' : i.name);
    const itemData = topItemsArray.map(i => i.qty);

    const ctxItem = document.getElementById('itemChart').getContext('2d');
    if (itemChartInstance) itemChartInstance.destroy();
    itemChartInstance = new Chart(ctxItem, {
        type: 'bar',
        data: {
            labels: itemLabels,
            datasets: [{
                data: itemData,
                backgroundColor: '#3B82F6', // Blue
                borderRadius: 6,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: isDark ? '#1E293B' : '#ffffff',
                    titleColor: isDark ? '#ffffff' : '#000000',
                    bodyColor: isDark ? '#94A3B8' : '#6B7280',
                    borderColor: gridColor,
                    borderWidth: 1
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: textColor, font: { family: 'Inter', weight: 'bold', size: 10 } }
                },
                y: {
                    grid: { color: gridColor, drawBorder: false },
                    ticks: { color: textColor, font: { family: 'Inter' }, stepSize: 1 },
                    beginAtZero: true
                }
            }
        }
    });

    // 3. CATEGORY CHART
    const catLabels = Object.keys(catMap);
    const catData = Object.values(catMap);

    // Premium color palette for doughnut
    const colors = ['#FF6B00', '#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EC4899'];

    const ctxCat = document.getElementById('categoryChart').getContext('2d');
    if (categoryChartInstance) categoryChartInstance.destroy();
    categoryChartInstance = new Chart(ctxCat, {
        type: 'doughnut',
        data: {
            labels: catLabels,
            datasets: [{
                data: catData,
                backgroundColor: colors.slice(0, catLabels.length),
                borderWidth: isDark ? 2 : 2,
                borderColor: isDark ? '#161E2E' : '#ffffff',
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        color: textColor,
                        font: { family: 'Inter', weight: 'bold' },
                        padding: 15,
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                },
                tooltip: {
                    backgroundColor: isDark ? '#1E293B' : '#ffffff',
                    titleColor: isDark ? '#ffffff' : '#000000',
                    bodyColor: isDark ? '#94A3B8' : '#6B7280',
                    borderColor: gridColor,
                    borderWidth: 1
                }
            }
        }
    });
}

// ===================== SETTINGS =====================
function renderSettingsView() {
    const settings = window.systemSettings;
    const isStoreOpen = settings.isStoreOpen;

    return `
        <div class="space-y-8 max-w-4xl animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
            <!-- Header Section -->
            <div class="flex flex-col gap-2">
                <h2 class="text-3xl font-[900] text-secondary dark:text-gray-100 italic transition-colors">Admin Settings</h2>
                <p class="text-sm font-bold text-gray-400 dark:text-dark-muted tracking-wide uppercase">Configure global system behavior and security</p>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <!-- Store Management Card -->
                <div class="bg-white dark:bg-dark-surface p-8 rounded-3xl border border-gray-100 dark:border-dark-border shadow-sm hover:shadow-xl transition-all duration-300">
                    <div class="flex items-center gap-4 mb-8">
                        <div class="w-14 h-14 bg-orange-100 dark:bg-orange-500/10 rounded-2xl flex items-center justify-center text-orange-600 dark:text-primary shadow-inner">
                            <i data-lucide="store" class="w-8 h-8"></i>
                        </div>
                        <div>
                            <h3 class="text-xl font-black text-secondary dark:text-gray-100">Store Status</h3>
                            <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-0.5">Control customer ordering</p>
                        </div>
                    </div>
                    
                    <div class="flex items-center justify-between p-4 bg-gray-50/50 dark:bg-dark-bg/50 rounded-2xl border border-gray-100 dark:border-dark-border">
                        <div>
                            <span class="text-sm font-bold text-secondary dark:text-gray-200">Current Status</span>
                            <p class="text-[11px] font-bold ${isStoreOpen ? 'text-green-500' : 'text-red-500'} uppercase mt-1">
                                ${isStoreOpen ? 'Accepting Orders' : 'Store Closed'}
                            </p>
                        </div>
                        <button onclick="saveSystemSettings('status', ${!isStoreOpen})" 
                                class="px-6 py-3 rounded-xl text-xs font-black transition-all active:scale-95 shadow-lg ${isStoreOpen ? 'bg-red-500 text-white shadow-red-500/20' : 'bg-green-500 text-white shadow-green-500/20'}">
                            ${isStoreOpen ? (adminState.isSettingsSaving ? 'Closing...' : 'Close Store') : (adminState.isSettingsSaving ? 'Opening...' : 'Open Store')}
                        </button>
                    </div>
                    <p class="text-[10px] italic text-gray-400 mt-4 leading-relaxed font-medium transition-colors">When closed, customers will see a notification and won't be able to place new orders. Existing orders can still be managed by staff.</p>
                </div>

                <!-- Tax Configuration Card -->
                <div class="bg-white dark:bg-dark-surface p-8 rounded-3xl border border-gray-100 dark:border-dark-border shadow-sm hover:shadow-xl transition-all duration-300">
                    <div class="flex items-center gap-4 mb-8">
                        <div class="w-14 h-14 bg-blue-100 dark:bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-600 dark:text-blue-500 shadow-inner">
                            <i data-lucide="percent" class="w-8 h-8"></i>
                        </div>
                        <div>
                            <h3 class="text-xl font-black text-secondary dark:text-gray-100">Tax Rates</h3>
                            <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-0.5">Applied to all orders</p>
                        </div>
                    </div>
                    
                    <div class="space-y-4">
                        <div class="flex items-center gap-3">
                            <div class="flex-1 relative">
                                <input type="number" id="setting-tax-rate" value="${settings.taxRate}" step="0.1" min="0" 
                                       class="w-full bg-gray-50 dark:bg-dark-bg rounded-xl px-5 py-4 border-none text-sm font-bold text-secondary dark:text-gray-100 focus:ring-2 focus:ring-primary/20 transition-all outline-none pl-12" />
                                <div class="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">%</div>
                            </div>
                            <button onclick="saveSystemSettings('tax', document.getElementById('setting-tax-rate').value)" 
                                    class="p-4 bg-secondary dark:bg-white text-white dark:text-secondary rounded-xl hover:opacity-90 transition-all active:scale-95 shadow-xl flex items-center justify-center">
                                <i data-lucide="${adminState.isSettingsSaving ? 'loader-2' : 'save'}" class="w-5 h-5 ${adminState.isSettingsSaving ? 'animate-spin' : ''}"></i>
                            </button>
                        </div>
                        <p class="text-[10px] italic text-gray-400 leading-relaxed font-medium transition-colors">This rate is used to calculate the final amount at checkout. Changes reflect immediately for all customers.</p>
                    </div>
                </div>

                <!-- Security Management Card -->
                <div class="bg-white dark:bg-dark-surface p-8 rounded-3xl border border-gray-100 dark:border-dark-border shadow-sm hover:shadow-xl transition-all duration-300 md:col-span-2">
                    <div class="flex items-center gap-4 mb-8">
                        <div class="w-14 h-14 bg-purple-100 dark:bg-purple-500/10 rounded-2xl flex items-center justify-center text-purple-600 dark:text-purple-400 shadow-inner">
                            <i data-lucide="shield-check" class="w-8 h-8"></i>
                        </div>
                        <div>
                            <h3 class="text-xl font-black text-secondary dark:text-gray-100">Master PIN Configuration</h3>
                            <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-0.5">System-wide administrative security</p>
                        </div>
                    </div>
                    
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                        <div class="space-y-4">
                             <div class="flex items-center gap-3">
                                <div class="flex-1 relative">
                                    <input type="password" id="setting-master-pin" maxlength="4" placeholder="••••"
                                           class="w-full bg-gray-50 dark:bg-dark-bg rounded-2xl px-5 py-5 border-none text-2xl font-black tracking-[0.5em] text-center text-secondary dark:text-gray-100 focus:ring-2 focus:ring-primary/20 transition-all outline-none" />
                                </div>
                                <button onclick="saveSystemSettings('pin', document.getElementById('setting-master-pin').value)" 
                                        class="px-8 py-5 bg-primary text-white rounded-2xl font-black text-sm hover:opacity-90 transition-all active:scale-95 shadow-xl shadow-orange-500/20 flex items-center gap-2 whitespace-nowrap">
                                    <i data-lucide="${adminState.isSettingsSaving ? 'loader-2' : 'key'}" class="w-5 h-5 ${adminState.isSettingsSaving ? 'animate-spin' : ''}"></i> 
                                    ${adminState.isSettingsSaving ? 'Saving PIN...' : 'Update Master PIN'}
                                </button>
                            </div>
                            <p class="text-[10px] italic text-gray-400 leading-relaxed font-medium px-2 transition-colors">The Master PIN is required for adding/editing staff accounts and other sensitive operations. <strong>Never share this PIN with non-administrative staff.</strong></p>
                        </div>

                        <div class="bg-gray-50 dark:bg-dark-bg/50 p-6 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
                            <h4 class="text-xs font-black text-secondary dark:text-gray-200 uppercase tracking-widest mb-3 flex items-center gap-2">
                                <i data-lucide="info" class="w-4 h-4 text-primary"></i> Security Tips
                            </h4>
                            <ul class="space-y-2 text-[11px] font-bold text-gray-500 dark:text-dark-muted">
                                <li class="flex items-start gap-2">• Use a non-obvious 4-digit combination</li>
                                <li class="flex items-start gap-2">• Rotate the PIN every 30 days for better security</li>
                                <li class="flex items-start gap-2">• Changes take effect globally for all admins</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderCardsView() {
    // Trigger card list load after render
    setTimeout(() => loadPrepaidCards(), 100);
    return `
        <div class="space-y-8 max-w-4xl animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
            <!-- Header -->
            <div class="flex flex-col gap-2">
                <h2 class="text-3xl font-[900] text-secondary dark:text-gray-100 italic">Prepaid Cards</h2>
                <p class="text-sm font-bold text-gray-400 uppercase tracking-wide">Generate & track N-Cafe Wallet reload codes</p>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                <!-- Generator Card -->
                <div class="bg-white dark:bg-dark-surface p-8 rounded-3xl border border-gray-100 dark:border-dark-border shadow-sm hover:shadow-xl transition-all duration-300">
                    <div class="flex items-center gap-4 mb-8">
                        <div class="w-14 h-14 bg-green-100 dark:bg-green-500/10 rounded-2xl flex items-center justify-center text-green-600 dark:text-green-400 shadow-inner">
                            <i data-lucide="plus-circle" class="w-8 h-8"></i>
                        </div>
                        <div>
                            <h3 class="text-xl font-black text-secondary dark:text-gray-100">Generate Cards</h3>
                            <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-0.5">Create reload codes for the counter</p>
                        </div>
                    </div>
                    <div class="space-y-3">
                        <div>
                            <label class="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1.5">Card Value (LKR)</label>
                            <input type="number" id="card-value" placeholder="e.g. 500" min="50" step="50"
                                   class="w-full bg-gray-50 dark:bg-dark-bg rounded-xl px-4 py-3 border-none text-sm font-bold text-secondary dark:text-gray-100 focus:ring-2 focus:ring-primary/20 outline-none transition-all" />
                        </div>
                        <div>
                            <label class="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1.5">Quantity</label>
                            <input type="number" id="card-qty" placeholder="e.g. 10" min="1" max="100" value="5"
                                   class="w-full bg-gray-50 dark:bg-dark-bg rounded-xl px-4 py-3 border-none text-sm font-bold text-secondary dark:text-gray-100 focus:ring-2 focus:ring-primary/20 outline-none transition-all" />
                        </div>
                        <button onclick="generatePrepaidCards()" class="w-full py-3.5 bg-green-500 text-white rounded-xl font-black text-sm hover:bg-green-600 transition-all active:scale-95 shadow-lg shadow-green-500/20 flex items-center justify-center gap-2 mt-2">
                            <i data-lucide="plus-circle" class="w-5 h-5"></i> Generate Cards
                        </button>
                    </div>
                    <div class="mt-6 p-4 bg-green-50 dark:bg-green-500/5 rounded-2xl border border-dashed border-green-200 dark:border-green-500/20">
                        <p class="text-[10px] font-black text-green-700 dark:text-green-400 uppercase tracking-widest mb-2">How it works</p>
                        <ul class="space-y-1 text-[11px] font-bold text-green-600 dark:text-green-500/80">
                            <li>• Generate codes in bulk</li>
                            <li>• Print & sell at the counter</li>
                            <li>• Customers redeem via their profile</li>
                        </ul>
                    </div>
                </div>

                <!-- Card List -->
                <div class="bg-white dark:bg-dark-surface p-8 rounded-3xl border border-gray-100 dark:border-dark-border shadow-sm hover:shadow-xl transition-all duration-300 md:col-span-2">
                    <div class="flex items-center gap-4 mb-6">
                        <div class="w-14 h-14 bg-blue-100 dark:bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-600 dark:text-blue-500 shadow-inner">
                            <i data-lucide="list" class="w-8 h-8"></i>
                        </div>
                        <div>
                            <h3 class="text-xl font-black text-secondary dark:text-gray-100">All Cards</h3>
                            <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-0.5">Last 50 generated codes</p>
                        </div>
                        <button onclick="loadPrepaidCards()" class="ml-auto p-3 rounded-xl bg-gray-100 dark:bg-dark-bg hover:bg-gray-200 dark:hover:bg-dark-border transition-all active:scale-95">
                            <i data-lucide="refresh-cw" class="w-4 h-4 text-gray-500"></i>
                        </button>
                    </div>
                    <div id="prepaid-card-list">
                        <div class="flex items-center justify-center py-12 text-gray-400">
                            <div class="text-center">
                                <i data-lucide="loader-2" class="w-6 h-6 animate-spin mx-auto mb-2"></i>
                                <p class="text-xs font-bold">Loading cards...</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

async function saveSystemSettings(type, value) {
    if (adminState.isSettingsSaving) return;

    adminState.isSettingsSaving = true;
    renderAdmin();

    try {
        if (type === 'pin') {
            if (!value || value.length !== 4 || isNaN(value)) {
                showToast("Invalid PIN", "New PIN must be a 4-digit number.", "error");
                adminState.isSettingsSaving = false;
                renderAdmin();
                return;
            }
            // Verify the current PIN via keypad before allowing change
            adminState.isSettingsSaving = false;
            renderAdmin();
            const verified = await showPinPrompt();
            if (!verified) {
                showToast("Verification Failed", "Current PIN was incorrect. PIN not changed.", "error");
                return;
            }
            adminState.isSettingsSaving = true;
            renderAdmin();
            await db.collection('settings').doc('security').set({ systemPin: value }, { merge: true });
        } else if (type === 'tax') {
            const tax = parseFloat(value);
            if (isNaN(tax) || tax < 0) {
                showToast("Invalid Tax", "Please enter a valid tax percentage.", "error");
                adminState.isSettingsSaving = false;
                renderAdmin();
                return;
            }
            await db.collection('settings').doc('general').set({
                taxRate: tax,
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        } else if (type === 'status') {
            await db.collection('settings').doc('general').set({
                isStoreOpen: value,
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        }
        showToast("Settings Updated", "System configurations have been saved successfully.", "success");
    } catch (e) {
        console.error("Save failed:", e);
        showToast("Error", "Failed to update settings. Please try again.", "error");
    } finally {
        adminState.isSettingsSaving = false;
        renderAdmin();
    }
}

// ===================== PREPAID CARDS =====================

function _genCardCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const seg = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    return `NCAFE-${seg()}-${seg()}`;
}

async function generatePrepaidCards() {
    const valueInput = document.getElementById('card-value');
    const qtyInput = document.getElementById('card-qty');
    const value = parseFloat(valueInput?.value);
    const qty = parseInt(qtyInput?.value);

    if (!value || value < 50) {
        showToast("Invalid Value", "Card value must be at least LKR 50.", "error");
        return;
    }
    if (!qty || qty < 1 || qty > 100) {
        showToast("Invalid Quantity", "Quantity must be between 1 and 100.", "error");
        return;
    }

    const confirmed = await showConfirm({
        title: 'Generate Prepaid Cards',
        message: `Create ${qty} prepaid card(s) worth LKR ${value.toLocaleString()} each?`,
        confirmText: `Generate ${qty} Cards`
    });
    if (!confirmed) return;

    const btn = document.querySelector('[onclick="generatePrepaidCards()"]');
    if (btn) { btn.disabled = true; btn.textContent = 'Generating...'; }

    try {
        const batch = db.batch();
        const batchId = `BATCH-${Date.now()}`;
        for (let i = 0; i < qty; i++) {
            const code = _genCardCode();
            const ref = db.collection('prepaid_cards').doc(code);
            batch.set(ref, {
                code,
                value,
                isRedeemed: false,
                redeemedBy: null,
                redeemedAt: null,
                batchId,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
        await batch.commit();
        showToast("Cards Generated!", `${qty} card(s) worth LKR ${value} each are ready.`, "success");
        loadPrepaidCards();
    } catch (e) {
        console.error(e);
        showToast("Error", "Failed to generate cards. Please try again.", "error");
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i data-lucide="plus-circle" style="display:inline-block;width:1rem;height:1rem;vertical-align:-2px;margin-right:6px;"></i>Generate Cards'; }
    }
}

async function loadPrepaidCards() {
    const container = document.getElementById('prepaid-card-list');
    if (!container) return;

    try {
        const snap = await db.collection('prepaid_cards').orderBy('createdAt', 'desc').limit(50).get();
        if (snap.empty) {
            container.innerHTML = `<p class="text-center text-xs font-bold text-gray-400 py-6">No cards generated yet. Create some above ↑</p>`;
            return;
        }

        const rows = snap.docs.map(doc => {
            const c = doc.data();
            const statusClass = c.isRedeemed ? 'text-red-500 bg-red-50 dark:bg-red-500/10' : 'text-green-600 bg-green-50 dark:bg-green-500/10';
            const status = c.isRedeemed ? 'Redeemed' : 'Active';
            return `
                <tr class="border-b border-gray-100 dark:border-dark-border last:border-none hover:bg-gray-50/50 dark:hover:bg-dark-bg/30 transition-colors">
                    <td class="py-3 pr-4">
                        <code class="text-xs font-black text-secondary dark:text-gray-200 bg-gray-100 dark:bg-dark-bg px-2 py-1 rounded-lg tracking-widest">${c.code}</code>
                    </td>
                    <td class="py-3 pr-4 text-sm font-black text-secondary dark:text-gray-200">LKR ${c.value.toLocaleString()}</td>
                    <td class="py-3">
                        <span class="text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-lg ${statusClass}">${status}</span>
                    </td>
                    <td class="py-3 text-right text-[10px] text-gray-400 font-bold">${c.isRedeemed ? (c.redeemedBy || '').substring(0, 15) + '...' : ''}</td>
                </tr>
            `;
        }).join('');

        container.innerHTML = `
            <div class="overflow-x-auto">
                <table class="w-full">
                    <thead>
                        <tr class="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 dark:border-dark-border">
                            <th class="pb-3 text-left">Code</th>
                            <th class="pb-3 text-left">Value</th>
                            <th class="pb-3 text-left">Status</th>
                            <th class="pb-3 text-right">Redeemed By</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;
        lucide.createIcons();
    } catch (e) {
        container.innerHTML = `<p class="text-center text-xs font-bold text-red-400 py-6">Failed to load cards.</p>`;
    }
}

// AUTO-REFRESH & INIT
window.addEventListener('storage', () => { renderAdmin(); }); // Cross-tab updates
window.addEventListener('order-updated', () => { renderAdmin(); }); // Same-tab updates
window.addEventListener('menu-updated', () => { renderAdmin(); });
// renderAdmin(); // Triggers only ONCE auth is verified now.

