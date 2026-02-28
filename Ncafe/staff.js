// ==============================================
// N-CAFE STAFF APP - REBUILT FROM SCRATCH
// ==============================================

const app = document.getElementById('app');
let orders = [];

// STATE
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
    isDarkMode: localStorage.getItem('ncafe_staff_dark_mode') === 'true'
};

// INITIAL DARK MODE APPLY
if (staffState.isDarkMode) {
    document.documentElement.classList.add('dark');
} else {
    document.documentElement.classList.remove('dark');
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

// ==============================================
// RENDER
// ==============================================

function render() {
    app.innerHTML = '';

    // Header (Always Visible)
    const header = document.createElement('header');
    header.className = 'bg-secondary dark:bg-dark-surface text-white p-6 sticky top-0 z-20 shadow-lg transition-colors duration-300';
    header.innerHTML = `
        <div class="flex justify-between items-center">
            <div>
                <h1 class="text-xl font-[900] tracking-tight">Staff Portal</h1>
                <p class="text-xs text-gray-400 font-bold tracking-widest uppercase">N-Cafe Manager</p>
            </div>
            <div class="flex items-center gap-3">
                <!-- Theme Toggle Switch -->
                <div onclick="toggleDarkMode()" class="w-14 h-8 bg-white/10 rounded-full p-1 cursor-pointer transition-all active:scale-95 group">
                    <div class="h-6 w-6 rounded-full bg-white dark:bg-primary shadow-sm flex items-center justify-center transition-all ${staffState.isDarkMode ? 'translate-x-6' : 'translate-x-0'}">
                        <i data-lucide="${staffState.isDarkMode ? 'sun' : 'moon'}" class="w-4 h-4 text-primary dark:text-white"></i>
                    </div>
                </div>
                <div class="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                    <i data-lucide="scan-barcode" class="w-5 h-5"></i>
                </div>
            </div>
        </div>
    `;
    app.appendChild(header);

    // Content based on current tab
    if (staffState.currentTab === 'orders') {
        renderOrders();
    } else if (staffState.currentTab === 'scanner') {
        renderScanner();
    } else if (staffState.currentTab === 'stock') {
        renderStock();
    } else if (staffState.currentTab === 'comms') {
        renderComms();
    } else if (staffState.currentTab === 'home') {
        renderOrders(); // Redirect Home to Orders View as requested
    }

    // Floating Navigation
    renderNavigation();

    lucide.createIcons();
}

function renderHome() {
    const content = document.createElement('main');
    content.className = 'p-6 pb-24';

    const activeOrders = orders.filter(o => o.status !== 'completed').length;
    const completedToday = orders.filter(o => o.status === 'completed' && new Date(o.date).toDateString() === new Date().toDateString()).length;
    const revenue = orders
        .filter(o => o.status === 'completed' && new Date(o.date).toDateString() === new Date().toDateString())
        .reduce((sum, o) => sum + (o.total || 0), 0);

    content.innerHTML = `
        <div class="space-y-6">
            <header class="mb-6 mt-4">
                <h1 class="text-2xl font-[900] text-secondary">Dashboard</h1>
                <p class="text-gray-400 font-medium text-sm">Overview for today</p>
            </header>

            <div class="grid grid-cols-2 gap-4">
                <div class="bg-orange-50 p-6 rounded-3xl border border-orange-100">
                    <div class="bg-white w-12 h-12 rounded-2xl flex items-center justify-center mb-4 shadow-sm text-primary">
                        <i data-lucide="activity" class="w-6 h-6"></i>
                    </div>
                    <h3 class="text-3xl font-[900] text-secondary mb-1">${activeOrders}</h3>
                    <p class="text-xs font-bold text-gray-400 uppercase tracking-wide">Active Orders</p>
                </div>

                <div class="bg-green-50 p-6 rounded-3xl border border-green-100">
                    <div class="bg-white w-12 h-12 rounded-2xl flex items-center justify-center mb-4 shadow-sm text-green-600">
                        <i data-lucide="check-circle-2" class="w-6 h-6"></i>
                    </div>
                    <h3 class="text-3xl font-[900] text-secondary mb-1">${completedToday}</h3>
                    <p class="text-xs font-bold text-gray-400 uppercase tracking-wide">Completed</p>
                </div>
            </div>

            <div class="bg-secondary text-white p-6 rounded-3xl relative overflow-hidden">
                <div class="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-10 -mt-10"></div>
                <div class="relative z-10">
                    <p class="text-gray-400 font-bold text-sm mb-1 uppercase tracking-wide">Total Revenue</p>
                    <h3 class="text-4xl font-[900]">LKR ${revenue.toLocaleString()}</h3>
                </div>
            </div>

            <div class="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm">
                 <div class="flex justify-between items-center mb-4">
                    <h3 class="font-bold text-secondary">Quick Actions</h3>
                 </div>
                 <div class="grid grid-cols-4 gap-4">
                    <button onclick="switchTab('orders')" class="flex flex-col items-center gap-2 group">
                        <div class="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center text-secondary group-hover:bg-primary group-hover:text-white transition-all">
                            <i data-lucide="clipboard-list" class="w-6 h-6"></i>
                        </div>
                        <span class="text-[10px] font-bold text-gray-500">Orders</span>
                    </button>
                    <button onclick="switchTab('scanner')" class="flex flex-col items-center gap-2 group">
                         <div class="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center text-secondary group-hover:bg-primary group-hover:text-white transition-all">
                            <i data-lucide="scan-line" class="w-6 h-6"></i>
                        </div>
                        <span class="text-[10px] font-bold text-gray-500">Scan</span>
                    </button>
                    <button onclick="switchTab('stock')" class="flex flex-col items-center gap-2 group">
                         <div class="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center text-secondary group-hover:bg-primary group-hover:text-white transition-all">
                            <i data-lucide="box" class="w-6 h-6"></i>
                        </div>
                        <span class="text-[10px] font-bold text-gray-500">Stock</span>
                    </button>
                     <button onclick="switchTab('comms')" class="flex flex-col items-center gap-2 group">
                         <div class="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center text-secondary group-hover:bg-primary group-hover:text-white transition-all">
                            <i data-lucide="message-circle" class="w-6 h-6"></i>
                        </div>
                        <span class="text-[10px] font-bold text-gray-500">Comms</span>
                    </button>
                 </div>
            </div>
        </div>
    `;
    app.appendChild(content);
}

function renderOrders() {
    const content = document.createElement('main');
    content.className = 'p-6 pb-24';

    // Stats
    const preparingOrders = orders.filter(o => o.status === 'preparing');
    const readyOrders = orders.filter(o => o.status === 'ready');
    const completedOrders = orders.filter(o => o.status === 'completed');

    // Today's stats
    const today = new Date().toDateString();
    const todaysOrders = orders.filter(o => new Date(o.date).toDateString() === today);
    const todaysRevenue = todaysOrders.reduce((sum, o) => sum + (o.total || 0), 0);

    // UI Helpers
    const filter = staffState.orderFilter || 'active';
    const getRing = (type) => filter === type ? 'ring-2 ring-primary ring-offset-2' : '';

    content.innerHTML = `
        <!-- Stats Grid -->
        <div class="grid grid-cols-4 gap-2 mb-4">
            <div onclick="staffState.orderFilter='preparing'; render()" class="bg-orange-100 p-2 rounded-xl cursor-pointer transition active:scale-95 text-center flex flex-col justify-center items-center h-20 ${getRing('preparing')}">
                <div class="text-xl font-[900] text-orange-600 leading-none mb-1">${preparingOrders.length}</div>
                <div class="text-[10px] font-bold text-orange-700/70 uppercase tracking-wide">Prep</div>
            </div>
            <div onclick="staffState.orderFilter='ready'; render()" class="bg-green-100 p-2 rounded-xl cursor-pointer transition active:scale-95 text-center flex flex-col justify-center items-center h-20 ${getRing('ready')}">
                <div class="text-xl font-[900] text-green-600 leading-none mb-1">${readyOrders.length}</div>
                <div class="text-[10px] font-bold text-green-700/70 uppercase tracking-wide">Ready</div>
            </div>
            <div onclick="staffState.orderFilter='completed'; render()" class="bg-blue-100 p-2 rounded-xl cursor-pointer transition active:scale-95 text-center flex flex-col justify-center items-center h-20 ${getRing('completed')}">
                <div class="text-xl font-[900] text-blue-600 leading-none mb-1">${completedOrders.length}</div>
                <div class="text-[10px] font-bold text-blue-700/70 uppercase tracking-wide">Done</div>
            </div>
            <div onclick="staffState.orderFilter='total'; render()" class="bg-purple-100 p-2 rounded-xl cursor-pointer transition active:scale-95 text-center flex flex-col justify-center items-center h-20 ${getRing('total')}">
                <div class="text-xl font-[900] text-purple-600 leading-none mb-1">${orders.length}</div>
                <div class="text-[10px] font-bold text-purple-700/70 uppercase tracking-wide">Total</div>
            </div>
        </div>
        
        <!-- Search Bar -->
        <div class="relative mb-6">
            <i data-lucide="search" class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"></i>
            <input type="text" placeholder="Search Order ID, Name or Items..." 
                value="${staffState.orderSearch}"
                oninput="staffState.orderSearch = this.value; window.updateOrdersList()"
                class="w-full bg-white border border-gray-100 rounded-xl pl-11 pr-4 py-3 text-sm font-bold placeholder:text-gray-300 focus:border-primary/30 outline-none transition-all shadow-sm">
             ${staffState.orderSearch ? `<button onclick="staffState.orderSearch=''; window.updateOrdersList(); render()" class="absolute right-3 top-1/2 -translate-y-1/2 bg-gray-100 p-1 rounded-full text-gray-400 hover:text-secondary"><i data-lucide="x" class="w-3 h-3"></i></button>` : ''}
        </div>
        
        <!-- Today's Revenue -->
        <div class="bg-gradient-to-r from-primary to-orange-400 p-4 rounded-xl text-white mb-6">
            <div class="flex items-center justify-between">
                <div>
                    <div class="text-xs opacity-90">Today's Revenue</div>
                    <div class="text-2xl font-bold">LKR ${todaysRevenue.toLocaleString()}</div>
                    <div class="text-xs opacity-90 mt-1">${todaysOrders.length} orders today</div>
                </div>
                <i data-lucide="trending-up" class="w-12 h-12 opacity-30"></i>
            </div>
        </div>
        
        <div class="flex justify-between items-center mb-4">
             <h2 id="orders-list-title" class="text-lg font-bold">Orders</h2>
             <div id="orders-reset-container"></div>
        </div>
        
        <div id="orders-list-container" class="space-y-3">
            <!-- Populated by updateOrdersList -->
        </div>
    `;

    app.appendChild(content);
    window.updateOrdersList();
}

window.updateOrdersList = function () {
    const filter = staffState.orderFilter || 'active';
    const searchQuery = (staffState.orderSearch || '').toLowerCase();

    // 1. Apply Filter
    let filteredOrders = [];
    let listTitle = 'Active Orders';

    // Global lists
    const activeOrdersMap = orders.filter(o => o.status !== 'completed');
    const preparingOrders = orders.filter(o => o.status === 'preparing');
    const readyOrders = orders.filter(o => o.status === 'ready');
    const completedOrders = orders.filter(o => o.status === 'completed');

    if (filter === 'preparing') {
        filteredOrders = preparingOrders;
        listTitle = 'Preparing Orders';
    } else if (filter === 'ready') {
        filteredOrders = readyOrders;
        listTitle = 'Ready Orders';
    } else if (filter === 'completed') {
        filteredOrders = completedOrders;
        listTitle = 'Completed Orders';
    } else if (filter === 'total') {
        filteredOrders = orders;
        listTitle = 'All Orders';
    } else {
        filteredOrders = activeOrdersMap;
        listTitle = 'Active Orders';
    }

    // 2. Apply Search
    if (searchQuery) {
        filteredOrders = filteredOrders.filter(o =>
            (o.id && o.id.toLowerCase().includes(searchQuery)) ||
            (o.user && o.user.id && o.user.id.toLowerCase().includes(searchQuery)) ||
            (o.items && o.items.some(i => i.name.toLowerCase().includes(searchQuery)))
        );
    }

    // 3. Update DOM
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
            listContainer.innerHTML = filteredOrders.map(order => `
                <div class="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                    <div class="flex justify-between items-start mb-3">
                        <div>
                            <span class="text-xs font-bold text-gray-400">#${order.id}</span>
                            <h3 class="font-bold text-sm">${order.user?.id || 'Guest'}</h3>
                            <span class="inline-block px-2 py-0.5 rounded text-xs font-bold mt-1 ${order.status === 'preparing' ? 'bg-orange-100 text-orange-600' : (order.status === 'ready' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600')}">${order.status.toUpperCase()}</span>
                        </div>
                        <span class="text-xs text-gray-400">${formatDate(order.date)}</span>
                    </div>
                    
                    <div class="text-xs text-gray-600 mb-3">
                        ${order.items.map(item => `${item.quantity}x ${item.name}`).join(', ')}
                    </div>
                    
                    ${order.status !== 'completed' ? `
                    <div class="flex gap-2">
                        ${order.status === 'preparing' ? `
                            <button onclick="updateStatus('${order.id}', 'ready')" 
                                class="flex-1 py-2 bg-green-500 text-white rounded-xl text-xs font-bold hover:bg-green-600">
                                Mark Ready
                            </button>
                        ` : ''}
                        <button onclick="updateStatus('${order.id}', 'completed')" 
                            class="flex-1 py-2 bg-blue-500 text-white rounded-xl text-xs font-bold hover:bg-blue-600">
                            Complete
                        </button>
                    </div>
                    ` : ''}
                </div>
            `).join('');
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
            
            <h2 class="text-xl font-[900] text-secondary mb-1">Scan Customer QR</h2>
            <p class="text-gray-400 text-sm mb-6 px-6">Point camera at the customer's order QR code.</p>
            
            <!-- Manual Entry -->
            <div class="w-full bg-white p-4 rounded-2xl shadow-sm border border-gray-100 max-w-sm">
                <p class="text-xs text-gray-400 mb-2 font-bold text-left ml-1">Manual Order Lookup</p>
                <div class="flex gap-2">
                    <input id="manual-input" type="text" placeholder="ORD..." class="flex-1 p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold outline-none focus:border-primary focus:bg-white transition-all uppercase">
                    <button onclick="handleValidScan(document.getElementById('manual-input').value)" class="bg-primary text-white p-3 rounded-xl hover:bg-orange-600 active:scale-95 transition-all">
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
        alert("Camera API not supported in this browser.");
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
        alert("Camera access denied or error: " + err.message + "\n\nMake sure you are on HTTPS and have allowed camera permissions.");
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
        <div class="bg-white p-0 rounded-2xl border border-gray-200 shadow-xl overflow-hidden text-left animate-in slide-in-from-bottom-4 zoom-in-95">
            <!-- Header -->
            <div class="bg-secondary p-4 text-white flex justify-between items-start">
                <div>
                    <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">Items Verified</span>
                    <h3 class="text-xl font-[900] tracking-tight">#${order.id}</h3>
                </div>
                <div class="bg-white/10 px-3 py-1 rounded-lg">
                    <span class="text-xs font-bold ${order.status === 'completed' ? 'text-green-400' : 'text-orange-300'} uppercase">${order.status}</span>
                </div>
            </div>
            
            <!-- Items -->
            <div class="p-4 bg-gray-50 border-b border-gray-100 max-h-40 overflow-y-auto">
                ${order.items.map(item => `
                    <div class="flex justify-between items-center mb-2 last:mb-0 text-sm">
                        <span class="font-bold text-gray-600">${item.quantity}x ${item.name}</span>
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
        <div class="bg-white p-3 rounded-xl border ${item.isAvailable ? 'border-gray-100' : 'border-red-100 bg-red-50/20'} flex items-center justify-between transition-all">
            <div class="flex items-center gap-3">
                <div class="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 relative">
                    <img src="${item.image || ''}" class="w-full h-full object-cover ${!item.isAvailable ? 'grayscale' : ''}" onerror="this.src='https://placehold.co/100'">
                    ${!item.isAvailable ? '<div class="absolute inset-0 bg-black/30 flex items-center justify-center"><i data-lucide="slash" class="w-4 h-4 text-white"></i></div>' : ''}
                </div>
                <div>
                    <h4 class="font-bold text-sm text-secondary ${!item.isAvailable ? 'text-gray-500' : ''}">${item.name || 'Unnamed Item'}</h4>
                    <p class="text-[10px] text-gray-400 font-bold uppercase tracking-wider">${item.category || 'Misc'}</p>
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
                <h2 class="text-lg font-bold">Live Inventory</h2>
                <span id="stock-item-count" class="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-xs font-bold">Loading...</span>
            </div>

            <!-- Search & Filter -->
            <div class="mb-6 space-y-4">
                <div class="relative">
                    <i data-lucide="search" class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"></i>
                    <input type="text" placeholder="Search items..." 
                        value="${staffState.stockSearch}"
                        oninput="staffState.stockSearch = this.value; window.updateStockView()"
                        class="w-full bg-gray-50 border border-gray-100 rounded-xl pl-11 pr-4 py-3 text-sm font-bold placeholder:text-gray-300 focus:bg-white focus:border-primary/30 outline-none transition-all">
                </div>
                
                <div class="flex overflow-x-auto hide-scrollbar gap-4 pb-4 px-1">
                ${cats.map(cat => `
                    <button onclick="staffState.stockCategory = '${cat.id}'; window.updateStockView()" class="flex flex-col items-center gap-2 min-w-[64px] group transition-all active:scale-95">
                        <div class="w-16 h-16 rounded-2xl flex items-center justify-center transition-all ${staffState.stockCategory === cat.id ? 'bg-primary text-white shadow-lg shadow-orange-500/30' : 'bg-gray-50 text-gray-400 border border-gray-100 group-hover:bg-gray-100'}">
                            <i data-lucide="${cat.icon || 'circle'}" class="w-7 h-7"></i>
                        </div>
                        <span class="text-xs font-bold tracking-wide ${staffState.stockCategory === cat.id ? 'text-primary' : 'text-gray-400'}">${cat.name}</span>
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
        <div class="flex justify-between items-center mb-6">
            <div>
                <h2 class="text-2xl font-[900] text-secondary">Communications</h2>
                <p class="text-xs text-gray-400 font-bold uppercase tracking-wider">Manage Engagement</p>
            </div>
            <div class="bg-gray-100 p-1 rounded-xl flex gap-1">
                <button onclick="staffState.commsTab = 'broadcast'; render()" 
                    class="px-5 py-2.5 rounded-lg text-xs font-bold transition-all ${staffState.commsTab === 'broadcast' ? 'bg-white text-primary shadow-sm' : 'text-gray-400 hover:text-gray-600'}">
                    Broadcast
                </button>
                <button onclick="staffState.commsTab = 'inbox'; render()" 
                    class="px-5 py-2.5 rounded-lg text-xs font-bold transition-all ${staffState.commsTab === 'inbox' ? 'bg-white text-primary shadow-sm' : 'text-gray-400 hover:text-gray-600'}">
                    Inbox
                </button>
            </div>
        </div>

        ${staffState.commsTab === 'broadcast' ? `
            <div class="flex-1 overflow-y-auto hide-scrollbar space-y-6">
                <!-- Send Form -->
                <div class="bg-white p-6 rounded-3xl border border-gray-100 shadow-xl shadow-gray-100/50 relative overflow-hidden">
                    <div class="absolute top-0 right-0 w-32 h-32 bg-orange-50 rounded-full -mr-10 -mt-10 opacity-60"></div>
                    
                    <div class="relative z-10 mb-6">
                        <div class="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center text-primary mb-3">
                            <i data-lucide="megaphone" class="w-6 h-6"></i>
                        </div>
                        <h3 class="font-bold text-lg text-secondary">New Announcement</h3>
                        <p class="text-xs text-gray-400">Send notifications to all active customers</p>
                    </div>
                    
                    <form onsubmit="sendBroadcast(event)" class="space-y-5 relative z-10">
                        <div>
                            <label class="block text-xs font-bold text-gray-500 mb-2 ml-1">Title</label>
                            <div class="relative">
                                <i data-lucide="type" class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"></i>
                                <input type="text" name="title" placeholder="e.g. Happy Hour Special!" required
                                    class="w-full bg-gray-50 border border-gray-100 rounded-xl pl-11 pr-4 py-3 text-sm font-bold text-secondary placeholder:text-gray-300 focus:bg-white focus:border-primary/30 focus:ring-4 focus:ring-primary/10 outline-none transition-all">
                            </div>
                        </div>
                        
                        <div>
                            <label class="block text-xs font-bold text-gray-500 mb-2 ml-1">Message</label>
                            <div class="relative">
                                <i data-lucide="align-left" class="absolute left-4 top-4 w-4 h-4 text-gray-400"></i>
                                <textarea name="message" rows="3" placeholder="Tell them what's special..." required
                                    class="w-full bg-gray-50 border border-gray-100 rounded-xl pl-11 pr-4 py-3 text-sm font-medium text-secondary placeholder:text-gray-300 focus:bg-white focus:border-primary/30 focus:ring-4 focus:ring-primary/10 outline-none transition-all resize-none"></textarea>
                            </div>
                        </div>
                        
                        <div>
                            <label class="block text-xs font-bold text-gray-500 mb-2 ml-1">Notification Type</label>
                            <div class="grid grid-cols-3 gap-3">
                                <label class="cursor-pointer group">
                                    <input type="radio" name="type" value="offer" class="peer sr-only" checked>
                                    <div class="bg-white border-2 border-gray-100 peer-checked:border-primary peer-checked:bg-orange-50 rounded-2xl p-3 text-center transition-all group-hover:border-primary/30">
                                        <div class="w-8 h-8 mx-auto -mt-1 mb-1 rounded-full bg-gray-50 peer-checked:bg-white flex items-center justify-center transition-colors">
                                            <i data-lucide="ticket-percent" class="w-4 h-4 text-gray-400 peer-checked:text-primary transition-colors"></i>
                                        </div>
                                        <span class="text-[10px] font-bold text-gray-400 peer-checked:text-primary transition-colors">Offer</span>
                                    </div>
                                </label>
                                <label class="cursor-pointer group">
                                    <input type="radio" name="type" value="info" class="peer sr-only">
                                    <div class="bg-white border-2 border-gray-100 peer-checked:border-blue-500 peer-checked:bg-blue-50 rounded-2xl p-3 text-center transition-all group-hover:border-blue-200">
                                        <div class="w-8 h-8 mx-auto -mt-1 mb-1 rounded-full bg-gray-50 peer-checked:bg-white flex items-center justify-center transition-colors">
                                            <i data-lucide="info" class="w-4 h-4 text-gray-400 peer-checked:text-blue-500 transition-colors"></i>
                                        </div>
                                        <span class="text-[10px] font-bold text-gray-400 peer-checked:text-blue-500 transition-colors">Info</span>
                                    </div>
                                </label>
                                <label class="cursor-pointer group">
                                    <input type="radio" name="type" value="alert" class="peer sr-only">
                                    <div class="bg-white border-2 border-gray-100 peer-checked:border-red-500 peer-checked:bg-red-50 rounded-2xl p-3 text-center transition-all group-hover:border-red-200">
                                        <div class="w-8 h-8 mx-auto -mt-1 mb-1 rounded-full bg-gray-50 peer-checked:bg-white flex items-center justify-center transition-colors">
                                            <i data-lucide="alert-triangle" class="w-4 h-4 text-gray-400 peer-checked:text-red-500 transition-colors"></i>
                                        </div>
                                        <span class="text-[10px] font-bold text-gray-400 peer-checked:text-red-500 transition-colors">Alert</span>
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
                    <h3 class="text-xs font-bold text-gray-400 mb-4 uppercase tracking-wider flex items-center gap-2">
                        <span>Past Activity</span>
                        <div class="h-px bg-gray-100 flex-1"></div>
                    </h3>
                    <div id="recent-broadcasts" class="space-y-4 pl-4 border-l-2 border-gray-100 ml-2">
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
                <div class="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                    <i data-lucide="message-circle" class="w-8 h-8 text-gray-300"></i>
                </div>
                <p class="text-secondary font-bold">No Messages</p>
                <p class="text-xs text-gray-400 mt-1">Customer inquiries will appear here</p>
            </div>
        `;
    }

    return `
        <div class="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
            ${staffState.chats.map(chat => `
                <div onclick="selectChat('${chat.customerId}')" class="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm active:scale-95 transition-all cursor-pointer flex justify-between items-center group hover:border-primary/30 hover:shadow-md">
                    <div class="flex items-center gap-4">
                        <div class="relative">
                            <div class="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center overflow-hidden border-2 border-white shadow-sm group-hover:border-orange-100 transition-colors">
                                <span class="font-bold text-lg text-gray-500 group-hover:text-primary transition-colors">${chat.customerName[0].toUpperCase()}</span>
                            </div>
                            <div class="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                        </div>
                        <div>
                            <div class="font-[800] text-sm text-secondary mb-0.5">${chat.customerName}</div>
                            <div class="text-xs text-gray-400 font-medium line-clamp-1 max-w-[160px] group-hover:text-primary/70 transition-colors">${chat.lastMessage}</div>
                        </div>
                    </div>
                    <div class="flex flex-col items-end gap-2">
                         <span class="text-[10px] text-gray-300 font-bold">${chat.timestamp ? new Date(chat.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                        ${chat.unreadCount > 0 ? `
                            <div class="w-5 h-5 bg-primary text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-lg shadow-orange-500/30">
                                ${chat.unreadCount}
                            </div>
                        ` : `
                            <i data-lucide="chevron-right" class="w-4 h-4 text-gray-300 group-hover:text-primary transition-colors"></i>
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
                        <span class="text-[10px] font-bold text-gray-400 bg-gray-100 px-3 py-1 rounded-full uppercase tracking-wider">Today</span>
                    </div>
                ` + staffState.chatMessages.map(msg => {
                    const isStaff = msg.direction === 'staff_to_customer';
                    const time = msg.timestamp ? new Date(msg.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...';

                    return `
                        <div class="flex flex-col ${isStaff ? 'items-end' : 'items-start'} animate-fade-in">
                            <div class="max-w-[75%] p-4 rounded-2xl text-sm relative shadow-sm ${isStaff
                            ? 'bg-secondary text-white rounded-tr-none'
                            : 'bg-white text-secondary border border-gray-100 rounded-tl-none'
                        }">
                                ${msg.text}
                            </div>
                            <span class="text-[10px] text-gray-400 mt-1 px-1 font-medium">${time}</span>
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
        <div class="fixed inset-0 z-[60] bg-white flex flex-col animate-slide-up max-w-md mx-auto shadow-2xl">
            <!-- Chat Header -->
            <div class="bg-white/80 backdrop-blur-md p-4 border-b border-gray-100 flex items-center gap-4 sticky top-0 z-10 shadow-sm">
                <button onclick="closeChat()" class="p-2 -ml-2 hover:bg-gray-100 rounded-full transition active:scale-90">
                    <i data-lucide="chevron-left" class="w-6 h-6 text-secondary"></i>
                </button>
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center font-bold text-gray-500">
                         ${chat.customerName[0].toUpperCase()}
                    </div>
                    <div>
                        <h3 class="font-[800] text-secondary leading-tight">${chat.customerName}</h3>
                        <p class="text-[10px] text-green-500 font-bold flex items-center gap-1">
                            <span class="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                            Online
                        </p>
                    </div>
                </div>
                <div class="ml-auto flex gap-2">
                    <button class="p-2 text-gray-400 hover:text-red-500 transition-colors">
                        <i data-lucide="flag" class="w-5 h-5"></i>
                    </button>
                </div>
            </div>
            
            <!-- Messages List -->
            <div id="staff-chat-container" class="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50">
                <div class="text-center py-6">
                    <span class="text-[10px] font-bold text-gray-400 bg-gray-100 px-3 py-1 rounded-full uppercase tracking-wider">Today</span>
                </div>
                
                ${staffState.chatMessages.map(msg => {
        const isStaff = msg.direction === 'staff_to_customer';
        const time = msg.timestamp ? new Date(msg.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...';

        return `
                        <div class="flex flex-col ${isStaff ? 'items-end' : 'items-start'} animate-fade-in">
                            <div class="max-w-[75%] p-4 rounded-2xl text-sm relative shadow-sm ${isStaff
                ? 'bg-secondary text-white rounded-tr-none'
                : 'bg-white text-secondary border border-gray-100 rounded-tl-none'
            }">
                                ${msg.text}
                            </div>
                            <span class="text-[10px] text-gray-400 mt-1 px-1 font-medium">${time}</span>
                        </div>
                    `;
    }).join('')}
            </div>
            
            <!-- Reply Input -->
            <form onsubmit="sendStaffReply(event, '${chat.customerId}')" class="p-4 bg-white border-t border-gray-100 flex gap-3 items-center pb-8 safe-area-bottom">
                <button type="button" class="p-2 text-gray-400 hover:text-secondary transition-colors">
                    <i data-lucide="plus" class="w-6 h-6"></i>
                </button>
                
                <div class="flex-1 bg-gray-100 rounded-full flex items-center px-4 transition-all focus-within:ring-2 focus-within:ring-primary/20 focus-within:bg-white">
                    <input type="text" name="message" placeholder="Type your reply..." required autocomplete="off"
                        class="flex-1 bg-transparent border-none py-3 text-sm font-medium outline-none placeholder:text-gray-400">
                </div>
                
                <button type="submit" class="w-12 h-12 bg-primary text-white rounded-full flex items-center justify-center shadow-lg shadow-orange-500/20 hover:bg-orange-600 transition active:scale-90">
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
                <div class="max-w-[75%] p-4 rounded-2xl text-sm relative shadow-sm bg-secondary text-white rounded-tr-none">
                    ${tempMsg.text}
                </div>
                <span class="text-[10px] text-gray-400 mt-1 px-1 font-medium">${time}</span>
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
        alert('Error sending reply: ' + err.message);
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
    if (!confirm('Access: All Customers\n\nAre you sure you want to send this broadcast?')) return;

    const data = {
        title: form.title.value,
        message: form.message.value,
        type: form.type.value,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        active: true
    };

    try {
        await db.collection('notifications').add(data);
        alert('✅ Notification Sent Successfully!');
        form.reset();
        loadBroadcastHistory();
    } catch (err) {
        console.error(err);
        alert('Error sending notification: ' + err.message);
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
                    <div class="absolute -left-[9px] top-0 w-4 h-4 bg-white border-2 border-gray-200 group-hover:border-primary rounded-full transition-colors"></div>
                    <div class="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm group-hover:shadow-md transition-all flex gap-3 items-start">
                        ${iconBox}
                        <div class="flex-1 min-w-0">
                            <div class="flex justify-between items-start mb-0.5">
                                <span class="font-bold text-sm text-secondary truncate pr-2">${n.title}</span>
                                <span class="text-[10px] text-gray-300 font-mono whitespace-nowrap">${date}</span>
                            </div>
                            <p class="text-xs text-gray-400 line-clamp-2 leading-relaxed">${n.message}</p>
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
    nav.className = 'fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-x border-gray-100 rounded-t-2xl px-6 py-3 z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.1)]';
    nav.innerHTML = `
        <div class="flex justify-between items-end relative">
            <!-- Home (First) -->
            <button onclick="switchTab('home')" class="flex flex-col items-center gap-1 w-12 group nav-btn" data-tab="home">
                <i data-lucide="home" class="w-6 h-6 ${staffState.currentTab === 'home' ? 'text-primary fill-current' : 'text-gray-400 group-hover:text-gray-600'} transition-colors"></i>
                <span class="text-[10px] font-bold ${staffState.currentTab === 'home' ? 'text-primary' : 'text-gray-400 group-hover:text-gray-600'} transition-colors">Home</span>
            </button>

            <!-- Stock (Second) -->
            <button onclick="switchTab('stock')" class="flex flex-col items-center gap-1 w-12 group nav-btn" data-tab="stock">
                <i data-lucide="box" class="w-6 h-6 ${staffState.currentTab === 'stock' ? 'text-primary fill-current' : 'text-gray-400 group-hover:text-gray-600'} transition-colors"></i>
                <span class="text-[10px] font-bold ${staffState.currentTab === 'stock' ? 'text-primary' : 'text-gray-400 group-hover:text-gray-600'} transition-colors">Stock</span>
            </button>

            <!-- Scan (Middle) -->
            <button onclick="switchTab('scanner')" class="flex flex-col items-center gap-1 w-12 group nav-btn" data-tab="scanner">
                <div class="w-14 h-14 bg-secondary text-white rounded-full flex items-center justify-center -mt-8 border-4 border-white shadow-xl shadow-secondary/20 transition-transform active:scale-95 group-hover:bg-black">
                     <i data-lucide="scan-line" class="w-7 h-7 ${staffState.currentTab === 'scanner' ? 'text-primary' : 'text-white'} transition-colors"></i>
                </div>
                <span class="text-[10px] font-bold ${staffState.currentTab === 'scanner' ? 'text-primary' : 'text-gray-400 group-hover:text-gray-600'} transition-colors mt-1">Scan</span>
            </button>

            <!-- Orders (Fourth) -->
            <button onclick="switchTab('orders')" class="flex flex-col items-center gap-1 w-12 group nav-btn" data-tab="orders">
                <i data-lucide="clipboard-list" class="w-6 h-6 ${staffState.currentTab === 'orders' ? 'text-primary fill-current' : 'text-gray-400 group-hover:text-gray-600'} transition-colors"></i>
                <span class="text-[10px] font-bold ${staffState.currentTab === 'orders' ? 'text-primary' : 'text-gray-400 group-hover:text-gray-600'} transition-colors">Orders</span>
            </button>

            <!-- Comms (Last) -->
            <button onclick="switchTab('comms')" class="flex flex-col items-center gap-1 w-12 group nav-btn" data-tab="comms">
                <i data-lucide="message-circle" class="w-6 h-6 ${staffState.currentTab === 'comms' ? 'text-primary fill-current' : 'text-gray-400 group-hover:text-gray-600'} transition-colors"></i>
                <span class="text-[10px] font-bold ${staffState.currentTab === 'comms' ? 'text-primary' : 'text-gray-400 group-hover:text-gray-600'} transition-colors">Comms</span>
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
        alert('Failed to update order: ' + error.message);
    }
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

// ==============================================
// REAL-TIME LISTENER
// ==============================================

db.collection('orders').onSnapshot((snapshot) => {
    orders = [];
    snapshot.forEach((doc) => {
        orders.push({ id: doc.id, ...doc.data() });
    });

    // Sort by date (newest first)
    orders.sort((a, b) => new Date(b.date) - new Date(a.date));

    console.log('🔄 Orders synced:', orders.length);
    render();
});

// ==============================================
// INITIALIZE
// ==============================================

render();
console.log('✅ N-Cafe Staff App Loaded');
