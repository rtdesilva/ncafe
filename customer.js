// ==============================================
// N-CAFE CUSTOMER APP - REBUILT FROM SCRATCH
// ==============================================

// MENU DATA
// MENU DATA
// Relying on global window.menuItems and window.categories from data.js

// --- REFRESH LOGIC ---
window.addEventListener('menu-updated', () => { render(); });
window.addEventListener('order-updated', () => { render(); });
window.addEventListener('settings-updated', () => { render(); }); // Re-render if tax/status changes
window.addEventListener('storage', () => { render(); });


// --- INJECT CLOSURE CSS ---
(function () {
    const style = document.createElement('style');
    style.textContent = `
        .store-closed-mode {
            position: relative;
        }
        .store-closed-mode > *:not(.keep-vibrant):not(.ncafe-toast-container) {
            filter: grayscale(1) brightness(0.8) !important;
            opacity: 0.6 !important;
            pointer-events: none !important;
            user-select: none !important;
            transition: all 0.4s ease;
        }
        .keep-vibrant {
            position: relative;
            z-index: 50;
            filter: none !important;
            opacity: 1 !important;
            pointer-events: auto !important;
        }
    `;
    document.head.appendChild(style);
})();


// STATE
const state = {
    cart: JSON.parse(localStorage.getItem('ncafe_cart')) || [],
    view: 'home', // 'home', 'item', 'checkout', 'payment', 'receipt', 'auth', 'profile', 'profile-edit', 'orders'
    selectedCategory: 'all',
    selectedItem: null,
    quantity: 1,
    orderId: null,
    activeOrder: null,
    orderListener: null,
    studentId: '',
    paymentMethod: 'visa',
    staffMode: false, // Toggle staff features
    staffTab: 'orders', // 'orders', 'scanner', 'stock'
    // User Auth
    user: JSON.parse(localStorage.getItem('ncafe_user')) || null, // { email, name, photo, uid }
    authMode: 'login', // 'login' or 'register'
    rememberMe: false,
    favorites: JSON.parse(localStorage.getItem('ncafe_favorites')) || [], // Array of item IDs that user has favorited
    searchQuery: '', // Search query for filtering items
    // Communication
    activeMsgTab: 'offers', // 'offers', 'chat'
    notifications: [],
    messages: [],
    notifications: [],
    messages: [],
    specialInstructions: '', // Special instructions for the order
    lastOrder: null, // Store details of the last placed order for receipt
    isDarkMode: localStorage.getItem('ncafe_dark_mode') === 'true',
    // Wallet
    walletBalance: 0,
    walletLoading: true
};

// INITIAL DARK MODE APPLY
if (state.isDarkMode) {
    document.documentElement.classList.add('dark');
} else {
    document.documentElement.classList.remove('dark');
}

function toggleDarkMode() {
    state.isDarkMode = !state.isDarkMode;
    localStorage.setItem('ncafe_dark_mode', state.isDarkMode);
    if (state.isDarkMode) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
    render();
}

// Sync studentId if user is already logged in from localStorage
if (state.user) {
    state.studentId = state.user.email;
}

// -------------------------------------------------------------
// AUTH STATE LISTENER (The Source of Truth)
// -------------------------------------------------------------
firebase.auth().onAuthStateChanged((user) => {
    if (user) {
        // SECURITY: Check if this user is a staff/admin member.
        // Staff accounts live in 'staff_users', not 'users'.
        // If detected, do NOT sign them out (it would affect the staff portal too).
        // Instead, simply don't load them as a customer — keep the portal in a logged-out state.
        db.collection('staff_users').where('email', '==', user.email).where('status', '==', 'active').limit(1).get().then(staffSnap => {
            if (!staffSnap.empty) {
                // Staff/admin session detected — silently ignore. Do NOT call signOut().
                // The customer portal simply won't recognize them as a valid customer.
                console.warn("Staff account detected in customer portal context. Ignoring.");
                state.user = null;
                return; // Stop processing — portal stays in logged-out state.
            }

            // Customer confirmed — fetch their profile from Firestore
            return db.collection('users').doc(user.uid).get().then(doc => {
                const data = doc.exists ? doc.data() : {};
                state.user = {
                    uid: user.uid,
                    email: user.email,
                    name: data.name || user.displayName || user.email.split('@')[0],
                    photo: data.photo || user.photoURL,
                    phone: data.phone || user.phoneNumber
                };
                state.studentId = state.user.email;
                localStorage.setItem('ncafe_user', JSON.stringify(state.user));

                // Update UI
                const profileBtn = document.querySelector('header .rounded-full');
                if (profileBtn || state.view === 'profile') render();
            });
        });
    } else {
        // User is signed out.
        if (state.user) {
            console.log("Firebase says logged out. Clearing local state.");
            state.user = null;
            state.studentId = '';
            localStorage.removeItem('ncafe_user');
            render(); // Re-render to show login button
        }
    }
});

const app = document.getElementById('app');

// ==============================================
// RENDER FUNCTIONS
// ==============================================

function render() {
    // 1. Handle Global Closure Class
    const isClosed = !window.systemSettings.isStoreOpen;
    const isExemptView = ['receipt', 'auth'].includes(state.view);

    if (isClosed && !isExemptView) {
        app.classList.add('store-closed-mode');
    } else {
        app.classList.remove('store-closed-mode');
    }

    app.innerHTML = '';

    // GLOBAL ORDER STATUS BAR (Live Tracking)
    if (state.activeOrder && !['auth', 'receipt', 'payment'].includes(state.view)) {
        const statusBar = document.createElement('div');
        statusBar.innerHTML = createStatusBar(state.activeOrder);
        app.appendChild(statusBar);
    }

    if (state.view === 'home') renderHome();
    else if (state.view === 'favorites') renderFavorites();
    else if (state.view === 'item') renderItemDetail();
    else if (state.view === 'checkout') renderCheckout();
    else if (state.view === 'payment') renderPayment();
    else if (state.view === 'receipt') renderReceipt();
    else if (state.view === 'auth') renderAuth();
    else if (state.view === 'profile') renderProfile();
    else if (state.view === 'profile-edit') renderProfileEdit();
    else if (state.view === 'orders') renderMyOrders();
    else if (state.view === 'messages') renderMessages();
    else if (state.view === 'chat-conversation') renderChatConversation();

    // Render staff navigation if in staff mode
    if (state.staffMode) {
        renderStaffNav();
    } else {
        // Render customer bottom nav for relevant views
        if (['home', 'favorites', 'checkout', 'messages', 'profile', 'profile-edit', 'orders'].includes(state.view)) {
            renderBottomNav();
        }
    }

    lucide.createIcons();
}

function renderHome() {
    // Header
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning,' : hour < 18 ? 'Good afternoon,' : 'Good evening,';

    const header = document.createElement('header');
    header.className = 'sticky top-0 bg-white dark:bg-dark-bg z-20 shadow-sm p-4 transition-colors duration-300';
    header.innerHTML = `
        <div class="flex justify-between items-center">
            <div class="flex items-center gap-3" onclick="${!state.user ? 'goToAuth()' : 'goToProfile()'}" role="button">
                <div class="w-12 h-12 rounded-full overflow-hidden border-2 border-primary/20 bg-orange-50 dark:bg-dark-surface shadow-sm transition-transform active:scale-90">
                    ${state.user?.photo ? `
                        <img src="${state.user.photo}" class="w-full h-full object-cover">
                    ` : `
                        <div class="w-full h-full flex items-center justify-center text-primary font-bold text-lg">
                            ${state.user?.name ? state.user.name[0].toUpperCase() : 'G'}
                        </div>
                    `}
                </div>
                <div class="flex flex-col">
                    <span class="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider">${greeting}</span>
                    <h2 class="text-base font-bold text-secondary dark:text-gray-100 leading-tight">${state.user?.name || 'Guest User'}</h2>
                </div>
            </div>

            <div class="flex items-center gap-2 bg-gray-100/50 dark:bg-dark-surface/50 p-1.5 rounded-2xl border border-gray-100/50 dark:border-dark-border/50">
                <!-- Theme Toggle Switch -->
                <div onclick="toggleDarkMode()" class="w-14 h-8 bg-gray-100 dark:bg-dark-surface rounded-full p-1 cursor-pointer transition-all shadow-md active:scale-95 group">
                    <div class="h-6 w-6 rounded-full bg-white dark:bg-primary shadow-sm flex items-center justify-center transition-all ${state.isDarkMode ? 'translate-x-6' : 'translate-x-0'}">
                        <i data-lucide="${state.isDarkMode ? 'sun' : 'moon'}" class="w-4 h-4 text-primary dark:text-white"></i>
                    </div>
                </div>

                <!-- Notifications Icon -->
                <button onclick="goToNotifications()" class="relative w-10 h-10 rounded-xl flex items-center justify-center hover:bg-white/50 dark:hover:bg-dark-bg/50 active:scale-95 transition-all text-gray-400 dark:text-gray-500">
                    <i data-lucide="bell" class="w-5 h-5"></i>
                    ${state.notifications.length > 0 ? `<span class="absolute top-2.5 right-2.5 w-2 h-2 bg-red-500 rounded-full border border-white dark:border-dark-bg"></span>` : ''}
                </button>
                
                <!-- Messages Icon -->
                <button onclick="${!state.user ? 'goToAuth(); showToast(\'Auth Required\', \'Please log in to view messages 💬\', \'error\');' : 'goToMessages()'}" class="relative w-10 h-10 rounded-xl flex items-center justify-center hover:bg-white/50 dark:hover:bg-dark-bg/50 active:scale-95 transition-all text-gray-400 dark:text-gray-500">
                    <i data-lucide="message-circle" class="w-5 h-5"></i>
                    ${state.messages.some(m => !m.read) ? `<span class="absolute top-2.5 right-2.5 w-2 h-2 bg-primary rounded-full border border-white dark:border-dark-bg"></span>` : ''}
                </button>
            </div>
            </div>
        </div>
        ${!window.systemSettings.isStoreOpen ? `
            <div class="keep-vibrant mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-4 animate-pulse shadow-lg shadow-red-500/10">
                <div class="w-10 h-10 bg-red-500 text-white rounded-xl flex items-center justify-center shadow-lg shadow-red-500/20">
                    <i data-lucide="door-closed" class="w-6 h-6"></i>
                </div>
                <div>
                    <h4 class="text-sm font-black text-red-600 dark:text-red-400">Store is currently CLOSED</h4>
                    <p class="text-[10px] font-bold text-red-500/80 uppercase tracking-wide">We are not accepting new orders at this time</p>
                </div>
            </div>
        ` : ''}
    `;
    app.appendChild(header);

    // Search Bar
    const searchConfig = document.createElement('div');
    searchConfig.className = "px-4 mb-6 mt-4";
    searchConfig.innerHTML = `
        <div class="relative">
            <i data-lucide="search" class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"></i>
            <input type="text" placeholder="Search for food..." 
                class="w-full pl-12 pr-4 py-3 bg-gray-100 dark:bg-dark-surface rounded-xl outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium dark:text-gray-100"
                value="${state.searchQuery}"
                oninput="handleSearch(event)"
            >
        </div>
    `;
    app.appendChild(searchConfig);

    // Categories
    const categoriesContainer = document.createElement('div');
    categoriesContainer.className = "px-4 mb-6";
    categoriesContainer.innerHTML = `
        <div class="flex justify-between overflow-x-auto hide-scrollbar gap-4 pb-2">
            ${categories.map(cat => `
                <button onclick="selectCategory('${cat.id}')" class="flex flex-col items-center gap-2 min-w-[64px] group">
                    <div class="w-16 h-16 rounded-2xl flex items-center justify-center transition-all ${state.selectedCategory === cat.id ? 'bg-primary text-white shadow-lg shadow-orange-500/30' : 'bg-gray-100 dark:bg-dark-surface text-gray-500 dark:text-gray-400 group-hover:bg-gray-200 dark:group-hover:bg-dark-border'}">
                        <i data-lucide="${cat.icon}" class="w-7 h-7"></i>
                    </div>
                    <span class="text-xs font-bold tracking-wide ${state.selectedCategory === cat.id ? 'text-primary' : 'text-gray-500 dark:text-gray-400'}">${cat.name}</span>
                </button>
            `).join('')}
        </div>
    `;
    app.appendChild(categoriesContainer);

    // Items Grid
    const filtered = menuItems.filter(item => {
        const matchesCategory = state.selectedCategory === 'all' || item.category === state.selectedCategory;
        const matchesSearch = item.name.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
            item.category.toLowerCase().includes(state.searchQuery.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    const grid = document.createElement('div');
    grid.className = 'grid grid-cols-2 gap-4 p-4 pb-24';
    grid.innerHTML = filtered.map(item => `
        <div onclick="viewItem(${item.id})" class="bg-white dark:bg-dark-surface rounded-2xl p-3 shadow-sm border border-gray-100 dark:border-dark-border hover:shadow-md transition-all active:scale-95 cursor-pointer group ${!item.isAvailable ? 'opacity-60 grayscale cursor-not-allowed' : ''}">
            <div class="relative mb-3 h-32 rounded-xl overflow-hidden bg-gray-100 dark:bg-dark-bg">
                <img src="${item.image}" alt="${item.name}" class="w-full h-full object-cover">
                <div class="absolute top-2 left-2 bg-white/90 dark:bg-dark-surface/90 backdrop-blur-sm px-2 py-1 rounded-lg text-xs font-bold text-primary">
                    LKR ${item.price}
                </div>
                ${!item.isAvailable ? `<div class="absolute inset-0 bg-black/50 flex items-center justify-center text-white font-bold text-sm px-2 text-center">Out of Stock</div>` : ''}
            </div>
            <h3 class="font-bold text-secondary dark:text-gray-100 text-sm mb-1 line-clamp-1">${item.name}</h3>
            <div class="flex justify-between items-center">
                <span class="text-xs text-gray-500 dark:text-gray-400">${item.category}</span>
                <button class="w-8 h-8 rounded-full ${item.isAvailable ? 'bg-primary text-white shadow-lg shadow-orange-500/20 group-hover:bg-orange-600' : 'bg-gray-200 dark:bg-dark-bg text-gray-400 dark:text-gray-600'} flex items-center justify-center transition-colors">
                    <i data-lucide="plus" class="w-5 h-5"></i>
                </button>
            </div>
        </div>
    `).join('');
    app.appendChild(grid);

    // Floating Cart Button logic moved to Bottom Nav in new design

}

function renderItemDetail() {
    const item = menuItems.find(i => i.id === state.selectedItem);
    if (!item) { state.view = 'home'; render(); return; }

    const div = document.createElement('div');
    div.className = 'min-h-screen bg-white dark:bg-dark-bg flex flex-col animate-fade-in transition-colors duration-300';
    div.innerHTML = `
        <div class="relative h-80">
            <img src="${item.image}" class="w-full h-full object-cover">
            <button onclick="goBack()" class="absolute top-6 left-6 w-10 h-10 bg-white/20 dark:bg-dark-surface/40 backdrop-blur-md text-white rounded-full flex items-center justify-center hover:bg-white/30 dark:hover:bg-dark-surface/60 transition-all active:scale-90 shadow-lg z-10">
                <i data-lucide="arrow-left" class="w-6 h-6"></i>
            </button>
            <button onclick="toggleFavorite(${item.id})" class="absolute top-6 right-6 w-10 h-10 bg-white/20 dark:bg-dark-surface/40 backdrop-blur-md rounded-full flex items-center justify-center hover:bg-white/30 dark:hover:bg-dark-surface/60 transition-all active:scale-90 shadow-lg z-10 ${state.favorites.includes(item.id) ? 'bg-white text-red-500' : 'text-white'}">
                <i data-lucide="heart" class="w-6 h-6 ${state.favorites.includes(item.id) ? 'fill-current' : ''}"></i>
            </button>
        </div>
        
        <div class="flex-1 bg-white dark:bg-dark-surface -mt-10 rounded-t-[2.5rem] relative p-8 flex flex-col shadow-[0_-10px_40px_rgba(0,0,0,0.1)] transition-colors duration-300">
            <div class="w-12 h-1.5 bg-gray-200 dark:bg-dark-border rounded-full mx-auto mb-6"></div>
            
            <div class="flex justify-between items-start mb-2">
                <h1 class="text-3xl font-bold text-secondary dark:text-gray-100 w-3/4 leading-tight">${item.name}</h1>
                <span class="text-primary text-2xl font-bold">LKR ${item.price}</span>
            </div>
            
            <div class="flex items-center gap-2 mb-6">
                <span class="bg-orange-50 dark:bg-primary/10 text-orange-600 dark:text-primary font-bold text-xs px-3 py-1.5 rounded-full uppercase tracking-wide border border-orange-100 dark:border-primary/20">${item.subCategory}</span>
            </div>
            
        </div>
    `;
    const p = document.createElement('p');
    p.className = 'text-gray-500 dark:text-gray-400 leading-relaxed mb-8 flex-1 text-base';
    p.innerHTML = `
        ${item.description || 'Delicious item from our menu.'}
    `;
    div.querySelector('.flex-1').appendChild(p);

    const controls = document.createElement('div');
    controls.className = 'mt-auto';
    controls.innerHTML = `
        <div class="flex items-center justify-between gap-6 p-1 mb-6">
            <span class="font-bold text-lg text-secondary dark:text-gray-100">Quantity</span>
            <div class="flex items-center gap-4 bg-gray-50 dark:bg-dark-bg px-4 py-2 rounded-2xl border border-gray-100 dark:border-dark-border">
                <button onclick="changeQty(-1)" class="w-8 h-8 rounded-full bg-white dark:bg-dark-surface shadow-sm border border-gray-100 dark:border-dark-border flex items-center justify-center text-gray-600 dark:text-gray-400 active:scale-90 transition-transform hover:bg-gray-50 dark:hover:bg-dark-border">
                    <i data-lucide="minus" class="w-4 h-4"></i>
                </button>
                <span class="font-bold text-xl w-8 text-center text-secondary dark:text-gray-100">${state.quantity}</span>
                <button onclick="changeQty(1)" class="w-8 h-8 rounded-full bg-secondary dark:bg-primary text-white shadow-lg shadow-gray-900/20 flex items-center justify-center active:scale-90 transition-transform">
                    <i data-lucide="plus" class="w-4 h-4"></i>
                </button>
            </div>
        </div>
        
        <button onclick="addToCart()" class="w-full bg-primary text-white p-5 rounded-2xl font-bold text-xl shadow-xl shadow-orange-500/30 active:scale-95 transition-all flex items-center justify-center gap-3 group">
            <span>Add to Cart</span>
            <span class="bg-white/20 text-sm px-2 py-1 rounded-lg font-medium group-hover:bg-white/30 transition-colors">LKR ${item.price * state.quantity}</span>
        </button>
    `;
    div.querySelector('.flex-1').appendChild(controls);

    app.appendChild(div);
}

function renderCheckout() {
    const subtotal = state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const tax = subtotal * (window.systemSettings.taxRate / 100);
    const total = subtotal + tax;

    const div = document.createElement('div');
    div.className = 'min-h-screen bg-gray-50 dark:bg-dark-bg flex flex-col pb-96 transition-colors duration-300';
    div.innerHTML = `
        <!-- Header -->
        <div class="bg-white dark:bg-dark-bg p-4 sticky top-0 z-30 flex items-center shadow-sm justify-between">
            <button onclick="goBack()" class="w-10 h-10 rounded-full flex items-center justify-center hover:bg-gray-100 dark:hover:bg-dark-surface active:scale-95 transition text-secondary dark:text-gray-100">
                <i data-lucide="chevron-left" class="w-7 h-7"></i>
            </button>
            <h1 class="text-xl font-bold text-center text-secondary dark:text-gray-100">My Cart</h1>
            <button onclick="toggleDarkMode()" class="w-10 h-10 rounded-full bg-gray-50 dark:bg-dark-surface flex items-center justify-center hover:bg-gray-100 dark:hover:bg-dark-border active:scale-95 transition text-gray-600 dark:text-gray-400">
                <i data-lucide="${state.isDarkMode ? 'sun' : 'moon'}" class="w-5 h-5"></i>
            </button>
        </div>
        
        <div class="p-6 space-y-4">
            <!-- Cart Items -->
            ${state.cart.length === 0 ? `
                <div class="text-center py-20">
                    <div class="w-20 h-20 bg-gray-200 dark:bg-dark-surface rounded-full flex items-center justify-center mx-auto mb-4">
                        <i data-lucide="shopping-cart" class="w-10 h-10 text-gray-400 dark:text-gray-600"></i>
                    </div>
                    <p class="text-gray-500 dark:text-gray-400 font-bold">Your cart is empty</p>
                    <button onclick="goHome()" class="mt-4 text-primary font-bold">Start Ordering</button>
                </div>
            ` : state.cart.map((item, idx) => `
                <div class="bg-white dark:bg-dark-surface p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-dark-border relative animate-fade-in transition-colors duration-300">
                    <button onclick="removeFromCart(${idx})" class="absolute top-4 right-4 text-gray-300 dark:text-gray-600 hover:text-red-500 transition active:scale-95">
                        <i data-lucide="trash-2" class="w-5 h-5"></i>
                    </button>

                    <div class="flex gap-4">
                        <div class="w-24 h-24 rounded-xl overflow-hidden bg-gray-100 dark:bg-dark-bg flex-shrink-0">
                            <img src="${item.image}" alt="${item.name}" class="w-full h-full object-cover">
                        </div>
                        
                        <div class="flex flex-col flex-1 justify-between">
                            <div>
                                <h3 class="font-bold text-secondary dark:text-gray-100 text-lg leading-tight mb-1 pr-8">${item.name}</h3>
                                <p class="text-primary font-bold">LKR ${item.price}</p>
                            </div>
                            
                            <div class="flex items-center gap-3 mt-2">
                                <button onclick="updateCartQuantity(${idx}, -1)" class="w-8 h-8 rounded-full bg-gray-100 dark:bg-dark-bg flex items-center justify-center text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-dark-border active:scale-95 transition">
                                    <i data-lucide="minus" class="w-4 h-4"></i>
                                </button>
                                <span class="text-lg font-bold w-6 text-center text-secondary dark:text-gray-100">${item.quantity}</span>
                                <button onclick="updateCartQuantity(${idx}, 1)" class="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center hover:bg-orange-600 active:scale-95 transition shadow-lg shadow-orange-500/30">
                                    <i data-lucide="plus" class="w-4 h-4"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `).join('')}

            <!-- Special Instructions -->
            ${state.cart.length > 0 ? `
                <div class="mt-8">
                    <label class="font-bold text-secondary dark:text-gray-100 text-lg mb-3 block">Special Instructions</label>
                    <div class="relative">
                        <textarea 
                            oninput="updateSpecialInstructions(this.value)"
                            placeholder="e.g. Less sugar, no spicy..." 
                            class="w-full bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-2xl p-4 min-h-[120px] outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none text-sm placeholder:text-gray-400 font-medium dark:text-gray-100"
                        >${state.specialInstructions || ''}</textarea>
                        <i data-lucide="edit-3" class="absolute bottom-4 right-4 w-5 h-5 text-gray-300 dark:text-gray-600"></i>
                    </div>
                </div>
            ` : ''}
        </div>
        
        <!-- Bottom Tab -->
        ${state.cart.length > 0 ? `
            <div class="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white dark:bg-dark-surface rounded-t-[2.5rem] shadow-[0_-10px_40px_rgba(0,0,0,0.1)] p-8 z-40 transition-colors duration-300">
                <div class="space-y-3 mb-8">
                    <div class="flex justify-between items-center text-gray-500 dark:text-gray-400">
                        <span class="font-medium">Subtotal</span>
                        <span class="font-bold text-secondary dark:text-gray-100">LKR ${subtotal.toFixed(2)}</span>
                    </div>
                    <div class="flex justify-between items-center text-gray-500 dark:text-gray-400">
                        <span class="font-medium">Tax (${window.systemSettings.taxRate}%)</span>
                        <span class="font-bold text-secondary dark:text-gray-100">LKR ${tax.toFixed(2)}</span>
                    </div>
                    <div class="flex justify-between items-center text-xl mt-4 pt-4 border-t border-gray-100 dark:border-dark-border">
                        <span class="font-bold text-secondary dark:text-gray-100">Total</span>
                        <span class="font-bold text-primary">LKR ${total.toFixed(2)}</span>
                    </div>
                </div>
                
                <button onclick="placeOrder()" class="w-full bg-primary text-white p-5 rounded-2xl font-bold text-lg shadow-xl shadow-orange-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 group mb-16">
                    Proceed to Checkout
                    <i data-lucide="arrow-right" class="w-6 h-6 group-hover:translate-x-1 transition-transform"></i>
                </button>
            </div>
        ` : ''}
    `;
    app.appendChild(div);
}

function updateSpecialInstructions(text) {
    state.specialInstructions = text;
}



function renderPayment() {
    const subtotal = state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const tax = subtotal * 0.05;
    const total = subtotal + tax;

    const div = document.createElement('div');
    div.className = 'min-h-screen bg-white dark:bg-dark-bg p-6 transition-colors duration-300';
    div.innerHTML = `
        <button onclick="backToCheckout()" class="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-8 hover:text-secondary dark:hover:text-gray-100 transition-colors active:scale-95">
            <i data-lucide="arrow-left" class="w-5 h-5"></i>
            <span class="font-bold">Back</span>
        </button>
        
        <h1 class="text-3xl font-bold mb-2 text-secondary dark:text-gray-100">Payment</h1>
        <p class="text-gray-400 dark:text-gray-500 mb-8 font-medium">Choose how you want to pay</p>
        
        <div class="bg-gray-50 dark:bg-dark-surface p-6 rounded-2xl mb-8 space-y-3 border border-gray-100 dark:border-dark-border shadow-sm">
            <div class="flex justify-between items-center text-sm text-gray-400 dark:text-gray-500 font-medium">
                <span>Subtotal</span>
                <span>LKR ${subtotal.toFixed(2)}</span>
            </div>
            <div class="flex justify-between items-center text-sm text-gray-400 dark:text-gray-500 font-medium pb-3 border-b border-gray-100 dark:border-dark-border">
                <span>Tax (${window.systemSettings.taxRate}%)</span>
                <span>LKR ${tax.toFixed(2)}</span>
            </div>
            <div class="flex justify-between items-center pt-1">
                <span class="text-secondary dark:text-gray-300 font-bold">Total Amount</span>
                <span class="text-3xl font-bold text-primary">LKR ${total.toFixed(2)}</span>
            </div>
        </div>
        
        <div class="space-y-4 mb-12">
            <button onclick="selectPayment('visa')" class="w-full p-5 rounded-2xl border-2 transition-all duration-300 flex items-center gap-4 ${state.paymentMethod === 'visa' ? 'border-primary bg-orange-50 dark:bg-primary/10 shadow-lg shadow-orange-500/10' : 'border-gray-100 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-dark-surface'}">
                <div class="w-6 h-6 rounded-full border-2 flex items-center justify-center ${state.paymentMethod === 'visa' ? 'border-primary bg-primary' : 'border-gray-300 dark:border-gray-600'}">
                    ${state.paymentMethod === 'visa' ? '<div class="w-2 h-2 bg-white rounded-full"></div>' : ''}
                </div>
                <div class="w-12 h-12 bg-white dark:bg-dark-bg rounded-xl flex items-center justify-center shadow-sm">
                    <i data-lucide="credit-card" class="w-6 h-6 text-primary"></i>
                </div>
                <div class="text-left">
                    <span class="font-bold text-secondary dark:text-gray-100 block">Visa / Master</span>
                    <span class="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest">Pay with Credit/Debit</span>
                </div>
            </button>
            
            <button onclick="selectPayment('genie')" class="w-full p-5 rounded-2xl border-2 border-gray-100 dark:border-dark-border opacity-50 flex items-center gap-4 cursor-not-allowed group">
                <div class="w-6 h-6 rounded-full border-2 border-gray-200 dark:border-gray-800"></div>
                <div class="w-12 h-12 bg-gray-50 dark:bg-dark-surface/50 rounded-xl flex items-center justify-center">
                    <i data-lucide="smartphone" class="w-6 h-6 text-gray-400 dark:text-gray-600"></i>
                </div>
                <div class="text-left">
                    <span class="font-bold text-gray-400 dark:text-gray-600 block">Genie</span>
                    <span class="text-[10px] text-gray-400 dark:text-gray-700 font-bold uppercase tracking-widest">Available Soon</span>
                </div>
            </button>

            <!-- N-Cafe Wallet Option -->
            <button onclick="selectPayment('wallet')" class="w-full p-5 rounded-2xl border-2 transition-all duration-300 flex items-center gap-4 ${state.paymentMethod === 'wallet' ? 'border-primary bg-orange-50 dark:bg-primary/10 shadow-lg shadow-orange-500/10' : 'border-gray-100 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-dark-surface'} ${state.walletBalance < total ? 'opacity-60' : ''}">
                <div class="w-6 h-6 rounded-full border-2 flex items-center justify-center ${state.paymentMethod === 'wallet' ? 'border-primary bg-primary' : 'border-gray-300 dark:border-gray-600'}">
                    ${state.paymentMethod === 'wallet' ? '<div class="w-2 h-2 bg-white rounded-full"></div>' : ''}
                </div>
                <div class="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center shadow-sm">
                    <i data-lucide="wallet" class="w-6 h-6 text-white"></i>
                </div>
                <div class="text-left flex-1">
                    <span class="font-bold text-secondary dark:text-gray-100 block">N-Cafe Wallet</span>
                    <span class="text-[10px] font-bold uppercase tracking-widest ${state.walletBalance >= total ? 'text-green-500' : 'text-red-400'}">
                        Balance: LKR ${state.walletBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })} ${state.walletBalance < total ? '— Insufficient' : '✓ Ready'}
                    </span>
                </div>
            </button>
        </div>
        
        <button onclick="processPayment()" class="w-full bg-secondary dark:bg-primary text-white p-5 rounded-2xl font-bold text-lg flex items-center justify-between shadow-2xl shadow-secondary/20 dark:shadow-primary/20 active:scale-[0.98] transition-all hover:translate-y-[-2px]">
            <span>Complete Order</span>
            <div class="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                <i data-lucide="check" class="w-6 h-6"></i>
            </div>
        </button>
    `;
    app.appendChild(div);
}

function renderReceipt() {
    const order = state.lastOrder || state.activeOrder;
    if (!order) { goHome(); return; }

    const subtotal = order.subtotal || (order.total / 1.05);
    const tax = order.tax || (order.total - subtotal);

    const div = document.createElement('div');
    div.className = 'min-h-screen bg-primary flex items-center justify-center p-6 transition-colors duration-300';
    div.innerHTML = `
        <div class="bg-white dark:bg-dark-surface w-full rounded-3xl p-8 shadow-2xl relative transition-colors duration-300">
            <button onclick="${state.user ? 'viewMyOrders()' : 'goHome()'}" class="absolute top-6 left-6 w-10 h-10 rounded-full bg-gray-50 dark:bg-dark-bg flex items-center justify-center text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-dark-border hover:text-secondary dark:hover:text-gray-100 active:scale-95 transition-all">
                <i data-lucide="arrow-left" class="w-5 h-5"></i>
            </button>

            <div class="text-center mb-6">
                <div class="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i data-lucide="check" class="w-8 h-8 text-green-600"></i>
                </div>
                <h1 class="text-2xl font-bold mb-2 text-secondary dark:text-gray-100">Order Placed!</h1>
                <p class="text-gray-500 dark:text-gray-400 text-sm font-bold mb-4">Order #${order.id}</p>
                <div class="bg-gray-50 dark:bg-white p-4 rounded-2xl inline-block mb-2 shadow-inner border border-gray-100 dark:border-dark-border">
                    <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${order.id}" class="w-32 h-32 mx-auto mix-blend-multiply opacity-90" alt="Order QR Code">
                </div>
                <p class="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest">Scan to Verify</p>
            </div>
            
            <div class="bg-gray-50 dark:bg-dark-bg p-4 rounded-xl mb-6 border border-gray-100 dark:border-dark-border">
                ${order.items.map(item => `
                    <div class="flex justify-between text-sm mb-2 text-secondary dark:text-gray-300">
                        <span>${item.quantity}x ${item.name}</span>
                        <span class="font-bold">LKR ${item.price * item.quantity}</span>
                    </div>
                `).join('')}
                <div class="border-t border-gray-200 dark:border-dark-border pt-2 mt-2 space-y-1">
                    <div class="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                        <span>Subtotal</span>
                        <span>LKR ${subtotal.toFixed(2)}</span>
                    </div>
                    <div class="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                        <span>Tax (${window.systemSettings.taxRate}%)</span>
                        <span>LKR ${tax.toFixed(2)}</span>
                    </div>
                    <div class="flex justify-between font-bold text-lg pt-1 text-secondary dark:text-gray-100">
                        <span>Total</span>
                        <span class="text-primary">LKR ${order.total.toFixed(2)}</span>
                    </div>
                </div>
            </div>
            
            ${order.status === 'completed' ? `
                <button onclick="reorder('${order.id}')" class="w-full bg-primary text-white p-4 rounded-xl font-bold mb-2 shadow-lg shadow-orange-500/20 active:scale-95 transition flex items-center justify-center gap-2">
                    <i data-lucide="refresh-ccw" class="w-5 h-5"></i> Order Again
                </button>
                <button onclick="goHome()" class="w-full bg-gray-50 dark:bg-dark-bg text-gray-500 dark:text-gray-400 p-4 rounded-xl font-bold hover:bg-gray-100 dark:hover:bg-dark-border transition">
                    Back to Menu
                </button>
            ` : `
                <button onclick="trackOrder()" class="w-full bg-secondary dark:bg-primary text-white p-4 rounded-xl font-bold mb-2 shadow-lg shadow-gray-900/20 active:scale-95 transition">
                    Track My Order
                </button>
                <button onclick="newOrder()" class="w-full bg-gray-100 dark:bg-dark-bg text-gray-600 dark:text-gray-400 p-4 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-dark-border transition">
                    Start New Order
                </button>
            `}
        </div>
    `;
    app.appendChild(div);
}

// ==============================================
// ORDER STATUS BAR
// ==============================================

function createStatusBar(order) {
    const config = {
        'preparing': { label: 'Preparing', color: 'bg-orange-500', progress: '33%', icon: 'chef-hat' },
        'ready': { label: 'Ready', color: 'bg-green-500', progress: '66%', icon: 'check-circle' },
        'completed': { label: 'Completed', color: 'bg-blue-500', progress: '100%', icon: 'package-check' }
    };

    const status = config[order.status] || config['preparing'];

    return `
        <div class="bg-white dark:bg-dark-surface border-b border-gray-100 dark:border-dark-border p-4 shadow-sm sticky top-0 z-30 transition-all animate-fade-in transition-colors duration-300">
            <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-3">
                    <div class="${status.color} w-10 h-10 rounded-xl flex items-center justify-center text-white scale-animation shadow-lg ${status.color.replace('bg-', 'shadow-')}/20">
                        <i data-lucide="${status.icon}" class="w-5 h-5"></i>
                    </div>
                    <div>
                        <p class="text-[10px] font-black text-gray-400 dark:text-dark-muted uppercase tracking-widest">#${order.id ? order.id : 'ORDER'}</p>
                        <h4 class="text-sm font-bold text-secondary dark:text-gray-100">${status.label}</h4>
                    </div>
                </div>
                <button onclick="clearTracking()" class="p-2 hover:bg-gray-100 dark:hover:bg-dark-border rounded-full transition-colors">
                    <i data-lucide="x" class="w-4 h-4 text-gray-400"></i>
                </button>
            </div>
            
            <div class="relative h-1.5 w-full bg-gray-100 dark:bg-dark-bg rounded-full overflow-hidden">
                <div class="${status.color} h-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(0,0,0,0.1)]" style="width: ${status.progress}"></div>
            </div>
            
            <div class="flex justify-between mt-2">
                <span class="text-[9px] font-bold ${order.status === 'preparing' ? 'text-primary' : 'text-gray-300 dark:text-dark-muted'} uppercase tracking-tight">Preparing</span>
                <span class="text-[9px] font-bold ${order.status === 'ready' ? 'text-green-500' : 'text-gray-300 dark:text-dark-muted'} uppercase tracking-tight">Ready</span>
                <span class="text-[9px] font-bold ${order.status === 'completed' ? 'text-blue-500' : 'text-gray-300 dark:text-dark-muted'} uppercase tracking-tight">Completed</span>
            </div>
        </div>
    `;
}

function setupOrderTracking(orderId) {
    console.log('🔄 Setting up tracking for order:', orderId);
    localStorage.setItem('trackingOrderId', orderId);

    if (state.orderListener) state.orderListener();

    state.orderListener = db.collection('orders').doc(orderId).onSnapshot((doc) => {
        if (doc.exists) {
            const order = doc.data();
            console.log('📊 Order status:', order.status);
            state.activeOrder = { id: doc.id, ...order };

            if (state.view === 'home') render();

            if (order.status === 'completed') {
                setTimeout(() => {
                    clearTracking();
                }, 5000);
            }
        }
    });
}

function clearTracking() {
    if (state.orderListener) state.orderListener();
    state.orderListener = null;
    state.activeOrder = null;
    localStorage.removeItem('trackingOrderId');
    render();
}

// ==============================================
// BOTTOM NAVIGATION
// ==============================================

function renderBottomNav() {
    const cartCount = state.cart.reduce((sum, item) => sum + item.quantity, 0);

    const navBar = document.createElement('nav');
    navBar.className = 'fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white dark:bg-dark-bg border-t border-x border-gray-100 dark:border-dark-border rounded-t-2xl px-6 py-3 z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] transition-colors duration-300';
    navBar.innerHTML = `
        <div class="flex justify-between items-end relative">
            <!-- Home -->
            <button onclick="goHome()" class="flex flex-col items-center gap-1 w-12 group ${state.view === 'home' ? 'text-primary' : 'text-gray-400 dark:text-gray-500'}">
                <i data-lucide="home" class="w-6 h-6 ${state.view === 'home' ? 'fill-current' : ''}"></i>
                <span class="text-[10px] font-bold">Home</span>
            </button>
            
            <!-- Saved (Favorites) -->
            <button onclick="goToFavorites()" class="flex flex-col items-center gap-1 w-12 group ${state.view === 'favorites' ? 'text-primary' : 'text-gray-400 dark:text-gray-500'}">
                <i data-lucide="heart" class="w-6 h-6 ${state.view === 'favorites' ? 'fill-current' : ''}"></i>
                <span class="text-[10px] font-bold">Saved</span>
            </button>
            
            <!-- Floating Cart Button -->
            <button onclick="goToCheckout()" class="flex flex-col items-center gap-1 w-12 group">
                <div class="w-14 h-14 bg-primary text-white rounded-full flex items-center justify-center -mt-8 border-4 border-white dark:border-dark-bg shadow-xl shadow-orange-500/40 transition-transform active:scale-95 group-hover:bg-orange-600 relative">
                    <i data-lucide="shopping-cart" class="w-7 h-7 fill-current"></i>
                    ${cartCount > 0 ? `
                        <span class="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full h-5 min-w-[20px] flex items-center justify-center border-2 border-white dark:border-dark-bg shadow-sm">${cartCount > 9 ? '9+' : cartCount}</span>
                    ` : ''}
                </div>
                <span class="text-[10px] font-bold ${state.view === 'checkout' ? 'text-primary' : 'text-gray-400 dark:text-gray-500'} mt-1">Cart</span>
            </button>
            
            <!-- Orders -->
            <button onclick="goToOrders()" class="flex flex-col items-center gap-1 w-12 group ${state.view === 'orders' ? 'text-primary' : 'text-gray-400 dark:text-gray-500'}">
                <i data-lucide="file-text" class="w-6 h-6 ${state.view === 'orders' ? 'fill-current' : ''}"></i>
                <span class="text-[10px] font-bold">Orders</span>
            </button>
            
            <!-- Profile -->
            <button onclick="goToProfile()" class="flex flex-col items-center gap-1 w-12 group ${state.view === 'profile' ? 'text-primary' : 'text-gray-400 dark:text-gray-500'}">
                <i data-lucide="user" class="w-6 h-6 ${state.view === 'profile' ? 'fill-current' : ''}"></i>
                <span class="text-[10px] font-bold">Profile</span>
            </button>
        </div>
    `;
    app.appendChild(navBar);
}

// ==============================================
// ACTIONS
// ==============================================

function selectCategory(cat) {
    state.selectedCategory = cat;
    render();
}

function handleSearch(event) {
    const cursorPosition = event.target.selectionStart;
    state.searchQuery = event.target.value;
    render();

    // Refocus and restore cursor position after render
    setTimeout(() => {
        const searchInput = document.querySelector('input[placeholder="Search for food..."]');
        if (searchInput) {
            searchInput.focus();
            searchInput.setSelectionRange(cursorPosition, cursorPosition);
        }
    }, 0);
}

function viewItem(id) {
    state.selectedItem = id;
    state.quantity = 1;
    state.view = 'item';
    render();
}

function changeQty(delta) {
    state.quantity = Math.max(1, state.quantity + delta);
    render();
}

function addToCart() {
    const item = menuItems.find(i => i.id === state.selectedItem);
    const existing = state.cart.find(i => i.id === item.id);

    if (existing) {
        existing.quantity += state.quantity;
    } else {
        state.cart.push({ ...item, quantity: state.quantity });
    }

    saveCart();
    state.view = 'home';
    render();
}

function saveCart() {
    localStorage.setItem('ncafe_cart', JSON.stringify(state.cart));
}

function updateCartQuantity(index, delta) {
    if (state.cart[index]) {
        state.cart[index].quantity += delta;

        // Remove item if quantity becomes 0 or less
        if (state.cart[index].quantity <= 0) {
            state.cart.splice(index, 1);

            // Go back to home if cart is empty
            if (state.cart.length === 0) {
                state.view = 'home';
            }
        }
    }
    saveCart();
    render();
}

function removeFromCart(index) {
    state.cart.splice(index, 1);
    saveCart();
    if (state.cart.length === 0) {
        state.view = 'home';
    }
    render();
}

function goToCheckout() {
    // Allow all users (guests and logged in) to access checkout/cart
    state.view = 'checkout';
    render();
}

function goBack() {
    state.view = 'home';
    render();
}

function goHome() {
    state.view = 'home';
    render();
}

function goToFavorites() {
    state.view = 'favorites';
    render();
}

function toggleFavorite(id) {
    if (state.favorites.includes(id)) {
        state.favorites = state.favorites.filter(fid => fid !== id);
    } else {
        state.favorites.push(id);
    }
    saveFavorites();
    render();
}

function saveFavorites() {
    localStorage.setItem('ncafe_favorites', JSON.stringify(state.favorites));
}

function renderFavorites() {
    const favoriteItems = menuItems.filter(item => state.favorites.includes(item.id));

    const div = document.createElement('div');
    div.className = 'min-h-screen bg-white dark:bg-dark-bg pb-24 transition-colors duration-300';

    let content = `
        <div class="sticky top-0 bg-white dark:bg-dark-bg z-10 p-4 border-b border-gray-100 dark:border-dark-border shadow-sm flex items-center gap-2">
            <h1 class="text-2xl font-bold text-secondary dark:text-gray-100">Saved Items</h1>
        </div>
    `;

    if (favoriteItems.length === 0) {
        content += `
        <div class="flex flex-col items-center justify-center py-20 text-center px-6">
            <div class="w-24 h-24 bg-red-50 dark:bg-red-900/10 rounded-full flex items-center justify-center mb-6">
                <i data-lucide="heart" class="w-10 h-10 text-red-500 fill-current"></i>
            </div>
            <h2 class="text-xl font-bold text-secondary dark:text-gray-100 mb-2">No Saved Items Yet</h2>
            <p class="text-gray-400 dark:text-gray-500 mb-8">Save your favorite items to find them quickly later.</p>
            <button onclick="goHome()" class="bg-primary text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-orange-500/20 active:scale-95 transition">
                Explore Menu
            </button>
        </div>`;
    } else {
        content += `<div class="grid grid-cols-2 gap-4 p-4">`;
        content += favoriteItems.map(item => `
            <div onclick="viewItem(${item.id})" class="bg-white dark:bg-dark-surface rounded-2xl p-3 shadow-sm border border-gray-100 dark:border-dark-border hover:shadow-md transition-all active:scale-95 cursor-pointer group ${!item.isAvailable ? 'opacity-60 grayscale cursor-not-allowed' : ''}">
                <div class="relative mb-3 h-32 rounded-xl overflow-hidden bg-gray-100 dark:bg-dark-bg">
                    <img src="${item.image}" alt="${item.name}" class="w-full h-full object-cover">
                    <div class="absolute top-2 left-2 bg-white/90 dark:bg-dark-surface/90 backdrop-blur-sm px-2 py-1 rounded-lg text-xs font-bold text-primary">
                        LKR ${item.price}
                    </div>
                     <button onclick="event.stopPropagation(); toggleFavorite(${item.id})" class="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/90 dark:bg-dark-surface/90 backdrop-blur-sm text-red-500 flex items-center justify-center shadow-sm z-10">
                        <i data-lucide="heart" class="w-4 h-4 fill-current"></i>
                    </button>
                    ${!item.isAvailable ? `<div class="absolute inset-0 bg-black/50 flex items-center justify-center text-white font-bold text-sm px-2 text-center">Out of Stock</div>` : ''}
                </div>
                <h3 class="font-bold text-secondary dark:text-gray-100 text-sm mb-1 line-clamp-1">${item.name}</h3>
                <div class="flex justify-between items-center">
                    <span class="text-xs text-gray-500 dark:text-gray-400">${item.category}</span>
                    <button class="w-8 h-8 rounded-full ${item.isAvailable ? 'bg-primary text-white shadow-lg shadow-orange-500/20 group-hover:bg-orange-600' : 'bg-gray-200 dark:bg-dark-bg text-gray-400 dark:text-gray-600'} flex items-center justify-center transition-colors">
                        <i data-lucide="plus" class="w-5 h-5"></i>
                    </button>
                </div>
            </div>
        `).join('');
        content += `</div>`;
    }

    div.innerHTML = content;
    app.appendChild(div);
}

function goToNotifications() {
    state.view = 'messages';
    state.activeMsgTab = 'offers';
    render();

    if (state.notifications.length === 0) {
        initNotificationsListener();
    }
}

function goToOrders() {
    state.view = 'orders';
    render();
}

// Auto-listen to chat for latest message preview
function goToMessages() {
    state.view = 'messages';
    state.activeMsgTab = 'chat';
    render();
    initChatListener();
}

function openSupportChat() {
    if (!state.user) {
        // Redirect guest users to login
        state.view = 'auth';
        state.authMode = 'login';
        render();
        // Optional: show a message after render or pass a message to renderAuth
        showToast("Please login to contact support 💬", 'error');
        return;
    }
    state.view = 'chat-conversation';
    render();
    scrollToBottom();
}

function initNotificationsListener() {
    // Removing orderBy to avoid need for composite index. Sorting client-side.
    db.collection('notifications').where('active', '==', true)
        .limit(20)
        .onSnapshot(snapshot => {
            state.notifications = [];
            snapshot.forEach(doc => {
                state.notifications.push({ id: doc.id, ...doc.data() });
            });

            // Client-side sort: Newest first
            state.notifications.sort((a, b) => {
                const ta = a.timestamp?.seconds || 0;
                const tb = b.timestamp?.seconds || 0;
                return tb - ta;
            });

            console.log('🔔 Notifications synced:', state.notifications.length);

            // Update UI if we are on the notifications tab
            if (state.view === 'messages' && state.activeMsgTab === 'offers') {
                render();
            }
        }, error => {
            console.error("Error fetching notifications:", error);
        });
}

function switchMsgTab(tab) {
    state.activeMsgTab = tab;
    if (tab === 'offers' && state.notifications.length === 0) initNotificationsListener();
    if (tab === 'chat' && state.messages.length === 0) initChatListener();
    render();
}

function renderMessages() {
    const div = document.createElement('div');
    div.className = 'min-h-screen bg-white dark:bg-dark-bg pb-24 transition-colors duration-300';

    div.innerHTML = `
        <div class="sticky top-0 bg-white dark:bg-dark-bg z-20 p-6 border-b border-gray-50 dark:border-dark-border shadow-sm flex justify-between items-center">
            <h1 class="text-2xl font-bold text-secondary dark:text-gray-100">Inbox</h1>
            <button onclick="toggleDarkMode()" class="w-10 h-10 rounded-full bg-gray-50 dark:bg-dark-surface flex items-center justify-center hover:bg-gray-100 dark:hover:bg-dark-border active:scale-95 transition text-gray-600 dark:text-gray-400">
                <i data-lucide="${state.isDarkMode ? 'sun' : 'moon'}" class="w-5 h-5"></i>
            </button>
        </div>
            <div class="flex gap-2 bg-gray-100 dark:bg-dark-surface p-1 rounded-2xl">
                <button onclick="switchMsgTab('offers')" class="flex-1 py-3 text-xs font-bold rounded-xl transition-all duration-300 ${state.activeMsgTab === 'offers' ? 'bg-white dark:bg-dark-bg text-primary shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-secondary dark:hover:text-gray-200'}">
                    Notifications
                    ${state.notifications.length > 0 ? `<span class="ml-2 px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-500 rounded-full text-[10px]">${state.notifications.length}</span>` : ''}
                </button>
                <button onclick="switchMsgTab('chat')" class="flex-1 py-3 text-xs font-bold rounded-xl transition-all duration-300 ${state.activeMsgTab === 'chat' ? 'bg-white dark:bg-dark-bg text-primary shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-secondary dark:hover:text-gray-200'}">
                    Support Chat
                    ${state.messages.some(m => !m.read && m.direction === 'staff_to_customer') ? `<span class="ml-2 w-2 h-2 bg-red-500 rounded-full inline-block animate-pulse"></span>` : ''}
                </button>
            </div>
        </div>
        
        <div class="p-6 space-y-4 animate-fade-in">
            ${state.activeMsgTab === 'offers' ? renderNotificationsTab() : renderChatTab()}
        </div>
    `;

    app.appendChild(div);
}

function renderNotificationsTab() {
    if (state.notifications.length === 0) {
        return `
            <div class="text-center py-20 animate-fade-in">
                <div class="w-20 h-20 bg-gray-50 dark:bg-dark-surface rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                    <i data-lucide="bell-off" class="w-10 h-10 text-gray-300 dark:text-gray-600"></i>
                </div>
                <h3 class="text-lg font-bold text-secondary dark:text-gray-100 mb-2">Clean Inbox</h3>
                <p class="text-sm text-gray-400 dark:text-gray-500 max-w-[200px] mx-auto">We'll let you know when we have something for you!</p>
            </div>
        `;
    }

    return state.notifications.map(n => `
        <div class="bg-white dark:bg-dark-surface p-5 rounded-[24px] border border-gray-100 dark:border-dark-border shadow-sm flex gap-4 relative overflow-hidden group animate-fade-in hover:shadow-md transition-all duration-300">
            <div class="absolute left-0 top-0 bottom-0 w-1.5 ${n.type === 'offer' ? 'bg-primary' : n.type === 'alert' ? 'bg-red-500' : 'bg-blue-500'}"></div>
            <div class="w-12 h-12 rounded-2xl ${n.type === 'offer' ? 'bg-orange-50 dark:bg-primary/10 text-primary' : n.type === 'alert' ? 'bg-red-50 dark:bg-red-900/10 text-red-500' : 'bg-blue-50 dark:bg-blue-900/10 text-blue-500'} flex items-center justify-center flex-shrink-0 shadow-sm">
                <i data-lucide="${n.type === 'offer' ? 'ticket-percent' : n.type === 'alert' ? 'alert-triangle' : 'info'}" class="w-6 h-6"></i>
            </div>
            <div class="flex-1 min-w-0">
                <div class="flex justify-between items-start mb-1">
                    <h3 class="font-bold text-sm text-secondary dark:text-gray-100 truncate">${n.title}</h3>
                    <span class="text-[10px] text-gray-300 dark:text-gray-600 font-bold uppercase tracking-widest whitespace-nowrap ml-2">${n.timestamp ? new Date(n.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now'}</span>
                </div>
                <p class="text-xs text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-2 font-medium">${n.message}</p>
            </div>
        </div>
    `).join('');
}

function renderChatTab() {
    const latestMsg = state.messages.length > 0
        ? state.messages.sort((a, b) => b.timestamp?.seconds - a.timestamp?.seconds)[0].text
        : 'Connect with our team for help!';

    const latestTime = state.messages.length > 0
        ? new Date(state.messages[0].timestamp?.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : '';

    return `
        <button onclick="openSupportChat()" class="w-full bg-white dark:bg-dark-surface border border-gray-100 dark:border-dark-border p-6 rounded-[28px] shadow-sm flex gap-5 items-center hover:shadow-xl transition-all duration-300 active:scale-95 text-left animate-fade-in group">
            <div class="relative flex-shrink-0">
                <div class="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center border-4 border-white dark:border-dark-bg shadow-lg shadow-orange-500/20 font-bold text-white group-hover:scale-105 transition-transform duration-300">
                    <i data-lucide="headset" class="w-8 h-8"></i>
                </div>
                <span class="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 border-4 border-white dark:border-dark-bg rounded-full shadow-sm animate-pulse"></span>
            </div>
            
            <div class="flex-1 min-w-0">
                <div class="flex justify-between items-center mb-1">
                    <h3 class="font-bold text-secondary dark:text-gray-100 text-lg">N-Cafe Support</h3>
                    <span class="text-[10px] text-primary font-bold uppercase tracking-widest bg-primary/10 px-2 py-1 rounded-md">${latestTime || 'ONLINE'}</span>
                </div>
                <p class="text-xs text-green-500 font-bold mb-2 flex items-center gap-1.5">
                    <span class="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                    Speaks English, Sinhala
                </p>
                <p class="text-sm text-gray-500 dark:text-gray-400 line-clamp-1 font-medium italic">"${latestMsg}"</p>
            </div>
            
            <i data-lucide="chevron-right" class="w-6 h-6 text-gray-300 dark:text-gray-600 group-hover:translate-x-1 transition-transform"></i>
        </button>

        <div class="bg-blue-50 dark:bg-blue-900/10 p-5 rounded-2xl border border-blue-100 dark:border-blue-900/20 flex gap-4 items-center">
            <div class="w-10 h-10 bg-white dark:bg-dark-bg rounded-full flex items-center justify-center text-blue-500 shadow-sm flex-shrink-0">
                <i data-lucide="clock" class="w-5 h-5"></i>
            </div>
            <p class="text-xs text-blue-600 dark:text-blue-400 font-bold leading-relaxed">We typically reply within <span class="text-blue-800 dark:text-blue-200">2 minutes</span> during business hours.</p>
        </div>
    `;
}

function renderChatConversation() {
    const user = firebase.auth().currentUser;
    if (!user) {
        state.view = 'auth';
        render();
        return;
    }

    // Sort messages: Oldest first
    const sorted = state.messages.sort((a, b) => (a.timestamp?.seconds || 0) - (b.timestamp?.seconds || 0));

    const div = document.createElement('div');
    div.className = 'h-screen flex flex-col bg-white dark:bg-dark-bg transition-colors duration-300';
    div.innerHTML = `
        <!-- Chat Header -->
        <header class="p-6 flex items-center gap-4 border-b border-gray-50 dark:border-dark-border shadow-sm sticky top-0 bg-white dark:bg-dark-bg z-20">
            <button onclick="goToMessages()" class="w-10 h-10 bg-gray-50 dark:bg-dark-surface rounded-full flex items-center justify-center transition-all text-secondary dark:text-gray-100 active:scale-95">
                <i data-lucide="arrow-left" class="w-5 h-5"></i>
            </button>
            <div class="relative">
                <div class="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center text-white shadow-lg shadow-orange-500/20">
                    <i data-lucide="headset" class="w-6 h-6"></i>
                </div>
                <div class="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-3 border-white dark:border-dark-bg rounded-full"></div>
            </div>
            <div class="flex-1">
                <h3 class="font-bold text-secondary dark:text-gray-100 text-base">N-Cafe Support</h3>
                <div class="flex items-center gap-1.5">
                    <span class="relative flex h-2 w-2">
                        <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span class="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                    <span class="text-[10px] text-green-500 font-bold uppercase tracking-widest">Active Now</span>
                </div>
            </div>
            <button class="w-10 h-10 flex items-center justify-center text-gray-400 hover:bg-gray-50 dark:hover:bg-dark-surface rounded-full">
                <i data-lucide="more-vertical" class="w-5 h-5"></i>
            </button>
        </header>

        <!-- Chat Area -->
        <div id="chat-container" class="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50/30 dark:bg-dark-bg/30">
            <!-- Intro Message -->
            <div class="text-center py-8">
                <span class="text-[10px] items-center gap-1.5 font-bold text-gray-400 dark:text-gray-600 bg-white dark:bg-dark-surface px-4 py-1.5 rounded-full border border-gray-100 dark:border-dark-border shadow-sm uppercase tracking-[0.2em] ml-1.5 italic">Chat Security Enabled</span>
            </div>

            ${sorted.map(msg => {
        const isMe = msg.direction === 'customer_to_staff';
        const time = msg.timestamp
            ? new Date(msg.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : '';

        return `
                    <div class="flex flex-col ${isMe ? 'items-end' : 'items-start'} animate-scale-in">
                        <div class="max-w-[85%] p-4 rounded-3xl text-sm relative shadow-sm transition-all duration-300 ${isMe
                ? 'bg-primary text-white rounded-br-none shadow-orange-500/10'
                : 'bg-white dark:bg-dark-surface text-secondary dark:text-gray-200 border border-gray-100 dark:border-dark-border rounded-bl-none'
            }">
                            ${msg.text}
                        </div>
                        <span class="text-[10px] text-gray-400 dark:text-gray-600 mt-2 px-2 font-bold uppercase tracking-wider">${time}</span>
                    </div>
                `;
    }).join('')}
        </div>

        <!-- Input Area -->
        <form onsubmit="sendChatMessage(event)" class="p-6 bg-white dark:bg-dark-bg border-t border-gray-50 dark:border-dark-border flex items-center gap-4 sticky bottom-0">
            <button type="button" class="w-12 h-12 flex items-center justify-center text-gray-400 hover:text-primary transition-colors bg-gray-50 dark:bg-dark-surface rounded-2xl border border-gray-100 dark:border-dark-border">
                <i data-lucide="plus" class="w-6 h-6"></i>
            </button>
            <div class="flex-1 bg-gray-50 dark:bg-dark-surface rounded-2xl flex items-center px-4 py-2 border border-gray-100 dark:border-dark-border focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary transition-all">
                <input type="text" name="message" placeholder="Type a message..." required autocomplete="off"
                    class="flex-1 bg-transparent border-none outline-none text-sm h-10 text-secondary dark:text-gray-100 placeholder:text-gray-400">
            </div>
            <button type="submit" class="w-14 h-14 bg-primary text-white rounded-2xl flex items-center justify-center shadow-xl shadow-orange-500/30 active:scale-90 transition-all hover:bg-orange-600">
                <i data-lucide="send" class="w-6 h-6"></i>
            </button>
        </form>
    `;
    app.appendChild(div);
}

async function sendChatMessage(e) {
    e.preventDefault();
    const form = e.target;
    const text = form.message.value.trim();
    if (!text) return;

    // Optimistic UI update could go here, but we rely on listener for now
    form.reset();

    const user = firebase.auth().currentUser;
    if (!user) return;

    try {
        const batch = db.batch();

        // 1. Add Message
        const msgRef = db.collection('messages').doc();
        batch.set(msgRef, {
            text: text,
            customerId: user.uid,
            senderId: user.uid,
            direction: 'customer_to_staff',
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            read: false
        });

        // 2. Update/Create Chat Metadata for Staff Inbox
        // Use user.email or a guest ID as name
        const displayName = state.user?.name || (state.user?.email ? state.user.email.split('@')[0] : 'Guest');

        const chatRef = db.collection('chats').doc(user.uid);
        batch.set(chatRef, {
            customerId: user.uid,
            customerName: displayName,
            lastMessage: text,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            unreadCount: firebase.firestore.FieldValue.increment(1)
        }, { merge: true });

        await batch.commit();
        console.log('✅ Message sent');
    } catch (err) {
        console.error('Send error:', err);
        showToast("Message Error", "Failed to send your message. Please check your connection.", "error");
    }
}

function scrollToBottom() {
    setTimeout(() => {
        const container = document.getElementById('chat-container');
        if (container) container.scrollTop = container.scrollHeight;
    }, 100);
}


function initChatListener() {
    const user = firebase.auth().currentUser;
    // ... rest of initChatListener logic is preserved if already correct or can range extend
    if (!user) return;


    db.collection('messages')
        .where('customerId', '==', user.uid)
        // .orderBy('timestamp', 'asc') // Firestore requires composite index
        .onSnapshot(snapshot => {
            state.messages = [];
            snapshot.forEach(doc => {
                state.messages.push({ id: doc.id, ...doc.data() });
            });
            // Client-side sort
            state.messages.sort((a, b) => {
                const ta = a.timestamp?.seconds || 0;
                const tb = b.timestamp?.seconds || 0;
                return ta - tb;
            });

            if (state.view === 'messages' && state.activeMsgTab === 'chat') {
                // If we were using the old tab logic, this check might fail. 
                // With new logic, 'messages' view is the list, 'chat-conversation' is the chat.
                // But initChatListener is mainly for the Chat Conversation now.
            }
            if (state.view === 'chat-conversation') {
                render();
                scrollToBottom();
            } else if (state.view === 'messages') {
                render(); // To update the preview text
            }
        });
}

function renderChatView() {
    const user = firebase.auth().currentUser;
    if (!user) {
        return `
            <div class="text-center py-12">
                <p class="text-gray-500 dark:text-gray-400 mb-4">Please login to chat with support.</p>
                <button onclick="goToAuth()" class="bg-primary text-white px-6 py-2 rounded-xl font-bold active:scale-95 transition-all shadow-lg shadow-orange-500/20">Login</button>
            </div>
        `;
    }

    // Sort messages just in case
    const sorted = state.messages.sort((a, b) => (a.timestamp?.seconds || 0) - (b.timestamp?.seconds || 0));

    return `
        <div class="flex flex-col h-[calc(100vh-180px)]">
            <!-- Messages Area -->
            <div id="chat-container" class="flex-1 overflow-y-auto p-4 space-y-4">
                ${sorted.length === 0 ? `
                    <div class="text-center text-gray-400 dark:text-gray-600 text-xs mt-10">
                        <div class="w-16 h-16 bg-gray-100 dark:bg-dark-surface rounded-full flex items-center justify-center mx-auto mb-4 scale-110">
                            <i data-lucide="message-square" class="w-8 h-8 opacity-40"></i>
                        </div>
                        <p class="font-bold">Start a conversation with us!</p>
                        <p>We usually reply within minutes.</p>
                    </div>
                ` : sorted.map(msg => {
        const isMe = msg.direction === 'customer_to_staff';
        return `
                        <div class="flex ${isMe ? 'justify-end' : 'justify-start'}">
                            <div class="max-w-[80%] p-4 rounded-2xl text-sm shadow-sm transition-all ${isMe ? 'bg-primary text-white rounded-tr-none' : 'bg-gray-100 dark:bg-dark-surface text-secondary dark:text-gray-200 rounded-tl-none border border-gray-100 dark:border-dark-border'}">
                                ${msg.text}
                            </div>
                        </div>
                    `;
    }).join('')}
            </div>
            
            <!-- Input Area -->
            <form onsubmit="sendChatMessage(event)" class="mt-auto px-4 py-4 border-t border-gray-100 dark:border-dark-border flex gap-2 bg-white dark:bg-dark-bg sticky bottom-0">
                <input type="text" name="message" placeholder="Type a message..." required autocomplete="off"
                    class="flex-1 bg-gray-100 dark:bg-dark-surface rounded-2xl px-5 py-4 outline-none focus:ring-2 focus:ring-primary/20 text-sm text-secondary dark:text-gray-100 border border-transparent focus:border-primary transition-all">
                <button type="submit" class="w-14 h-14 bg-secondary dark:bg-primary text-white rounded-2xl flex items-center justify-center hover:shadow-xl transition-all active:scale-90 flex-shrink-0">
                    <i data-lucide="send" class="w-6 h-6"></i>
                </button>
            </form>
        </div>
    `;
}

async function sendChatMessage(e) {
    e.preventDefault();
    const form = e.target;
    const text = form.message.value.trim();
    if (!text) return;

    // Optimistic UI update could go here, but we rely on listener for now
    form.reset();

    const user = firebase.auth().currentUser;
    if (!user) return;

    try {
        const batch = db.batch();

        // 1. Add Message
        const msgRef = db.collection('messages').doc();
        batch.set(msgRef, {
            text: text,
            customerId: user.uid,
            senderId: user.uid,
            direction: 'customer_to_staff',
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            read: false
        });

        // 2. Update/Create Chat Metadata for Staff Inbox
        // Use user.email or a guest ID as name
        const displayName = state.user?.name || (state.user?.email ? state.user.email.split('@')[0] : 'Guest');

        const chatRef = db.collection('chats').doc(user.uid);
        batch.set(chatRef, {
            customerId: user.uid,
            customerName: displayName,
            lastMessage: text,
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            unreadCount: firebase.firestore.FieldValue.increment(1)
        }, { merge: true });

        await batch.commit();
        console.log('✅ Message sent');
    } catch (err) {
        console.error('Send error:', err);
        showToast("Message Error", "Failed to send your message. Please check your connection.", "error");
    }
}

function scrollToBottom() {
    setTimeout(() => {
        const container = document.getElementById('chat-container');
        if (container) container.scrollTop = container.scrollHeight;
    }, 100);
}


function placeOrder() {
    // 1. Check Store Status
    if (!window.systemSettings.isStoreOpen) {
        showToast('Store Closed', 'Sorry, we are not accepting new orders right now 🛑', 'error');
        return;
    }

    // 2. Check if user is logged in before proceeding to payment
    if (!state.user) {
        // Guest user - redirect to login/auth page
        showToast('Auth Required', 'Please log in to place your order 🔒', 'error');
        state.view = 'auth';
        state.authMode = 'login';
        render();
        return;
    }

    // Logged in user - proceed to payment
    state.view = 'payment';
    render();
}



function backToCheckout() {
    state.view = 'checkout';
    render();
}

function selectPayment(method) {
    state.paymentMethod = method;
    render();
}

async function processPayment() {
    // Final Store Status Check
    if (!window.systemSettings.isStoreOpen) {
        showToast('Store Closed', 'The store just closed. We cannot process this order 🛑', 'error');
        state.view = 'home';
        render();
        return;
    }

    const orderId = 'ORD' + Date.now();
    const subtotal = state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const tax = subtotal * (window.systemSettings.taxRate / 100);
    const total = subtotal + tax;

    const order = {
        id: orderId,
        items: state.cart,
        subtotal: subtotal,
        tax: tax,
        total: total,
        instructions: state.specialInstructions || '',
        status: 'preparing',
        date: new Date().toISOString(),
        user: {
            id: state.studentId || 'Guest',
            name: (state.user && state.user.name) || 'Guest',
            email: (state.user && state.user.email) || '',
            phone: (state.user && state.user.phone) || '',
            paymentMethod: state.paymentMethod
        }
    };

    console.log('🛒 Creating order:', orderId);
    console.log('👤 Student ID:', state.studentId);
    console.log('👤 User Email:', state.user?.email);
    console.log('💳 Payment:', state.paymentMethod);
    console.log('📦 Order object:', JSON.stringify(order, null, 2));

    try {
        if (state.paymentMethod === 'wallet') {
            // --- WALLET PAYMENT: Atomic batch ---
            if (state.walletBalance < total) {
                const shortfall = (total - state.walletBalance).toFixed(2);
                showToast("Insufficient Balance", `You need LKR ${shortfall} more. Please top up your wallet.`, "error");
                return;
            }
            const newBalance = state.walletBalance - total;
            const batch = db.batch();
            const orderRef = db.collection('orders').doc(orderId);
            const walletRef = db.collection('wallets').doc(state.user.uid);
            const txnRef = db.collection('wallet_transactions').doc();

            batch.set(orderRef, order);
            batch.set(walletRef, { balance: newBalance, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
            batch.set(txnRef, {
                userId: state.user.uid,
                type: 'debit',
                amount: total,
                method: 'order_payment',
                ref: orderId,
                balance_after: newBalance,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            await batch.commit();
            state.walletBalance = newBalance;
        } else {
            await db.collection('orders').doc(orderId).set(order);
        }

        state.orderId = orderId;
        state.lastOrder = order;

        // Clear cart after successful order
        state.cart = [];
        saveCart();
        state.specialInstructions = '';

        state.view = 'receipt';
        setupOrderTracking(orderId);
        render();
    } catch (error) {
        showToast("Order Failed", "We couldn't place your order. Please try again.", "error");
    }
}

function trackOrder() {
    state.view = 'home';
    render();
}

function newOrder() {
    clearTracking();
    state.cart = [];
    state.view = 'home';
    render();
}

// ==============================================
// AUTHENTICATION & PROFILE
// ==============================================

function goToAuth() {
    state.view = 'auth';
    state.authMode = 'login';
    render();
}

function goToProfile() {
    if (!state.user) {
        goToAuth();
        return;
    }
    state.view = 'profile';
    render();
}

function switchAuthMode(mode) {
    state.authMode = mode;
    render();
}

function renderAuth() {
    const div = document.createElement('div');
    div.className = 'min-h-screen bg-white dark:bg-dark-bg flex flex-col p-8 pb-24 transition-colors duration-300';
    div.innerHTML = `
        <!-- Header -->
        <div class="text-center mb-8 mt-4">
            <h1 class="text-2xl font-bold text-secondary dark:text-gray-100 mb-6">${state.authMode === 'login' ? 'Welcome Back' : 'Create Account'}</h1>
        </div>

        <!-- Tabs -->
        <div class="flex gap-2 mb-8 bg-gray-100 dark:bg-dark-surface p-1 rounded-2xl">
            <button onclick="switchAuthMode('login')" 
                class="flex-1 py-3 rounded-xl font-bold text-sm transition-all duration-300 ${state.authMode === 'login' ? 'bg-white dark:bg-dark-bg shadow-sm text-primary' : 'text-gray-500 dark:text-gray-400'}">
                Login
            </button>
            <button onclick="switchAuthMode('register')" 
                class="flex-1 py-3 rounded-xl font-bold text-sm transition-all duration-300 ${state.authMode === 'register' ? 'bg-white dark:bg-dark-bg shadow-sm text-primary' : 'text-gray-500 dark:text-gray-400'}">
                Register
            </button>
        </div>

        ${state.authMode === 'login' ? `
            <!-- Login Form -->
            <form onsubmit="handleLogin(event)" class="space-y-4">
                <!-- Email -->
                <div class="relative">
                    <label class="text-xs text-secondary dark:text-gray-300 font-bold mb-2 block ml-1 uppercase tracking-wider">Email Address</label>
                    <div class="flex items-center bg-gray-50 dark:bg-dark-surface rounded-2xl border border-gray-200 dark:border-dark-border px-4 py-4 transition-all focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary">
                        <i data-lucide="mail" class="w-5 h-5 text-gray-400 mr-3"></i>
                        <input type="email" name="email" placeholder="Enter your email" required
                            class="flex-1 bg-transparent outline-none text-base text-secondary dark:text-gray-100 placeholder:text-gray-400">
                    </div>
                </div>

                <!-- Password -->
                <div class="relative">
                    <label class="text-xs text-secondary dark:text-gray-300 font-bold mb-2 block ml-1 uppercase tracking-wider">Password</label>
                    <div class="flex items-center bg-gray-50 dark:bg-dark-surface rounded-2xl border border-gray-200 dark:border-dark-border px-4 py-4 transition-all focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary">
                        <i data-lucide="lock" class="w-5 h-5 text-gray-400 mr-3"></i>
                        <input type="password" id="login-password" name="password" placeholder="Enter your password" required
                            class="flex-1 bg-transparent outline-none text-base text-secondary dark:text-gray-100 placeholder:text-gray-400">
                        <button type="button" onclick="togglePassword('login-password')" class="ml-2 text-gray-400">
                            <i data-lucide="eye" class="w-5 h-5"></i>
                        </button>
                    </div>
                </div>

                <!-- Remember & Forgot -->
                <div class="flex justify-between items-center text-sm py-2">
                    <label class="flex items-center gap-2 cursor-pointer group">
                        <input type="checkbox" name="remember" class="w-5 h-5 text-primary border-gray-300 rounded-lg focus:ring-primary dark:bg-dark-bg">
                        <span class="text-gray-600 dark:text-gray-400 font-medium group-hover:text-secondary dark:group-hover:text-gray-200 transition-colors">Remember me</span>
                    </label>
                    <button type="button" onclick="forgotPassword()" class="text-primary font-bold hover:underline">
                        Forgot password?
                    </button>
                </div>

                <!-- Login Button -->
                <button type="submit" class="w-full bg-primary text-white py-4 rounded-2xl font-bold text-lg shadow-xl shadow-orange-500/20 active:scale-95 transition-all mt-6">
                    Sign In
                </button>

                <!-- Divider -->
                <div class="flex items-center gap-4 my-8">
                    <div class="flex-1 h-px bg-gray-200 dark:bg-dark-border"></div>
                    <span class="text-xs text-gray-400 font-bold uppercase tracking-widest">Or continue with</span>
                    <div class="flex-1 h-px bg-gray-200 dark:bg-dark-border"></div>
                </div>

                <!-- Social Login -->
                <div class="grid grid-cols-2 gap-4">
                    <button type="button" onclick="loginWithFacebook()" class="flex items-center justify-center gap-2 bg-[#1877F2] text-white py-3.5 rounded-2xl font-bold text-sm active:scale-95 transition-transform">
                        <i data-lucide="facebook" class="w-5 h-5 fill-current"></i>
                        Facebook
                    </button>
                    <button type="button" onclick="loginWithGoogle()" class="flex items-center justify-center gap-2 bg-gray-50 dark:bg-dark-surface text-gray-700 dark:text-gray-200 py-3.5 rounded-2xl font-bold text-sm border border-gray-200 dark:border-dark-border active:scale-95 transition-transform hover:bg-white dark:hover:bg-dark-border">
                        <svg class="w-5 h-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                        Google
                    </button>
                </div>
            </form>
        ` : `
            <!-- Register Form -->
            <form onsubmit="handleRegister(event)" class="space-y-4">
                <!-- Name -->
                <div class="relative">
                    <label class="text-xs text-secondary dark:text-gray-300 font-bold mb-2 block ml-1 uppercase tracking-wider">Full Name</label>
                    <div class="flex items-center bg-gray-50 dark:bg-dark-surface rounded-2xl border border-gray-200 dark:border-dark-border px-4 py-4 transition-all focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary">
                        <i data-lucide="user" class="w-5 h-5 text-gray-400 mr-3"></i>
                        <input type="text" name="name" placeholder="Enter your full name" required
                            class="flex-1 bg-transparent outline-none text-base text-secondary dark:text-gray-100 placeholder:text-gray-400">
                    </div>
                </div>

                <!-- Email -->
                <div class="relative">
                    <label class="text-xs text-secondary dark:text-gray-300 font-bold mb-2 block ml-1 uppercase tracking-wider">Email Address</label>
                    <div class="flex items-center bg-gray-50 dark:bg-dark-surface rounded-2xl border border-gray-200 dark:border-dark-border px-4 py-4 transition-all focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary">
                        <i data-lucide="mail" class="w-5 h-5 text-gray-400 mr-3"></i>
                        <input type="email" name="email" placeholder="Enter your email" required
                            class="flex-1 bg-transparent outline-none text-base text-secondary dark:text-gray-100 placeholder:text-gray-400">
                    </div>
                </div>

                <!-- Phone Number -->
                <div class="relative">
                    <label class="text-xs text-secondary dark:text-gray-300 font-bold mb-2 block ml-1 uppercase tracking-wider">Phone Number</label>
                    <div class="flex items-center bg-gray-50 dark:bg-dark-surface rounded-2xl border border-gray-200 dark:border-dark-border px-4 py-4 transition-all focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary">
                        <i data-lucide="phone" class="w-5 h-5 text-gray-400 mr-3"></i>
                        <input type="tel" name="phone" placeholder="077XXXXXXX" required
                            class="flex-1 bg-transparent outline-none text-base text-secondary dark:text-gray-100 placeholder:text-gray-400">
                    </div>
                </div>

                <!-- Password -->
                <div class="relative">
                    <label class="text-xs text-gray-400 mb-1 block">Password</label>
                    <div class="flex items-center bg-gray-50 rounded-xl border border-gray-200 px-4 py-3">
                        <i data-lucide="lock" class="w-5 h-5 text-gray-400 mr-3"></i>
                        <input type="password" id="register-password" name="password" placeholder="Create a password" required
                            class="flex-1 bg-transparent outline-none text-sm">
                        <button type="button" onclick="togglePassword('register-password')" class="ml-2">
                            <i data-lucide="eye" class="w-5 h-5 text-gray-400"></i>
                        </button>
                    </div>
                </div>

                <!-- Register Button -->
                <button type="submit" class="w-full bg-primary text-white py-4 rounded-xl font-bold shadow-lg active:scale-95 transition mt-6">
                    Create Account
                </button>

                <p class="text-xs text-gray-400 text-center mt-4">
                    By registering, you agree to our Terms &amp; Privacy Policy
                </p>
            </form>
        `}

        <!-- Back to Home -->
        <button onclick="goHome()" class="mt-8 text-gray-400 text-sm font-bold text-center w-full">
            ← Back to Home
        </button>
    `;
    app.appendChild(div);
}

function renderProfile() {
    const div = document.createElement('div');
    div.className = 'min-h-screen bg-white dark:bg-dark-bg flex flex-col transition-colors duration-300';
    div.innerHTML = `
        <!-- Profile Header -->
        <div class="bg-white dark:bg-dark-surface p-8 text-center border-b border-gray-100 dark:border-dark-border transition-colors duration-300">
            <div class="w-28 h-28 mx-auto mb-4 rounded-full overflow-hidden border-4 border-primary shadow-xl">
                ${state.user?.photo ? `
                    <img src="${state.user.photo}" class="w-full h-full object-cover">
                ` : `
                    <div class="w-full h-full bg-primary flex items-center justify-center text-white text-4xl font-bold">
                        ${state.user?.name ? state.user.name[0].toUpperCase() : 'U'}
                    </div>
                `}
            </div>
            <h2 class="text-2xl font-bold text-secondary dark:text-gray-100 mb-1">${state.user?.name || 'Guest User'}</h2>
            <p class="text-sm text-gray-400 dark:text-gray-500 font-medium">${state.user?.email || 'No email'}</p>
        </div>

        <!-- Menu Options -->
        <div class="p-6 space-y-4 pb-28">
            <button onclick="editProfile()" class="w-full bg-gray-50 dark:bg-dark-surface p-4 rounded-2xl flex items-center justify-between hover:bg-gray-100 dark:hover:bg-dark-border transition-all active:scale-[0.98] border border-gray-100 dark:border-dark-border shadow-sm">
                <div class="flex items-center gap-4">
                    <div class="w-12 h-12 bg-white dark:bg-dark-bg rounded-xl flex items-center justify-center shadow-sm">
                        <i data-lucide="user" class="w-6 h-6 text-primary"></i>
                    </div>
                    <span class="font-bold text-secondary dark:text-gray-100">Personal Information</span>
                </div>
                <i data-lucide="chevron-right" class="w-5 h-5 text-gray-300 dark:text-gray-600"></i>
            </button>

            <button onclick="viewMyOrders()" class="w-full bg-gray-50 dark:bg-dark-surface p-4 rounded-2xl flex items-center justify-between hover:bg-gray-100 dark:hover:bg-dark-border transition-all active:scale-[0.98] border border-gray-100 dark:border-dark-border shadow-sm">
                <div class="flex items-center gap-4">
                    <div class="w-12 h-12 bg-white dark:bg-dark-bg rounded-xl flex items-center justify-center shadow-sm">
                        <i data-lucide="shopping-bag" class="w-6 h-6 text-primary"></i>
                    </div>
                    <span class="font-bold text-secondary dark:text-gray-100">My Orders</span>
                </div>
                <i data-lucide="chevron-right" class="w-5 h-5 text-gray-300 dark:text-gray-600"></i>
            </button>

            <!-- N-Cafe Wallet Card -->
            <div class="bg-gradient-to-br from-orange-500 to-orange-600 p-6 rounded-3xl shadow-2xl shadow-orange-500/30 text-white mb-2">
                <div class="flex items-center justify-between mb-4">
                    <div>
                        <p class="text-[10px] font-black uppercase tracking-[0.2em] text-orange-200">N-Cafe Wallet</p>
                        <p class="text-3xl font-black mt-1">
                            ${state.walletLoading ? '<span class="text-xl opacity-70">Loading...</span>' : `LKR ${state.walletBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                        </p>
                    </div>
                    <div class="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                        <i data-lucide="wallet" class="w-8 h-8"></i>
                    </div>
                </div>
                <!-- Redeem Form -->
                <div class="bg-white/15 backdrop-blur-sm rounded-2xl p-4 mt-2">
                    <p class="text-[10px] font-black uppercase tracking-widest text-orange-100 mb-2">Reload with Prepaid Card</p>
                    <div class="flex gap-2">
                        <input type="text" id="redeem-code-input" placeholder="NCAFE-XXXX-XXXX"
                               class="flex-1 bg-white/20 text-white placeholder-orange-200 font-black tracking-widest text-xs rounded-xl px-4 py-3 outline-none focus:bg-white/30 transition-all uppercase"
                               maxlength="15" oninput="this.value = this.value.toUpperCase()" />
                        <button onclick="redeemPrepaidCard()" class="px-5 py-3 bg-white text-primary rounded-xl font-black text-xs active:scale-95 transition-all shadow-lg whitespace-nowrap">
                            Redeem
                        </button>
                    </div>
                </div>
            </div>
            <button onclick="toggleDarkMode()" class="w-full bg-gray-50 dark:bg-dark-surface p-4 rounded-2xl flex items-center justify-between hover:bg-gray-100 dark:hover:bg-dark-border transition-all active:scale-[0.98] border border-gray-100 dark:border-dark-border shadow-sm">
                <div class="flex items-center gap-4">
                    <div class="w-12 h-12 bg-white dark:bg-dark-bg rounded-xl flex items-center justify-center shadow-sm">
                        <i data-lucide="${state.isDarkMode ? 'sun' : 'moon'}" class="w-6 h-6 text-primary"></i>
                    </div>
                    <div>
                        <span class="font-bold text-secondary dark:text-gray-100 block">Dark Mode</span>
                        <span class="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-widest">${state.isDarkMode ? 'ON' : 'OFF'}</span>
                    </div>
                </div>
                <div class="w-12 h-6 bg-gray-200 dark:bg-gray-700 rounded-full relative transition-colors">
                    <div class="absolute top-1 ${state.isDarkMode ? 'left-7 bg-primary' : 'left-1 bg-white'} w-4 h-4 rounded-full transition-all shadow-sm"></div>
                </div>
            </button>

            <button onclick="handleLogout()" class="w-full bg-red-50 dark:bg-red-900/10 p-4 rounded-2xl flex items-center justify-between hover:bg-red-100 dark:hover:bg-red-900/20 transition-all active:scale-[0.98] border border-red-100 dark:border-red-900/20 mt-8 shadow-sm">
                <div class="flex items-center gap-4">
                    <div class="w-12 h-12 bg-white dark:bg-dark-bg rounded-xl flex items-center justify-center shadow-sm">
                        <i data-lucide="log-out" class="w-6 h-6 text-red-500"></i>
                    </div>
                    <span class="font-bold text-red-500">Logout</span>
                </div>
            </button>
        </div>
    `;
    app.appendChild(div);
}

function renderProfileEdit() {
    const div = document.createElement('div');
    div.className = 'min-h-screen bg-white dark:bg-dark-bg flex flex-col transition-colors duration-300';
    div.innerHTML = `
        <!-- Header -->
        <header class="sticky top-0 bg-white dark:bg-dark-bg border-b border-gray-100 dark:border-dark-border p-6 flex items-center gap-4 z-20">
            <button onclick="goToProfile()" class="w-10 h-10 bg-gray-50 dark:bg-dark-surface rounded-full flex items-center justify-center active:scale-95 transition-all text-secondary dark:text-gray-100">
                <i data-lucide="arrow-left" class="w-5 h-5"></i>
            </button>
            <h1 class="text-lg font-bold text-secondary dark:text-gray-100">Personal Information</h1>
        </header>

        <!-- Profile Photo -->
        <div class="p-8 text-center border-b border-gray-100 dark:border-dark-border bg-gray-50/50 dark:bg-dark-surface/30">
            <div class="relative w-28 h-28 mx-auto mb-4">
                <div class="w-28 h-28 rounded-full overflow-hidden border-4 border-white dark:border-dark-border shadow-xl">
                    <img id="profile-photo-preview"
                         src="${state.user?.photo || ''}"
                         class="w-full h-full object-cover ${state.user?.photo ? '' : 'hidden'}">
                    ${!state.user?.photo ? `
                        <div id="profile-photo-initial" class="w-full h-full bg-primary flex items-center justify-center text-white text-4xl font-bold">
                            ${state.user?.name ? state.user.name[0].toUpperCase() : 'U'}
                        </div>
                    ` : `<div id="profile-photo-initial" class="w-full h-full bg-primary hidden items-center justify-center text-white text-4xl font-bold">${state.user?.name ? state.user.name[0].toUpperCase() : 'U'}</div>`}
                </div>
                <!-- Camera overlay tap target -->
                <button type="button" onclick="changePhoto()" class="absolute inset-0 rounded-full flex items-end justify-center pb-1 bg-black/0 hover:bg-black/20 transition-all group">
                    <span class="bg-black/60 text-white text-[10px] font-black px-3 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-all mb-1">Edit</span>
                </button>
                <button type="button" onclick="changePhoto()" class="absolute -bottom-1 -right-1 w-9 h-9 bg-primary text-white rounded-full flex items-center justify-center shadow-lg shadow-orange-500/30 active:scale-95 transition-all border-2 border-white dark:border-dark-bg">
                    <i data-lucide="camera" class="w-4 h-4"></i>
                </button>
                <!-- Hidden file input -->
                <input type="file" id="photo-file-input" accept="image/*" class="hidden" onchange="handlePhotoSelected(this)">
            </div>
            <p class="text-xs text-gray-400 font-medium">Tap the camera icon to change your photo</p>
        </div>

        <!-- Edit Form -->
        <form onsubmit="saveProfile(event)" class="p-6 pb-32 space-y-6 flex-1">
            <!-- Name -->
            <div class="space-y-2">
                <label class="text-xs text-secondary dark:text-gray-300 font-bold ml-1 uppercase tracking-wider">Name</label>
                <div class="flex items-center bg-gray-50 dark:bg-dark-surface rounded-2xl border border-gray-100 dark:border-dark-border px-4 py-4 transition-all focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary">
                    <input type="text" name="name" value="${state.user?.name || ''}" required
                        class="w-full bg-transparent outline-none text-secondary dark:text-gray-100 text-base font-medium">
                </div>
            </div>

            <!-- Email & Phone -->
            <div class="grid grid-cols-1 gap-6">
                <div class="space-y-2">
                    <label class="text-xs text-secondary dark:text-gray-300 font-bold ml-1 uppercase tracking-wider">Email Address</label>
                    <div class="flex items-center bg-gray-50 dark:bg-dark-surface rounded-2xl border border-gray-100 dark:border-dark-border px-4 py-4 transition-all focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary">
                        <input type="email" name="email" value="${state.user?.email || ''}" required
                            class="w-full bg-transparent outline-none text-secondary dark:text-gray-100 text-base font-medium">
                    </div>
                </div>
                <div class="space-y-2">
                    <label class="text-xs text-secondary dark:text-gray-300 font-bold ml-1 uppercase tracking-wider">Phone Number</label>
                    <div class="flex items-center bg-gray-50 dark:bg-dark-surface rounded-2xl border border-gray-100 dark:border-dark-border px-4 py-4 transition-all focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary">
                        <input type="tel" name="phone" value="${state.user?.phone || '+880'}" required
                            class="w-full bg-transparent outline-none text-secondary dark:text-gray-100 text-base font-medium">
                    </div>
                </div>
            </div>

            <!-- Password Change Section -->
            <div class="pt-4 border-t border-gray-100 dark:border-dark-border space-y-6">
                <div class="flex items-center gap-2">
                    <i data-lucide="shield-check" class="w-5 h-5 text-primary"></i>
                    <h3 class="text-xs font-black text-secondary dark:text-gray-100 uppercase tracking-widest">Security & Password</h3>
                </div>
                
                <p class="text-[10px] text-gray-400 font-bold leading-relaxed">Leave password fields blank if you don't want to change it.</p>

                <div class="space-y-2">
                    <label class="text-xs text-secondary dark:text-gray-300 font-bold ml-1 uppercase tracking-wider">Current Password</label>
                    <div class="flex items-center bg-gray-50 dark:bg-dark-surface rounded-2xl border border-gray-100 dark:border-dark-border px-4 py-4 transition-all focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary">
                        <input type="password" name="currentPassword" placeholder="Required for security"
                            class="w-full bg-transparent outline-none text-secondary dark:text-gray-100 text-base font-medium">
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="space-y-2">
                        <label class="text-xs text-secondary dark:text-gray-300 font-bold ml-1 uppercase tracking-wider">New Password</label>
                        <div class="flex items-center bg-gray-50 dark:bg-dark-surface rounded-2xl border border-gray-100 dark:border-dark-border px-4 py-4 transition-all focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary">
                            <input type="password" name="newPassword" placeholder="At least 6 chars"
                                class="w-full bg-transparent outline-none text-secondary dark:text-gray-100 text-base font-medium">
                        </div>
                    </div>
                    <div class="space-y-2">
                        <label class="text-xs text-secondary dark:text-gray-300 font-bold ml-1 uppercase tracking-wider">Confirm Password</label>
                        <div class="flex items-center bg-gray-50 dark:bg-dark-surface rounded-2xl border border-gray-100 dark:border-dark-border px-4 py-4 transition-all focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary">
                            <input type="password" name="confirmPassword" placeholder="Repeat new password"
                                class="w-full bg-transparent outline-none text-secondary dark:text-gray-100 text-base font-medium">
                        </div>
                    </div>
                </div>
            </div>

            <!-- Save Button -->
            <button type="submit" class="w-full bg-primary text-white py-5 rounded-2xl font-bold text-lg shadow-xl shadow-orange-500/20 active:scale-95 transition-all mt-8">
                Save Changes
            </button>
        </form>
    `;
    app.appendChild(div);
}

function renderMyOrders() {
    const div = document.createElement('div');
    div.className = 'min-h-screen bg-gray-50 dark:bg-dark-bg flex flex-col pb-24 transition-colors duration-300';
    div.innerHTML = `
        <!-- Header -->
        <header class="sticky top-0 bg-white dark:bg-dark-bg border-b border-gray-100 dark:border-dark-border p-6 flex items-center justify-between gap-4 z-20 transition-colors duration-300">
            <h1 class="text-2xl font-bold text-secondary dark:text-gray-100">My Orders</h1>
            <button onclick="goHome()" class="w-10 h-10 bg-gray-50 dark:bg-dark-surface rounded-full flex items-center justify-center text-gray-400 dark:text-gray-500 hover:text-primary transition-all active:scale-90">
                <i data-lucide="home" class="w-5 h-5"></i>
            </button>
        </header>

        <!-- Orders List Container -->
        <div id="orders-container" class="p-6 space-y-4">
            <!-- Loading state -->
            <div class="flex items-center justify-center py-12">
                <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        </div>
    `;
    app.appendChild(div);

    // Fetch user's orders from Firebase (re-renders automatically on sync)
    if (state.user) {
        console.log('🔍 Fetching orders for user:', state.user.email);

        db.collection('orders')
            .where('user.id', '==', state.user.email)
            .limit(200)
            .get()
            .then(snapshot => {
                console.log('📦 Orders fetched:', snapshot.size, 'orders found');
                const ordersContainer = document.getElementById('orders-container');
                if (snapshot.empty) {
                    ordersContainer.innerHTML = `
                        <div class="flex flex-col items-center justify-center py-12 text-center">
                            <div class="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                                <i data-lucide="shopping-bag" class="w-12 h-12 text-gray-400"></i>
                            </div>
                            <h3 class="font-bold text-lg text-secondary mb-2">No Orders Yet</h3>
                            <p class="text-gray-400 text-sm mb-6">You haven't placed any orders yet.</p>
                            <button onclick="goHome()" class="bg-primary text-white px-6 py-3 rounded-xl font-bold active:scale-95 transition">
                                Browse Menu
                            </button>
                        </div>
                    `;
                    lucide.createIcons();
                    return;
                }

                const orders = [];
                snapshot.forEach(doc => {
                    orders.push({ id: doc.id, ...doc.data() });
                });

                // Sort by date in descending order (newest first)
                orders.sort((a, b) => {
                    const dateA = new Date(a.date);
                    const dateB = new Date(b.date);
                    return dateB - dateA;
                });

                // Save to state for viewBill lookup
                state.orders = orders;

                ordersContainer.innerHTML = orders.map(order => {
                    const orderDate = new Date(order.date);
                    const formattedDate = orderDate.toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                    });
                    const formattedTime = orderDate.toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit'
                    });

                    const statusColors = {
                        'preparing': 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400',
                        'ready': 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400',
                        'completed': 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400',
                        'cancelled': 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                    };

                    const statusIcons = {
                        'preparing': 'chef-hat',
                        'ready': 'bell-ring',
                        'completed': 'check-circle',
                        'cancelled': 'x-circle'
                    };

                    const status = order.status || 'preparing';
                    const statusClass = statusColors[status] || 'bg-gray-100 dark:bg-dark-surface text-gray-700 dark:text-gray-300';
                    const statusIcon = statusIcons[status] || 'circle';

                    return `
                        <div class="bg-white dark:bg-dark-surface rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-dark-border hover:shadow-md transition duration-300">
                            <!-- Order Header (Mobile Optimized) -->
                            <div class="flex justify-between items-start mb-2">
                                <span class="font-bold text-secondary dark:text-gray-100 text-sm">#${order.id}</span>
                                <span class="text-xl font-bold text-primary whitespace-nowrap">LKR ${order.total}</span>
                            </div>
                            
                            <div class="flex justify-between items-center mb-5">
                                <span class="text-xs text-gray-400 dark:text-gray-500 font-medium">${formattedDate} • ${formattedTime}</span>
                                <span class="${statusClass} text-[10px] px-3 py-1.5 rounded-full font-bold flex items-center gap-1.5 uppercase tracking-wider">
                                    <i data-lucide="${statusIcon}" class="w-3.5 h-3.5"></i>
                                    ${status}
                                </span>
                            </div>

                            <!-- Order Items -->
                            <div class="space-y-2.5 pt-4 border-t border-gray-100 dark:border-dark-border">
                                ${order.items.map(item => `
                                    <div class="flex items-center gap-3">
                                        <div class="w-12 h-12 rounded-xl overflow-hidden bg-gray-100 dark:bg-dark-bg flex-shrink-0">
                                            ${item.image ? `<img src="${item.image}" class="w-full h-full object-cover">` : ''}
                                        </div>
                                        <div class="flex-1 min-w-0">
                                            <p class="font-bold text-sm text-secondary dark:text-gray-100 truncate">${item.name}</p>
                                            <p class="text-xs text-gray-400 dark:text-gray-500 font-medium">LKR ${item.price} × ${item.quantity}</p>
                                        </div>
                                        <span class="font-bold text-sm text-secondary dark:text-gray-100">LKR ${item.price * item.quantity}</span>
                                    </div>
                                `).join('')}
                            </div>

                            <!-- Payment Method -->
                            ${order.user?.paymentMethod ? `
                                <div class="mt-5 pt-4 border-t border-gray-100 dark:border-dark-border flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500 font-medium">
                                    <i data-lucide="credit-card" class="w-4 h-4"></i>
                                    <span>Paid via ${order.user.paymentMethod === 'visa' ? 'Visa/Mastercard' : order.user.paymentMethod.charAt(0).toUpperCase() + order.user.paymentMethod.slice(1)}</span>
                                </div>
                            ` : ''}

                            <!-- Actions -->
                            <div class="flex gap-3 mt-5">
                                <button onclick="viewBill('${order.id}')" class="flex-1 bg-white dark:bg-dark-bg border border-gray-200 dark:border-dark-border text-secondary dark:text-gray-100 py-3.5 rounded-xl font-bold text-sm active:scale-95 transition-all hover:bg-gray-50 dark:hover:bg-dark-surface flex items-center justify-center gap-2">
                                    <i data-lucide="receipt" class="w-4 h-4 text-gray-400 dark:text-gray-500"></i> View Bill
                                </button>
                                ${status !== 'completed' && status !== 'cancelled' ? `
                                    <button onclick="setupOrderTracking('${order.id}'); goHome();" class="flex-1 bg-secondary dark:bg-primary text-white py-3.5 rounded-xl font-bold text-sm active:scale-95 transition-all">
                                        Track Order
                                    </button>
                                ` : (status === 'completed' ? `
                                    <button onclick="reorder('${order.id}')" class="flex-1 bg-primary text-white py-3.5 rounded-xl font-bold text-sm active:scale-95 transition-all hover:shadow-lg hover:shadow-orange-500/20">
                                        Order Again
                                    </button>
                                ` : '')}
                            </div>
                        </div>
                    `;
                }).join('');

                lucide.createIcons();
            })
            .catch(error => {
                console.error('❌ Error fetching orders:', error);
                console.error('Error code:', error.code);
                console.error('Error message:', error.message);
                const ordersContainer = document.getElementById('orders-container');
                ordersContainer.innerHTML = `
                    <div class="flex flex-col items-center justify-center py-12 text-center">
                        <div class="w-24 h-24 bg-red-50 rounded-full flex items-center justify-center mb-4">
                            <i data-lucide="alert-circle" class="w-12 h-12 text-red-500"></i>
                        </div>
                        <h3 class="font-bold text-lg text-secondary mb-2">Error Loading Orders</h3>
                        <p class="text-gray-400 text-sm mb-2">Unable to fetch your orders.</p>
                        <p class="text-xs text-red-500 mb-6 font-mono bg-red-50 p-2 rounded">${error.message || 'Unknown error'}</p>
                        <button onclick="viewMyOrders()" class="bg-primary text-white px-6 py-3 rounded-xl font-bold active:scale-95 transition">
                            Retry
                        </button>
                    </div>
                `;
                lucide.createIcons();
            });
    } else {
        const ordersContainer = document.getElementById('orders-container');
        ordersContainer.innerHTML = `
            <div class="flex flex-col items-center justify-center py-12 text-center">
                <div class="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <i data-lucide="lock" class="w-12 h-12 text-gray-400"></i>
                </div>
                <h3 class="font-bold text-lg text-secondary mb-2">Login Required</h3>
                <p class="text-gray-400 text-sm mb-6">Please log in to view your order history.</p>
                <button onclick="goToAuth()" class="bg-primary text-white px-6 py-3 rounded-xl font-bold active:scale-95 transition">
                    Login Now
                </button>
            </div>
        `;
        lucide.createIcons();
    }
}


function viewBill(orderId) {
    const order = state.orders.find(o => o.id === orderId);
    if (order) {
        state.lastOrder = order;
        state.view = 'receipt';
        render();
    }
}

function reorder(orderId) {
    db.collection('orders').doc(orderId).get()
        .then(doc => {
            if (doc.exists) {
                const order = doc.data();
                // Clear current cart and add all items from the previous order
                state.cart = [];
                order.items.forEach(item => {
                    state.cart.push({ ...item });
                });
                state.view = 'checkout';
                render();
            }
        })
        .catch(error => {
            console.error('Error reordering:', error);
            showToast("Reorder Error", "Failed to process reorder. Please try manual checkout.", "error");
        });
}

// Auth Helper Functions
function togglePassword(inputId) {
    const input = document.getElementById(inputId);
    input.type = input.type === 'password' ? 'text' : 'password';
}

function handleLogin(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const email = formData.get('email');
    const password = formData.get('password');
    const remember = formData.get('remember');

    // Firebase email/password login
    firebase.auth().signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
            const user = userCredential.user;
            db.collection('users').doc(user.uid).get().then(doc => {
                const data = doc.exists ? doc.data() : {};
                state.user = {
                    uid: user.uid,
                    email: user.email,
                    name: data.name || user.displayName || email.split('@')[0],
                    photo: data.photo || user.photoURL
                };
                state.studentId = state.user.email; // Always set studentId
                if (remember) {
                    localStorage.setItem('ncafe_user', JSON.stringify(state.user));
                }

                // If user has items in cart, redirect to checkout
                if (state.cart.length > 0) {
                    state.view = 'checkout';
                } else {
                    state.view = 'home';
                }

                render();
                console.log('✅ Login successful');
            });
        })
        .catch((error) => {
            console.error('❌ Login error:', error);
            showToast("Login Error", "Invalid credentials or account issue. Please try again.", "error");
        });
}

function handleRegister(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const email = formData.get('email');
    const password = formData.get('password');
    const name = formData.get('name');
    const phone = formData.get('phone');

    // Firebase email/password registration
    firebase.auth().createUserWithEmailAndPassword(email, password)
        .then((userCredential) => {
            const user = userCredential.user;

            // Update profile
            user.updateProfile({
                displayName: name
            });

            // Send verification email
            user.sendEmailVerification();

            state.user = {
                uid: user.uid,
                email: user.email,
                name: name,
                phone: phone,
                photo: null
            };
            state.studentId = state.user.email; // Always set studentId

            // Save to Firestore so it exists on next login
            db.collection('users').doc(user.uid).set({
                name: name,
                phone: phone,
                email: email
            });

            // If user has items in cart, redirect to checkout
            if (state.cart.length > 0) {
                state.view = 'checkout';
            } else {
                state.view = 'home';
            }

            render();
            showToast("Account Created", "Your account has been created! Please check your email for verification.", "success");
            console.log('✅ Registration successful');
        })
        .catch((error) => {
            console.error('❌ Registration error:', error);
            showToast("Sign Up Error", "Failed to create account. Check your details and try again.", "error");
        });
}

function forgotPassword() {
    // improved UI for forgot password
    const overlay = document.createElement('div');
    overlay.id = 'forgot-password-modal';
    overlay.className = 'fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6 animate-fade-in';
    overlay.innerHTML = `
        <div class="bg-white dark:bg-dark-surface w-full max-w-sm rounded-[32px] p-8 shadow-2xl relative transition-all animate-scale-in">
            <button onclick="document.getElementById('forgot-password-modal').remove()" class="absolute top-6 right-6 text-gray-400 hover:text-secondary dark:hover:text-gray-100 transition-colors">
                <i data-lucide="x" class="w-6 h-6"></i>
            </button>
            
            <div class="text-center mb-8">
                <div class="w-20 h-20 bg-orange-50 dark:bg-orange-900/10 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                    <i data-lucide="key-round" class="w-10 h-10 text-primary"></i>
                </div>
                <h3 class="text-2xl font-bold text-secondary dark:text-gray-100 mb-2">Forgot Password?</h3>
                <p class="text-sm text-gray-500 dark:text-gray-400">Enter your email and we'll send you a link to reset your password.</p>
            </div>
            
            <form onsubmit="handleForgotPassword(event)" class="space-y-6">
                <div class="space-y-2">
                    <label class="text-xs text-secondary dark:text-gray-300 font-bold ml-1 uppercase tracking-wider">Email Address</label>
                    <div class="flex items-center bg-gray-50 dark:bg-dark-bg rounded-2xl border border-gray-100 dark:border-dark-border px-4 py-4 transition-all focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary">
                        <input type="email" name="email" placeholder="Enter your email" required autofocus
                            class="w-full bg-transparent outline-none text-base text-secondary dark:text-gray-100 placeholder:text-gray-400">
                    </div>
                </div>
                
                <button type="submit" class="w-full bg-primary text-white py-4 rounded-2xl font-bold text-lg shadow-xl shadow-orange-500/20 active:scale-95 transition-all">
                    Send Reset Link
                </button>
            </form>
        </div>
    `;
    document.body.appendChild(overlay);
    lucide.createIcons();
}

function handleForgotPassword(e) {
    e.preventDefault();
    const email = e.target.email.value;
    const modal = document.getElementById('forgot-password-modal');

    if (email) {
        // Show loading state
        const btn = e.target.querySelector('button');
        const originalText = btn.innerText;
        btn.innerText = 'Sending...';
        btn.disabled = true;

        firebase.auth().sendPasswordResetEmail(email)
            .then(() => {
                modal.remove();
                showToast('Email Sent', '✅ Reset link sent! Check your inbox.', 'success');
            })
            .catch((error) => {
                console.error('❌ Password reset error:', error);
                btn.innerText = originalText;
                btn.disabled = false;
                showToast('Reset Error', error.message, 'error');
            });
    }
}

function loginWithFacebook() {
    const provider = new firebase.auth.FacebookAuthProvider();
    firebase.auth().signInWithPopup(provider)
        .then((result) => {
            const user = result.user;
            state.user = {
                uid: user.uid,
                email: user.email,
                name: user.displayName,
                photo: user.photoURL
            };
            state.studentId = state.user.email; // Always set studentId

            // If user has items in cart, redirect to checkout
            if (state.cart.length > 0) {
                state.view = 'checkout';
            } else {
                state.view = 'home';
            }

            render();
        })
        .catch((error) => {
            console.error('❌ Facebook login error:', error);
            showToast("Update Error", "Failed to update profile. Please try again later.", "error");
        });
}

function loginWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    firebase.auth().signInWithPopup(provider)
        .then((result) => {
            const user = result.user;
            state.user = {
                uid: user.uid,
                email: user.email,
                name: user.displayName,
                photo: user.photoURL
            };
            state.studentId = state.user.email; // Always set studentId

            // If user has items in cart, redirect to checkout
            if (state.cart.length > 0) {
                state.view = 'checkout';
            } else {
                state.view = 'home';
            }

            render();
        })
        .catch((error) => {
            console.error('❌ Google login error:', error);
            showToast("Update Error", "Failed to update profile. Please try again later.", "error");
        });
}

function editProfile() {
    state.view = 'profile-edit';
    render();
}

function viewMyOrders() {
    state.view = 'orders';
    render();
}

async function handleLogout() {
    const confirmed = await showConfirm({
        title: 'Sign Out',
        message: 'Are you sure you want to sign out?',
        confirmText: 'Sign Out',
        isDanger: false
    });
    if (confirmed) {
        firebase.auth().signOut();
        state.user = null;
        localStorage.removeItem('ncafe_user');
        state.view = 'home';
        render();
        console.log('✅ Logged out');
    }
}

function changePhoto() {
    document.getElementById('photo-file-input')?.click();
}

function handlePhotoSelected(input) {
    const file = input.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        showToast("Invalid File", "Please select an image file.", "error");
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            // Compress to 200x200 JPEG via canvas
            const canvas = document.createElement('canvas');
            canvas.width = 200;
            canvas.height = 200;
            const ctx = canvas.getContext('2d');

            // Cover crop: centre the image
            const size = Math.min(img.width, img.height);
            const sx = (img.width - size) / 2;
            const sy = (img.height - size) / 2;
            ctx.drawImage(img, sx, sy, size, size, 0, 0, 200, 200);

            const base64 = canvas.toDataURL('image/jpeg', 0.7);

            // Instant preview
            const preview = document.getElementById('profile-photo-preview');
            const initial = document.getElementById('profile-photo-initial');
            if (preview) { preview.src = base64; preview.classList.remove('hidden'); }
            if (initial) { initial.classList.add('hidden'); }

            // Save to state so saveProfile can persist it
            state._pendingPhoto = base64;
            showToast("Photo ready", "Hit Save to apply your new profile photo.", "success");
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function saveProfile(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const newName = formData.get('name');
    const newPhone = formData.get('phone');
    const currentPassword = formData.get('currentPassword');
    const newPassword = formData.get('newPassword');
    const confirmPassword = formData.get('confirmPassword');

    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i data-lucide="loader-2" class="w-5 h-5 animate-spin mx-auto"></i>';
    lucide.createIcons();

    const user = firebase.auth().currentUser;
    if (!user) return;

    const performProfileUpdate = () => {
        // Build update payloads
        const authUpdates = { displayName: newName };
        const dbUpdates = { name: newName, phone: newPhone };

        if (state._pendingPhoto) {
            dbUpdates.photo = state._pendingPhoto;
        }

        user.updateProfile(authUpdates).then(() => {
            return db.collection('users').doc(user.uid).set(dbUpdates, { merge: true });
        }).then(() => {
            state.user = { ...state.user, name: newName, phone: newPhone };
            if (state._pendingPhoto) {
                state.user.photo = state._pendingPhoto;
                delete state._pendingPhoto;
            }
            showToast("Success", "Your profile has been updated successfully!", "success");
            state.view = 'profile';
            render();
        }).catch((error) => {
            console.error("Error updating profile:", error);
            showToast("Error", "Failed to update profile: " + error.message, "error");
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
            lucide.createIcons();
        });
    };

    // --- PASSWORD CHANGE LOGIC ---
    if (newPassword) {
        if (newPassword.length < 6) {
            showToast("Security", "New password must be at least 6 characters.", "error");
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
            lucide.createIcons();
            return;
        }
        if (newPassword !== confirmPassword) {
            showToast("Security", "Passwords do not match.", "error");
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
            lucide.createIcons();
            return;
        }
        if (!currentPassword) {
            showToast("Security", "Current password is required to set a new one.", "error");
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
            lucide.createIcons();
            return;
        }

        // Re-authenticate
        const credential = firebase.auth.EmailAuthProvider.credential(user.email, currentPassword);
        user.reauthenticateWithCredential(credential).then(() => {
            return user.updatePassword(newPassword);
        }).then(() => {
            performProfileUpdate();
        }).catch((error) => {
            console.error("Auth Error:", error);
            const msg = error.code === 'auth/wrong-password' ? "Incorrect current password." : error.message;
            showToast("Security Error", msg, "error");
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
            lucide.createIcons();
        });
    } else {
        performProfileUpdate();
    }
}

function goHome() {
    state.view = 'home';
    render();
}

// ==============================================
// INITIALIZE
// ==============================================

// Check for existing tracked order
const trackingId = localStorage.getItem('trackingOrderId');
if (trackingId) {
    db.collection('orders').doc(trackingId).get().then(doc => {
        if (doc.exists && doc.data().status !== 'completed') {
            setupOrderTracking(trackingId);
        } else {
            localStorage.removeItem('trackingOrderId');
        }
    });
}

// ==============================================
// STAFF MODE FUNCTIONS
// ==============================================

function toggleStaffMode() {
    state.staffMode = !state.staffMode;
    render();
}

function switchStaffTab(tab) {
    state.staffTab = tab;
    render();
}

function renderStaffNav() {
    const nav = document.createElement('nav');
    nav.className = 'fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white dark:bg-dark-bg border-t border-x border-gray-100 dark:border-dark-border rounded-t-2xl flex justify-around p-3 pb-6 z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] transition-colors duration-300';
    nav.innerHTML = `
        <button onclick="switchStaffTab('orders')" 
            class="flex-1 p-2 rounded-xl flex flex-col items-center gap-1 transition-all duration-300 ${state.staffTab === 'orders' ? 'text-primary' : 'text-gray-400 dark:text-gray-500 hover:text-secondary dark:hover:text-gray-200'}">
            <i data-lucide="clipboard-list" class="w-6 h-6"></i>
            <span class="text-[10px] font-bold">Orders</span>
        </button>
        <button onclick="switchStaffTab('scanner')" 
            class="flex-1 p-2 rounded-xl flex flex-col items-center gap-1 group">
            <div class="w-14 h-14 bg-secondary dark:bg-primary text-white rounded-2xl flex items-center justify-center -mt-10 border-4 border-white dark:border-dark-bg shadow-xl shadow-secondary/20 dark:shadow-primary/20 transition-transform active:scale-90 group-hover:scale-105">
                <i data-lucide="scan-face" class="w-7 h-7"></i>
            </div>
            <span class="text-[10px] font-bold mt-1 ${state.staffTab === 'scanner' ? 'text-primary' : 'text-gray-400 dark:text-gray-500'}">Scan</span>
        </button>
        <button onclick="switchStaffTab('stock')" 
            class="flex-1 p-2 rounded-xl flex flex-col items-center gap-1 transition-all duration-300 ${state.staffTab === 'stock' ? 'text-primary' : 'text-gray-400 dark:text-gray-500 hover:text-secondary dark:hover:text-gray-200'}">
            <i data-lucide="box" class="w-6 h-6"></i>
            <span class="text-[10px] font-bold">Stock</span>
        </button>
    `;
    app.appendChild(nav);
}

// Enable staff mode by typing 'staff' anywhere
let staffCode = '';
document.addEventListener('keypress', (e) => {
    staffCode += e.key;
    if (staffCode.includes('staff')) {
        toggleStaffMode();
        staffCode = '';
    }
    if (staffCode.length > 10) staffCode = '';
});

// Check for saved user in localStorage
const savedUser = localStorage.getItem('ncafe_user');
if (savedUser) {
    try {
        state.user = JSON.parse(savedUser);
        console.log('✅ User restored from localStorage');
    } catch (e) {
        console.error('Failed to parse saved user');
    }
}


// Listen to Firebase auth state changes
firebase.auth().onAuthStateChanged((user) => {
    if (user) {
        state.user = {
            uid: user.uid,
            email: user.email,
            name: user.displayName || user.email.split('@')[0],
            photo: user.photoURL
        };
        state.studentId = user.email; // Always set studentId
        initChatListener(); // Start listening for messages
        fetchWalletBalance(user.uid); // Load wallet balance
    } else if (!savedUser) {
        state.user = null;
        state.walletBalance = 0;
        state.walletLoading = false;
    }
    render();
});


render();

// ==============================================
// WALLET
// ==============================================

async function fetchWalletBalance(uid) {
    if (!uid) return;
    state.walletLoading = true;
    try {
        const doc = await db.collection('wallets').doc(uid).get();
        state.walletBalance = doc.exists ? (doc.data().balance || 0) : 0;
    } catch (e) {
        state.walletBalance = 0;
    }
    state.walletLoading = false;
    // Re-render only if currently on profile page
    if (state.view === 'profile') render();
}

async function redeemPrepaidCard() {
    const input = document.getElementById('redeem-code-input');
    const code = input?.value?.trim().toUpperCase();

    if (!code || code.length < 15) {
        showToast("Invalid Code", "Please enter a valid NCAFE-XXXX-XXXX code.", "error");
        return;
    }
    if (!state.user) {
        showToast("Login Required", "Please log in to redeem a card.", "error");
        return;
    }

    const btn = document.querySelector('[onclick="redeemPrepaidCard()"]');
    if (btn) { btn.disabled = true; btn.textContent = 'Redeeming...'; }

    try {
        const cardRef = db.collection('prepaid_cards').doc(code);
        const cardSnap = await cardRef.get();

        if (!cardSnap.exists) {
            showToast("Invalid Code", "This code does not exist. Please check and try again.", "error");
            return;
        }

        const card = cardSnap.data();

        if (card.isRedeemed) {
            showToast("Already Used", "This card has already been redeemed.", "error");
            return;
        }

        // Atomic batch: mark card redeemed + add to wallet + log transaction
        const batch = db.batch();
        const walletRef = db.collection('wallets').doc(state.user.uid);
        const txnRef = db.collection('wallet_transactions').doc();
        const walletDoc = await walletRef.get();
        const currentBalance = walletDoc.exists ? (walletDoc.data().balance || 0) : 0;
        const newBalance = currentBalance + card.value;

        batch.update(cardRef, {
            isRedeemed: true,
            redeemedBy: state.user.email,
            redeemedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        batch.set(walletRef, {
            balance: newBalance,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        batch.set(txnRef, {
            userId: state.user.uid,
            type: 'credit',
            amount: card.value,
            method: 'prepaid_card',
            ref: code,
            balance_after: newBalance,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        await batch.commit();

        state.walletBalance = newBalance;
        state.walletLoading = false;
        if (input) input.value = '';
        showToast("🎉 Reloaded!", `LKR ${card.value.toLocaleString()} added to your N-Cafe Wallet!`, "success");
        render();
    } catch (e) {
        showToast("Error", "Failed to redeem code. Please try again.", "error");
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Redeem'; }
    }
}

// ==============================================
// UTILS
// ==============================================

// End of file cleanup - removing local showToast as it's now global in data.js
