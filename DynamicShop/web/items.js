// DS-WEB-VERSION: 2.5.7
// ═══════════════════════════════════════════════════════════════════════
// DYNAMICSHOP 物品目录 - JavaScript (汉化版)
// ═══════════════════════════════════════════════════════════════════════

// 全局状态
let allItems = [];
let filteredItems = [];
let categories = [];
let currentCategory = '';
let currentSort = 'name';
let searchQuery = '';
let hideOutOfStock = false;

// ═══ 初始化 ═══
document.addEventListener('DOMContentLoaded', () => {
    loadItems();
    loadCategories();
    setupEventListeners();
});

// ═══ 事件监听器 ═══
function setupEventListeners() {
    // 搜索输入框
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', debounce((e) => {
            searchQuery = e.target.value.toLowerCase();
            filterAndRenderItems();
        }, 300));
    }

    // 排序下拉菜单
    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect) {
        sortSelect.addEventListener('change', (e) => {
            currentSort = e.target.value;
            filterAndRenderItems();
        });
    }

    // 隐藏缺货复选框
    const hideOutOfStockCheckbox = document.getElementById('hideOutOfStock');
    if (hideOutOfStockCheckbox) {
        hideOutOfStockCheckbox.addEventListener('change', (e) => {
            hideOutOfStock = e.target.checked;
            filterAndRenderItems();
        });
    }

    // 模态框关闭（点击背景）
    document.getElementById('itemModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'itemModal') closeModal();
    });

    // 按 ESC 键关闭模态框
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
    });
}

// ═══ 数据加载 ═══
async function loadItems() {
    try {
        const response = await fetch('/api/shop/items');
        allItems = await response.json();
        document.getElementById('itemCount').textContent = allItems.length + ' 个物品';
        filterAndRenderItems();
    } catch (error) {
        console.error('加载物品时出错:', error);
        document.getElementById('itemsGrid').innerHTML =
            '<div class="loading">加载物品出错，请确保服务器正在运行。</div>';
    }
}

async function loadCategories() {
    try {
        const response = await fetch('/api/shop/categories');
        categories = await response.json();
        renderCategoryTabs();
    } catch (error) {
        console.error('加载分类时出错:', error);
    }
}

// ═══ 分类选项卡 ═══
function renderCategoryTabs() {
    const container = document.getElementById('categoryTabs');
    if (!container) return;

    const allBtn = `<button class="category-btn active" data-category="" onclick="selectCategory('')">
        全部物品
    </button>`;

    const categoryBtns = categories.map(cat => `
        <button class="category-btn" data-category="${cat.id}" onclick="selectCategory('${cat.id}')">
            ${getCategoryIcon(cat.id)} ${cat.displayName}
            <span class="category-count">${cat.itemCount}</span>
        </button>
    `).join('');

    container.innerHTML = allBtn + categoryBtns;
}

function getCategoryIcon(category) {
    const icons = {
        'TOOLS': '⚒️',
        'ARMOR': '🛡️',
        'WOOD': '🪵',
        'BLOCKS': '🧱',
        'FOOD': '🍖',
        'REDSTONE': '🔴',
        'FARMING': '🌾',
        'MISC': '📦'
    };
    return icons[category] || '📦';
}

function selectCategory(category) {
    currentCategory = category;

    // 更新选中状态
    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.category === category);
    });

    filterAndRenderItems();
}

// ═══ 筛选与排序 ═══
function filterAndRenderItems() {
    // 筛选
    filteredItems = allItems.filter(item => {
        const matchesSearch = !searchQuery ||
            item.displayName.toLowerCase().includes(searchQuery) ||
            item.item.toLowerCase().includes(searchQuery);
        const matchesCategory = !currentCategory || item.category === currentCategory;
        const matchesStock = !hideOutOfStock || item.stock > 0;
        return matchesSearch && matchesCategory && matchesStock;
    });

    // 排序
    filteredItems.sort((a, b) => {
        switch (currentSort) {
            case 'buyPrice': return b.buyPrice - a.buyPrice;
            case 'sellPrice': return b.sellPrice - a.sellPrice;
            case 'stock': return b.stock - a.stock;
            default: return a.displayName.localeCompare(b.displayName);
        }
    });

    renderItems();
}

// ═══ 渲染物品卡片 ═══
function renderItems() {
    const grid = document.getElementById('itemsGrid');
    const showingEl = document.getElementById('itemsShowing');

    if (!grid) return;

    if (showingEl) {
        showingEl.textContent = `显示 ${filteredItems.length} 个物品`;
    }

    if (!filteredItems.length) {
        grid.innerHTML = '<div class="loading">未找到物品</div>';
        return;
    }

    grid.innerHTML = filteredItems.map(item => `
        <div class="item-card glass" onclick="showItemDetails('${item.item}')">
            <div class="item-image-wrap">
                <img class="item-image" 
                     src="${item.imageUrl}" 
                     alt="${item.displayName}"
                     onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2264%22 height=%2264%22><rect fill=%22%23334155%22 width=%2264%22 height=%2264%22 rx=%228%22/><text x=%2232%22 y=%2238%22 text-anchor=%22middle%22 fill=%22%2394A3B8%22 font-size=%2224%22>?</text></svg>'">
            </div>
            <div class="item-info">
                <h3 class="item-name">${item.displayName}</h3>
                <span class="item-category">${item.category}</span>
            </div>
            <div class="item-prices">
                <div class="price buy">
                    <span class="price-label">购买</span>
                    <span class="price-value">${formatCurrency(item.buyPrice)}</span>
                </div>
                <div class="price sell">
                    <span class="price-label">出售</span>
                    <span class="price-value">${formatCurrency(item.sellPrice)}</span>
                </div>
            </div>
            <div class="item-stock">
                <span class="stock-label">库存:</span>
                <span class="stock-value ${item.stock <= 0 ? 'low' : ''}">${item.stock.toFixed(0)}</span>
            </div>
        </div>
    `).join('');
}

// ═══ 模态框详情 ═══
async function showItemDetails(itemName) {
    const modal = document.getElementById('itemModal');
    const modalTitle = document.getElementById('modalItemName');
    const modalBody = document.getElementById('modalBody');

    if (!modal || !modalTitle || !modalBody) return;

    const item = allItems.find(i => i.item === itemName);
    modalTitle.textContent = item?.displayName || itemName;
    modalBody.innerHTML = '<div class="loading-spinner"></div>';
    modal.classList.add('active');

    try {
        const [itemData, priceHistory] = await Promise.all([
            fetch(`/api/shop/item/${encodeURIComponent(itemName)}`).then(r => r.json()),
            fetch(`/api/analytics/price-history/${encodeURIComponent(itemName)}?hours=168`).then(r => r.json())
        ]);

        const recentTxs = itemData.recentTransactions || [];
        const recentBuyers = itemData.recentBuyers || [];
        const recentSellers = itemData.recentSellers || [];

        modalBody.innerHTML = `
            <div class="modal-item-header">
                <img src="${itemData.imageUrl}" alt="${itemData.displayName}" class="modal-item-image"
                     onerror="this.style.display='none'">
                <div class="modal-item-details">
                    <h3>${itemData.displayName}</h3>
                    <span class="item-category">${itemData.category}</span>
                    <div class="modal-prices">
                        <div class="modal-price buy">
                            <span class="label">购买价</span>
                            <span class="value">${formatCurrency(itemData.buyPrice)}</span>
                        </div>
                        <div class="modal-price sell">
                            <span class="label">出售价</span>
                            <span class="value">${formatCurrency(itemData.sellPrice)}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div class="modal-stats-grid">
                <div class="modal-stat">
                    <span class="stat-label">当前库存</span>
                    <span class="stat-value">${itemData.stock?.toFixed(0) || 0}</span>
                </div>
                <div class="modal-stat">
                    <span class="stat-label">基础价格</span>
                    <span class="stat-value">${formatCurrency(itemData.basePrice)}</span>
                </div>
                <div class="modal-stat">
                    <span class="stat-label">总购买次数</span>
                    <span class="stat-value">${itemData.totalBuys || 0}</span>
                </div>
                <div class="modal-stat">
                    <span class="stat-label">总出售次数</span>
                    <span class="stat-value">${itemData.totalSells || 0}</span>
                </div>
                <div class="modal-stat">
                    <span class="stat-label">总交易额</span>
                    <span class="stat-value">${formatCurrency(itemData.totalVolume || 0)}</span>
                </div>
            </div>

            <div class="modal-section">
                <h4>📈 价格历史（7天）</h4>
                <div class="chart-container-sm">
                    <canvas id="modalPriceChart"></canvas>
                </div>
            </div>

            <div class="modal-columns">
                <div class="modal-section">
                    <h4>👥 最近购买者</h4>
                    <div class="traders-list">
                        ${recentBuyers.length ? recentBuyers.map(t => `
                            <div class="trader-item">
                                <img src="https://mc-heads.net/avatar/${t.playerName}/24" class="trader-avatar"
                                     onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2224%22 height=%2224%22><rect fill=%22%23334155%22 width=%2224%22 height=%2224%22/></svg>'">
                                <span class="trader-name">${escapeHtml(t.playerName)}</span>
                                <span class="trader-amount">${t.amount} 个</span>
                            </div>
                        `).join('') : '<div class="no-data">暂无最近购买者</div>'}
                    </div>
                </div>
                <div class="modal-section">
                    <h4>👥 最近出售者</h4>
                    <div class="traders-list">
                        ${recentSellers.length ? recentSellers.map(t => `
                            <div class="trader-item">
                                <img src="https://mc-heads.net/avatar/${t.playerName}/24" class="trader-avatar"
                                     onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2224%22 height=%2224%22><rect fill=%22%23334155%22 width=%2224%22 height=%2224%22/></svg>'">
                                <span class="trader-name">${escapeHtml(t.playerName)}</span>
                                <span class="trader-amount">${t.amount} 个</span>
                            </div>
                        `).join('') : '<div class="no-data">暂无最近出售者</div>'}
                    </div>
                </div>
            </div>

            <div class="modal-section">
                <h4>📋 最近交易记录</h4>
                <div class="transactions-list">
                    ${recentTxs.slice(0, 10).map(tx => `
                        <div class="tx-item">
                            <span class="tx-time">${formatTime(tx.timestamp)}</span>
                            <span class="type-badge ${tx.type.toLowerCase()}">${tx.type === 'BUY' ? '购买' : '出售'}</span>
                            <span class="tx-amount">${tx.amount} 个 @ ${formatCurrency(tx.price)}</span>
                            <span class="tx-player">${escapeHtml(tx.playerName)}</span>
                        </div>
                    `).join('') || '<div class="no-data">暂无最近交易记录</div>'}
                </div>
            </div>
        `;

        // 渲染价格图表
        setTimeout(() => {
            const canvas = document.getElementById('modalPriceChart');
            if (canvas && priceHistory.length) {
                new Chart(canvas, {
                    type: 'line',
                    data: {
                        labels: priceHistory.map(h => h.timestamp.split(' ')[1] || h.timestamp),
                        datasets: [
                            {
                                label: '购买价',
                                data: priceHistory.map(h => h.avgBuyPrice),
                                borderColor: '#10B981',
                                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                                tension: 0.4,
                                fill: true
                            },
                            {
                                label: '出售价',
                                data: priceHistory.map(h => h.avgSellPrice),
                                borderColor: '#EF4444',
                                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                tension: 0.4,
                                fill: true
                            }
                        ]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { labels: { color: '#CBD5E1' } } },
                        scales: {
                            x: { ticks: { color: '#94A3B8' }, grid: { color: 'rgba(51, 65, 85, 0.5)' } },
                            y: { ticks: { color: '#94A3B8' }, grid: { color: 'rgba(51, 65, 85, 0.5)' } }
                        }
                    }
                });
            }
        }, 100);

    } catch (error) {
        console.error('加载物品详情时出错:', error);
        modalBody.innerHTML = '<div class="loading">加载物品详情失败</div>';
    }
}

function closeModal() {
    const modal = document.getElementById('itemModal');
    if (modal) modal.classList.remove('active');
}

// ═══ 工具函数 ═══
function formatCurrency(amount) {
    return '¥' + (amount || 0).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function formatTime(timestamp) {
    const date = new Date(timestamp);
    const diff = Date.now() - date.getTime();
    const mins = Math.floor(diff / 60000);

    if (mins < 1) return '刚刚';
    if (mins < 60) return `${mins} 分钟前`;
    if (mins < 1440) return `${Math.floor(mins / 60)} 小时前`;
    return date.toLocaleDateString();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
}

function debounce(fn, delay) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn(...args), delay);
    };
}