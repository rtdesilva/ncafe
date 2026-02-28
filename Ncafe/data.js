
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

// AUTHENTICATE ANONYMOUSLY (Required by Security Rules)
auth.signInAnonymously()
    .then(() => {
        console.log("Signed in anonymously");
    })
    .catch((error) => {
        console.error("Auth Error", error);
        alert("AUTH ERROR: " + error.message);
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
                alert("FIREBASE ERROR: " + e.message + "\n\nLikely cause: Database Rules are locked.\nGo to Firebase Console > Firestore > Rules and set 'allow read, write: if true;'");
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
                alert("UPDATE ERROR: " + e.message + "\nCheck Rules!");
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
                alert("Database Error: " + e.message);
            });
    },
    deleteMenuItem: function (id) {
        db.collection('menuItems').doc(id.toString()).delete()
            .then(() => console.log('Item deleted:', id))
            .catch(e => alert("Delete Error: " + e.message));
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
                alert("Database Error (Batch): " + e.message);
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
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
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
        alert("SYNC ERROR: Permission Denied.\nPlease check your Firestore Database Rules.");
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
