
// FIREBASE CONFIG FROM USER
const firebaseConfig = {
    apiKey: "AIzaSyDl4UWK-WXRTwAPM-7U2KgkOekhmnb-X7Q",
    authDomain: "ncafe-test.firebaseapp.com",
    projectId: "ncafe-test",
    storageBucket: "ncafe-test.firebasestorage.app",
    messagingSenderId: "349521309019",
    appId: "1:349521309019:web:78e4698765102ee1b3be7e"
};

// INITIALIZE FIREBASE (Global Scope via Compat SDK)
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// ----------------------------------------------------------------------------
// SYSTEM SETTINGS (Reactive Global)
// ----------------------------------------------------------------------------
window.systemSettings = {
    systemPin: '1111',
    taxRate: 5,
    isStoreOpen: true,
    lastUpdated: null
};

// 1. Security Settings Listener (PIN)
db.collection('settings').doc('security').onSnapshot((doc) => {
    if (doc.exists) {
        window.systemSettings.systemPin = doc.data().systemPin || '1111';
    } else {
        db.collection('settings').doc('security').set({ systemPin: '1111' });
    }
});

// 2. General Settings Listener (Tax, Store Status)
db.collection('settings').doc('general').onSnapshot((doc) => {
    if (doc.exists) {
        const data = doc.data();
        window.systemSettings.taxRate = data.taxRate !== undefined ? data.taxRate : 5;
        window.systemSettings.isStoreOpen = data.isStoreOpen !== undefined ? data.isStoreOpen : true;
        window.systemSettings.lastUpdated = data.lastUpdated;
    } else {
        db.collection('settings').doc('general').set({
            taxRate: 5,
            isStoreOpen: true,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        });
    }
    window.dispatchEvent(new Event('settings-updated'));
});

// GLOBAL NOTIFICATION SYSTEM (TOAST)
(function () {
    const style = document.createElement('style');
    style.textContent = `
        .ncafe-toast-container {
            position: fixed;
            top: 24px;
            right: 24px;
            z-index: 9999;
            display: flex;
            flex-direction: column;
            gap: 12px;
            pointer-events: none;
        }
        .ncafe-toast {
            min-width: 320px;
            max-width: 400px;
            background: rgba(255, 255, 255, 0.8);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.3);
            border-radius: 16px;
            padding: 16px 20px;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
            display: flex;
            align-items: flex-start;
            gap: 14px;
            transform: translateX(120%);
            transition: all 0.5s cubic-bezier(0.19, 1, 0.22, 1);
            pointer-events: auto;
        }
        .dark .ncafe-toast {
            background: rgba(22, 30, 46, 0.8);
            border: 1px solid rgba(255, 255, 255, 0.05);
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3);
        }
        .ncafe-toast.show { transform: translateX(0); }
        .ncafe-toast-icon {
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 8px;
            flex-shrink: 0;
        }
        .ncafe-toast-content { flex: 1; }
        .ncafe-toast-title {
            font-size: 14px;
            font-weight: 800;
            margin-bottom: 2px;
            color: #111827;
        }
        .dark .ncafe-toast-title { color: #F3F4F6; }
        .ncafe-toast-message {
            font-size: 13px;
            color: #4B5563;
            line-height: 1.4;
            font-weight: 500;
        }
        .dark .ncafe-toast-message { color: #94A3B8; }
        
        /* Types */
        .toast-success .ncafe-toast-icon { background: rgba(16, 185, 129, 0.1); color: #10B981; }
        .toast-error .ncafe-toast-icon { background: rgba(239, 68, 68, 0.1); color: #EF4444; }
        .toast-info .ncafe-toast-icon { background: rgba(59, 130, 246, 0.1); color: #3B82F6; }

        /* Confirmation Dialog */
        .ncafe-confirm-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.4);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0;
            transition: opacity 0.3s ease;
            padding: 24px;
        }
        .ncafe-confirm-overlay.show { opacity: 1; }
        .ncafe-confirm-modal {
            background: white;
            width: 100%;
            max-width: 400px;
            border-radius: 28px;
            padding: 32px;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
            transform: scale(0.9) translateY(20px);
            transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            text-align: center;
        }
        .dark .ncafe-confirm-modal {
            background: #161E2E;
            border: 1px solid rgba(255, 255, 255, 0.05);
        }
        .ncafe-confirm-overlay.show .ncafe-confirm-modal { transform: scale(1) translateY(0); }
        .ncafe-confirm-icon {
            width: 64px;
            height: 64px;
            background: rgba(255, 107, 0, 0.1);
            color: #FF6B00;
            border-radius: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 24px;
        }
        .ncafe-confirm-title {
            font-size: 20px;
            font-weight: 800;
            color: #111827;
            margin-bottom: 12px;
        }
        .dark .ncafe-confirm-title { color: #F3F4F6; }
        .ncafe-confirm-message {
            font-size: 15px;
            color: #6B7280;
            line-height: 1.6;
            margin-bottom: 32px;
            font-weight: 500;
        }
        .dark .ncafe-confirm-message { color: #94A3B8; }
        .ncafe-confirm-actions {
            display: flex;
            gap: 12px;
        }
        .ncafe-confirm-btn {
            flex: 1;
            padding: 14px;
            border-radius: 16px;
            font-size: 14px;
            font-weight: 800;
            transition: all 0.2s;
        }
        .ncafe-confirm-btn-cancel {
            background: #F3F4F6;
            color: #4B5563;
        }
        .dark .ncafe-confirm-btn-cancel {
            background: #1F2937;
            color: #94A3B8;
        }
        .ncafe-confirm-btn-confirm {
            background: #FF6B00;
            color: white;
            box-shadow: 0 10px 15px -3px rgba(255, 107, 0, 0.3);
        }
        .ncafe-confirm-btn-confirm.danger {
            background: #EF4444;
            box-shadow: 0 10px 15px -3px rgba(239, 68, 68, 0.3);
        }
        .ncafe-confirm-btn:active { transform: scale(0.95); }

        /* PIN Prompt */
        .ncafe-pin-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 12px;
            margin-top: 24px;
        }
        .ncafe-pin-btn {
            aspect-ratio: 1;
            border-radius: 16px;
            background: #F3F4F6;
            color: #111827;
            font-size: 20px;
            font-weight: 800;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
        }
        .dark .ncafe-pin-btn {
            background: #1F2937;
            color: #F3F4F6;
        }
        .ncafe-pin-btn:active { transform: scale(0.9); background: #E5E7EB; }
        .dark .ncafe-pin-btn:active { background: #374151; }
        
        .ncafe-pin-dots {
            display: flex;
            justify-content: center;
            gap: 12px;
            margin-bottom: 8px;
        }
        .ncafe-pin-dot {
            width: 14px;
            height: 14px;
            border-radius: 50%;
            border: 2px solid #D1D5DB;
            transition: all 0.2s;
        }
        .dark .ncafe-pin-dot { border-color: #4B5563; }
        .ncafe-pin-dot.filled {
            background: #FF6B00;
            border-color: #FF6B00;
            transform: scale(1.2);
        }
    `;
    document.head.appendChild(style);

    const container = document.createElement('div');
    container.className = 'ncafe-toast-container';
    document.body.appendChild(container);

    window.showToast = function (title, message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `ncafe-toast toast-${type}`;

        const icons = {
            success: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>',
            error: '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>',
            info: '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line>'
        };

        toast.innerHTML = `
            <div class="ncafe-toast-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${icons[type]}</svg>
            </div>
            <div class="ncafe-toast-content">
                <div class="ncafe-toast-title">${title}</div>
                <div class="ncafe-toast-message">${message}</div>
            </div>
        `;

        container.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 10);

        const removeToast = () => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 500);
        };

        setTimeout(removeToast, 4000);
        toast.onclick = removeToast;
    };

    window.showConfirm = function (options = {}) {
        const {
            title = 'Confirm Action',
            message = 'Are you sure you want to proceed?',
            confirmText = 'Confirm',
            cancelText = 'Cancel',
            isDanger = false
        } = options;

        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'ncafe-confirm-overlay';
            overlay.innerHTML = `
                <div class="ncafe-confirm-modal">
                    <div class="ncafe-confirm-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                            <line x1="12" y1="17" x2="12.01" y2="17"></line>
                        </svg>
                    </div>
                    <div class="ncafe-confirm-title">${title}</div>
                    <div class="ncafe-confirm-message">${message}</div>
                    <div class="ncafe-confirm-actions">
                        <button class="ncafe-confirm-btn ncafe-confirm-btn-cancel">${cancelText}</button>
                        <button class="ncafe-confirm-btn ncafe-confirm-btn-confirm ${isDanger ? 'danger' : ''}">${confirmText}</button>
                    </div>
                </div>
            `;

            document.body.appendChild(overlay);
            setTimeout(() => overlay.classList.add('show'), 10);

            const close = (result) => {
                overlay.classList.remove('show');
                setTimeout(() => {
                    overlay.remove();
                    resolve(result);
                }, 400);
            };

            overlay.querySelector('.ncafe-confirm-btn-cancel').onclick = () => close(false);
            overlay.querySelector('.ncafe-confirm-btn-confirm').onclick = () => close(true);
        });
    };

    window.showPinPrompt = function () {
        return new Promise((resolve) => {
            const systemPin = window.systemSettings.systemPin;
            const overlay = document.createElement('div');
            overlay.className = 'ncafe-confirm-overlay';
            overlay.innerHTML = `
                <div class="ncafe-confirm-modal">
                    <div class="ncafe-confirm-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                        </svg>
                    </div>
                    <div class="ncafe-confirm-title">Security PIN Required</div>
                    <p class="text-xs text-gray-400 mb-6 font-bold uppercase tracking-widest">Verify identity to continue</p>
                    
                    <div class="ncafe-pin-dots">
                        <div class="ncafe-pin-dot"></div>
                        <div class="ncafe-pin-dot"></div>
                        <div class="ncafe-pin-dot"></div>
                        <div class="ncafe-pin-dot"></div>
                    </div>

                    <div class="ncafe-pin-grid">
                        ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button class="ncafe-pin-btn" data-val="${n}">${n}</button>`).join('')}
                        <button class="ncafe-pin-btn text-red-500" data-val="clear"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"></path></svg></button>
                        <button class="ncafe-pin-btn" data-val="0">0</button>
                        <button class="ncafe-pin-btn text-gray-400" onclick="this.closest('.ncafe-confirm-overlay').remove(); resolve(false);"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"></path></svg></button>
                    </div>
                </div>
            `;

            document.body.appendChild(overlay);
            setTimeout(() => overlay.classList.add('show'), 10);

            let currentInput = '';
            const dots = overlay.querySelectorAll('.ncafe-pin-dot');

            const handleInput = (val) => {
                if (val === 'clear') {
                    currentInput = '';
                } else if (currentInput.length < 4) {
                    currentInput += val;
                }

                // Update dots
                dots.forEach((dot, idx) => {
                    dot.classList.toggle('filled', idx < currentInput.length);
                });

                // Check completion
                if (currentInput.length === 4) {
                    if (currentInput === systemPin) {
                        overlay.classList.remove('show');
                        setTimeout(() => {
                            overlay.remove();
                            resolve(true);
                        }, 400);
                    } else {
                        // Vibrate or shake effect
                        const modal = overlay.querySelector('.ncafe-confirm-modal');
                        if (modal) {
                            modal.animate([
                                { transform: 'translateX(-10px)' },
                                { transform: 'translateX(10px)' },
                                { transform: 'translateX(-10px)' },
                                { transform: 'translateX(10px)' },
                                { transform: 'translateX(0)' }
                            ], { duration: 300 });
                        }

                        // Flash dots red
                        dots.forEach(d => d.style.borderColor = '#EF4444');
                        setTimeout(() => {
                            currentInput = '';
                            dots.forEach(d => {
                                d.classList.remove('filled');
                                d.style.borderColor = '';
                            });
                        }, 500);
                    }
                }
            };

            overlay.querySelectorAll('.ncafe-pin-btn').forEach(btn => {
                const val = btn.getAttribute('data-val');
                if (val) btn.onclick = () => handleInput(val);
            });
        });
    };
})();

// FILE:/// ISOLATION FIX: Browsers completely isolate localStorage between file paths. 
// We catch the role from the URL to bridge the gap.
const urlParams = new URLSearchParams(window.location.search);

// 1. TOP-LEVEL PARAM CONSUMPTION (Executes before any auth logic)
const incomingRole = urlParams.get('role');
const logoutSignal = urlParams.get('logout') === 'true';

if (logoutSignal) {
    console.log("Logout signal detected. Clearing local role...");
    localStorage.removeItem('ncafe_user_role');
}
if (incomingRole) {
    console.log("Incoming role detected:", incomingRole);
    localStorage.setItem('ncafe_user_role', incomingRole);
}

// Clear URL params without reloading to keep a clean state
if (incomingRole || logoutSignal) {
    window.history.replaceState(null, '', window.location.pathname);
}

// 2. AUTHENTICATE & ROUTE
auth.onAuthStateChanged((user) => {
    // Handle Logout Logic inside Auth
    if (logoutSignal && user && !user.isAnonymous) {
        auth.signOut();
    }

    if (user) {
        console.log("data.js: User session active globally:", user.email || 'Anonymously');
    } else {
        console.log("data.js: No globally active auth session found.");

        // Auto-sign-in for customers if not on a restricted page or login page
        const isRestrictedPage = window.location.pathname.includes('admin.html') || window.location.pathname.includes('staff.html');
        const isLoginPage = window.location.pathname.includes('login.html');

        if (!isRestrictedPage && !isLoginPage) {
            auth.signInAnonymously().catch(console.error);
        }
    }
});

// LOCAL CACHE FOR SYNCHRONOUS ACCESS
let localOrders = [];
let localMenu = [];

// DEFAULT DATA (Fallback)
const DEFAULT_MENU_ITEMS = [
    // Pastries - Savory
    { id: 101, name: "Chicken Roll", price: 120, category: "Pastries", subCategory: "Savory", image: "https://placehold.co/400x300?text=Chicken+Roll", isAvailable: true, description: "Crispy pastry roll filled with spiced chicken." },
    { id: 102, name: "Fish Patty", price: 100, category: "Pastries", subCategory: "Savory", image: "https://placehold.co/400x300?text=Fish+Patty", isAvailable: true, description: "Golden fried patty with spicy fish filling." },
    { id: 103, name: "Seeni Sambol Bun", price: 80, category: "Pastries", subCategory: "Savory", image: "https://placehold.co/400x300?text=Seeni+Sambol", isAvailable: true, description: "Soft bun stuffed with sweet and spicy onion sambol." },
    { id: 104, name: "Chicken Pie", price: 150, category: "Pastries", subCategory: "Savory", image: "https://placehold.co/400x300?text=Chicken+Pie", isAvailable: false, description: "Baked pastry envelope with creamy chicken filling." },
    { id: 105, name: "Hot Dog", price: 200, category: "Pastries", subCategory: "Savory", image: "https://placehold.co/400x300?text=Hot+Dog", isAvailable: true, description: "Chicken sausage in a soft bun with sauces." },

    // Desserts - Cakes
    { id: 201, name: "Chocolate Slice", price: 250, category: "Desserts", subCategory: "Cakes", image: "https://placehold.co/400x300?text=Choc+Cake", isAvailable: true, description: "Decadent chocolate cake slice." },
    { id: 202, name: "Eclair", price: 180, category: "Desserts", subCategory: "Cakes", image: "https://placehold.co/400x300?text=Eclair", isAvailable: true, description: "Choux pastry filled with cream and topped with chocolate." },
    { id: 203, name: "Glazed Donut", price: 150, category: "Desserts", subCategory: "Cakes", image: "https://placehold.co/400x300?text=Donut", isAvailable: true, description: "Classic soft donut with sugar glaze." },

    // Desserts - Ice Cream
    { id: 251, name: "Vanilla Scoop", price: 100, category: "Desserts", subCategory: "Ice Cream", image: "https://placehold.co/400x300?text=Vanilla", isAvailable: true, description: "Creamy vanilla ice cream." },

    // Hot Drinks - Coffee
    { id: 301, name: "Cappuccino", price: 450, category: "Hot Drinks", subCategory: "Coffee", image: "https://placehold.co/400x300?text=Cappuccino", isAvailable: true, description: "Frothy hot coffee with milk." },
    { id: 302, name: "Espresso", price: 350, category: "Hot Drinks", subCategory: "Coffee", image: "https://placehold.co/400x300?text=Espresso", isAvailable: true, description: "Strong black coffee shot." },
    { id: 303, name: "Mocha", price: 500, category: "Hot Drinks", subCategory: "Coffee", image: "https://placehold.co/400x300?text=Mocha", isAvailable: true, description: "Coffee mixed with hot chocolate." },
    { id: 304, name: "Latte", price: 450, category: "Hot Drinks", subCategory: "Coffee", image: "https://placehold.co/400x300?text=Latte", isAvailable: true, description: "Smooth milky coffee." },

    // Hot Drinks - Chocolate
    { id: 351, name: "Hot Chocolate", price: 400, category: "Hot Drinks", subCategory: "Chocolate", image: "https://placehold.co/400x300?text=Hot+Choc", isAvailable: true, description: "Rich hot cocoa." },

    // Hot Drinks - Tea
    { id: 381, name: "Black Tea", price: 100, category: "Hot Drinks", subCategory: "Tea", image: "https://placehold.co/400x300?text=Black+Tea", isAvailable: true, description: "Classic Ceylon tea." },
    { id: 382, name: "Ginger Tea", price: 120, category: "Hot Drinks", subCategory: "Tea", image: "https://placehold.co/400x300?text=Ginger+Tea", isAvailable: true, description: "Tea with a spicy ginger kick." },
    { id: 383, name: "Mint Tea", price: 130, category: "Hot Drinks", subCategory: "Tea", image: "https://placehold.co/400x300?text=Mint+Tea", isAvailable: true, description: "Refreshing mint infused tea." },
    { id: 384, name: "Milk Tea", price: 150, category: "Hot Drinks", subCategory: "Tea", image: "https://placehold.co/400x300?text=Milk+Tea", isAvailable: true, description: "Creamy tea with milk." },

    // Cold Drinks
    { id: 401, name: "Iced Coffee", price: 450, category: "Cold Drinks", subCategory: "Iced Coffee", image: "https://placehold.co/400x300?text=Iced+Coffee", isAvailable: true, description: "Chilled brewed coffee." },
    { id: 402, name: "Iced Tea", price: 300, category: "Cold Drinks", subCategory: "Iced Tea", image: "https://placehold.co/400x300?text=Iced+Tea", isAvailable: true, description: "Cold refreshing tea." },
    { id: 403, name: "Chocolate Milkshake", price: 550, category: "Cold Drinks", subCategory: "Milkshakes", image: "https://placehold.co/400x300?text=Choco+Shake", isAvailable: true, description: "Thick chocolate shake." },
    { id: 404, name: "Orange Juice", price: 400, category: "Cold Drinks", subCategory: "Juices", image: "https://placehold.co/400x300?text=Orange+Juice", isAvailable: true, description: "Freshly squeezed." },
    { id: 405, name: "Coca-Cola", price: 200, category: "Cold Drinks", subCategory: "Soft Drinks", image: "https://placehold.co/400x300?text=Coke", isAvailable: true, description: "Chilled coke." },
    { id: 406, name: "Sprite", price: 200, category: "Cold Drinks", subCategory: "Soft Drinks", image: "https://placehold.co/400x300?text=Sprite", isAvailable: true, description: "Lemon-lime soda." },
];

const categories = [
    { id: 'all', name: 'All', icon: 'layout-grid' },
    { id: 'Pastries', name: 'Pastries', icon: 'croissant' },
    { id: 'Desserts', name: 'Desserts', icon: 'ice-cream-2' },
    { id: 'Hot Drinks', name: 'Hot Drinks', icon: 'coffee' },
    { id: 'Cold Drinks', name: 'Cold Drinks', icon: 'glass-water' }
];

// DATA STORE API (Firebase Implementation)
const DataStore = {
    getOrders: function () {
        return localOrders; // Returns cached orders immediately
    },
    saveOrder: function (order) {
        // Use ID as doc ID for easier updates
        db.collection('orders').doc(order.id.toString()).set(order)
            .then(() => console.log("Order Saved"))
            .catch(e => {
                console.error(e);
                showToast("Order Error", "We couldn't save your order. Please check your internet connection.", "error");
            });
    },
    updateOrderStatus: function (orderId, status) {
        console.log('DataStore.updateOrderStatus:', orderId, status);
        const docId = typeof orderId === 'string' ? orderId : orderId.toString();
        db.collection('orders').doc(docId).update({
            status: status,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        })
            .then(() => {
                console.log('Order status updated successfully:', docId, status);
            })
            .catch(e => {
                console.error('Update error:', e);
                showToast("Update Failed", "We couldn't update the order status. Please try again.", "error");
            });
    },
    getMenu: function () {
        return localMenu.length ? localMenu : DEFAULT_MENU_ITEMS;
    },
    saveMenuItem: function (item) {
        db.collection('menuItems').doc(item.id.toString()).set(item)
            .then(() => console.log('Item saved:', item.name))
            .catch(e => {
                console.error("Save Error:", e);
                showToast("Menu Error", "Failed to save menu item. Check your permissions.", "error");
            });
    },
    deleteMenuItem: function (id) {
        db.collection('menuItems').doc(id.toString()).delete()
            .then(() => console.log('Item deleted:', id))
            .catch(e => showToast("Delete Error", "Could not remove menu item. Please try again.", "error"));
    },
    saveMenu: function (items) {
        // Batch write for migration/reset
        const batch = db.batch();
        items.forEach(item => {
            const ref = db.collection('menuItems').doc(item.id.toString());
            batch.set(ref, item);
        });
        batch.commit()
            .then(() => console.log("Batch menu update complete"))
            .catch(e => {
                console.error("Batch Save Error:", e);
                showToast("Menu Update Failed", "Failed to save menu changes. Please refresh the page.", "error");
            });
    },
    resetMenuToDefaults: function () {
        console.log("Resetting menu to defaults...");
        this.saveMenu(DEFAULT_MENU_ITEMS);
    },
    reset: function () {
        // For testing
    }
};

// LISTENERS (Real-time Sync)

// 1. Orders Listener
db.collection('orders').onSnapshot((snapshot) => {
    localOrders = [];
    snapshot.forEach((doc) => {
        localOrders.push(doc.data());
    });
    // Sort locally by date (descending)
    localOrders.sort((a, b) => {
        const dateA = (a.date && typeof a.date.toDate === 'function') ? a.date.toDate() : new Date(a.date);
        const dateB = (b.date && typeof b.date.toDate === 'function') ? b.date.toDate() : new Date(b.date);
        return dateB - dateA;
    });
    console.log("✅ Orders Synced:", localOrders.length, "orders");
    if (localOrders.length > 0) {
        console.log("Latest order:", localOrders[0]);
    }
    window.dispatchEvent(new Event('order-updated')); // Update UI
    window.dispatchEvent(new Event('storage')); // Compat
}, (error) => {
    console.error("❌ Sync Error:", error);
    if (error.code === 'permission-denied') {
        showToast("Sync Error", "Access denied. Please log in with an administrator account.", "error");
    }
});

// 2. Menu Listener
// 2. Menu Listener (Now listens to Collection 'menuItems')
db.collection('menuItems').onSnapshot((snapshot) => {
    const items = [];
    snapshot.forEach((doc) => {
        items.push(doc.data());
    });

    // Handle Init / Migration
    if (items.length === 0) {
        // Check if we have legacy data in settings/menu
        db.collection('settings').doc('menu').get().then((doc) => {
            if (doc.exists && doc.data().items && doc.data().items.length > 0) {
                console.log("Migrating legacy menu to collection...");
                DataStore.saveMenu(doc.data().items);
            } else {
                // No legacy data, load defaults if first run
                if (!localStorage.getItem('ncafe_menu_v3_init')) {
                    console.log("Initializing default values...");
                    DataStore.saveMenu(DEFAULT_MENU_ITEMS);
                    localStorage.setItem('ncafe_menu_v3_init', 'true');
                }
            }
        });
    } else {
        // Sort by ID to ensure consistent order
        items.sort((a, b) => a.id - b.id);
        localMenu = items;
        window.dispatchEvent(new Event('menu-updated'));
        window.dispatchEvent(new Event('storage'));
    }
});

// EXPORT GLOBALS
window.menuItems = localMenu.length ? localMenu : DEFAULT_MENU_ITEMS;
window.categories = categories;


// Helper to keep global menuItems in sync for legacy code accessing window.menuItems directly
window.addEventListener('menu-updated', () => {
    window.menuItems = DataStore.getMenu();
});

// SELF-HEALING / AUTO-RESET
// This block is disabled to prevent accidental overwrite of live data.
/*
if (!localStorage.getItem('fix_v2_applied')) {
    console.log("Applying Fix V2: Resetting Data...");
    setTimeout(() => {
        DataStore.resetMenuToDefaults();
        localStorage.setItem('fix_v2_applied', 'true');
        console.log("Fix V2 Applied. Data reset.");
    }, 2000); // Wait a bit for firebase to init
}
*/
