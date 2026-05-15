// DS-WEB-VERSION: 2.5.7
// ═══════════════════════════════════════════════════════════════════════
// 流浪世界服务器商店系统 DASHBOARD - JavaScript
// ═══════════════════════════════════════════════════════════════════════

// Global State
let allTransactions = [];
let filteredTransactions = [];
let currentPage = 1;
const itemsPerPage = 25;
let sortColumn = 'timestamp';
let sortDirection = 'desc';
let timeRange = 'all';
let activityTimeRange = '24h';
let currentLeaderboard = 'buyers';
let currentTrends = 'hot';
let activityChart = null;
let categoryChart = null;

function itemDisplayName(itemId) {
    if (window.getChineseName) {
        return window.getChineseName(itemId);
    }
    return prettifyItem(itemId);
}

function categoryDisplayName(category) {
    if (window.getChineseCategory) {
        return window.getChineseCategory(category);
    }
    return category || '未知';
}

function txTypeLabel(type) {
    if (type === 'BUY') return '购买';
    if (type === 'SELL') return '出售';
    return type;
}

function trendTextureHtml(itemId) {
    const name = itemDisplayName(itemId);
    if (typeof getTextureHtml === 'function') {
        return getTextureHtml(itemId, name);
    }
    if (window.getTextureHtml) {
        return window.getTextureHtml(itemId, name);
    }
    return '';
}

// ═══ INITIALIZATION ═══
document.addEventListener('DOMContentLoaded', () => {
    loadAllData();
    setupEventListeners();
    setInterval(loadAllData, 30000); // Auto-refresh every 30 seconds
});

// ═══ EVENT LISTENERS ═══
function setupEventListeners() {
    // Search input
    const txSearch = document.getElementById('txSearch');
    if (txSearch) {
        txSearch.addEventListener('input', debounce(applyFilters, 300));
    }

    // Type filter
    const typeFilter = document.getElementById('typeFilter');
    if (typeFilter) {
        typeFilter.addEventListener('change', applyFilters);
    }

    // Modal close on outside click
    document.getElementById('itemModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'itemModal') closeModal();
    });

    // Escape key closes modal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
    });
}

// ═══ DATA LOADING ═══
async function loadAllData() {
    try {
        await Promise.all([
            loadTransactions(),
            loadStats(),
            loadEconomyHealth(),
            loadLeaderboards(),
            loadTrends()
        ]);
        updateLastUpdateTime();
    } catch (error) {
        console.error('Error loading data:', error);
    }
}

async function loadTransactions() {
    try {
        const response = await fetch('/api/recent?limit=5000');
        allTransactions = await response.json();
        applyTimeFilter();
        renderTransactions();
        updateInsights();
        renderActivityChart();
    } catch (error) {
        console.error('Error loading transactions:', error);
        showError('transactionsBody', '加载交易失败');
    }
}

async function loadStats() {
    try {
        const response = await fetch('/api/stats');
        const stats = await response.json();

        animateNumber('totalTransactions', stats.total);
        animateNumber('totalMoney', stats.totalMoney, true);
        animateNumber('totalBuys', stats.buys);
        animateNumber('totalSells', stats.sells);
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

async function loadEconomyHealth() {
    try {
        const response = await fetch('/api/analytics/economy');
        const health = await response.json();

        // Update health metrics
        const buyRatioEl = document.getElementById('buyRatio');
        if (buyRatioEl) {
            buyRatioEl.textContent = (health.buyRatio * 100).toFixed(1) + '%';
        }

        const buyRatioBar = document.getElementById('buyRatioBar');
        if (buyRatioBar) {
            buyRatioBar.style.width = (health.buyRatio * 100) + '%';
        }

        setText('velocity', health.velocity + ' 笔/小时');

        const netFlow = health.netFlow;
        const flowElement = document.getElementById('netFlow');
        if (flowElement) {
            flowElement.textContent = formatCurrency(Math.abs(netFlow));
            flowElement.className = 'health-value ' + (netFlow >= 0 ? 'positive' : 'negative');
        }

        setText('avgTransaction', formatCurrency(health.avgTransaction));
        setText('uniqueItems', health.uniqueItems);
        setText('uniquePlayers', health.uniquePlayers);
    } catch (error) {
        console.error('Error loading economy health:', error);
    }
}

async function loadLeaderboards() {
    try {
        const response = await fetch(`/api/analytics/leaderboard?type=${currentLeaderboard}&limit=5`);
        const data = await response.json();
        renderLeaderboard(data);
    } catch (error) {
        console.error('Error loading leaderboards:', error);
        showError('leaderboardContent', '加载排行榜失败');
    }
}

async function loadTrends() {
    try {
        const response = await fetch('/api/analytics/trends?limit=10');
        const data = await response.json();
        renderTrends(data[currentTrends] || []);
    } catch (error) {
        console.error('Error loading trends:', error);
        showError('trendsContent', '加载趋势失败');
    }
}

// ═══ RENDERING ═══
function renderLeaderboard(data) {
    const container = document.getElementById('leaderboardContent');
    if (!container || !data.length) {
        if (container) container.innerHTML = '<div class="loading">暂无数据</div>';
        return;
    }

    const valueKey = currentLeaderboard === 'traders' ? 'trades' :
        currentLeaderboard === 'recyclers' ? 'earned' : 'spent';

    container.innerHTML = data.map((entry, i) => {
        const rankClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
        const value = valueKey === 'trades' ?
            entry.trades.toLocaleString() + ' 笔' :
            formatCurrency(Math.abs(entry[valueKey]));
        const subStat = currentLeaderboard === 'traders'
            ? `买入 ${formatCurrency(entry.spent)}  回收 ${formatCurrency(entry.earned)}`
            : `${entry.trades} 笔交易`;

        return `
            <div class="leaderboard-item">
                <div class="rank ${rankClass}">${i + 1}</div>
                <img class="player-avatar" 
                     src="https://mc-heads.net/avatar/${entry.player}/32" 
                     alt="${entry.player}"
                     onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2232%22 height=%2232%22><rect fill=%22%23334155%22 width=%2232%22 height=%2232%22/></svg>'">
                <div class="player-info">
                    <div class="player-name">${escapeHtml(entry.player)}</div>
                    <div class="player-stat">${subStat}</div>
                </div>
                <div class="player-value">${value}</div>
            </div>
        `;
    }).join('');
}

function renderTrends(items) {
    const container = document.getElementById('trendsContent');
    if (!container || !items.length) {
        if (container) container.innerHTML = '<div class="loading">暂无趋势数据</div>';
        return;
    }

    container.innerHTML = items.map(item => {
        const isPositive = item.changePercent >= 0;
        return `
            <div class="trend-item" onclick="showItemDetails('${escapeHtml(item.item)}')">
                <div class="trend-icon">${trendTextureHtml(item.item)}</div>
                <div class="trend-info">
                    <div class="trend-name">${itemDisplayName(item.item)}</div>
                    <div class="trend-stats">${item.recentCount} 笔近期  ${formatCurrency(item.avgPrice)}/件</div>
                </div>
                <span class="trend-change ${isPositive ? 'positive' : 'negative'}">
                    ${isPositive ? '+' : ''}${item.changePercent.toFixed(0)}%
                </span>
            </div>
        `;
    }).join('');
}

function renderTransactions() {
    const tbody = document.getElementById('transactionsBody');
    if (!tbody) return;

    if (!filteredTransactions.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="loading">未找到交易</td></tr>';
        return;
    }

    sortTransactions();

    const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
    const start = (currentPage - 1) * itemsPerPage;
    const pageData = filteredTransactions.slice(start, start + itemsPerPage);

    tbody.innerHTML = pageData.map(tx => `
        <tr onclick="showItemDetails('${escapeHtml(tx.item)}')">
            <td>${formatTime(tx.timestamp)}</td>
            <td>${escapeHtml(tx.playerName)}</td>
            <td><span class="type-badge ${tx.type.toLowerCase()}">${txTypeLabel(tx.type)}</span></td>
            <td>${itemDisplayName(tx.item)}</td>
            <td>${tx.amount.toLocaleString()}</td>
            <td>${formatCurrency(tx.price)}</td>
        </tr>
    `).join('');

    // Update pagination
    setText('currentPage', currentPage);
    setText('totalPages', totalPages || 1);
    document.getElementById('prevBtn').disabled = currentPage === 1;
    document.getElementById('nextBtn').disabled = currentPage >= totalPages;
}

const ACTIVITY_RANGE_CONFIG = {
    '10m': { windowMs: 10 * 60 * 1000, bucketMs: 60 * 1000 },
    '30m': { windowMs: 30 * 60 * 1000, bucketMs: 2 * 60 * 1000 },
    '1h': { windowMs: 60 * 60 * 1000, bucketMs: 5 * 60 * 1000 },
    '6h': { windowMs: 6 * 60 * 60 * 1000, bucketMs: 30 * 60 * 1000 },
    '24h': { windowMs: 24 * 60 * 60 * 1000, bucketMs: 60 * 60 * 1000 },
    '7d': { windowMs: 7 * 24 * 60 * 60 * 1000, bucketMs: 24 * 60 * 60 * 1000 },
    '1mo': { windowMs: 30 * 24 * 60 * 60 * 1000, bucketMs: 24 * 60 * 60 * 1000 },
    '1y': { windowMs: 365 * 24 * 60 * 60 * 1000, bucketMs: 7 * 24 * 60 * 60 * 1000 },
    '3y': { windowMs: 3 * 365 * 24 * 60 * 60 * 1000, bucketMs: 30 * 24 * 60 * 60 * 1000 },
    all: { windowMs: null, bucketMs: null }
};

function parseTxTime(timestamp) {
    if (!timestamp) return null;
    const raw = String(timestamp).trim();
    const iso = raw.includes('T') ? raw : raw.replace(' ', 'T');
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? null : date;
}

function pad2(n) {
    return String(n).padStart(2, '0');
}

function formatBucketLabel(date, rangeKey, bucketMs) {
    if (rangeKey === '10m' || rangeKey === '30m' || rangeKey === '1h') {
        return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
    }
    if (rangeKey === '6h' || rangeKey === '24h') {
        return `${pad2(date.getHours())}:00`;
    }
    if (rangeKey === '7d' || rangeKey === '1mo') {
        return `${pad2(date.getMonth() + 1)}/${pad2(date.getDate())}`;
    }
    if (rangeKey === '1y') {
        return `${pad2(date.getMonth() + 1)}/${pad2(date.getDate())}`;
    }
    if (rangeKey === '3y') {
        return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
    }
    if (bucketMs && bucketMs >= 30 * 24 * 60 * 60 * 1000) {
        return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
    }
    if (bucketMs && bucketMs >= 24 * 60 * 60 * 1000) {
        return `${pad2(date.getMonth() + 1)}/${pad2(date.getDate())}`;
    }
    if (bucketMs && bucketMs >= 60 * 60 * 1000) {
        return `${pad2(date.getMonth() + 1)}/${pad2(date.getDate())} ${pad2(date.getHours())}:00`;
    }
    return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function resolveAllRangeParams(transactions, nowMs) {
    const times = transactions
        .map(tx => parseTxTime(tx.timestamp))
        .filter(Boolean)
        .map(d => d.getTime());

    if (!times.length) {
        return { startMs: nowMs - 24 * 60 * 60 * 1000, bucketMs: 60 * 60 * 1000 };
    }

    const minT = Math.min(...times);
    const span = nowMs - minT;
    const day = 24 * 60 * 60 * 1000;

    if (span <= 2 * 60 * 60 * 1000) {
        return { startMs: minT, bucketMs: 5 * 60 * 1000 };
    }
    if (span <= 2 * day) {
        return { startMs: minT, bucketMs: 60 * 60 * 1000 };
    }
    if (span <= 60 * day) {
        return { startMs: minT, bucketMs: day };
    }
    if (span <= 2 * 365 * day) {
        return { startMs: minT, bucketMs: 7 * day };
    }
    return { startMs: minT, bucketMs: 30 * day };
}

function buildActivityBuckets(transactions, rangeKey) {
    const nowMs = Date.now();
    const cfg = ACTIVITY_RANGE_CONFIG[rangeKey] || ACTIVITY_RANGE_CONFIG['24h'];
    let windowMs = cfg.windowMs;
    let bucketMs = cfg.bucketMs;

    if (rangeKey === 'all') {
        const resolved = resolveAllRangeParams(transactions, nowMs);
        windowMs = nowMs - resolved.startMs;
        bucketMs = resolved.bucketMs;
    }

    const startMs = nowMs - windowMs;
    const bucketCount = Math.max(1, Math.ceil(windowMs / bucketMs));
    const buckets = [];

    for (let i = 0; i < bucketCount; i += 1) {
        const bucketStart = startMs + i * bucketMs;
        buckets.push({
            startMs: bucketStart,
            label: formatBucketLabel(new Date(bucketStart), rangeKey, bucketMs),
            buys: 0,
            sells: 0
        });
    }

    transactions.forEach(tx => {
        const t = parseTxTime(tx.timestamp);
        if (!t) return;
        const ts = t.getTime();
        if (ts < startMs || ts > nowMs) return;
        let idx = Math.floor((ts - startMs) / bucketMs);
        if (idx >= buckets.length) idx = buckets.length - 1;
        if (idx < 0) return;
        if (tx.type === 'BUY') buckets[idx].buys += 1;
        else buckets[idx].sells += 1;
    });

    return { buckets, bucketMs: bucketMs || cfg.bucketMs, rangeKey };
}

function computeActivityYAxis(buckets, rangeKey) {
    let maxVal = 0;
    buckets.forEach(b => {
        maxVal = Math.max(maxVal, b.buys + b.sells, b.buys, b.sells);
    });

    if (maxVal === 0) {
        const defaults = {
            '10m': 5, '30m': 8, '1h': 10, '6h': 15, '24h': 20,
            '7d': 30, '1mo': 50, '1y': 80, '3y': 100, all: 20
        };
        return { suggestedMax: defaults[rangeKey] || 10, stepSize: 1 };
    }

    const padded = Math.ceil(maxVal * 1.2);
    let stepSize = 1;
    if (padded <= 10) stepSize = 1;
    else if (padded <= 30) stepSize = 2;
    else if (padded <= 80) stepSize = 5;
    else if (padded <= 200) stepSize = 10;
    else if (padded <= 500) stepSize = 25;
    else stepSize = Math.ceil(padded / 10);

    const suggestedMax = Math.ceil(padded / stepSize) * stepSize;
    return { suggestedMax: Math.max(suggestedMax, stepSize), stepSize };
}

function renderActivityChart() {
    const canvas = document.getElementById('activityChart');
    if (!canvas) return;

    const { buckets, bucketMs, rangeKey } = buildActivityBuckets(allTransactions, activityTimeRange);
    const labels = buckets.map(b => b.label);
    const buyData = buckets.map(b => b.buys);
    const sellData = buckets.map(b => b.sells);
    const yAxis = computeActivityYAxis(buckets, rangeKey);

    const maxTicks = rangeKey === '10m' || rangeKey === '30m' ? 12
        : rangeKey === '1h' || rangeKey === '6h' ? 14
        : rangeKey === '24h' ? 16
        : rangeKey === '7d' ? 10
        : rangeKey === '1mo' ? 12
        : 14;

    if (activityChart) activityChart.destroy();

    activityChart = new Chart(canvas, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    label: '购买',
                    data: buyData,
                    backgroundColor: 'rgba(16, 185, 129, 0.7)',
                    borderRadius: 4
                },
                {
                    label: '出售',
                    data: sellData,
                    backgroundColor: 'rgba(239, 68, 68, 0.7)',
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: { color: '#CBD5E1' }
                },
                tooltip: {
                    callbacks: {
                        title(items) {
                            const idx = items[0]?.dataIndex;
                            if (idx == null || !buckets[idx]) return '';
                            const b = buckets[idx];
                            const step = bucketMs || 3600000;
                            const end = new Date(b.startMs + step);
                            return `${formatBucketLabel(new Date(b.startMs), rangeKey, step)} – ${formatBucketLabel(end, rangeKey, step)}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    stacked: true,
                    ticks: {
                        color: '#94A3B8',
                        maxRotation: 45,
                        minRotation: 0,
                        autoSkip: true,
                        maxTicksLimit: maxTicks
                    },
                    grid: { color: 'rgba(51, 65, 85, 0.5)' }
                },
                y: {
                    stacked: true,
                    beginAtZero: true,
                    suggestedMax: yAxis.suggestedMax,
                    ticks: {
                        color: '#94A3B8',
                        stepSize: yAxis.stepSize,
                        precision: 0
                    },
                    grid: { color: 'rgba(51, 65, 85, 0.5)' }
                }
            }
        }
    });
}

function setActivityTimeRange(range, btn) {
    activityTimeRange = range;
    document.querySelectorAll('.activity-time-selector .time-btn').forEach(b => b.classList.remove('active'));
    if (btn) {
        btn.classList.add('active');
    } else {
        document.querySelector(`.activity-time-selector .time-btn[data-range="${range}"]`)?.classList.add('active');
    }
    renderActivityChart();
}

function updateInsights() {
    updateTopItems();
    renderCategoryChart();
}

function updateTopItems() {
    const container = document.getElementById('topItems');
    if (!container) return;

    const itemCounts = {};
    filteredTransactions.forEach(tx => {
        if (!itemCounts[tx.item]) itemCounts[tx.item] = { count: 0, volume: 0 };
        itemCounts[tx.item].count += tx.amount;
        itemCounts[tx.item].volume += tx.price;
    });

    const sorted = Object.entries(itemCounts)
        .sort((a, b) => b[1].volume - a[1].volume)
        .slice(0, 8);

    container.innerHTML = sorted.map(([item, data]) => `
        <div class="insight-item" onclick="showItemDetails('${escapeHtml(item)}')">
            <span class="insight-name">${itemDisplayName(item)}</span>
            <span class="insight-value">${formatCurrency(data.volume)}</span>
        </div>
    `).join('') || '<div class="loading">暂无数据</div>';
}

function renderCategoryChart() {
    const canvas = document.getElementById('categoryChart');
    if (!canvas) return;

    const categories = {};
    filteredTransactions.forEach(tx => {
        const cat = categoryDisplayName(tx.category || 'unknown');
        categories[cat] = (categories[cat] || 0) + 1;
    });

    const labels = Object.keys(categories);
    const data = Object.values(categories);
    const colors = [
        '#8B5CF6', '#06B6D4', '#10B981', '#F59E0B',
        '#EF4444', '#EC4899', '#6366F1', '#14B8A6'
    ];

    if (categoryChart) categoryChart.destroy();

    categoryChart = new Chart(canvas, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data,
                backgroundColor: colors.slice(0, labels.length),
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        color: '#CBD5E1',
                        boxWidth: 12,
                        padding: 8
                    }
                }
            }
        }
    });
}

// ═══ MODAL ═══
async function showItemDetails(item) {
    const modal = document.getElementById('itemModal');
    const modalTitle = document.getElementById('modalItemName');
    const modalBody = document.getElementById('modalBody');

    if (!modal || !modalTitle || !modalBody) return;

    modalTitle.textContent = itemDisplayName(item);
    modalBody.innerHTML = '<div class="loading-spinner"></div>';
    modal.classList.add('active');

    try {
        const [itemData, priceHistory] = await Promise.all([
            fetch(`/api/shop/item/${encodeURIComponent(item)}`).then(r => r.json()),
            fetch(`/api/analytics/price-history/${encodeURIComponent(item)}?hours=168`).then(r => r.json())
        ]);

        const recentTxs = itemData.recentTransactions || [];

        modalBody.innerHTML = `
            <div class="modal-item-info">
                <img src="${itemData.imageUrl}" alt="${itemDisplayName(item)}" 
                     style="width: 64px; height: 64px; margin-right: 1rem;"
                     onerror="this.style.display='none'">
                <div>
                    <div style="font-size: 1.25rem; font-weight: 600;">${itemDisplayName(item)}</div>
                    <div style="color: var(--text-muted); margin-bottom: 0.5rem;">${categoryDisplayName(itemData.category)}</div>
                    <div style="display: flex; gap: 1rem;">
                        <span style="color: var(--success);">买入：${formatCurrency(itemData.buyPrice)}</span>
                        <span style="color: var(--danger);">卖出：${formatCurrency(itemData.sellPrice)}</span>
                    </div>
                </div>
            </div>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin: 1.5rem 0;">
                <div style="background: var(--bg-tertiary); padding: 1rem; border-radius: 8px; text-align: center;">
                    <div style="color: var(--text-muted); font-size: 0.8rem;">库存</div>
                    <div style="font-size: 1.25rem; font-weight: 600;">${itemData.stock?.toFixed(0) || 0}</div>
                </div>
                <div style="background: var(--bg-tertiary); padding: 1rem; border-radius: 8px; text-align: center;">
                    <div style="color: var(--text-muted); font-size: 0.8rem;">总购买</div>
                    <div style="font-size: 1.25rem; font-weight: 600;">${itemData.totalBuys || 0}</div>
                </div>
                <div style="background: var(--bg-tertiary); padding: 1rem; border-radius: 8px; text-align: center;">
                    <div style="color: var(--text-muted); font-size: 0.8rem;">总出售</div>
                    <div style="font-size: 1.25rem; font-weight: 600;">${itemData.totalSells || 0}</div>
                </div>
            </div>
            <h3 style="margin-bottom: 1rem;">价格历史（7 天）</h3>
            <div style="height: 200px; margin-bottom: 1.5rem;">
                <canvas id="modalPriceChart"></canvas>
            </div>
            <h3 style="margin-bottom: 1rem;">最近交易</h3>
            <div style="max-height: 200px; overflow-y: auto;">
                ${recentTxs.slice(0, 10).map(tx => `
                    <div style="display: flex; justify-content: space-between; padding: 0.75rem; background: var(--bg-tertiary); border-radius: 6px; margin-bottom: 0.5rem;">
                        <span>${formatTime(tx.timestamp)}</span>
                        <span class="type-badge ${tx.type.toLowerCase()}">${txTypeLabel(tx.type)}</span>
                        <span>${tx.amount} 件 @ ${formatCurrency(tx.price)}</span>
                        <span>${escapeHtml(tx.playerName)}</span>
                    </div>
                `).join('') || '<div class="loading">暂无最近交易</div>'}
            </div>
        `;

        // Render price chart
        setTimeout(() => {
            const canvas = document.getElementById('modalPriceChart');
            if (canvas && priceHistory.length) {
                new Chart(canvas, {
                    type: 'line',
                    data: {
                        labels: priceHistory.map(h => h.timestamp.split(' ')[1] || h.timestamp),
                        datasets: [
                            {
                                label: '买入价',
                                data: priceHistory.map(h => h.avgBuyPrice),
                                borderColor: '#10B981',
                                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                                tension: 0.4,
                                fill: true
                            },
                            {
                                label: '卖出价',
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
        console.error('Error loading item details:', error);
        modalBody.innerHTML = '<div class="loading">加载物品详情失败</div>';
    }
}

function closeModal() {
    const modal = document.getElementById('itemModal');
    if (modal) modal.classList.remove('active');
}

// ═══ FILTERS & SORTING ═══
function applyTimeFilter() {
    const now = new Date();
    let cutoff;

    switch (timeRange) {
        case '1h': cutoff = new Date(now - 60 * 60 * 1000); break;
        case '24h': cutoff = new Date(now - 24 * 60 * 60 * 1000); break;
        case '7d': cutoff = new Date(now - 7 * 24 * 60 * 60 * 1000); break;
        case '30d': cutoff = new Date(now - 30 * 24 * 60 * 60 * 1000); break;
        default: filteredTransactions = [...allTransactions]; return;
    }

    filteredTransactions = allTransactions.filter(tx => new Date(tx.timestamp) > cutoff);
}

function applyFilters() {
    const search = document.getElementById('txSearch')?.value.toLowerCase() || '';
    const typeFilter = document.getElementById('typeFilter')?.value || '';

    // First apply time filter to get the base set
    applyTimeFilter();

    // Then filter by search and type on top of the time-filtered results
    if (search || typeFilter) {
        filteredTransactions = filteredTransactions.filter(tx => {
            const itemCn = itemDisplayName(tx.item).toLowerCase();
            const matchesSearch = !search ||
                tx.playerName.toLowerCase().includes(search) ||
                tx.item.toLowerCase().includes(search) ||
                itemCn.includes(search);
            const matchesType = !typeFilter || tx.type === typeFilter;
            return matchesSearch && matchesType;
        });
    }

    currentPage = 1;
    renderTransactions();
}

function sortTransactions() {
    filteredTransactions.sort((a, b) => {
        let aVal = a[sortColumn];
        let bVal = b[sortColumn];

        if (sortColumn === 'timestamp') {
            aVal = new Date(aVal).getTime();
            bVal = new Date(bVal).getTime();
        }

        return sortDirection === 'desc' ? bVal - aVal : aVal - bVal;
    });
}

function setTimeRange(range) {
    timeRange = range;
    applyTimeFilter();
    renderTransactions();
    updateInsights();
    renderCategoryChart();
}

// ═══ TAB SWITCHING ═══
function switchLeaderboard(type) {
    currentLeaderboard = type;
    document.querySelectorAll('.leaderboard-tabs .tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    loadLeaderboards();
}

function switchTrends(type) {
    currentTrends = type;
    document.querySelectorAll('.trends-tabs .tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    loadTrends();
}

// ═══ PAGINATION ═══
function nextPage() {
    const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
    if (currentPage < totalPages) {
        currentPage++;
        renderTransactions();
    }
}

function previousPage() {
    if (currentPage > 1) {
        currentPage--;
        renderTransactions();
    }
}

// ═══ UTILITIES ═══
function refreshData() {
    const btn = document.querySelector('.refresh-btn');
    if (btn) {
        btn.style.transform = 'rotate(360deg)';
        setTimeout(() => btn.style.transform = '', 500);
    }
    loadAllData();
}

function updateLastUpdateTime() {
    const el = document.getElementById('lastUpdate');
    if (el) el.textContent = new Date().toLocaleTimeString('zh-CN');
}

function formatTime(timestamp) {
    const date = new Date(timestamp);
    const diff = Date.now() - date.getTime();
    const mins = Math.floor(diff / 60000);

    if (mins < 1) return '刚刚';
    if (mins < 60) return `${mins} 分钟前`;
    if (mins < 1440) return `${Math.floor(mins / 60)} 小时前`;
    return date.toLocaleDateString('zh-CN');
}

function formatCurrency(amount) {
    return '￥' + (amount || 0).toLocaleString('zh-CN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function prettifyItem(item) {
    return item.split('_')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function showError(id, message) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = `<div class="loading">${message}</div>`;
}

function animateNumber(id, value, isCurrency = false) {
    const el = document.getElementById(id);
    if (!el) return;

    const target = typeof value === 'number' ? value : 0;
    const duration = 500;
    const start = performance.now();
    const startValue = 0;

    function update(now) {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const current = startValue + (target - startValue) * easeOutQuart(progress);

        el.textContent = isCurrency ? formatCurrency(current) : Math.round(current).toLocaleString();

        if (progress < 1) requestAnimationFrame(update);
    }

    requestAnimationFrame(update);
}

function easeOutQuart(x) {
    return 1 - Math.pow(1 - x, 4);
}

function debounce(fn, delay) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn(...args), delay);
    };
}