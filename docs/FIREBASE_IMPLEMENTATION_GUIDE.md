# Firebase Order System Implementation Guide

## What You Need:

### 1. **Customer Order Status Bar** (Bottom of screen)
Shows current order status: Preparing → Ready → Completed

### 2. **Real-time Order Updates**
- When customer places order → saved to Firebase with status "preparing"
- When staff clicks "Mark Ready" → status changes to "ready" 
- Customer sees update immediately in status bar
- When picked up → status "completed"

## Changes Needed in script.js:

### A. Add Firebase Listeners (After line 95, before render function):

```javascript
// Firebase Listeners
let ordersUnsubscribe = null;
let customerOrderUnsubscribe = null;

// Listen to all orders for staff/admin
function setupOrdersListener() {
    if (ordersUnsubscribe) ordersUnsubscribe();
    
    ordersUnsubscribe = db.collection('orders')
        .where('status', 'in', ['preparing', 'ready'])
        .onSnapshot((snapshot) => {
            state.pendingOrders = [];
            snapshot.forEach((doc) => {
                state.pendingOrders.push({ id: doc.id, ...doc.data() });
            });
            if (state.userRole === 'staff' || state.userRole === 'admin') {
                render();
            }
        });
}

// Listen to customer's active order
function setupCustomerOrderListener(orderId) {
    if (customerOrderUnsubscribe) customerOrderUnsubscribe();
    if (!orderId) return;
    
    customerOrderUnsubscribe = db.collection('orders').doc(orderId).onSnapshot((doc) => {
        if (doc.exists) {
            state.activeOrders = [{ id: doc.id, ...doc.data() }];
            render();
        }
    });
}
```

### B. Update `processPayment()` function (around line 800):

```javascript
function processPayment() {
    const button = document.querySelector('button[onclick="processPayment()"]');
    button.innerHTML = `<span class="animate-pulse">Processing...</span>`;

    setTimeout(async () => {
        const orderId = 'ORD' + Date.now();
        
        // Create order in Firebase
        const orderData = {
            id: orderId,
            items: state.cart.map(item => ({
                name: item.name,
                qty: item.quantity,
                price: item.price
            })),
            total: state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0),
            status: 'preparing',
            timestamp: new Date().toISOString()
        };
        
        await db.collection('orders').doc(orderId).set(orderData);
        
        state.orderId = orderId;
        state.currentView = 'receipt';
        
        // Start listening to this order
        setupCustomerOrderListener(orderId);
        
       render();
    }, 1500);
}
```

###C. Update `completeOrder()` function (around line 555):

```javascript
async function completeOrder(id) {
    // Update status to "ready" in Firebase
    await db.collection('orders').doc(id).update({
        status: 'ready',
        updatedAt: new Date().toISOString()
    });
    // Orders will auto-update via listener
}
```

### D. Add Status Bar Component (new function):

```javascript
// Render order status bar for customers
function renderOrderStatusBar() {
    if (state.activeOrders.length === 0) return;
    
    const order = state.activeOrders[0];
    const status = order.status || 'preparing';
    
    const statusConfig = {
        preparing: { text: 'Preparing', color: 'bg-orange-500', icon: 'chef-hat', progress: '33%' },
        ready: { text: 'Ready for Pickup', color: 'bg-green-500', icon: 'check-circle', progress: '66%' },
        completed: { text: 'Completed', color: 'bg-gray-500', icon: 'check', progress: '100%' }
    };
    
    const config = statusConfig[status] || statusConfig.preparing;
    
    const statusBar = document.createElement('div');
    statusBar.className = "fixed bottom-0 left-0 right-0 bg-white border-t-2 border-gray-100 p-4 z-50 shadow-2xl";
    statusBar.innerHTML = `
        <div class="max-w-md mx-auto">
            <div class="flex items-center justify-between mb-2">
                <div class="flex items-center gap-2">
                    <div class="${config.color} w-8 h-8 rounded-full flex items-center justify-center text-white">
                        <i data-lucide="${config.icon}" class="w-4 h-4"></i>
                    </div>
                    <div>
                        <p class="text-xs text-gray-500">Order #${order.id}</p>
                        <p class="font-bold text-secondary">${config.text}</p>
                    </div>
                </div>
                <button onclick="dismissOrderStatus()" class="text-gray-400 hover:text-secondary">
                    <i data-lucide="x" class="w-5 h-5"></i>
                </button>
            </div>
            <div class="w-full bg-gray-200 rounded-full h-2">
                <div class="${config.color} h-2 rounded-full transition-all duration-500" style="width: ${config.progress}"></div>
            </div>
        </div>
    `;
    
    app.appendChild(statusBar);
}

function dismissOrderStatus() {
    state.activeOrders = [];
    render();
}
```

### E. Call Status Bar in renderHome() (add after line 305):

```javascript
    // Add this at the end of renderHome(), just before closing brace
    renderOrderStatusBar();
}
```

### F. Initialize listeners on load (add after line 149):

```javascript
// Initialize Firebase listeners when app loads
if (state.userRole === 'staff' || state.userRole === 'admin') {
    setupOrdersListener();
}
```

## Testing:

1. **Customer Flow:**
   - Add items to cart → Checkout → Pay
   - After payment, status bar appears at bottom showing "Preparing"

2. **Staff Flow:**
   - Go to `#staff` URL
   - Login with staff/123
   - See pending orders
   - Click "Mark Ready" - order status updates

3. **Real-time Update:**
   - Keep customer page open
   - On staff page, mark order ready
   - Customer's status bar automatically updates to "Ready for Pickup"

## Files Modified:
- `index.html` - Added Firebase SDK
- `script.js` - Added Firebase config, listeners, status bar

Let me know if you want me to apply these changes automatically!
