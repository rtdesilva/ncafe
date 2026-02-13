// ADMIN STATE
let adminState = {
    currentView: 'dashboard', // 'dashboard', 'menu', 'orders', 'customers'
    isSidebarOpen: window.innerWidth >= 768,
    isModalOpen: false,
    modalMode: 'add',
    editingItem: null,
    selectedCategory: 'all', // New state for menu filtering
    dateFilter: 'today',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    orderSearch: '', // Search query for orders
    customerSearch: '', // Search query for customers
    selectedCustomer: null // For viewing customer order history
};

// DOM ELEMENTS
const adminApp = document.getElementById('admin-app');

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
        <aside class="fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-gray-100 transition-transform duration-300 md:translate-x-0 ${sidebarClass} flex flex-col shadow-xl md:shadow-none">
            <div class="p-8 flex items-center gap-3">
                 <div class="w-10 h-10 bg-gradient-to-br from-primary to-orange-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-orange-500/30">
                    <i data-lucide="coffee" class="w-6 h-6"></i>
                 </div>
                 <div>
                    <span class="text-xl font-[900] tracking-tight text-secondary block leading-none">N-Cafe</span>
                    <span class="text-[10px] font-bold text-gray-400 tracking-widest uppercase">Admin</span>
                 </div>
            </div>

            <nav class="flex-1 px-4 space-y-2 mt-4">
                ${renderSidebarItem('layout-dashboard', 'Dashboard', 'dashboard')}
                ${renderSidebarItem('coffee', 'Menu Management', 'menu')}
                ${renderSidebarItem('clipboard-list', 'Orders', 'orders')}
                ${renderSidebarItem('users', 'Customers', 'customers')}
            </nav>

            <div class="p-4 mt-auto">
                 <button onclick="window.location.href='index.html'" class="w-full flex items-center gap-3 px-4 py-3 text-gray-500 hover:bg-gray-50 rounded-xl transition-colors font-bold text-sm">
                    <i data-lucide="log-out" class="w-5 h-5"></i>
                    Back to App
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
    } else {
        contentHtml = renderDashboardView(); // Default
    }

    const mainLayout = `
        <main class="flex-1 h-screen overflow-y-auto bg-gray-50/50 md:ml-64 transition-all">
            <!-- Header -->
            <header class="bg-white border-b border-gray-100 sticky top-0 z-20 px-8 py-4 flex justify-between items-center">
                <div class="flex items-center gap-4">
                     <button onclick="toggleSidebar()" class="p-2 -ml-2 hover:bg-gray-100 rounded-lg md:hidden text-secondary">
                        <i data-lucide="menu" class="w-6 h-6"></i>
                    </button>
                    <h1 class="text-2xl font-[800] capitalize text-secondary">${adminState.currentView === 'menu' ? 'Menu Management' : adminState.currentView}</h1>
                </div>
                
                <div class="flex items-center gap-4">
                    <div class="flex items-center gap-3 border-l border-gray-100 pl-6">
                         <div class="text-right hidden sm:block">
                            <p class="text-sm font-bold">Admin</p>
                            <p class="text-xs text-gray-400">Manager</p>
                         </div>
                         <div class="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center text-gray-500">
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
    const modal = adminState.isModalOpen ? renderModal() : (adminState.selectedCustomer ? renderCustomerHistoryModal() : '');

    adminApp.innerHTML = sidebar + mainLayout + modal;
    lucide.createIcons();
}

// COMPONENT RENDERERS
function renderSidebarItem(icon, label, view) {
    const isActive = adminState.currentView === view;
    const activeClass = isActive
        ? 'bg-secondary text-white shadow-lg shadow-gray-900/20'
        : 'text-gray-500 hover:bg-gray-100 hover:text-secondary';

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
        adminState.startDate = today.toISOString().split('T')[0];
        adminState.endDate = today.toISOString().split('T')[0];
    } else if (type === 'yesterday') {
        const yest = new Date(today);
        yest.setDate(yest.getDate() - 1);
        adminState.startDate = yest.toISOString().split('T')[0];
        adminState.endDate = yest.toISOString().split('T')[0];
    } else if (type === 'last7') {
        const last7 = new Date(today);
        last7.setDate(last7.getDate() - 6);
        adminState.startDate = last7.toISOString().split('T')[0];
        adminState.endDate = today.toISOString().split('T')[0];
    } else if (type === 'thisMonth') {
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        adminState.startDate = firstDay.toISOString().split('T')[0];
        adminState.endDate = today.toISOString().split('T')[0];
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

    // Kanban Display: Last 50 completed orders (regardless of date) to ensure "just finished" orders appear
    const allCompleted = allOrders.filter(o => o.status === 'completed');
    allCompleted.sort((a, b) => new Date(b.date) - new Date(a.date));
    const recentCompleted = allCompleted.slice(0, 50);

    const activeCount = preparing.length + ready.length;

    return `
        <!-- Live Metrics Header -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div class="bg-secondary text-white p-6 rounded-2xl shadow-lg shadow-gray-900/10 relative overflow-hidden group">
                <div class="relative z-10">
                    <p class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 group-hover:text-white transition-colors">Live Revenue</p>
                    <h3 class="text-3xl font-[900]">${formatPrice(liveRevenue)}</h3>
                </div>
                <div class="absolute right-0 top-0 h-full w-24 bg-white/5 skew-x-12 -mr-4 group-hover:bg-white/10 transition-colors"></div>
            </div>
            
            <div class="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-center">
                <p class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Active Orders</p>
                <div class="flex items-baseline gap-2">
                    <h3 class="text-3xl font-[900] text-primary">${activeCount}</h3>
                    <span class="text-xs font-bold text-gray-300">orders</span>
                </div>
            </div>

            <div class="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-center">
                 <p class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Preparing</p>
                <h3 class="text-3xl font-[900] text-orange-500">${preparing.length}</h3>
            </div>

            <div class="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-center">
                 <p class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Ready</p>
                <h3 class="text-3xl font-[900] text-green-500">${ready.length}</h3>
            </div>
        </div>

        <!-- Kanban Board -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-280px)] min-h-[600px]">
            
            <!-- Preparing Column -->
            <div class="bg-gray-100/50 rounded-3xl p-4 border border-gray-200/50 flex flex-col h-full">
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
            ? `<div class="h-40 flex flex-col items-center justify-center text-gray-300 font-bold text-sm border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50/50">
                            <i data-lucide="chef-hat" class="w-8 h-8 mb-2 opacity-50"></i>
                            Kitchen is idle
                           </div>`
            : preparing.map(o => renderLiveOrderCard(o)).join('')}
                </div>
            </div>

            <!-- Ready Column -->
            <div class="bg-gray-100/50 rounded-3xl p-4 border border-gray-200/50 flex flex-col h-full">
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
            ? `<div class="h-40 flex flex-col items-center justify-center text-gray-300 font-bold text-sm border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50/50">
                            <i data-lucide="bell" class="w-8 h-8 mb-2 opacity-50"></i>
                            No orders ready
                           </div>`
            : ready.map(o => renderLiveOrderCard(o)).join('')}
                </div>
            </div>

            <!-- Completed Column -->
            <div class="bg-gray-100/50 rounded-3xl p-4 border border-gray-200/50 flex flex-col h-full">
                <div class="flex items-center justify-between mb-4 px-2">
                    <h3 class="font-[900] text-gray-600 flex items-center gap-2">
                        <span class="w-3 h-3 rounded-full bg-blue-500"></span> Completed
                    </h3>
                     <span class="bg-white px-2.5 py-1 rounded-lg text-xs font-bold text-gray-500 shadow-sm border border-gray-100">Today: ${completedToday.length}</span>
                </div>
                <div class="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-hide pb-4">
                     ${recentCompleted.length === 0
            ? `<div class="h-40 flex flex-col items-center justify-center text-gray-300 font-bold text-sm border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50/50">No activity yet</div>`
            : recentCompleted.map(o => renderLiveOrderCard(o)).join('')}
                </div>
            </div>

        </div>
    `;
}

function renderLiveOrderCard(order) {
    const isPrep = order.status === 'preparing';
    const isReady = order.status === 'ready';
    const itemsList = order.items.map(i => `<span class="text-secondary font-bold">${i.quantity}x</span> ${i.name}`).join(', ');
    const user = order.user || {};
    const userName = user.name || user.id || 'Guest';

    return `
        <div class="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
            <!-- Left Colored Bar based on status -->
            <div class="absolute left-0 top-0 bottom-0 w-1 ${isPrep ? 'bg-orange-500' : (isReady ? 'bg-green-500' : 'bg-blue-500')}"></div>
            
            <div class="pl-2">
                <div class="flex justify-between items-start mb-3">
                    <div>
                        <span class="font-[900] text-secondary text-lg tracking-tight">#${order.id}</span>
                         <div class="flex items-center gap-1.5 mt-0.5">
                            <i data-lucide="user" class="w-3 h-3 text-gray-400"></i>
                            <p class="text-xs font-bold text-gray-500 truncate max-w-[120px]">${userName}</p>
                         </div>
                    </div>
                    <span class="text-[10px] font-bold text-gray-400 bg-gray-50 px-2 py-1 rounded-lg border border-gray-100">
                        ${new Date(order.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                </div>
                
                <p class="text-sm text-gray-600 mb-4 line-clamp-3 leading-relaxed">${itemsList}</p>
                
                <div class="flex items-center gap-2 mt-auto pt-2 border-t border-gray-50">
                    <span class="font-bold text-sm text-secondary">${formatPrice(order.total)}</span>
                    
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
    const filteredItems = adminState.selectedCategory === 'all'
        ? menuItems
        : menuItems.filter(item => item.category === adminState.selectedCategory);

    return `
        <div class="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative">
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                     <h3 class="text-lg font-bold">Menu Items</h3>
                     <p class="text-gray-400 text-xs font-bold">${filteredItems.length} items found</p>
                </div>
               
                <button onclick="openAddModal()" class="bg-secondary text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-gray-800 transition-colors flex items-center gap-2">
                    <i data-lucide="plus" class="w-4 h-4"></i> Add New Item
                </button>
            </div>

            <!-- Categories Filter -->
            <div class="flex flex-wrap gap-2 mb-6">
                ${categories.map(cat => `
                    <button onclick="selectCategory('${cat.id}')" 
                        class="px-4 py-2 rounded-xl text-xs font-bold transition-all border ${adminState.selectedCategory === cat.id
            ? 'bg-secondary text-white border-secondary shadow-lg shadow-gray-900/20'
            : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
        }">
                        <div class="flex items-center gap-2">
                            <i data-lucide="${cat.icon}" class="w-3 h-3"></i>
                            ${cat.name}
                        </div>
                    </button>
                `).join('')}
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                ${filteredItems.length === 0 ? `<div class="col-span-full text-center py-10 text-gray-400 font-bold">No items found in this category.</div>` :
            filteredItems.map(item => `
                    <div class="border border-gray-100 rounded-2xl p-4 flex flex-col gap-4 hover:shadow-md transition-shadow bg-white relative group">
                        <div class="relative w-full aspect-video rounded-xl overflow-hidden bg-gray-50">
                            <img src="${item.image}" class="w-full h-full object-cover">
                            ${!item.isAvailable ? '<div class="absolute inset-0 bg-black/50 flex items-center justify-center text-white font-bold text-xs">Unavailable</div>' : ''}
                        </div>
                        
                        <div>
                            <div class="flex justify-between items-start mb-1">
                                <h4 class="font-bold text-secondary text-sm line-clamp-1">${item.name}</h4>
                                <span class="text-primary font-bold text-xs whitespace-nowrap">LKR ${item.price}</span>
                            </div>
                            <p class="text-xs text-gray-400 mb-3">${item.category} • ${item.subCategory}</p>
                            
                            <div class="flex gap-2">
                                <button onclick="openEditModal(${item.id})" class="flex-1 py-2 border border-gray-200 rounded-lg text-xs font-bold text-gray-600 hover:bg-gray-50">Edit</button>
                                <button onclick="toggleAvailability(${item.id})" class="flex-1 py-2 ${item.isAvailable ? 'bg-red-50 text-red-500 hover:bg-red-100' : 'bg-green-50 text-green-500 hover:bg-green-100'} rounded-lg text-xs font-bold transition-colors">
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

function renderOrdersView() {
    const orders = getFilteredOrders();

    return `
        <!-- Date Filter Control -->
        <div class="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm mb-6 flex flex-col md:flex-row justify-between items-center gap-4">
            <div class="flex items-center gap-2">
                <i data-lucide="calendar-days" class="w-5 h-5 text-primary"></i>
                <h3 class="font-bold text-secondary text-sm">Date Range:</h3>
                <select onchange="updateDateFilter(this.value)" class="bg-gray-50 border border-gray-200 text-gray-700 text-sm font-bold rounded-lg focus:ring-primary focus:border-primary block p-2 outline-none">
                    <option value="today" ${adminState.dateFilter === 'today' ? 'selected' : ''}>Today</option>
                    <option value="yesterday" ${adminState.dateFilter === 'yesterday' ? 'selected' : ''}>Yesterday</option>
                    <option value="last7" ${adminState.dateFilter === 'last7' ? 'selected' : ''}>Last 7 Days</option>
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
        <div class="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm mb-6">
            <div class="relative">
                <i data-lucide="search" class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"></i>
                <input type="text" 
                    placeholder="Search orders by ID, Customer, or Item..." 
                    value="${adminState.orderSearch || ''}"
                    oninput="updateOrdersList(this.value)"
                    class="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-secondary outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-gray-300"
                >
            </div>
        </div>

        <div id="orders-list-container" class="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
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
        <div class="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm mb-6">
            <div class="relative">
                <i data-lucide="search" class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"></i>
                <input type="text" 
                    placeholder="Search customers by Name, Email or Phone..." 
                    value="${adminState.customerSearch || ''}"
                    oninput="updateCustomersList(this.value)"
                    class="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-secondary outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-gray-300"
                >
            </div>
        </div>

        <div id="customers-list-container" class="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
            ${renderCustomersListHTML(customers)}
        </div>
    `;
}

function renderCustomersListHTML(customers) {
    return `
        <div class="flex justify-between items-center mb-6">
             <h3 class="text-lg font-bold">Customers</h3>
             <span class="text-xs font-bold text-gray-400 bg-gray-50 px-3 py-1 rounded-full">${customers.length} customers found</span>
        </div>
       
        ${customers.length === 0 ? `<div class="text-center py-10 text-gray-400 font-bold">No customers found matching your criteria.</div>` : `
        <div class="overflow-x-auto">
            <table class="w-full text-sm text-left">
                <thead class="text-gray-400 font-medium border-b border-gray-50">
                    <tr>
                        <th class="pb-3 pl-0 sm:pl-2">Customer</th>
                        <th class="pb-3 hidden sm:table-cell">Contact Info</th>
                        <th class="pb-3 hidden sm:table-cell">Total Orders</th>
                        <th class="pb-3 hidden sm:table-cell">Total Spent</th>
                        <th class="pb-3 hidden sm:table-cell">Last Active</th>
                        <th class="pb-3 text-right">Actions</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-50">
                    ${customers.sort((a, b) => b.totalSpent - a.totalSpent).map(customer => `
                        <tr class="group hover:bg-gray-50 transition-colors">
                            <td class="py-4 pl-0 sm:pl-2 align-top">
                                <div class="flex items-center gap-3">
                                    <div class="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-primary font-bold">
                                        ${customer.name ? customer.name.charAt(0).toUpperCase() : 'U'}
                                    </div>
                                    <div>
                                        <div class="font-bold text-secondary">${customer.name}</div>
                                        <div class="text-xs text-gray-400">ID: ${customer.id.length > 10 ? customer.id.slice(0, 8) + '...' : customer.id}</div>
                                    </div>
                                </div>
                            </td>

                            <td class="hidden sm:table-cell py-4 align-top">
                                <div class="flex flex-col gap-1 text-xs">
                                    <div class="flex items-center gap-2 text-gray-600">
                                        <i data-lucide="mail" class="w-3 h-3 text-gray-400"></i> ${customer.email}
                                    </div>
                                    <div class="flex items-center gap-2 text-gray-600">
                                        <i data-lucide="phone" class="w-3 h-3 text-gray-400"></i> ${customer.phone}
                                    </div>
                                </div>
                            </td>

                            <td class="hidden sm:table-cell py-4 font-bold text-gray-600 align-top pl-4">${customer.totalOrders}</td>
                            
                            <td class="hidden sm:table-cell py-4 font-bold text-primary align-top">${formatPrice(customer.totalSpent)}</td>

                            <td class="hidden sm:table-cell py-4 text-xs text-gray-500 align-top">${new Date(customer.lastOrderDate).toLocaleDateString()}</td>

                            <td class="py-4 align-top text-right">
                                <button onclick="viewCustomerHistory('${customer.id}')" class="bg-gray-100 hover:bg-gray-200 text-secondary px-3 py-2 rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-2">
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
    const customerName = (customerId !== 'Guest' && customerOrders.length > 0 && customerOrders[0].user) ? (customerOrders[0].user.name || customerId) : 'Guest User';

    return `
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" onclick="closeCustomerHistory()"></div>
            <div class="bg-white rounded-3xl p-6 w-full max-w-4xl relative z-10 shadow-2xl animate-fade-in max-h-[90vh] flex flex-col">
                <div class="flex justify-between items-center mb-6">
                    <div>
                        <h3 class="text-xl font-[900] text-secondary">Order History</h3>
                        <p class="text-sm text-gray-500 font-bold">${customerName} • <span class="text-primary">${customerOrders.length} Orders</span> • Total: ${formatPrice(totalSpent)}</p>
                    </div>
                    <button onclick="closeCustomerHistory()" class="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <i data-lucide="x" class="w-5 h-5 text-gray-500"></i>
                    </button>
                </div>

                <div class="overflow-y-auto pr-2">
                     ${customerOrders.length === 0 ? `<div class="text-center py-10 text-gray-400 font-bold">No history available.</div>` : `
                    <table class="w-full text-sm text-left">
                        <thead class="text-gray-400 font-medium border-b border-gray-50 bg-white sticky top-0">
                            <tr>
                                <th class="pb-3 pl-2">Order ID</th>
                                <th class="pb-3">Date</th>
                                <th class="pb-3">Items</th>
                                <th class="pb-3">Amount</th>
                                <th class="pb-3 text-right">Status</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-50">
                            ${customerOrders.sort((a, b) => new Date(b.date) - new Date(a.date)).map(order => {
        const firstItem = order.items[0];
        const moreCount = order.items.length - 1;
        return `
                                <tr class="group hover:bg-gray-50 transition-colors">
                                    <td class="py-4 pl-2 font-bold text-gray-500">#${order.id}</td>
                                    <td class="py-4 text-gray-500">${new Date(order.date).toLocaleDateString()} ${new Date(order.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                                    <td class="py-4 text-secondary font-medium">
                                        ${firstItem.name} ${moreCount > 0 ? `<span class="text-gray-400 font-bold text-xs">+${moreCount}</span>` : ''}
                                    </td>
                                    <td class="py-4 font-bold text-secondary">${formatPrice(order.total)}</td>
                                    <td class="py-4 text-right">
                                        <span class="bg-gray-100 text-gray-600 px-2 py-1 rounded-lg text-xs font-bold inline-block">${order.status}</span>
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

// MODAL RENDERER
function renderModal() {
    const isEdit = adminState.modalMode === 'edit';
    const item = adminState.editingItem || {};

    return `
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" onclick="closeModal()"></div>
            <div class="bg-white rounded-3xl p-6 w-full max-w-lg relative z-10 shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto">
                <div class="flex justify-between items-center mb-6">
                    <h3 class="text-lg font-[900] text-secondary">${isEdit ? 'Edit Item' : 'Add New Item'}</h3>
                    <button onclick="closeModal()" class="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <i data-lucide="x" class="w-5 h-5 text-gray-500"></i>
                    </button>
                </div>

                <form onsubmit="saveItem(event)" class="space-y-4">
                    <div>
                        <label class="block text-xs font-bold text-gray-400 mb-1">Item Name</label>
                        <input type="text" name="name" value="${item.name || ''}" required class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all font-bold text-secondary text-sm">
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-xs font-bold text-gray-400 mb-1">Price (LKR)</label>
                            <input type="number" name="price" value="${item.price || ''}" required class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all font-bold text-secondary text-sm">
                        </div>
                        <div>
                             <label class="block text-xs font-bold text-gray-400 mb-1">Category</label>
                             <select name="category" required class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all font-bold text-secondary text-sm">
                                <option value="Pastries" ${item.category === 'Pastries' ? 'selected' : ''}>Pastries</option>
                                <option value="Desserts" ${item.category === 'Desserts' ? 'selected' : ''}>Desserts</option>
                                <option value="Hot Drinks" ${item.category === 'Hot Drinks' ? 'selected' : ''}>Hot Drinks</option>
                                <option value="Cold Drinks" ${item.category === 'Cold Drinks' ? 'selected' : ''}>Cold Drinks</option>
                             </select>
                        </div>
                    </div>

                    <div>
                        <label class="block text-xs font-bold text-gray-400 mb-1">Sub Category</label>
                        <input type="text" name="subCategory" value="${item.subCategory || ''}" placeholder="e.g. Savory, Cakes, Coffee..." required class="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all font-bold text-secondary text-sm">
                    </div>

                    <!-- IMAGE UPLOAD SECTION -->
                    <div>
                        <label class="block text-xs font-bold text-gray-400 mb-1">Product Image</label>
                        
                        <!-- Hidden Input stores the Base64 string or original URL -->
                        <input type="hidden" name="finalImage" id="encoded-image" value="${item.image || ''}">
                        
                        <div class="flex items-start gap-4">
                            <!-- Preview -->
                            <div id="image-preview-container" class="w-20 h-20 bg-gray-100 rounded-xl border border-gray-200 flex items-center justify-center overflow-hidden shrink-0 ${!item.image ? 'hidden' : ''}">
                                <img id="image-preview" src="${item.image || ''}" class="w-full h-full object-cover">
                            </div>
                            
                            <div class="flex-1">
                                <label class="block w-full cursor-pointer group">
                                    <div class="flex items-center justify-center w-full h-20 border-2 border-dashed border-gray-200 rounded-xl hover:bg-gray-50 hover:border-primary/50 transition-all group-hover:text-primary">
                                        <div class="flex flex-col items-center justify-center pt-2 pb-3">
                                            <i data-lucide="upload-cloud" class="w-6 h-6 text-gray-400 mb-1 group-hover:text-primary transition-colors"></i>
                                            <p class="mb-0 text-[10px] text-gray-500 font-bold">Click to upload image</p>
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
        DataStore.saveMenu(menuItems);
        renderAdmin();
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
    renderAdmin();
}

// IMAGE PROCESSING HELPER
window.handleImageUpload = function (input) {
    const file = input.files[0];
    if (!file) return;

    // Size Check (2MB Limit)
    if (file.size > 2 * 1024 * 1024) {
        alert("File too large. Please select an image under 2MB.");
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
        image: formData.get('finalImage'), // Get processed Base64 or URL
        description: formData.get('description'),
        isAvailable: true // Default to true for new items
    };

    if (!newItem.image) {
        newItem.image = 'https://placehold.co/400x300?text=No+Image'; // Fallback
    }

    if (adminState.modalMode === 'add') {
        // Generate new ID
        // If there are no items, start at 101. Otherwise find max and add 1.
        const newId = menuItems.length > 0 ? Math.max(...menuItems.map(i => i.id)) + 1 : 101;
        newItem.id = newId;
        menuItems.push(newItem);
    } else if (adminState.modalMode === 'edit') {
        const index = menuItems.findIndex(i => i.id === adminState.editingItem.id);
        if (index !== -1) {
            newItem.id = adminState.editingItem.id;
            newItem.isAvailable = adminState.editingItem.isAvailable; // Preserve availability
            menuItems[index] = newItem;
        }
    }

    DataStore.saveMenu(menuItems); // Persist changes
    closeModal();
}

function deleteMenuItem(id) {
    if (confirm('Are you sure you want to delete this item?')) {
        const menuItems = DataStore.getMenu();
        const index = menuItems.findIndex(i => i.id === id);
        if (index !== -1) {
            menuItems.splice(index, 1);
            DataStore.saveMenu(menuItems); // Persist changes
            renderAdmin();
        }
    }
}


// HELPERS FOR ORDERS VIEW
function getFilteredOrders() {
    const allOrders = DataStore.getOrders();

    // Filter by Date
    const start = new Date(adminState.startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(adminState.endDate);
    end.setHours(23, 59, 59, 999);

    let orders = allOrders.filter(o => {
        const d = new Date(o.date);
        return d >= start && d <= end;
    });

    // Filter by Search
    const query = (adminState.orderSearch || '').toLowerCase();
    if (query) {
        orders = orders.filter(o =>
            (o.id && o.id.toString().toLowerCase().includes(query)) ||
            (o.user && o.user.id && o.user.id.toLowerCase().includes(query)) ||
            (o.items && o.items.some(i => i.name.toLowerCase().includes(query)))
        );
    }
    return orders;
}

function renderOrdersListHTML(orders) {
    return `
        <div class="flex justify-between items-center mb-6">
             <h3 class="text-lg font-bold">Orders History</h3>
             <span class="text-xs font-bold text-gray-400 bg-gray-50 px-3 py-1 rounded-full">${orders.length} orders found</span>
        </div>
       
        ${orders.length === 0 ? `<div class="text-center py-10 text-gray-400 font-bold">No orders found matching your criteria.</div>` : `
        <div class="overflow-x-auto">
            <table class="w-full text-sm text-left">
                <thead class="text-gray-400 font-medium border-b border-gray-50">
                    <tr>
                        <th class="pb-3 pl-0 sm:pl-2">Order</th>
                        <th class="pb-3 hidden sm:table-cell">Date</th>
                        <th class="pb-3 hidden sm:table-cell">Customer</th>
                        <th class="pb-3 hidden sm:table-cell">Items</th>
                        <th class="pb-3 hidden sm:table-cell">Amount</th>
                        <th class="pb-3 text-right sm:text-left">Status</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-50">
                    ${orders.sort((a, b) => new Date(b.date) - new Date(a.date)).map(order => {
        const firstItem = order.items[0];
        const moreCount = order.items.length - 1;
        const userId = (order.user && order.user.id) ? order.user.id : 'Guest';
        return `
                        <tr class="group hover:bg-gray-50 transition-colors">
                            <!-- Mobile: Combined Info | Desktop: ID -->
                            <td class="py-4 pl-0 sm:pl-2 align-top w-auto">
                                <div class="hidden sm:block">
                                    <div class="font-bold text-gray-500">#${order.id}</div>
                                </div>
                                
                                <div class="sm:hidden flex gap-3">
                                     <img src="${firstItem.image}" class="w-12 h-12 rounded-lg object-cover bg-gray-100 flex-shrink-0">
                                     <div class="flex flex-col gap-0.5">
                                        <div class="flex items-center gap-2">
                                            <span class="font-[800] text-secondary text-sm">#${order.id}</span>
                                            <span class="text-[10px] text-gray-400">${new Date(order.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                        <div class="text-xs font-bold text-gray-600 line-clamp-1">${firstItem.name} ${moreCount > 0 ? `+${moreCount}` : ''}</div>
                                        <div class="text-xs font-[800] text-primary">${formatPrice(order.total)} • ${userId}</div>
                                     </div>
                                </div>
                            </td>

                            <td class="py-4 text-xs text-secondary hidden sm:table-cell align-top whitespace-nowrap pr-8">${new Date(order.date).toLocaleString()}</td>
                            <td class="py-4 font-bold text-secondary hidden sm:table-cell align-top">${userId}</td>
                            
                            <td class="hidden sm:table-cell py-4 text-secondary font-medium w-64 align-top">
                                <div class="flex items-center gap-2">
                                    <div class="w-8 h-8 rounded-lg bg-gray-100 flex-shrink-0 overflow-hidden">
                                         <img src="${firstItem.image}" class="w-full h-full object-cover">
                                    </div>
                                    <div class="line-clamp-1 text-xs">
                                        ${firstItem.name} ${moreCount > 0 ? `<span class="text-gray-400 font-bold">+${moreCount}</span>` : ''}
                                    </div>
                                </div>
                            </td>

                            <td class="py-4 font-bold text-secondary hidden sm:table-cell align-top">${formatPrice(order.total)}</td>
                            <td class="py-4 align-top text-right sm:text-left">
                                <span class="bg-orange-50 text-orange-600 px-2 sm:px-3 py-1 rounded-lg text-[10px] sm:text-xs font-bold whitespace-nowrap inline-block">${order.status}</span>
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

// AUTO-REFRESH & INIT
window.addEventListener('storage', () => { renderAdmin(); }); // Cross-tab updates
window.addEventListener('order-updated', () => { renderAdmin(); }); // Same-tab updates
window.addEventListener('menu-updated', () => { renderAdmin(); });
renderAdmin();
