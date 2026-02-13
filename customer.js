// ==============================================
// N-CAFE CUSTOMER APP - REBUILT FROM SCRATCH
// ==============================================

// MENU DATA
// MENU DATA
// Relying on global window.menuItems and window.categories from data.js

// LISTEN FOR UPDATES
window.addEventListener('menu-updated', () => {
    console.log('Menu updated in Customer App');
    render();
});


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
    lastOrder: null // Store details of the last placed order for receipt
};

// Sync studentId if user is already logged in from localStorage
if (state.user) {
    state.studentId = state.user.email;
}

// -------------------------------------------------------------
// AUTH STATE LISTENER (The Source of Truth)
// -------------------------------------------------------------
firebase.auth().onAuthStateChanged((user) => {
    if (user) {
        // User is signed in.
        state.user = {
            uid: user.uid,
            email: user.email,
            name: user.displayName || user.email.split('@')[0],
            photo: user.photoURL,
            phone: user.phoneNumber // Basic info
        };
        state.studentId = state.user.email;
        // Persist session
        localStorage.setItem('ncafe_user', JSON.stringify(state.user));
    } else {
        // User is signed out.
        // Only clear if we are not in the middle of an auth flow or if explicit logout happened
        // But for safety, we respect firebase.
        // However, to avoid flashing, we only clear if localStorage has user but firebase says no.
        if (state.user) {
            console.log("Firebase says logged out. Clearing local state.");
            state.user = null;
            state.studentId = '';
            localStorage.removeItem('ncafe_user');
            render(); // Re-render to show login button
        }
    }
    // Update UI if needed (e.g. avatar)
    const profileBtn = document.querySelector('header .rounded-full');
    if (profileBtn) render();
});

const app = document.getElementById('app');

// ==============================================
// RENDER FUNCTIONS
// ==============================================

function render() {
    app.innerHTML = '';

    if (state.view === 'home') renderHome();
    else if (state.view === 'favorites') renderFavorites();
    else if (state.view === 'item') renderItemDetail();
    else if (state.view === 'checkout') renderCheckout();
    else if (state.view === 'payment') renderPayment();
    else if (state.view === 'receipt') renderReceipt();
    else if (state.view === 'auth') renderAuth();
    else if (state.view === 'profile') renderProfile();
    else if (state.view === 'profile-edit') renderProfileEdit();
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
    // Order Status Bar (if tracking active order)
    if (state.activeOrder) {
        const statusBar = document.createElement('div');
        statusBar.innerHTML = createStatusBar(state.activeOrder);
        app.appendChild(statusBar);
    }

    // Header
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning,' : hour < 18 ? 'Good afternoon,' : 'Good evening,';

    const header = document.createElement('header');
    header.className = 'sticky top-0 bg-white z-20 shadow-sm p-4';
    header.innerHTML = `
        <div class="flex justify-between items-center">
            <div class="flex items-center gap-3" onclick="${!state.user ? 'goToAuth()' : 'goToProfile()'}" role="button">
                <div class="w-12 h-12 rounded-full overflow-hidden border-2 border-primary/20 bg-orange-50">
                    ${state.user?.photo ? `
                        <img src="${state.user.photo}" class="w-full h-full object-cover">
                    ` : `
                        <div class="w-full h-full flex items-center justify-center text-primary font-bold text-lg">
                            ${state.user?.name ? state.user.name[0].toUpperCase() : 'G'}
                        </div>
                    `}
                </div>
                <div class="flex flex-col">
                    <span class="text-xs text-gray-500 font-medium">${greeting}</span>
                    <h2 class="text-base font-bold text-secondary leading-tight">${state.user?.name || 'Guest User'}</h2>
                </div>
            </div>

            <div class="flex items-center gap-3">
                <!-- Notifications Icon -->
                <button onclick="goToNotifications()" class="relative w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center hover:bg-gray-100 active:scale-95 transition">
                    <i data-lucide="bell" class="w-5 h-5 text-gray-600"></i>
                    ${state.notifications.length > 0 ? `<span class="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full"></span>` : ''}
                </button>
                
                <!-- Messages Icon -->
                <button onclick="${!state.user ? 'goToAuth(); showToast(\'Please log in to view messages 💬\', \'error\');' : 'goToMessages()'}" class="relative w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center hover:bg-gray-100 active:scale-95 transition">
                    <i data-lucide="message-circle" class="w-5 h-5 text-gray-600"></i>
                    ${state.messages.some(m => !m.read) ? `<span class="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full"></span>` : ''}
                </button>
            </div>
        </div>
    `;
    app.appendChild(header);

    // Search Bar
    const searchConfig = document.createElement('div');
    searchConfig.className = "px-4 mb-6 mt-4";
    searchConfig.innerHTML = `
        <div class="relative">
            <i data-lucide="search" class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"></i>
            <input type="text" placeholder="Search for food..." 
                class="w-full pl-12 pr-4 py-3 bg-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
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
                    <div class="w-16 h-16 rounded-2xl flex items-center justify-center transition-all ${state.selectedCategory === cat.id ? 'bg-primary text-white shadow-lg shadow-orange-500/30' : 'bg-gray-100 text-gray-500 group-hover:bg-gray-200'}">
                        <i data-lucide="${cat.icon}" class="w-7 h-7"></i>
                    </div>
                    <span class="text-xs font-medium ${state.selectedCategory === cat.id ? 'text-primary' : 'text-gray-500'}">${cat.name}</span>
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
        <div onclick="viewItem(${item.id})" class="bg-white rounded-2xl p-3 shadow-sm border border-gray-100 hover:shadow-md transition-all active:scale-95 cursor-pointer group ${!item.isAvailable ? 'opacity-60 grayscale cursor-not-allowed' : ''}">
            <div class="relative mb-3 h-32 rounded-xl overflow-hidden bg-gray-100">
                <img src="${item.image}" alt="${item.name}" class="w-full h-full object-cover">
                <div class="absolute top-2 left-2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-lg text-xs font-bold text-primary">
                    LKR ${item.price}
                </div>
                ${!item.isAvailable ? `<div class="absolute inset-0 bg-black/50 flex items-center justify-center text-white font-bold text-sm px-2 text-center">Out of Stock</div>` : ''}
            </div>
            <h3 class="font-bold text-secondary text-sm mb-1 line-clamp-1">${item.name}</h3>
            <div class="flex justify-between items-center">
                <span class="text-xs text-gray-500">${item.category}</span>
                <button class="w-8 h-8 rounded-full ${item.isAvailable ? 'bg-primary text-white shadow-lg shadow-orange-500/20 group-hover:bg-orange-600' : 'bg-gray-200 text-gray-400'} flex items-center justify-center transition-colors">
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
    div.className = 'min-h-screen bg-white flex flex-col animate-fade-in';
    div.innerHTML = `
        <div class="relative h-80">
            <img src="${item.image}" class="w-full h-full object-cover">
            <button onclick="goBack()" class="absolute top-6 left-6 w-10 h-10 bg-white/20 backdrop-blur-md text-white rounded-full flex items-center justify-center hover:bg-white/30 transition-all active:scale-90 shadow-lg z-10">
                <i data-lucide="arrow-left" class="w-6 h-6"></i>
            </button>
            <button onclick="toggleFavorite(${item.id})" class="absolute top-6 right-6 w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center hover:bg-white/30 transition-all active:scale-90 shadow-lg z-10 ${state.favorites.includes(item.id) ? 'bg-white text-red-500' : 'text-white'}">
                <i data-lucide="heart" class="w-6 h-6 ${state.favorites.includes(item.id) ? 'fill-current' : ''}"></i>
            </button>
        </div>
        
        <div class="flex-1 bg-white -mt-10 rounded-t-[2.5rem] relative p-8 flex flex-col shadow-[0_-10px_40px_rgba(0,0,0,0.1)]">
            <div class="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6"></div>
            
            <div class="flex justify-between items-start mb-2">
                <h1 class="text-3xl font-bold text-secondary w-3/4 leading-tight">${item.name}</h1>
                <span class="text-primary text-2xl font-bold">LKR ${item.price}</span>
            </div>
            
            <div class="flex items-center gap-2 mb-6">
                <span class="bg-orange-50 text-orange-600 font-bold text-xs px-3 py-1.5 rounded-full uppercase tracking-wide border border-orange-100">${item.subCategory}</span>
            </div>
            
            <p class="text-gray-500 leading-relaxed mb-8 flex-1 text-base">
                ${item.description || 'Delicious item from our menu.'}
            </p>
            
            <div class="mt-auto">
                <div class="flex items-center justify-between gap-6 p-1 mb-6">
                    <span class="font-bold text-lg text-secondary">Quantity</span>
                    <div class="flex items-center gap-4 bg-gray-50 px-4 py-2 rounded-2xl border border-gray-100">
                        <button onclick="changeQty(-1)" class="w-8 h-8 rounded-full bg-white shadow-sm border border-gray-100 flex items-center justify-center text-gray-600 active:scale-90 transition-transform hover:bg-gray-50">
                            <i data-lucide="minus" class="w-4 h-4"></i>
                        </button>
                        <span class="font-bold text-xl w-8 text-center text-secondary">${state.quantity}</span>
                        <button onclick="changeQty(1)" class="w-8 h-8 rounded-full bg-secondary text-white shadow-lg shadow-gray-900/20 flex items-center justify-center active:scale-90 transition-transform">
                            <i data-lucide="plus" class="w-4 h-4"></i>
                        </button>
                    </div>
                </div>
                
                <button onclick="addToCart()" class="w-full bg-primary text-white p-5 rounded-2xl font-bold text-xl shadow-xl shadow-orange-500/30 active:scale-95 transition-all flex items-center justify-center gap-3 group">
                    <span>Add to Cart</span>
                    <span class="bg-white/20 text-sm px-2 py-1 rounded-lg font-medium group-hover:bg-white/30 transition-colors">LKR ${item.price * state.quantity}</span>
                </button>
            </div>
        </div>
    `;
    app.appendChild(div);
}

function renderCheckout() {
    const subtotal = state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const tax = subtotal * 0.05;
    const total = subtotal + tax;

    const div = document.createElement('div');
    div.className = 'min-h-screen bg-gray-50 flex flex-col pb-96'; // Increased padding to ensure content isn't hidden behind fixed footer
    div.innerHTML = `
        <!-- Header -->
        <div class="bg-white p-4 sticky top-0 z-30 flex items-center shadow-sm">
            <button onclick="goBack()" class="w-10 h-10 rounded-full flex items-center justify-center hover:bg-gray-100 active:scale-95 transition absolute left-4">
                <i data-lucide="chevron-left" class="w-7 h-7 text-secondary"></i>
            </button>
            <h1 class="text-xl font-bold flex-1 text-center text-secondary">My Cart</h1>
        </div>
        
        <div class="p-6 space-y-4">
            <!-- Cart Items -->
            ${state.cart.length === 0 ? `
                <div class="text-center py-20">
                    <div class="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                        <i data-lucide="shopping-cart" class="w-10 h-10 text-gray-400"></i>
                    </div>
                    <p class="text-gray-500 font-bold">Your cart is empty</p>
                    <button onclick="goHome()" class="mt-4 text-primary font-bold">Start Ordering</button>
                </div>
            ` : state.cart.map((item, idx) => `
                <div class="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 relative animate-fade-in">
                    <button onclick="removeFromCart(${idx})" class="absolute top-4 right-4 text-gray-300 hover:text-red-500 transition active:scale-95">
                        <i data-lucide="trash-2" class="w-5 h-5"></i>
                    </button>

                    <div class="flex gap-4">
                        <div class="w-24 h-24 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                            <img src="${item.image}" alt="${item.name}" class="w-full h-full object-cover">
                        </div>
                        
                        <div class="flex flex-col flex-1 justify-between">
                            <div>
                                <h3 class="font-bold text-secondary text-lg leading-tight mb-1 pr-8">${item.name}</h3>
                                <p class="text-primary font-bold">LKR ${item.price}</p>
                            </div>
                            
                            <div class="flex items-center gap-3 mt-2">
                                <button onclick="updateCartQuantity(${idx}, -1)" class="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200 active:scale-95 transition">
                                    <i data-lucide="minus" class="w-4 h-4"></i>
                                </button>
                                <span class="text-lg font-bold w-6 text-center text-secondary">${item.quantity}</span>
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
                    <label class="font-bold text-secondary text-lg mb-3 block">Special Instructions</label>
                    <div class="relative">
                        <textarea 
                            oninput="updateSpecialInstructions(this.value)"
                            placeholder="e.g. Less sugar, no spicy..." 
                            class="w-full bg-white border border-gray-200 rounded-2xl p-4 min-h-[120px] outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none text-sm placeholder:text-gray-400 font-medium"
                        >${state.specialInstructions || ''}</textarea>
                        <i data-lucide="edit-3" class="absolute bottom-4 right-4 w-5 h-5 text-gray-300"></i>
                    </div>
                </div>
            ` : ''}
        </div>
        
        <!-- Bottom Tab -->
        ${state.cart.length > 0 ? `
            <div class="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white rounded-t-[2.5rem] shadow-[0_-10px_40px_rgba(0,0,0,0.1)] p-8 z-40">
                <div class="space-y-3 mb-8">
                    <div class="flex justify-between items-center text-gray-500">
                        <span class="font-medium">Subtotal</span>
                        <span class="font-bold text-secondary">LKR ${subtotal.toFixed(2)}</span>
                    </div>
                    <div class="flex justify-between items-center text-gray-500">
                        <span class="font-medium">Tax (5%)</span>
                        <span class="font-bold text-secondary">LKR ${tax.toFixed(2)}</span>
                    </div>
                    <div class="flex justify-between items-center text-xl mt-4 pt-4 border-t border-gray-100">
                        <span class="font-bold text-secondary">Total</span>
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
    div.className = 'min-h-screen bg-white p-6';
    div.innerHTML = `
        <button onclick="backToCheckout()" class="flex items-center gap-2 text-gray-600 mb-6">
            <i data-lucide="arrow-left" class="w-5 h-5"></i>
            <span class="font-medium">Back</span>
        </button>
        
        <h1 class="text-3xl font-bold mb-2">Payment</h1>
        <p class="text-gray-500 mb-8">Choose how you want to pay</p>
        
        <div class="bg-gray-50 p-4 rounded-xl mb-6 space-y-2">
            <div class="flex justify-between items-center text-sm text-gray-500">
                <span>Subtotal</span>
                <span>LKR ${subtotal.toFixed(2)}</span>
            </div>
            <div class="flex justify-between items-center text-sm text-gray-500">
                <span>Tax (5%)</span>
                <span>LKR ${tax.toFixed(2)}</span>
            </div>
            <div class="flex justify-between items-center border-t border-gray-200 pt-2 mt-2">
                <span class="text-gray-600 font-bold">Total Amount</span>
                <span class="text-2xl font-bold text-primary">LKR ${total.toFixed(2)}</span>
            </div>
        </div>
        
        <div class="space-y-3 mb-8">
            <button onclick="selectPayment('visa')" class="w-full p-4 rounded-xl border-2 ${state.paymentMethod === 'visa' ? 'border-primary bg-orange-50' : 'border-gray-200'} flex items-center gap-3">
                <div class="w-6 h-6 rounded-full border-2 ${state.paymentMethod === 'visa' ? 'border-primary bg-primary' : 'border-gray-300'} flex items-center justify-center">
                    ${state.paymentMethod === 'visa' ? '<div class="w-3 h-3 bg-white rounded-full"></div>' : ''}
                </div>
                <i data-lucide="credit-card" class="w-5 h-5 text-primary"></i>
                <span class="font-bold">Visa / Master</span>
            </button>
            
            <button onclick="selectPayment('genie')" class="w-full p-4 rounded-xl border-2 border-gray-200 opacity-50 flex items-center gap-3" disabled>
                <div class="w-6 h-6 rounded-full border-2 border-gray-300"></div>
                <i data-lucide="smartphone" class="w-5 h-5 text-gray-400"></i>
                <span class="font-bold text-gray-400">Genie (Coming Soon)</span>
            </button>
        </div>
        
        <button onclick="processPayment()" class="w-full bg-secondary text-white p-4 rounded-xl font-bold text-lg flex items-center justify-between">
            <span>Pay Now</span>
            <i data-lucide="arrow-right" class="w-5 h-5"></i>
        </button>
    `;
    app.appendChild(div);
}

function renderReceipt() {
    const order = state.lastOrder;
    if (!order) {
        state.view = 'home';
        render();
        return;
    }

    const div = document.createElement('div');
    div.className = 'min-h-screen bg-primary flex items-center justify-center p-6';
    div.innerHTML = `
        <div class="bg-white w-full rounded-3xl p-8 shadow-2xl relative">
            <button onclick="${state.user ? 'viewMyOrders()' : 'goHome()'}" class="absolute top-6 left-6 w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-secondary active:scale-95 transition-all">
                <i data-lucide="arrow-left" class="w-5 h-5"></i>
            </button>

            <div class="text-center mb-6">
                <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i data-lucide="check" class="w-8 h-8 text-green-600"></i>
                </div>
                <h1 class="text-2xl font-bold mb-2">Order Placed!</h1>
                <p class="text-gray-500 text-sm font-bold mb-4">Order #${order.id}</p>
                <div class="bg-gray-50 p-4 rounded-2xl inline-block mb-2 shadow-inner border border-gray-100">
                    <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${order.id}" class="w-32 h-32 mx-auto mix-blend-multiply opacity-90" alt="Order QR Code">
                </div>
                <p class="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Scan to Verify</p>
            </div>
            
            <div class="bg-gray-50 p-4 rounded-xl mb-6">
                ${order.items.map(item => `
                    <div class="flex justify-between text-sm mb-2">
                        <span>${item.quantity}x ${item.name}</span>
                        <span class="font-bold">LKR ${item.price * item.quantity}</span>
                    </div>
                `).join('')}
                <div class="border-t border-gray-200 pt-2 mt-2 space-y-1">
                    <div class="flex justify-between text-xs text-gray-500">
                        <span>Subtotal</span>
                        <span>LKR ${order.subtotal?.toFixed(2) || (order.total / 1.05).toFixed(2)}</span>
                    </div>
                    <div class="flex justify-between text-xs text-gray-500">
                        <span>Tax (5%)</span>
                        <span>LKR ${order.tax?.toFixed(2) || (order.total - (order.total / 1.05)).toFixed(2)}</span>
                    </div>
                    <div class="flex justify-between font-bold text-lg pt-1">
                        <span>Total</span>
                        <span class="text-primary">LKR ${order.total.toFixed(2)}</span>
                    </div>
                </div>
            </div>
            
            ${order.status === 'completed' ? `
                <button onclick="reorder('${order.id}')" class="w-full bg-primary text-white p-4 rounded-xl font-bold mb-2 shadow-lg shadow-orange-500/20 active:scale-95 transition flex items-center justify-center gap-2">
                    <i data-lucide="refresh-ccw" class="w-5 h-5"></i> Order Again
                </button>
                <button onclick="goHome()" class="w-full bg-gray-50 text-gray-500 p-4 rounded-xl font-bold hover:bg-gray-100">
                    Back to Menu
                </button>
            ` : `
                <button onclick="trackOrder()" class="w-full bg-secondary text-white p-4 rounded-xl font-bold mb-2 shadow-lg shadow-gray-900/20 active:scale-95 transition">
                    Track My Order
                </button>
                <button onclick="newOrder()" class="w-full bg-gray-100 text-gray-600 p-4 rounded-xl font-bold">
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
        <div class="bg-white border-b border-gray-200 p-4 shadow-sm sticky top-0 z-30">
            <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-3">
                    <div class="${status.color} w-10 h-10 rounded-full flex items-center justify-center text-white animate-pulse">
                        <i data-lucide="${status.icon}" class="w-5 h-5"></i>
                    </div>
                    <div>
                        <p class="text-xs text-gray-500">Order #${order.id}</p>
                        <p class="font-bold text-sm">Status: ${status.label}</p>
                    </div>
                </div>
                <button onclick="clearTracking()" class="text-gray-400">
                    <i data-lucide="x" class="w-5 h-5"></i>
                </button>
            </div>
            <div class="w-full bg-gray-200 rounded-full h-2">
                <div class="${status.color} h-full rounded-full transition-all duration-500" style="width: ${status.progress}"></div>
            </div>
            <div class="flex justify-between text-xs text-gray-400 mt-2">
                <span ${order.status === 'preparing' || order.status === 'ready' || order.status === 'completed' ? 'class="text-orange-600 font-bold"' : ''}>Preparing</span>
                <span ${order.status === 'ready' || order.status === 'completed' ? 'class="text-green-600 font-bold"' : ''}>Ready</span>
                <span ${order.status === 'completed' ? 'class="text-blue-600 font-bold"' : ''}>Completed</span>
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
    navBar.className = 'fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-x border-gray-100 rounded-t-2xl px-6 py-3 z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.1)]';
    navBar.innerHTML = `
        <div class="flex justify-between items-end relative">
            <!-- Home -->
            <button onclick="goHome()" class="flex flex-col items-center gap-1 w-12 group ${state.view === 'home' ? 'text-primary' : 'text-gray-400'}">
                <i data-lucide="home" class="w-6 h-6 ${state.view === 'home' ? 'fill-current' : ''}"></i>
                <span class="text-[10px] font-bold">Home</span>
            </button>
            
            <!-- Saved (Favorites) -->
            <button onclick="goToFavorites()" class="flex flex-col items-center gap-1 w-12 group ${state.view === 'favorites' ? 'text-primary' : 'text-gray-400'}">
                <i data-lucide="heart" class="w-6 h-6 ${state.view === 'favorites' ? 'fill-current' : ''}"></i>
                <span class="text-[10px] font-bold">Saved</span>
            </button>
            
            <!-- Floating Cart Button -->
            <button onclick="goToCheckout()" class="flex flex-col items-center gap-1 w-12 group">
                <div class="w-14 h-14 bg-primary text-white rounded-full flex items-center justify-center -mt-8 border-4 border-white shadow-xl shadow-orange-500/40 transition-transform active:scale-95 group-hover:bg-orange-600 relative">
                    <i data-lucide="shopping-cart" class="w-7 h-7 fill-current"></i>
                    ${cartCount > 0 ? `
                        <span class="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full h-5 min-w-[20px] flex items-center justify-center border-2 border-white shadow-sm">${cartCount > 9 ? '9+' : cartCount}</span>
                    ` : ''}
                </div>
                <span class="text-[10px] font-bold ${state.view === 'checkout' ? 'text-primary' : 'text-gray-400'} mt-1">Cart</span>
            </button>
            
            <!-- Orders -->
            <button onclick="goToOrders()" class="flex flex-col items-center gap-1 w-12 group ${state.view === 'orders' ? 'text-primary' : 'text-gray-400'}">
                <i data-lucide="file-text" class="w-6 h-6 ${state.view === 'orders' ? 'fill-current' : ''}"></i>
                <span class="text-[10px] font-bold">Orders</span>
            </button>
            
            <!-- Profile -->
            <button onclick="goToProfile()" class="flex flex-col items-center gap-1 w-12 group ${state.view === 'profile' ? 'text-primary' : 'text-gray-400'}">
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
    div.className = 'min-h-screen bg-white pb-24';

    let content = `
        <div class="sticky top-0 bg-white z-10 p-4 border-b border-gray-100 shadow-sm flex items-center gap-2">
            <h1 class="text-2xl font-bold">Saved Items</h1>
        </div>
    `;

    if (favoriteItems.length === 0) {
        content += `
        <div class="flex flex-col items-center justify-center py-20 text-center px-6">
            <div class="w-24 h-24 bg-red-50 rounded-full flex items-center justify-center mb-6">
                <i data-lucide="heart" class="w-10 h-10 text-red-500 fill-current"></i>
            </div>
            <h2 class="text-xl font-bold text-secondary mb-2">No Saved Items Yet</h2>
            <p class="text-gray-400 mb-8">Save your favorite items to find them quickly later.</p>
            <button onclick="goHome()" class="bg-primary text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-orange-500/20 active:scale-95 transition">
                Explore Menu
            </button>
        </div>`;
    } else {
        content += `<div class="grid grid-cols-2 gap-4 p-4">`;
        content += favoriteItems.map(item => `
            <div onclick="viewItem(${item.id})" class="bg-white rounded-2xl p-3 shadow-sm border border-gray-100 hover:shadow-md transition-all active:scale-95 cursor-pointer group ${!item.isAvailable ? 'opacity-60 grayscale cursor-not-allowed' : ''}">
                <div class="relative mb-3 h-32 rounded-xl overflow-hidden bg-gray-100">
                    <img src="${item.image}" alt="${item.name}" class="w-full h-full object-cover">
                    <div class="absolute top-2 left-2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-lg text-xs font-bold text-primary">
                        LKR ${item.price}
                    </div>
                     <button onclick="event.stopPropagation(); toggleFavorite(${item.id})" class="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm text-red-500 flex items-center justify-center shadow-sm z-10">
                        <i data-lucide="heart" class="w-4 h-4 fill-current"></i>
                    </button>
                    ${!item.isAvailable ? `<div class="absolute inset-0 bg-black/50 flex items-center justify-center text-white font-bold text-sm px-2 text-center">Out of Stock</div>` : ''}
                </div>
                <h3 class="font-bold text-secondary text-sm mb-1 line-clamp-1">${item.name}</h3>
                <div class="flex justify-between items-center">
                    <span class="text-xs text-gray-500">${item.category}</span>
                    <button class="w-8 h-8 rounded-full ${item.isAvailable ? 'bg-primary text-white shadow-lg shadow-orange-500/20 group-hover:bg-orange-600' : 'bg-gray-200 text-gray-400'} flex items-center justify-center transition-colors">
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
    div.className = 'min-h-screen bg-white pb-24';

    div.innerHTML = `
        <div class="sticky top-0 bg-white z-10 p-6 border-b border-gray-50">
            <div class="flex justify-between items-center mb-4">
                <h1 class="text-2xl font-bold text-secondary">Inbox</h1>
            </div>
            <div class="flex gap-2 bg-gray-50 p-1 rounded-xl">
                <button onclick="switchMsgTab('offers')" class="flex-1 py-2.5 text-xs font-bold rounded-lg transition-all ${state.activeMsgTab === 'offers' ? 'bg-white text-primary shadow-sm' : 'text-gray-400 hover:text-gray-600'}">
                    Notifications
                    ${state.notifications.length > 0 ? `<span class="ml-1 px-1.5 py-0.5 bg-red-100 text-red-500 rounded-full text-[10px]">${state.notifications.length}</span>` : ''}
                </button>
                <button onclick="switchMsgTab('chat')" class="flex-1 py-2.5 text-xs font-bold rounded-lg transition-all ${state.activeMsgTab === 'chat' ? 'bg-white text-primary shadow-sm' : 'text-gray-400 hover:text-gray-600'}">
                    Messages
                    ${state.messages.some(m => !m.read && m.direction === 'staff_to_customer') ? `<span class="ml-1 w-2 h-2 bg-red-500 rounded-full inline-block"></span>` : ''}
                </button>
            </div>
        </div>
        
        <div class="p-4 space-y-4">
            ${state.activeMsgTab === 'offers' ? renderNotificationsTab() : renderChatTab()}
        </div>
    `;

    app.appendChild(div);
    renderBottomNav();
}

function renderNotificationsTab() {
    if (state.notifications.length === 0) {
        return `
            <div class="text-center py-12">
                <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i data-lucide="bell" class="w-8 h-8 text-gray-400"></i>
                </div>
                <p class="text-gray-500 font-bold">No notifications yet</p>
                <p class="text-xs text-cool-gray-400 mt-2">We will let you know when we have something for you!</p>
            </div>
        `;
    }

    return state.notifications.map(n => `
        <div class="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex gap-3 relative overflow-hidden group animate-fade-in hover:shadow-md transition">
            <div class="absolute left-0 top-0 bottom-0 w-1 ${n.type === 'offer' ? 'bg-primary' : n.type === 'alert' ? 'bg-red-500' : 'bg-blue-500'}"></div>
            <div class="w-10 h-10 rounded-full ${n.type === 'offer' ? 'bg-orange-50 text-primary' : n.type === 'alert' ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-500'} flex items-center justify-center flex-shrink-0">
                <i data-lucide="${n.type === 'offer' ? 'ticket-percent' : n.type === 'alert' ? 'alert-triangle' : 'info'}" class="w-5 h-5"></i>
            </div>
            <div class="flex-1 min-w-0">
                <h3 class="font-bold text-sm text-secondary mb-1 truncate">${n.title}</h3>
                <p class="text-xs text-gray-500 leading-relaxed line-clamp-2">${n.message}</p>
                <span class="text-[10px] text-gray-300 mt-2 block font-medium">${n.timestamp ? new Date(n.timestamp.toDate()).toLocaleDateString() : 'Just now'}</span>
            </div>
        </div>
    `).join('');
}

function renderChatTab() {
    const latestMsg = state.messages.length > 0
        ? state.messages.sort((a, b) => b.timestamp?.seconds - a.timestamp?.seconds)[0].text
        : 'Hello! How can we help you today?';

    const latestTime = state.messages.length > 0
        ? new Date(state.messages[0].timestamp?.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : 'Now';

    return `
        <button onclick="openSupportChat()" class="w-full bg-white border border-gray-100 p-4 rounded-2xl shadow-sm flex gap-4 items-start hover:shadow-md transition active:scale-95 text-left animate-fade-in">
            <div class="relative">
                <div class="w-14 h-14 rounded-full bg-primary flex items-center justify-center border-4 border-white shadow-sm font-bold text-white">
                    <i data-lucide="headset" class="w-8 h-8"></i>
                </div>
                <span class="absolute bottom-0 right-0 w-4 h-4 bg-green-500 border-2 border-white rounded-full"></span>
            </div>
            
            <div class="flex-1 min-w-0">
                <div class="flex justify-between items-center mb-1">
                    <h3 class="font-bold text-secondary text-lg">N-Cafe Support</h3>
                    <span class="text-xs text-blue-400 font-medium">${latestTime}</span>
                </div>
                <p class="text-xs text-green-600 font-medium mb-1">● Online - Usually responds in 5 mins</p>
                <p class="text-sm text-gray-500 line-clamp-2 leading-relaxed">${latestMsg}</p>
            </div>
        </button>
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
    div.className = 'h-screen flex flex-col bg-white';
    div.innerHTML = `
        <!-- Chat Header -->
        <header class="p-4 flex items-center gap-4 border-b border-gray-100 shadow-sm sticky top-0 bg-white z-10">
            <button onclick="goToMessages()" class="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-full transition">
                <i data-lucide="arrow-left" class="w-6 h-6"></i>
            </button>
            <div class="relative">
                <div class="w-10 h-10 bg-primary rounded-full flex items-center justify-center text-white">
                    <i data-lucide="headset" class="w-6 h-6"></i>
                </div>
                <div class="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
            </div>
            <div class="flex-1">
                <h3 class="font-bold text-secondary">N-Cafe Support</h3>
                <span class="text-xs text-green-500 font-bold block">Online</span>
            </div>
            <button class="p-2 text-gray-400 hover:bg-gray-50 rounded-full">
                <i data-lucide="more-vertical" class="w-5 h-5"></i>
            </button>
        </header>

        <!-- Chat Area -->
        <div id="chat-container" class="flex-1 overflow-y-auto p-4 space-y-6 bg-gray-50/50">
            <!-- Intro Message -->
            <div class="text-center py-6">
                <span class="text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-full">Today</span>
            </div>

            ${sorted.map(msg => {
        const isMe = msg.direction === 'customer_to_staff';
        const time = msg.timestamp
            ? new Date(msg.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : '';

        return `
                    <div class="flex flex-col ${isMe ? 'items-end' : 'items-start'}">
                        <div class="max-w-[80%] p-4 rounded-2xl text-sm relative shadow-sm ${isMe
                ? 'bg-primary text-white rounded-br-none'
                : 'bg-white text-secondary border border-gray-100 rounded-bl-none'
            }">
                            ${msg.text}
                        </div>
                        <span class="text-[10px] text-gray-400 mt-1 px-1">${time}</span>
                    </div>
                `;
    }).join('')}
        </div>

        <!-- Input Area -->
        <form onsubmit="sendChatMessage(event)" class="p-4 bg-white border-t border-gray-100 flex items-center gap-3">
            <button type="button" class="text-gray-400 hover:text-gray-600 p-2">
                <i data-lucide="paperclip" class="w-5 h-5"></i>
            </button>
            <div class="flex-1 bg-gray-50 rounded-full flex items-center px-4 py-2 border border-gray-100 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10 transition-all">
                <input type="text" name="message" placeholder="Type a message..." required autocomplete="off"
                    class="flex-1 bg-transparent border-none outline-none text-sm h-8 placeholder:text-gray-400">
            </div>
            <button type="submit" class="w-12 h-12 bg-primary text-white rounded-full flex items-center justify-center shadow-lg shadow-orange-500/20 active:scale-95 transition hover:bg-orange-600">
                <i data-lucide="send-horizontal" class="w-5 h-5 ml-0.5"></i>
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
        alert('Failed to send message: ' + err.message);
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
                <p class="text-gray-500 mb-4">Please login to chat with support.</p>
                <button onclick="goToAuth()" class="bg-primary text-white px-6 py-2 rounded-xl font-bold">Login</button>
            </div>
        `;
    }

    // Sort messages just in case
    const sorted = state.messages.sort((a, b) => (a.timestamp?.seconds || 0) - (b.timestamp?.seconds || 0));

    return `
        <div class="flex flex-col h-[calc(100vh-180px)]">
            <!-- Messages Area -->
            <div id="chat-container" class="flex-1 overflow-y-auto p-2 space-y-3">
                ${sorted.length === 0 ? `
                    <div class="text-center text-gray-400 text-xs mt-10">
                        <p>Start a conversation with us!</p>
                        <p>We usually reply within minutes.</p>
                    </div>
                ` : sorted.map(msg => {
        const isMe = msg.direction === 'customer_to_staff';
        return `
                        <div class="flex ${isMe ? 'justify-end' : 'justify-start'}">
                            <div class="max-w-[80%] p-3 rounded-2xl text-sm ${isMe ? 'bg-primary text-white rounded-tr-none' : 'bg-gray-100 text-secondary rounded-tl-none'}">
                                ${msg.text}
                            </div>
                        </div>
                    `;
    }).join('')}
            </div>
            
            <!-- Input Area -->
            <form onsubmit="sendChatMessage(event)" class="mt-auto pt-4 border-t border-gray-100 flex gap-2">
                <input type="text" name="message" placeholder="Type a message..." required
                    class="flex-1 bg-gray-100 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary/20 text-sm">
                <button type="submit" class="w-12 h-12 bg-secondary text-white rounded-xl flex items-center justify-center hover:bg-gray-800 transition active:scale-95">
                    <i data-lucide="send" class="w-5 h-5"></i>
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
        alert('Failed to send message: ' + err.message);
    }
}

function scrollToBottom() {
    setTimeout(() => {
        const container = document.getElementById('chat-container');
        if (container) container.scrollTop = container.scrollHeight;
    }, 100);
}


function placeOrder() {
    // Check if user is logged in before proceeding to payment
    if (!state.user) {
        // Guest user - redirect to login/auth page
        showToast('Please log in to place your order 🔒', 'error');
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
    const orderId = 'ORD' + Date.now();
    const subtotal = state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const tax = subtotal * 0.05;
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
        await db.collection('orders').doc(orderId).set(order);
        console.log('✅ Order saved to Firebase successfully!');
        console.log('📝 Order ID:', orderId, 'for user:', state.studentId);
        state.orderId = orderId;
        state.lastOrder = order;

        // Clear cart after successful order
        const orderCopy = [...state.cart];
        state.cart = [];
        saveCart();
        state.specialInstructions = '';

        state.view = 'receipt';
        setupOrderTracking(orderId);
        render();
    } catch (error) {
        console.error('❌ Order error:', error);
        alert('Failed to place order: ' + error.message);
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
    div.className = 'min-h-screen bg-white flex flex-col p-8 pb-24';
    div.innerHTML = `
        <!-- Header -->
        <div class="text-center mb-8 mt-4">
            <h1 class="text-2xl font-bold text-secondary mb-6">Login</h1>
        </div>

        <!-- Tabs -->
        <div class="flex gap-2 mb-8">
            <button onclick="switchAuthMode('login')" 
                class="flex-1 py-3 rounded-xl font-bold text-sm transition ${state.authMode === 'login' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'}">
                Login
            </button>
            <button onclick="switchAuthMode('register')" 
                class="flex-1 py-3 rounded-xl font-bold text-sm transition ${state.authMode === 'register' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'}">
                Register
            </button>
        </div>

        ${state.authMode === 'login' ? `
            <!-- Login Form -->
            <form onsubmit="handleLogin(event)" class="space-y-4">
                <!-- Email -->
                <div class="relative">
                    <label class="text-xs text-gray-400 mb-1 block">Email Address</label>
                    <div class="flex items-center bg-gray-50 rounded-xl border border-gray-200 px-4 py-3">
                        <i data-lucide="mail" class="w-5 h-5 text-gray-400 mr-3"></i>
                        <input type="email" name="email" placeholder="Enter your email" required
                            class="flex-1 bg-transparent outline-none text-sm">
                    </div>
                </div>

                <!-- Password -->
                <div class="relative">
                    <label class="text-xs text-gray-400 mb-1 block">Password</label>
                    <div class="flex items-center bg-gray-50 rounded-xl border border-gray-200 px-4 py-3">
                        <i data-lucide="lock" class="w-5 h-5 text-gray-400 mr-3"></i>
                        <input type="password" id="login-password" name="password" placeholder="Enter your password" required
                            class="flex-1 bg-transparent outline-none text-sm">
                        <button type="button" onclick="togglePassword('login-password')" class="ml-2">
                            <i data-lucide="eye" class="w-5 h-5 text-gray-400"></i>
                        </button>
                    </div>
                </div>

                <!-- Remember & Forgot -->
                <div class="flex justify-between items-center text-xs">
                    <label class="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" name="remember" class="w-4 h-4 text-primary rounded">
                        <span class="text-gray-600">Remember me</span>
                    </label>
                    <button type="button" onclick="forgotPassword()" class="text-primary font-bold">
                        Forgot password?
                    </button>
                </div>

                <!-- Login Button -->
                <button type="submit" class="w-full bg-primary text-white py-4 rounded-xl font-bold shadow-lg active:scale-95 transition">
                    Login
                </button>

                <!-- Divider -->
                <div class="flex items-center gap-4 my-6">
                    <div class="flex-1 h-px bg-gray-200"></div>
                    <span class="text-xs text-gray-400">Or</span>
                    <div class="flex-1 h-px bg-gray-200"></div>
                </div>

                <!-- Social Login -->
                <div class="grid grid-cols-2 gap-3">
                    <button type="button" onclick="loginWithFacebook()" class="flex items-center justify-center gap-2 bg-[#1877F2] text-white py-3 rounded-xl font-bold text-sm active:scale-95 transition">
                        <i data-lucide="facebook" class="w-5 h-5 fill-current"></i>
                        Facebook
                    </button>
                    <button type="button" onclick="loginWithGoogle()" class="flex items-center justify-center gap-2 bg-gray-100 text-gray-700 py-3 rounded-xl font-bold text-sm active:scale-95 transition">
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
                    <label class="text-xs text-gray-400 mb-1 block">Full Name</label>
                    <div class="flex items-center bg-gray-50 rounded-xl border border-gray-200 px-4 py-3">
                        <i data-lucide="user" class="w-5 h-5 text-gray-400 mr-3"></i>
                        <input type="text" name="name" placeholder="Enter your full name" required
                            class="flex-1 bg-transparent outline-none text-sm">
                    </div>
                </div>

                <!-- Email -->
                <div class="relative">
                    <label class="text-xs text-gray-400 mb-1 block">Email Address</label>
                    <div class="flex items-center bg-gray-50 rounded-xl border border-gray-200 px-4 py-3">
                        <i data-lucide="mail" class="w-5 h-5 text-gray-400 mr-3"></i>
                        <input type="email" name="email" placeholder="Enter your email" required
                            class="flex-1 bg-transparent outline-none text-sm">
                    </div>
                </div>

                <!-- Phone Number -->
                <div class="relative">
                    <label class="text-xs text-gray-400 mb-1 block">Phone Number</label>
                    <div class="flex items-center bg-gray-50 rounded-xl border border-gray-200 px-4 py-3">
                        <i data-lucide="phone" class="w-5 h-5 text-gray-400 mr-3"></i>
                        <input type="tel" name="phone" placeholder="077XXXXXXX" required
                            class="flex-1 bg-transparent outline-none text-sm">
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
    div.className = 'min-h-screen bg-white flex flex-col';
    div.innerHTML = `
        <!-- Profile Header -->
        <div class="bg-white p-6 text-center border-b border-gray-100">
            <div class="w-24 h-24 mx-auto mb-4 rounded-full overflow-hidden border-4 border-primary">
                ${state.user?.photo ? `
                    <img src="${state.user.photo}" class="w-full h-full object-cover">
                ` : `
                    <div class="w-full h-full bg-primary flex items-center justify-center text-white text-3xl font-bold">
                        ${state.user?.name ? state.user.name[0].toUpperCase() : 'U'}
                    </div>
                `}
            </div>
            <h2 class="text-xl font-bold text-secondary mb-1">${state.user?.name || 'Guest User'}</h2>
            <p class="text-sm text-gray-400">${state.user?.email || 'No email'}</p>
        </div>

        <!-- Menu Options -->
        <div class="p-6 space-y-3">
            <button onclick="editProfile()" class="w-full bg-gray-50 p-4 rounded-xl flex items-center justify-between hover:bg-gray-100 transition active:scale-95">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-white rounded-full flex items-center justify-center">
                        <i data-lucide="user" class="w-5 h-5 text-secondary"></i>
                    </div>
                    <span class="font-bold text-secondary">Personal Information</span>
                </div>
                <i data-lucide="chevron-right" class="w-5 h-5 text-gray-400"></i>
            </button>

            <button onclick="viewMyOrders()" class="w-full bg-gray-50 p-4 rounded-xl flex items-center justify-between hover:bg-gray-100 transition active:scale-95">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-white rounded-full flex items-center justify-center">
                        <i data-lucide="shopping-bag" class="w-5 h-5 text-secondary"></i>
                    </div>
                    <span class="font-bold text-secondary">My Orders</span>
                </div>
                <i data-lucide="chevron-right" class="w-5 h-5 text-gray-400"></i>
            </button>

            <button onclick="logout()" class="w-full bg-red-50 p-4 rounded-xl flex items-center justify-between hover:bg-red-100 transition active:scale-95 mt-8">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-white rounded-full flex items-center justify-center">
                        <i data-lucide="log-out" class="w-5 h-5 text-red-500"></i>
                    </div>
                    <span class="font-bold text-red-500">Logout</span>
                </div>
            </button>
        </div>

        <!-- Back Button -->
        <button onclick="goHome()" class="m-6 mt-auto py-4 bg-gray-100 text-secondary rounded-xl font-bold active:scale-95 transition">
            Back to Home
        </button>
    `;
    app.appendChild(div);
}

function renderProfileEdit() {
    const div = document.createElement('div');
    div.className = 'min-h-screen bg-white flex flex-col';
    div.innerHTML = `
        <!-- Header -->
        <header class="sticky top-0 bg-white border-b border-gray-100 p-6 flex items-center gap-4">
            <button onclick="goToProfile()" class="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center active:scale-95 transition">
                <i data-lucide="arrow-left" class="w-5 h-5"></i>
            </button>
            <h1 class="text-lg font-bold">Personal Information</h1>
        </header>

        <!-- Profile Photo -->
        <div class="p-6 text-center border-b border-gray-100">
            <div class="w-24 h-24 mx-auto mb-3 rounded-full overflow-hidden border-4 border-gray-200 relative">
                ${state.user?.photo ? `
                    <img src="${state.user.photo}" class="w-full h-full object-cover">
                ` : `
                    <div class="w-full h-full bg-primary flex items-center justify-center text-white text-3xl font-bold">
                        ${state.user?.name ? state.user.name[0].toUpperCase() : 'U'}
                    </div>
                `}
            </div>
            <button onclick="changePhoto()" class="text-primary font-bold text-sm">Change your photo</button>
        </div>

        <!-- Edit Form -->
        <form onsubmit="saveProfile(event)" class="p-6 space-y-4 flex-1">
            <!-- Name -->
            <div>
                <label class="text-xs text-gray-400 mb-2 block">Name</label>
                <input type="text" name="name" value="${state.user?.name || ''}" required
                    class="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-primary transition">
            </div>

            <!-- Email & Phone -->
            <div class="grid grid-cols-2 gap-3">
                <div>
                    <label class="text-xs text-gray-400 mb-2 block">Email</label>
                    <input type="email" name="email" value="${state.user?.email || ''}" required
                        class="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-primary transition text-sm">
                </div>
                <div>
                    <label class="text-xs text-gray-400 mb-2 block">Phone Number</label>
                    <input type="tel" name="phone" value="${state.user?.phone || '+880'}" required
                        class="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-primary transition text-sm">
                </div>
            </div>

            <!-- Save Button -->
            <button type="submit" class="w-full bg-primary text-white py-4 rounded-xl font-bold shadow-lg active:scale-95 transition mt-8">
                Save Changes
            </button>
        </form>
    `;
    app.appendChild(div);
}

function renderMyOrders() {
    const div = document.createElement('div');
    div.className = 'min-h-screen bg-gray-50 flex flex-col pb-24';
    div.innerHTML = `
        <!-- Header -->
        <header class="sticky top-0 bg-white border-b border-gray-100 p-6 flex items-center gap-4 z-20">
            <h1 class="text-lg font-bold">My Orders</h1>
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

    // Fetch user's orders from Firebase
    if (state.user) {
        console.log('🔍 Fetching orders for user:', state.user.email);

        db.collection('orders')
            .where('user.id', '==', state.user.email)
            .limit(50)
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
                        'preparing': 'bg-yellow-100 text-yellow-700',
                        'ready': 'bg-green-100 text-green-700',
                        'completed': 'bg-blue-100 text-blue-700',
                        'cancelled': 'bg-red-100 text-red-700'
                    };

                    const statusIcons = {
                        'preparing': 'chef-hat',
                        'ready': 'bell-ring',
                        'completed': 'check-circle',
                        'cancelled': 'x-circle'
                    };

                    const status = order.status || 'preparing';
                    const statusClass = statusColors[status] || 'bg-gray-100 text-gray-700';
                    const statusIcon = statusIcons[status] || 'circle';

                    return `
                        <div class="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition">
                            <!-- Order Header -->
                            <div class="flex justify-between items-start mb-4">
                                <div>
                                    <div class="flex items-center gap-2 mb-1">
                                        <span class="font-bold text-secondary">#${order.id.substring(0, 12)}...</span>
                                        <span class="${statusClass} text-xs px-2 py-1 rounded-full font-bold flex items-center gap-1">
                                            <i data-lucide="${statusIcon}" class="w-3 h-3"></i>
                                            ${status.charAt(0).toUpperCase() + status.slice(1)}
                                        </span>
                                    </div>
                                    <span class="text-xs text-gray-400">${formattedDate} • ${formattedTime}</span>
                                </div>
                                <span class="text-lg font-bold text-primary">LKR ${order.total}</span>
                            </div>

                            <!-- Order Items -->
                            <div class="space-y-2 pt-3 border-t border-gray-100">
                                ${order.items.map(item => `
                                    <div class="flex items-center gap-3">
                                        <div class="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                                            ${item.image ? `<img src="${item.image}" class="w-full h-full object-cover">` : ''}
                                        </div>
                                        <div class="flex-1 min-w-0">
                                            <p class="font-bold text-sm text-secondary truncate">${item.name}</p>
                                            <p class="text-xs text-gray-400">LKR ${item.price} × ${item.quantity}</p>
                                        </div>
                                        <span class="font-bold text-sm text-secondary">LKR ${item.price * item.quantity}</span>
                                    </div>
                                `).join('')}
                            </div>

                            <!-- Payment Method -->
                            ${order.user?.paymentMethod ? `
                                <div class="mt-4 pt-3 border-t border-gray-100 flex items-center gap-2 text-xs text-gray-500">
                                    <i data-lucide="credit-card" class="w-4 h-4"></i>
                                    <span>Paid via ${order.user.paymentMethod === 'visa' ? 'Visa/Mastercard' : order.user.paymentMethod.charAt(0).toUpperCase() + order.user.paymentMethod.slice(1)}</span>
                                </div>
                            ` : ''}

                            <!-- Reorder Button -->
                            <!-- Actions -->
                            <div class="flex gap-2 mt-4">
                                <button onclick="viewBill('${order.id}')" class="flex-1 bg-white border border-gray-200 text-secondary py-3 rounded-xl font-bold text-sm active:scale-95 transition hover:bg-gray-50 flex items-center justify-center gap-2">
                                    <i data-lucide="receipt" class="w-4 h-4 text-gray-400"></i> View Bill
                                </button>
                                ${status === 'completed' ? `
                                    <button onclick="reorder('${order.id}')" class="flex-1 bg-primary text-white py-3 rounded-xl font-bold text-sm active:scale-95 transition hover:bg-orange-600 shadow-lg shadow-orange-500/20">
                                        Order Again
                                    </button>
                                ` : ''}
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
            alert('Failed to reorder. Please try again.');
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
            state.user = {
                uid: user.uid,
                email: user.email,
                name: user.displayName || email.split('@')[0],
                photo: user.photoURL
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
        })
        .catch((error) => {
            console.error('❌ Login error:', error);
            alert(error.message);
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

            // If user has items in cart, redirect to checkout
            if (state.cart.length > 0) {
                state.view = 'checkout';
            } else {
                state.view = 'home';
            }

            render();
            alert('✅ Account created! Please check your email to verify your account.');
            console.log('✅ Registration successful');
        })
        .catch((error) => {
            console.error('❌ Registration error:', error);
            alert(error.message);
        });
}

function forgotPassword() {
    // improved UI for forgot password
    const overlay = document.createElement('div');
    overlay.id = 'forgot-password-modal';
    overlay.className = 'fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-fade-in';
    overlay.innerHTML = `
        <div class="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl relative">
            <button onclick="document.getElementById('forgot-password-modal').remove()" class="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                <i data-lucide="x" class="w-6 h-6"></i>
            </button>
            
            <div class="text-center mb-6">
                <div class="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i data-lucide="key-round" class="w-8 h-8 text-primary"></i>
                </div>
                <h3 class="text-xl font-bold text-secondary mb-2">Forgot Password?</h3>
                <p class="text-sm text-gray-500">Enter your email and we'll send you a link to reset your password.</p>
            </div>
            
            <form onsubmit="handleForgotPassword(event)">
                <div class="mb-6">
                    <input type="email" name="email" placeholder="Enter your email" required autofocus
                        class="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-primary transition text-sm">
                </div>
                
                <button type="submit" class="w-full bg-primary text-white py-3 rounded-xl font-bold shadow-lg shadow-orange-500/20 active:scale-95 transition">
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
                showToast('✅ Reset link sent! Check your inbox.', 'success');
            })
            .catch((error) => {
                console.error('❌ Password reset error:', error);
                btn.innerText = originalText;
                btn.disabled = false;
                showToast(error.message, 'error');
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
            alert(error.message);
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
            alert(error.message);
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

function logout() {
    if (confirm('Are you sure you want to logout?')) {
        firebase.auth().signOut();
        state.user = null;
        localStorage.removeItem('ncafe_user');
        state.view = 'home';
        render();
        console.log('✅ Logged out');
    }
}

function changePhoto() {
    alert('Photo upload feature coming soon!');
}

function saveProfile(e) {
    e.preventDefault();
    const formData = new FormData(e.target);

    state.user = {
        ...state.user,
        name: formData.get('name'),
        email: formData.get('email'),
        phone: formData.get('phone')
    };

    // Update Firebase profile
    const user = firebase.auth().currentUser;
    if (user) {
        user.updateProfile({
            displayName: state.user.name
        }).then(() => {
            alert('✅ Profile updated!');
            state.view = 'profile';
            render();
        });
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
    nav.className = 'fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex justify-around p-2 pb-4 z-50 max-w-md mx-auto';
    nav.innerHTML = `
        <button onclick="switchStaffTab('orders')" 
            class="flex-1 p-2 rounded-xl flex flex-col items-center gap-1 ${state.staffTab === 'orders' ? 'text-primary' : 'text-gray-400 hover:text-secondary hover:bg-gray-50'}">
            <i data-lucide="clipboard-list" class="w-6 h-6"></i>
            <span class="text-[10px] font-bold">Orders</span>
        </button>
        <button onclick="switchStaffTab('scanner')" 
            class="flex-1 p-2 rounded-xl flex flex-col items-center gap-1 ${state.staffTab === 'scanner' ? 'text-primary' : 'text-gray-400 hover:text-secondary hover:bg-gray-50'}">
            <div class="w-12 h-12 bg-secondary text-white rounded-full flex items-center justify-center -mt-8 border-4 border-white shadow-lg">
                <i data-lucide="scan-face" class="w-6 h-6"></i>
            </div>
            <span class="text-[10px] font-bold mt-1">Scan</span>
        </button>
        <button onclick="switchStaffTab('stock')" 
            class="flex-1 p-2 rounded-xl flex flex-col items-center gap-1 ${state.staffTab === 'stock' ? 'text-primary' : 'text-gray-400 hover:text-secondary hover:bg-gray-50'}">
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
        console.log('✅ User authenticated:', user.email);
        initChatListener(); // Start listening for messages
    } else if (!savedUser) {
        state.user = null;
    }
    render();
});


render();
console.log('✅ N-Cafe Customer App Loaded');
console.log('💡 Type "staff" to toggle staff mode');

// ==============================================
// UTILS
// ==============================================

function showToast(message, type = 'info') {
    // Remove existing toasts specific to this message to to avoid duplicates stacking
    const existing = document.querySelectorAll('.ncafe-toast');
    existing.forEach(t => {
        if (t.innerText === message) t.remove();
    });

    const toast = document.createElement('div');
    toast.className = `ncafe-toast fixed top-6 left-1/2 -translate-x-1/2 bg-secondary text-white px-6 py-4 rounded-2xl shadow-2xl z-[100] flex items-center gap-3 toast-enter max-w-[90%] w-auto`;

    // Icon based on type
    let icon = 'info';
    let iconColor = 'text-primary';

    if (type === 'error') {
        icon = 'alert-circle';
        iconColor = 'text-red-400';
    } else if (type === 'success') {
        icon = 'check-circle';
        iconColor = 'text-green-400';
    }

    toast.innerHTML = `
        <i data-lucide="${icon}" class="w-6 h-6 ${iconColor} flex-shrink-0"></i>
        <span class="font-bold text-sm bg-transparent">${message}</span>
    `;

    document.body.appendChild(toast);
    lucide.createIcons();

    // Remove after 3 seconds
    setTimeout(() => {
        toast.classList.remove('toast-enter');
        toast.classList.add('toast-exit');
        setTimeout(() => toast.remove(), 400);
    }, 3000);
}
