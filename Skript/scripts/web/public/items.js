// ==========================================
// 流浪世界服务器商店系统 物品目录 - 核心逻辑 (Skript 适配版)
// ==========================================

// 全局状态（新增 sortReverse 变量）
let allItems = [];
let filteredItems = [];
let currentSort = 'name';
let searchQuery = '';
let letterFilter = ''; // A–Z 首字母筛选，空表示不限
let sortReverse = false; // 逆序状态，默认关闭
let hideUntradable = false; // 隐藏无 UltimateShop 上架（不可交易）的物品
let currentUser = null;
let authToken = localStorage.getItem('authToken') || null;
let authMode = 'login';
let currentPage = 1;
let itemScope = 'all';
const PAGE_SIZE = 60;
let searchTimer = null;
let pageBeforeSearch = null;
let clockTimeTimer = null;
let pointerBearingTimer = null;
let pointerBearingX = null;
let pointerBearingY = null;

const POINTER_COMPASS_TILT_COS = Math.cos(Math.PI / 4);

const SORT_VALUES = new Set(['name', 'buyPrice', 'sellPrice', 'stock']);
const ITEM_SCOPE_VALUES = new Set(['all', 'vanilla', 'custom']);

function replaceUrlIfChanged(params) {
    const qs = params.toString();
    const next = qs
        ? `${window.location.pathname}?${qs}${window.location.hash || ''}`
        : `${window.location.pathname}${window.location.hash || ''}`;
    const cur = `${window.location.pathname}${window.location.search}${window.location.hash || ''}`;
    if (next !== cur) {
        history.replaceState(null, '', next);
    }
}

/** 从地址栏恢复：搜索、排序、复选框、页码（交易弹窗在数据加载后单独处理） */
function hydrateItemsStateFromUrl() {
    const params = new URLSearchParams(window.location.search);

    if (params.has('q')) {
        const trimmed = (params.get('q') || '').trim();
        searchQuery = normalizeSearchText(trimmed);
        const inp = document.getElementById('searchInput');
        if (inp) inp.value = trimmed;
        updateSearchClearButton();
    }

    const letterParam = (params.get('letter') || '').trim().toUpperCase();
    if (letterParam && /^[A-Z]$/.test(letterParam)) {
        letterFilter = letterParam;
    }

    const sortVal = params.get('sort');
    if (sortVal && SORT_VALUES.has(sortVal)) {
        currentSort = sortVal;
        const sortSelect = document.getElementById('sortSelect');
        if (sortSelect) sortSelect.value = sortVal;
    }

    const scopeVal = params.get('scope');
    itemScope = scopeVal && ITEM_SCOPE_VALUES.has(scopeVal) ? scopeVal : 'all';
    updateCategoryScopeButtons();

    sortReverse = params.get('rev') === '1';
    const revEl = document.getElementById('sortReverse');
    if (revEl) revEl.checked = sortReverse;

    hideUntradable = params.get('hide') === '1';
    const hideEl = document.getElementById('hideUntradable');
    if (hideEl) hideEl.checked = hideUntradable;

    const pageNum = parseInt(params.get('page'), 10);
    if (Number.isFinite(pageNum) && pageNum >= 1) {
        currentPage = pageNum;
    }
}

/** 根据当前 UI 状态写回地址栏（不新增历史记录） */
function syncItemsStateToUrl() {
    const params = new URLSearchParams(window.location.search);

    const inp = document.getElementById('searchInput');
    const raw = inp ? inp.value.trim() : '';
    if (raw) params.set('q', raw);
    else params.delete('q');

    if (letterFilter) params.set('letter', letterFilter);
    else params.delete('letter');

    if (currentSort && currentSort !== 'name') params.set('sort', currentSort);
    else params.delete('sort');

    if (itemScope && itemScope !== 'all') params.set('scope', itemScope);
    else params.delete('scope');

    if (sortReverse) params.set('rev', '1');
    else params.delete('rev');

    if (hideUntradable) params.set('hide', '1');
    else params.delete('hide');

    if (currentPage > 1) params.set('page', String(currentPage));
    else params.delete('page');

    const tradeModal = document.getElementById('tradeModal');
    const tradeOpen = tradeModal && tradeModal.classList.contains('active');
    const tradeId = tradeOpen && tradeModal.dataset.tradeItemId ? tradeModal.dataset.tradeItemId : null;
    if (tradeId) params.set('trade', tradeId);
    else params.delete('trade');

    replaceUrlIfChanged(params);
}

/** 刷新后若带 ?trade= 则打开交易弹窗；无效则移除参数 */
function tryOpenTradeFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const tid = params.get('trade');
    if (!tid || !allItems.length) return;
    const item = allItems.find((i) => i.id === tid);
    const offers = item && item.ultimateShopOffers ? item.ultimateShopOffers : [];
    if (item && offers.length) {
        openTradeModal(item);
    } else {
        params.delete('trade');
        replaceUrlIfChanged(params);
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', async () => {
    if (window.mcLangReady) {
        await window.mcLangReady;
    }
    if (!window.McItemIcon) {
        console.warn('[物品图标] item-model-renderer.js 未加载，仍使用 PNG');
    } else if (!window.THREE) {
        console.warn('[物品图标] Three.js 未加载（检查 vendor/three.module.min.js），仍使用 PNG');
    }
    initItemsHeroCompass();
    loadItems();
    setupEventListeners();
    loadUserProfile();
    ensureClockTimeTicker();
    ensurePointerBearingTicker();
});

// 绑定页面交互事件（新增逆序复选框监听）
// 该函数在后面定义为优化版，避免重复定义。

// 从 Node.js 后端拉取数据，并读取 UltimateShop 映射
async function loadItems() {
    try {
        const response = await fetch('/api/prices?t=' + new Date().getTime());

        if (!response.ok) throw new Error('网络响应失败');
        const rawData = await response.json();

        // 核心转换逻辑
        LETTER_SORT_CACHE.clear();
        allItems = Object.keys(rawData).map(key => ({
            id: key,
            name: rawData[key].displayName
                || rawData[key].customDisplayName
                || (window.getChineseName ? window.getChineseName(key) : key),
            buyPrice: rawData[key].buy,
            sellPrice: rawData[key].sell,
            source: rawData[key].source || 'vanilla',
            custom: rawData[key].custom === true,
            shop: rawData[key].shop || null,
            shopItem: rawData[key].item || null,
            buyAmount: rawData[key].amount || 1,
            displayName: rawData[key].displayName || rawData[key].customDisplayName || null,
            loreLine: normalizeLoreLine(rawData[key].loreLine
                || rawData[key].description
                || rawData[key].lore
                || (window.getItemLoreLine ? window.getItemLoreLine(key) : null)),
            ultimateShopOffers: Array.isArray(rawData[key].ultimateShopOffers)
                ? rawData[key].ultimateShopOffers
                : []
        }));

        hydrateItemsStateFromUrl();
        initLetterIndexBar();
        updateLetterIndexButtons();
        filterAndRenderItems();
        tryOpenTradeFromUrl();

    } catch (error) {
        console.error('加载物品数据出错:', error);
        const grid = document.getElementById('itemsGrid');
        if (grid) {
            grid.innerHTML = '<div style="color:#ef4444; text-align:center; grid-column:1/-1; padding: 40px; background: #1e293b; border-radius: 12px;">⚠️ 无法连接到后端数据库。</div>';
        }
    }
}

function formatUltimateShopPrice(val) {
    if (val === null || val === undefined) {
        return '—';
    }
    if (typeof val === 'number' && Number.isFinite(val)) {
        return `￥${val.toFixed(2)}`;
    }
    return String(val);
}

function isValidShopLocation(location) {
    return !!(location
        && location.enabled !== false
        && location.map
        && location.x !== undefined
        && location.y !== undefined
        && location.z !== undefined);
}

function blueMapUrlForLocation(location) {
    if (!isValidShopLocation(location)) return null;
    const map = encodeURIComponent(String(location.map || 'world'));
    const x = Number(location.x);
    const y = Number(location.y);
    const z = Number(location.z);
    if (![x, y, z].every(Number.isFinite)) return null;
    return `http://${window.location.hostname}:8100/#${map}:${x.toFixed(2)}:${y.toFixed(2)}:${z.toFixed(2)}:180:0.4:0.25:0:0:perspective`;
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function normalizeLoreLine(value) {
    if (Array.isArray(value)) {
        return value.map(normalizeLoreLine).find(Boolean) || null;
    }
    if (value && typeof value === 'object') {
        if (value.text != null) return normalizeLoreLine(value.text);
        if (value.translate != null) return normalizeLoreLine(value.translate);
        return null;
    }
    if (value == null) return null;
    const text = String(value).replace(/§[0-9a-fk-or]/gi, '').trim();
    return text || null;
}

function isCustomCatalogItem(item) {
    if (!item || typeof item !== 'object') return false;
    return item.custom === true
        || item.isCustom === true
        || item.source === 'custom'
        || item.kind === 'custom'
        || item.type === 'custom';
}

function updateCategoryScopeButtons() {
    const tabs = document.getElementById('categoryTabs');
    if (!tabs) return;
    tabs.querySelectorAll('.category-btn[data-scope]').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.scope === itemScope);
    });
}

function formatClockSystemTime(date) {
    if (window.McClockUi) return window.McClockUi.formatSystemTime(date);
    const d = date || new Date();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
}

function updateClockTimeDescriptions(root) {
    if (window.McClockUi) {
        window.McClockUi.updateTimeElements(root);
        return;
    }
    const host = root || document;
    const text = formatClockSystemTime();
    host.querySelectorAll('[data-clock-time-desc]').forEach((el) => {
        el.textContent = text;
        const container = el.closest('.scrolling-text');
        if (container) container.title = text;
    });
}

function ensureClockTimeTicker() {
    if (window.McClockUi) {
        window.McClockUi.ensureTimeTicker();
        return;
    }
    if (clockTimeTimer !== null) return;
    clockTimeTimer = setInterval(() => updateClockTimeDescriptions(document), 1000);
}

function formatCompassBearingForElement(el) {
    const deviceHeading = window.McPointerCompass && window.McPointerCompass.getDeviceHeading
        ? window.McPointerCompass.getDeviceHeading()
        : null;
    if (typeof deviceHeading === 'number') {
        return formatHeadingDegrees(deviceHeading);
    }
    const deviceStatus = window.McPointerCompass && window.McPointerCompass.getDeviceStatus
        ? window.McPointerCompass.getDeviceStatus()
        : '';
    if (isCoarsePointerDeviceForItems()) {
        if (deviceStatus === 'insecure') return '浏览器未开放罗盘：需要 HTTPS';
        if (deviceStatus === 'denied') return '系统指南针权限被拒绝';
        if (deviceStatus === 'unsupported') return '浏览器不支持系统指南针';
        if (deviceStatus === 'low-accuracy') return '罗盘精度较低，请校准手机';
        if (deviceStatus === 'permission') return '点击允许后读取系统指南针';
        return '等待系统指南针数据';
    }
    if (!el || pointerBearingX == null || pointerBearingY == null) return '移动鼠标查看方位';
    const heroWidget = el.closest('#heroCompassWidget');
    const card = el.closest('.glass');
    const icon = (heroWidget && heroWidget.querySelector('[data-item-id="compass"], [data-item-id="recovery_compass"]'))
        || (card && card.querySelector('[data-item-id="compass"], [data-item-id="recovery_compass"]'));
    if (!icon || !icon.getBoundingClientRect) return '移动鼠标查看方位';

    const rect = icon.getBoundingClientRect();
    const dx = pointerBearingX - (rect.left + rect.width / 2);
    const dy = pointerBearingY - (rect.top + rect.height / 2);
    if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) return '中心';

    const east = dx;
    const south = dy / POINTER_COMPASS_TILT_COS;
    const absE = Math.abs(east);
    const absS = Math.abs(south);
    if (absE < 0.001) return south >= 0 ? '正南' : '正北';
    if (absS < 0.001) return east >= 0 ? '正东' : '正西';

    const eastWest = east >= 0 ? '东' : '西';
    const northSouth = south >= 0 ? '南' : '北';
    const fromEastWest = Math.atan(absS / absE) * 180 / Math.PI;
    const fromNorthSouth = 90 - fromEastWest;
    if (fromEastWest <= 45) {
        return `${eastWest}偏${northSouth} ${fromEastWest.toFixed(1)} 度`;
    }
    return `${northSouth}偏${eastWest} ${fromNorthSouth.toFixed(1)} 度`;
}

function isCoarsePointerDeviceForItems() {
    return window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
}

function formatHeadingDegrees(heading) {
    const h = ((heading % 360) + 360) % 360;
    if (h < 0.05 || h >= 359.95) return '正北';
    if (Math.abs(h - 90) < 0.05) return '正东';
    if (Math.abs(h - 180) < 0.05) return '正南';
    if (Math.abs(h - 270) < 0.05) return '正西';
    if (h < 45) return `北偏东 ${h.toFixed(1)} 度`;
    if (h < 90) return `东偏北 ${(90 - h).toFixed(1)} 度`;
    if (h < 135) return `东偏南 ${(h - 90).toFixed(1)} 度`;
    if (h < 180) return `南偏东 ${(180 - h).toFixed(1)} 度`;
    if (h < 225) return `南偏西 ${(h - 180).toFixed(1)} 度`;
    if (h < 270) return `西偏南 ${(270 - h).toFixed(1)} 度`;
    if (h < 315) return `西偏北 ${(h - 270).toFixed(1)} 度`;
    return `北偏西 ${(360 - h).toFixed(1)} 度`;
}

function updatePointerBearingDescriptions(root) {
    const host = root || document;
    host.querySelectorAll('[data-pointer-bearing-desc]').forEach((el) => {
        const text = formatCompassBearingForElement(el);
        el.textContent = text;
        if (el.hasAttribute('data-pointer-bearing-title')) {
            el.title = text;
        } else {
            const container = el.closest('.scrolling-text');
            if (container) container.title = text;
        }
    });
}

function initItemsHeroCompass() {
    const mount = document.getElementById('heroCompassIconMount');
    if (!mount || mount.dataset.heroCompassReady === '1') return;

    if (typeof getTextureHtml === 'function') {
        mount.innerHTML = getTextureHtml('compass', '指南针');
    } else if (window.getTextureHtml) {
        mount.innerHTML = window.getTextureHtml('compass', '指南针');
    }

    const canvas = mount.querySelector('canvas[data-item-id="compass"]');
    if (canvas && window.McTextureAnim) {
        const urls = window.mcMouseCompassTextureUrlsForItem
            ? window.mcMouseCompassTextureUrlsForItem('compass')
            : (canvas.dataset.texUrls || '').split('|').filter(Boolean);
        if (urls.length) {
            if (!canvas.dataset.texUrls) {
                canvas.dataset.texUrls = urls.join('|');
            }
            window.McTextureAnim.initCanvasFromUrls(canvas, urls).then((ok) => {
                if (ok) {
                    canvas.style.opacity = '1';
                    canvas.dataset.texReady = '1';
                }
            });
        }
    }

    const widget = document.getElementById('heroCompassWidget');
    updatePointerBearingDescriptions(widget);
    ensurePointerBearingTicker();
    mount.dataset.heroCompassReady = '1';
}

function ensurePointerBearingTicker() {
    if (pointerBearingTimer !== null) return;
    if (window.McPointerCompass && window.McPointerCompass.requestDeviceCompass) {
        window.McPointerCompass.requestDeviceCompass();
    }
    const updatePointer = (event) => {
        pointerBearingX = event.clientX;
        pointerBearingY = event.clientY;
        updatePointerBearingDescriptions(document);
    };
    window.addEventListener('pointermove', updatePointer, { passive: true });
    window.addEventListener('mousemove', updatePointer, { passive: true });
    pointerBearingTimer = setInterval(() => updatePointerBearingDescriptions(document), 100);
}

function showDialog(modal) {
    if (!modal) return;
    modal.classList.remove('closing');
    modal.classList.add('active');
}

function hideDialog(modal, afterClose) {
    if (!modal || !modal.classList.contains('active')) {
        if (typeof afterClose === 'function') afterClose();
        return;
    }
    modal.classList.add('closing');
    modal.classList.remove('active');
    window.setTimeout(() => {
        modal.classList.remove('closing');
        if (typeof afterClose === 'function') afterClose();
    }, 190);
}

function closeTradeModal() {
    const modal = document.getElementById('tradeModal');
    hideDialog(modal, () => {
        if (modal) delete modal.dataset.tradeItemId;
        syncItemsStateToUrl();
    });
}

function openTradeModal(item) {
    const modal = document.getElementById('tradeModal');
    const title = document.getElementById('tradeModalTitle');
    const body = document.getElementById('tradeModalBody');
    if (!modal || !title || !body) {
        return;
    }

    title.textContent = `UltimateShop  ${item.name}`;

    const offers = item.ultimateShopOffers || [];
    const blocks = offers.map((o, idx) => {
        const shopName = o.shopTitleResolved || o.shopTitle;
        const shopLabel = shopName != null && String(shopName).trim() !== ''
            ? escapeHtml(String(shopName))
            : escapeHtml(o.shopId);
        const buyDisplay = o.buyAmountResolved != null ? o.buyAmountResolved : o.buyAmount;
        const sellDisplay = o.sellAmountResolved != null ? o.sellAmountResolved : o.sellAmount;
        const mapUrl = blueMapUrlForLocation(o.location);
        const mapButton = mapUrl
            ? `<a class="trade-map-link" href="${escapeHtml(mapUrl)}" target="_blank" rel="noopener">在地图上查看</a>`
            : '<span class="trade-map-missing">未配置地图位置</span>';
        const locationText = isValidShopLocation(o.location)
            ? `${o.location.world || 'world'} / ${o.location.x}, ${o.location.y}, ${o.location.z}${o.location.description ? ` · ${o.location.description}` : ''}`
            : '—';
        return `
            <div class="trade-offer-card">
                <h4>上架位置 ${idx + 1}</h4>
                <dl class="trade-offer-meta">
                    <dt>商店 ID</dt>
                    <dd>${escapeHtml(o.shopId)}</dd>
                    <dt>商店名称</dt>
                    <dd>${shopLabel}</dd>
                    <dt>商品槽位</dt>
                    <dd>${escapeHtml(o.slot)}</dd>
                    <dt>买入价</dt>
                    <dd>${escapeHtml(formatUltimateShopPrice(buyDisplay))}</dd>
                    <dt>卖出价</dt>
                    <dd>${escapeHtml(formatUltimateShopPrice(sellDisplay))}</dd>
                    <dt>地图位置</dt>
                    <dd>${escapeHtml(locationText)}</dd>
                </dl>
                <div style="margin-top:12px; display:flex; justify-content:flex-end;">${mapButton}</div>
            </div>
        `;
    }).join('');

    body.innerHTML = `
        <p style="margin:0 0 16px 0; color:#94a3b8; font-size:0.9rem;">
            以下为 UltimateShop 商店 YAML 中的报价；网页端会解析 {lang:...} 与 %mcwws.price_*% 占位符。
        </p>
        <div class="trade-offer-list">${blocks}</div>
    `;

    showDialog(modal);
    modal.dataset.tradeItemId = item.id;
    syncItemsStateToUrl();
}

function handleTradeClick(itemId) {
    const item = allItems.find(i => i.id === itemId);
    if (!item) {
        syncItemsStateToUrl();
        return showToast('未找到该物品。', false);
    }
    const offers = item.ultimateShopOffers || [];
    if (!offers.length) {
        syncItemsStateToUrl();
        return showToast('该物品未在任何 UltimateShop 商店 YAML 中上架，无法交易。', false);
    }
    openTradeModal(item);
}

function showToast(message, success = true) {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.position = 'fixed';
    toast.style.bottom = '24px';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.style.padding = '14px 18px';
    toast.style.borderRadius = '12px';
    toast.style.background = success ? 'rgba(34,197,94,0.95)' : 'rgba(239,68,68,0.95)';
    toast.style.color = '#fff';
    toast.style.fontSize = '0.95rem';
    toast.style.zIndex = 9999;
    toast.style.boxShadow = '0 10px 30px rgba(0,0,0,0.2)';
    toast.style.maxWidth = 'calc(100% - 40px)';
    toast.style.textAlign = 'center';
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.transition = 'opacity 0.25s ease';
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 250);
    }, 3200);
}

// 搜索过滤与排序逻辑（新增逆序处理和拼音搜索支持）
/** 美式 QWERTY：盲打时易误触的邻键（仅 a-z、0-9 与常用符号） */
const KEYBOARD_NEIGHBORS = {
    '`': ['1', '~'],
    '1': ['`', '2', 'q'],
    '2': ['1', '3', 'q', 'w'],
    '3': ['2', '4', 'w', 'e'],
    '4': ['3', '5', 'e', 'r'],
    '5': ['4', '6', 'r', 't'],
    '6': ['5', '7', 't', 'y'],
    '7': ['6', '8', 'y', 'u'],
    '8': ['7', '9', 'u', 'i'],
    '9': ['8', '0', 'i', 'o'],
    '0': ['9', '-', 'o', 'p'],
    '-': ['0', '=', 'p', '['],
    '=': ['-', '[', ']'],
    q: ['1', '2', 'w', 'a'],
    w: ['q', '2', '3', 'e', 'a', 's'],
    e: ['w', '3', '4', 'r', 's', 'd'],
    r: ['e', '4', '5', 't', 'd', 'f'],
    t: ['r', '5', '6', 'y', 'f', 'g'],
    y: ['t', '6', '7', 'u', 'g', 'h'],
    u: ['y', '7', '8', 'i', 'h', 'j'],
    i: ['u', '8', '9', 'o', 'j', 'k'],
    o: ['i', '9', '0', 'p', 'k', 'l'],
    p: ['o', '0', '-', '[', 'l', ';'],
    a: ['q', 'w', 's', 'z'],
    s: ['a', 'w', 'e', 'd', 'z', 'x'],
    d: ['s', 'e', 'r', 'f', 'x', 'c'],
    f: ['d', 'r', 't', 'g', 'c', 'v'],
    g: ['f', 't', 'y', 'h', 'v', 'b'],
    h: ['g', 'y', 'u', 'j', 'b', 'n'],
    j: ['h', 'u', 'i', 'k', 'n', 'm'],
    k: ['j', 'i', 'o', 'l', 'm', ','],
    l: ['k', 'o', 'p', ';', ',', '.'],
    z: ['a', 's', 'x'],
    x: ['z', 's', 'd', 'c'],
    c: ['x', 'd', 'f', 'v'],
    v: ['c', 'f', 'g', 'b'],
    b: ['v', 'g', 'h', 'n'],
    n: ['b', 'h', 'j', 'm'],
    m: ['n', 'j', 'k', ','],
    '[': ['p', '-', '=', ']', ';', "'"],
    ']': ['[', '=', '\\', "'"],
    '\\': [']', "'"],
    ';': ['p', '[', 'l', "'", '/'],
    "'": [';', '[', ']', '/'],
    ',': ['m', 'k', 'l', '.'],
    '.': [',', 'l', ';', '/'],
    '/': ['.', ';', "'"]
};

const KEYBOARD_CHAR_SET_CACHE = new Map();

/** 忽略拼音输入法误触的单引号分隔（如 指南针 → z'n'z、co'm） */
function normalizeSearchText(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/[''`´′＇]/g, '');
}

function compactSearchText(value) {
    return normalizeSearchText(value).replace(/[\s_'`´′＇_-]+/g, '');
}

function getKeyboardCharSet(ch) {
    if (KEYBOARD_CHAR_SET_CACHE.has(ch)) {
        return KEYBOARD_CHAR_SET_CACHE.get(ch);
    }
    const set = new Set([ch]);
    const neighbors = KEYBOARD_NEIGHBORS[ch];
    if (neighbors) {
        neighbors.forEach((n) => set.add(n));
    }
    KEYBOARD_CHAR_SET_CACHE.set(ch, set);
    return set;
}

/** 同一键或 QWERTY 邻键（仅拉丁字母/数字/符号） */
function charsKeyboardClose(a, b) {
    if (a === b) return true;
    if (!a || !b || a.length !== 1 || b.length !== 1) return false;
    if (!/^[a-z0-9`\-=[\]\\;',./]$/.test(a) || !/^[a-z0-9`\-=[\]\\;',./]$/.test(b)) {
        return false;
    }
    return getKeyboardCharSet(a).has(b);
}

/** 连续子串：每位为原字符或键盘邻键 */
function keyboardFuzzyIncludes(haystack, needle) {
    if (!needle) return true;
    if (!haystack || needle.length > haystack.length) return false;
    if (needle.length < 2) {
        return haystack.includes(needle);
    }

    const limit = haystack.length - needle.length;
    for (let start = 0; start <= limit; start += 1) {
        let ok = true;
        for (let i = 0; i < needle.length; i += 1) {
            if (!charsKeyboardClose(needle[i], haystack[start + i])) {
                ok = false;
                break;
            }
        }
        if (ok) return true;
    }
    return false;
}

function prefixKeyboardMatch(word, prefix) {
    if (!prefix) return true;
    if (!word || prefix.length > word.length) return false;
    for (let i = 0; i < prefix.length; i += 1) {
        if (!charsKeyboardClose(prefix[i], word[i])) return false;
    }
    return true;
}

function normalizePinyinNasal(value) {
    return normalizeSearchText(value)
        .replace(/\s+/g, '')
        .replace(/zh/g, 'z')
        .replace(/ch/g, 'c')
        .replace(/sh/g, 's')
        .replace(/ang/g, 'an')
        .replace(/eng/g, 'en')
        .replace(/ing/g, 'in');
}

function pinyinPrefixComboMatch(syllables, query) {
    const parts = syllables.map((part) => String(part || '').toLowerCase()).filter(Boolean);
    const q = normalizeSearchText(query).replace(/\s+/g, '');
    if (!parts.length || !q) return false;

    const canMatchFrom = (start) => {
        const memo = new Set();
        const dfs = (idx, rest) => {
            if (!rest) return true;
            if (idx >= parts.length) return false;
            const key = `${idx}|${rest}`;
            if (memo.has(key)) return false;
            const part = parts[idx];
            const maxLen = Math.min(part.length, rest.length);
            for (let len = 1; len <= maxLen; len += 1) {
                if (rest.startsWith(part.slice(0, len)) && dfs(idx + 1, rest.slice(len))) {
                    return true;
                }
            }
            memo.add(key);
            return false;
        };
        return dfs(start, q);
    };

    for (let i = 0; i < parts.length; i += 1) {
        if (canMatchFrom(i)) return true;
    }
    return false;
}

const LETTER_SORT_CACHE = new Map();

function getItemSortLetter(item) {
    if (!item || !item.id) return '';
    if (LETTER_SORT_CACHE.has(item.id)) {
        return LETTER_SORT_CACHE.get(item.id);
    }

    let letter = '';
    const name = String(item.name || '').trim();
    const firstChar = name.charAt(0);
    if (/[a-zA-Z]/.test(firstChar)) {
        letter = firstChar.toUpperCase();
    } else if (typeof pinyinPro !== 'undefined' && name) {
        try {
            const initial = pinyinPro.pinyin(name, {
                pattern: 'first',
                toneType: 'none',
                type: 'array'
            });
            const ch = Array.isArray(initial) && initial[0]
                ? String(initial[0]).charAt(0).toUpperCase()
                : '';
            if (/[A-Z]/.test(ch)) {
                letter = ch;
            } else {
                const initials = pinyinPro.pinyin(name, {
                    pattern: 'initial',
                    toneType: 'none',
                    type: 'string'
                }).replace(/\s+/g, '');
                const fromInitial = initials.charAt(0).toUpperCase();
                if (/[A-Z]/.test(fromInitial)) {
                    letter = fromInitial;
                }
            }
        } catch (e) {
            // ignore
        }
    }

    if (!letter) {
        const idFirst = String(item.id).replace(/^minecraft:/i, '').charAt(0).toUpperCase();
        if (/[A-Z]/.test(idFirst)) {
            letter = idFirst;
        }
    }

    LETTER_SORT_CACHE.set(item.id, letter);
    return letter;
}

function itemMatchesLetterFilter(item) {
    if (!letterFilter) return true;
    return getItemSortLetter(item) === letterFilter;
}

function updateLetterIndexButtons() {
    document.querySelectorAll('.letter-index-bar .letter-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.letter === letterFilter);
    });
}

function setLetterFilter(letter) {
    const next = letter && /^[A-Z]$/.test(letter) ? letter : '';
    if (letterFilter === next) {
        if (next) {
            letterFilter = '';
        } else {
            return;
        }
    } else {
        letterFilter = next;
    }
    updateLetterIndexButtons();
    currentPage = 1;
    filterAndRenderItems();
}

function initLetterIndexBar() {
    const bar = document.getElementById('letterIndexBar');
    if (!bar || bar.dataset.ready === '1') return;

    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    bar.innerHTML = letters.map((ch) => (
        `<button type="button" class="letter-btn" data-letter="${ch}" aria-label="首字母 ${ch}">${ch}</button>`
    )).join('');

    bar.addEventListener('click', (e) => {
        const btn = e.target.closest('.letter-btn');
        if (!btn) return;
        setLetterFilter(btn.dataset.letter || '');
    });

    bar.dataset.ready = '1';
    updateLetterIndexButtons();
}

function splitSearchWords(value) {
    return normalizeSearchText(value)
        .split(/[\s_'`´′＇_-]+/)
        .map((part) => part.trim())
        .filter(Boolean);
}

function prefixComboMatch(parts, query) {
    const words = parts.map((part) => String(part || '').toLowerCase()).filter(Boolean);
    const q = normalizeSearchText(query).replace(/[\s_'`´′＇_-]+/g, '');
    if (!words.length || !q) return false;

    const canMatchFrom = (start) => {
        const memo = new Set();
        const dfs = (idx, rest) => {
            if (!rest) return true;
            if (idx >= words.length) return false;
            const key = `${idx}|${rest}`;
            if (memo.has(key)) return false;
            const word = words[idx];
            const maxLen = Math.min(word.length, rest.length);
            for (let len = 1; len <= maxLen; len += 1) {
                if (rest.startsWith(word.slice(0, len)) && dfs(idx + 1, rest.slice(len))) {
                    return true;
                }
            }
            memo.add(key);
            return false;
        };
        return dfs(start, q);
    };

    for (let i = 0; i < words.length; i += 1) {
        if (canMatchFrom(i)) return true;
    }
    return false;
}

function keyboardPrefixComboMatch(parts, query) {
    const words = parts.map((part) => String(part || '').toLowerCase()).filter(Boolean);
    const q = compactSearchText(query);
    if (!words.length || !q || q.length < 2) return false;

    const canMatchFrom = (start) => {
        const memo = new Set();
        const dfs = (idx, rest) => {
            if (!rest) return true;
            if (idx >= words.length) return false;
            const key = `${idx}|${rest}`;
            if (memo.has(key)) return false;
            const word = words[idx];
            const maxLen = Math.min(word.length, rest.length);
            for (let len = 1; len <= maxLen; len += 1) {
                if (prefixKeyboardMatch(word, rest.slice(0, len)) && dfs(idx + 1, rest.slice(len))) {
                    return true;
                }
            }
            memo.add(key);
            return false;
        };
        return dfs(start, q);
    };

    for (let i = 0; i < words.length; i += 1) {
        if (canMatchFrom(i)) return true;
    }
    return false;
}

function keyboardPinyinPrefixComboMatch(syllables, query) {
    const parts = syllables.map((part) => String(part || '').toLowerCase()).filter(Boolean);
    const q = compactSearchText(query);
    if (!parts.length || !q || q.length < 2) return false;

    const canMatchFrom = (start) => {
        const memo = new Set();
        const dfs = (idx, rest) => {
            if (!rest) return true;
            if (idx >= parts.length) return false;
            const key = `${idx}|${rest}`;
            if (memo.has(key)) return false;
            const part = parts[idx];
            const maxLen = Math.min(part.length, rest.length);
            for (let len = 1; len <= maxLen; len += 1) {
                if (prefixKeyboardMatch(part, rest.slice(0, len)) && dfs(idx + 1, rest.slice(len))) {
                    return true;
                }
            }
            memo.add(key);
            return false;
        };
        return dfs(start, q);
    };

    for (let i = 0; i < parts.length; i += 1) {
        if (canMatchFrom(i)) return true;
    }
    return false;
}

function textMatchesSearchQuery(text, query) {
    const lower = String(text || '').toLowerCase();
    const compactText = compactSearchText(lower);
    const compactQuery = compactSearchText(query);
    if (!compactQuery) return true;

    if (lower.includes(query) || compactText.includes(compactQuery)) return true;
    if (prefixComboMatch(splitSearchWords(lower), query)) return true;

    if (compactQuery.length < 2) return false;
    if (keyboardFuzzyIncludes(compactText, compactQuery)) return true;
    return keyboardPrefixComboMatch(splitSearchWords(lower), query);
}

function itemMatchesSearchQuery(item, query) {
    const compactQuery = compactSearchText(query);
    if (!compactQuery) return true;

    const itemNameLower = item.name.toLowerCase();
    const itemIdLower = item.id.toLowerCase();
    if (textMatchesSearchQuery(itemNameLower, query) || textMatchesSearchQuery(itemIdLower, query)) {
        return true;
    }

    if (typeof pinyinPro === 'undefined') return false;

    try {
        const namePinyinSpaced = pinyinPro.pinyin(item.name, { toneType: 'none', type: 'string' }).toLowerCase();
        const namePinyinSyllables = namePinyinSpaced.split(/\s+/).filter(Boolean);
        const namePinyin = namePinyinSpaced.replace(/\s+/g, '');
        const namePinyinInitial = pinyinPro.pinyin(item.name, { pattern: 'initial', toneType: 'none', type: 'string' }).toLowerCase().replace(/\s+/g, '');
        const namePinyinComputedInitial = namePinyinSyllables
            .map((part) => part.charAt(0))
            .join('');
        const fuzzyNamePinyin = normalizePinyinNasal(namePinyin);
        const fuzzyNamePinyinInitial = normalizePinyinNasal(namePinyinInitial);
        const fuzzyNamePinyinComputedInitial = normalizePinyinNasal(namePinyinComputedInitial);
        const fuzzyNamePinyinSyllables = namePinyinSyllables.map(normalizePinyinNasal);
        const fuzzyQuery = normalizePinyinNasal(query);

        if (textMatchesSearchQuery(namePinyin, query)
            || textMatchesSearchQuery(namePinyinInitial, query)
            || textMatchesSearchQuery(namePinyinComputedInitial, query)
            || textMatchesSearchQuery(fuzzyNamePinyin, fuzzyQuery)
            || textMatchesSearchQuery(fuzzyNamePinyinInitial, fuzzyQuery)
            || textMatchesSearchQuery(fuzzyNamePinyinComputedInitial, fuzzyQuery)) {
            return true;
        }

        if (pinyinPrefixComboMatch(namePinyinSyllables, query)
            || pinyinPrefixComboMatch(fuzzyNamePinyinSyllables, fuzzyQuery)) {
            return true;
        }

        if (compactQuery.length >= 2) {
            return keyboardPinyinPrefixComboMatch(namePinyinSyllables, query)
                || keyboardPinyinPrefixComboMatch(fuzzyNamePinyinSyllables, fuzzyQuery);
        }
    } catch (e) {
        // ignore
    }

    return false;
}

function filterAndRenderItems() {
    filteredItems = allItems.filter(item => {
        if (!itemMatchesLetterFilter(item)) {
            return false;
        }

        const query = normalizeSearchText(searchQuery);
        if (!query) return true;

        return itemMatchesSearchQuery(item, query);
    });

    if (itemScope === 'vanilla') {
        filteredItems = filteredItems.filter(item => !isCustomCatalogItem(item));
    } else if (itemScope === 'custom') {
        filteredItems = filteredItems.filter(item => isCustomCatalogItem(item));
    }

    if (hideUntradable) {
        filteredItems = filteredItems.filter(item => (item.ultimateShopOffers || []).length > 0);
    }

    // 原有排序逻辑
    if (currentSort === 'name') {
        filteredItems.sort((a, b) => a.name.localeCompare(b.name));
    } else if (currentSort === 'buyPrice') {
        filteredItems.sort((a, b) => a.buyPrice - b.buyPrice);
    } else if (currentSort === 'sellPrice') {
        filteredItems.sort((a, b) => a.sellPrice - b.sellPrice);
    } else if (currentSort === 'stock') {
        // 补充 stock 排序（原HTML有选项但JS未处理）
        filteredItems.sort((a, b) => (b.stock || 0) - (a.stock || 0));
    }

    // 新增：如果勾选逆序，反转排序结果
    if (sortReverse) {
        filteredItems.reverse();
    }

    const pageCount = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
    if (currentPage > pageCount) {
        currentPage = pageCount;
    }
    if (currentPage < 1) {
        currentPage = 1;
    }

    renderCards();
}

function updateSearchClearButton() {
    const inp = document.getElementById('searchInput');
    const btn = document.getElementById('searchClearBtn');
    if (!inp || !btn) return;
    btn.hidden = inp.value.length === 0;
}

function pageForClearedSearch() {
    const fallback = pageBeforeSearch || currentPage || 1;
    pageBeforeSearch = null;
    return fallback;
}

function clearSearchInput() {
    const inp = document.getElementById('searchInput');
    if (!inp) return;
    const restorePage = pageForClearedSearch();
    inp.value = '';
    searchQuery = '';
    updateSearchClearButton();
    currentPage = restorePage;
    filterAndRenderItems();
    inp.focus();
}

function setupEventListeners() {
    initLetterIndexBar();

    // 监听搜索框输入
    const searchInput = document.getElementById('searchInput');
    const searchClearBtn = document.getElementById('searchClearBtn');
    if (searchInput) {
        updateSearchClearButton();
        searchInput.addEventListener('input', (e) => {
            const previousQuery = searchQuery;
            const nextQuery = normalizeSearchText(e.target.value);
            if (!previousQuery && nextQuery && pageBeforeSearch === null) {
                pageBeforeSearch = currentPage;
            }
            searchQuery = nextQuery;
            updateSearchClearButton();
            clearTimeout(searchTimer);
            searchTimer = setTimeout(() => {
                currentPage = searchQuery ? 1 : pageForClearedSearch();
                filterAndRenderItems();
            }, 200);
        });
    }
    if (searchClearBtn) {
        searchClearBtn.addEventListener('click', clearSearchInput);
    }

    // 监听刷新按钮
    const refreshButton = document.getElementById('refreshButton');
    if (refreshButton) {
        refreshButton.addEventListener('click', async () => {
            refreshButton.disabled = true;
            refreshButton.textContent = '刷新中...';
            await loadItems();
            refreshButton.disabled = false;
            refreshButton.innerHTML = '<span class="refresh-icon">⟳</span>';
        });
    }

    // 监听排序下拉菜单切换
    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect) {
        sortSelect.addEventListener('change', (e) => {
            currentSort = e.target.value;
            currentPage = 1;
            filterAndRenderItems();
        });
    }

    // 新增：监听逆序复选框切换
    const sortReverseCheckbox = document.getElementById('sortReverse');
    if (sortReverseCheckbox) {
        sortReverseCheckbox.addEventListener('change', (e) => {
            sortReverse = e.target.checked;
            currentPage = 1;
            filterAndRenderItems(); // 切换后重新排序渲染
        });
    }

    const hideUntradableCheckbox = document.getElementById('hideUntradable');
    if (hideUntradableCheckbox) {
        hideUntradableCheckbox.addEventListener('change', (e) => {
            hideUntradable = e.target.checked;
            currentPage = 1;
            filterAndRenderItems();
        });
    }

    /** 页尾翻页后滚到物品区时，在网格顶端之上多留的像素（避免第一行被导航栏裁切） */
    const SCROLL_GRID_EXTRA_TOP_PX = 120;

    function scrollItemsGridIntoView() {
        const grid = document.getElementById('itemsGrid');
        if (!grid) {
            return;
        }
        const y = grid.getBoundingClientRect().top + window.scrollY - SCROLL_GRID_EXTRA_TOP_PX;
        window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
    }

    function bindPager(firstId, prevId, nextId, lastId, scrollAfter) {
        const pageFirst = document.getElementById(firstId);
        const pagePrev = document.getElementById(prevId);
        const pageNext = document.getElementById(nextId);
        const pageLast = document.getElementById(lastId);
        const afterPageChange = () => {
            if (scrollAfter) {
                scrollItemsGridIntoView();
            }
        };
        if (pageFirst) {
            pageFirst.addEventListener('click', () => {
                if (currentPage > 1) {
                    currentPage = 1;
                    renderCards();
                    afterPageChange();
                }
            });
        }
        if (pagePrev) {
            pagePrev.addEventListener('click', () => {
                if (currentPage > 1) {
                    currentPage -= 1;
                    renderCards();
                    afterPageChange();
                }
            });
        }
        if (pageNext) {
            pageNext.addEventListener('click', () => {
                const pageCount = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
                if (currentPage < pageCount) {
                    currentPage += 1;
                    renderCards();
                    afterPageChange();
                }
            });
        }
        if (pageLast) {
            pageLast.addEventListener('click', () => {
                const pageCount = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
                if (currentPage < pageCount) {
                    currentPage = pageCount;
                    renderCards();
                    afterPageChange();
                }
            });
        }
    }

    bindPager('pageFirst', 'pagePrev', 'pageNext', 'pageLast', false);
    bindPager('pageFirstBottom', 'pagePrevBottom', 'pageNextBottom', 'pageLastBottom', true);

    // 绑定跳转功能
    function bindPageJump(inputId, btnId, scrollAfter) {
        const input = document.getElementById(inputId);
        const btn = document.getElementById(btnId);
        
        const jumpToPage = () => {
            const pageCount = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
            const targetPage = parseInt(input.value);
            
            if (isNaN(targetPage) || targetPage < 1 || targetPage > pageCount) {
                // 显示错误提示
                showToast(`请输入有效的页码 (1-${pageCount})`, false);
                input.focus();
                return;
            }
            
            currentPage = targetPage;
            renderCards();
            if (scrollAfter) {
                scrollItemsGridIntoView();
            }
            input.value = ''; // 清空输入框
        };
        
        if (btn) {
            btn.addEventListener('click', jumpToPage);
        }
        
        if (input) {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    jumpToPage();
                }
            });
        }
    }

    bindPageJump('pageJumpInput', 'pageJumpBtn', false);
    bindPageJump('pageJumpInputBottom', 'pageJumpBtnBottom', true);

    const itemsGrid = document.getElementById('itemsGrid');
    if (itemsGrid) {
        itemsGrid.addEventListener('click', (e) => {
            const btn = e.target.closest('.trade-btn');
            if (!btn) {
                return;
            }
            e.preventDefault();
            const itemId = btn.getAttribute('data-item-id');
            if (itemId) {
                handleTradeClick(itemId);
            }
        });
    }

    const categoryTabs = document.getElementById('categoryTabs');
    if (categoryTabs) {
        categoryTabs.addEventListener('click', (e) => {
            const btn = e.target.closest('.category-btn[data-scope]');
            if (!btn) return;
            const nextScope = btn.dataset.scope || 'all';
            if (!ITEM_SCOPE_VALUES.has(nextScope) || nextScope === itemScope) return;
            itemScope = nextScope;
            currentPage = 1;
            updateCategoryScopeButtons();
            filterAndRenderItems();
        });
        updateCategoryScopeButtons();
    }

    const tradeModal = document.getElementById('tradeModal');
    if (tradeModal) {
        tradeModal.addEventListener('click', (e) => {
            if (e.target === tradeModal) {
                closeTradeModal();
            }
        });
    }
}

// 将数据渲染为 HTML 卡片（无修改）
function renderCards() {
    const grid = document.getElementById('itemsGrid');
    if (!grid) {
        syncItemsStateToUrl();
        return;
    }

    // 更新页面顶部和列表显示计数
    const itemCount = document.getElementById('itemCount');
    if (itemCount) {
        itemCount.textContent = `共计 ${allItems.length} 个物品`;
    }

    const itemsShowing = document.getElementById('itemsShowing');
    if (itemsShowing) {
        itemsShowing.textContent = `显示 ${filteredItems.length} 个物品`;
    }

    if (filteredItems.length === 0) {
        grid.innerHTML = '<div style="text-align:center; color:#94a3b8; grid-column:1/-1; padding: 40px;">没有找到匹配的物品 📦</div>';
        renderPagination();
        syncItemsStateToUrl();
        return;
    }

    const pageCount = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    const pageItems = filteredItems.slice(startIndex, startIndex + PAGE_SIZE);
    const duplicateNames = new Set();
    const nameCounts = new Map();
    allItems.forEach(item => {
        nameCounts.set(item.name, (nameCounts.get(item.name) || 0) + 1);
    });
    nameCounts.forEach((count, name) => {
        if (count > 1) duplicateNames.add(name);
    });

    grid.innerHTML = pageItems.map(item => {
        const offers = item.ultimateShopOffers || [];
        const canTrade = offers.length > 0;
        const tradeBtnClass = canTrade ? 'trade-btn trade-btn--active' : 'trade-btn trade-btn--disabled';
        const isClock = item.id === 'clock';
        const isPointerCompass = item.id === 'compass' || item.id === 'recovery_compass';
        const descriptionText = isClock
            ? formatClockSystemTime()
            : isPointerCompass
                ? '移动鼠标查看方位'
            : (duplicateNames.has(item.name) && item.loreLine ? item.loreLine : '');
        const loreLine = descriptionText
            ? `<span class="scrolling-text" style="margin-top:2px; font-size:0.82rem; color:#94a3b8;" title="${escapeHtml(descriptionText)}"><span class="scrolling-text-inner"${isClock ? ' data-clock-time-desc="1"' : ''}${isPointerCompass ? ' data-pointer-bearing-desc="1"' : ''}>${escapeHtml(descriptionText)}</span></span>`
            : '';
        const safeName = escapeHtml(item.name);
        const safeId = escapeHtml(item.id);

        return `
        <div class="glass card-hover" style="border-radius:12px; padding:20px; transition:all 0.3s ease; position:relative; overflow:hidden; border:1px solid rgba(255,255,255,0.05); background: var(--bg-card);">
            
            <div style="position: absolute; top: 0; left: 0; width: 100%; height: 3px; background: linear-gradient(90deg, #3b82f6, #8b5cf6);"></div>

            <div style="display:flex; align-items:center; margin-bottom:15px; margin-top: 5px;">
                ${getItemIconHtml(item.id, item.name)}
                <div style="min-width:0; width:100%;">
                    <h3 class="scrolling-text" style="margin:0; font-size:1.1rem; color:#F1F5F9; font-weight: 600;" title="${safeName}"><span class="scrolling-text-inner">${safeName}</span></h3>
                    ${loreLine}
                    <span class="scrolling-text scrolling-id" style="font-size:0.75rem; color:#64748b; text-transform: lowercase;" title="${safeId}"><span class="scrolling-text-inner scrolling-id-text">${safeId}</span></span>
                </div>
            </div>
            
            <div style="background: rgba(15,23,42,0.6); padding:12px; border-radius:8px; border: 1px solid rgba(255,255,255,0.02);">
                <div style="display:flex; justify-content:space-between; margin-bottom:8px; align-items: center;">
                    <span style="color:#94A3B8; font-size:0.85rem;">系统买入</span>
                    <strong style="color:#34D399; font-family: monospace; font-size: 1.05rem;">￥${item.buyPrice.toFixed(2)}</strong>
                </div>
                <div style="display:flex; justify-content:space-between; align-items: center;">
                    <span style="color:#94A3B8; font-size:0.85rem;">玩家回收</span>
                    <strong style="color:#F87171; font-family: monospace; font-size: 1.05rem;">￥${item.sellPrice.toFixed(2)}</strong>
                </div>
                <div style="margin-top:14px; display:flex; justify-content:flex-end;">
                    <button type="button" class="${tradeBtnClass}" data-item-id="${String(item.id).replace(/"/g, '&quot;')}">交易</button>
                </div>
            </div>
        </div>
    `;
    }).join('');
    initScrollingText(grid);
    requestAnimationFrame(() => initScrollingText(grid));
    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => {
            if (grid.isConnected) initScrollingText(grid);
        });
    }
    renderPagination();
    mountItemIcons();
    if (window.McTextureAnim) {
        window.McTextureAnim.initInContainer(grid);
    }
    if (window.McEnchantGlint) {
        window.McEnchantGlint.initInContainer(grid);
    }
    updateClockTimeDescriptions(grid);
    ensureClockTimeTicker();
    updatePointerBearingDescriptions(grid);
    ensurePointerBearingTicker();
    syncItemsStateToUrl();
}

function getItemIconHtml(itemId, itemName) {
    return window.getTextureHtml ? window.getTextureHtml(itemId, itemName) : '';
}

function mountItemIcons() {
    const grid = document.getElementById('itemsGrid');
    if (grid && window.McItemIcon) {
        window.McItemIcon.mountGrid(grid);
    }
}

function renderPagination() {
    const pageCount = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
    const label = `第 ${currentPage} / ${pageCount} 页`;
    const prevDisabled = currentPage <= 1;
    const nextDisabled = currentPage >= pageCount;

    const pairs = [
        ['pageInfo', 'pageFirst', 'pagePrev', 'pageNext', 'pageLast', 'pageJumpInput'],
        ['pageInfoBottom', 'pageFirstBottom', 'pagePrevBottom', 'pageNextBottom', 'pageLastBottom', 'pageJumpInputBottom']
    ];
    pairs.forEach(([infoId, firstId, prevId, nextId, lastId, inputId]) => {
        const pageInfo = document.getElementById(infoId);
        const pageFirst = document.getElementById(firstId);
        const pagePrev = document.getElementById(prevId);
        const pageNext = document.getElementById(nextId);
        const pageLast = document.getElementById(lastId);
        const pageInput = document.getElementById(inputId);
        
        if (pageInfo) {
            pageInfo.textContent = label;
        }
        if (pageFirst) {
            pageFirst.disabled = prevDisabled;
        }
        if (pagePrev) {
            pagePrev.disabled = prevDisabled;
        }
        if (pageNext) {
            pageNext.disabled = nextDisabled;
        }
        if (pageLast) {
            pageLast.disabled = nextDisabled;
        }
        if (pageInput) {
            pageInput.max = pageCount;
            pageInput.placeholder = `1-${pageCount}`;
        }
    });
}

function updateAuthUi() {
    const userStatus = document.getElementById('userStatus');
    const authButton = document.getElementById('authButton');
    if (!userStatus || !authButton) return;

    if (currentUser) {
        userStatus.textContent = `已登录：${currentUser.username}（${currentUser.playerId}）`;
        authButton.textContent = '退出登录';
        authButton.onclick = handleLogout;
    } else {
        userStatus.textContent = '未登录';
        authButton.textContent = '登录 / 注册';
        authButton.onclick = openAuthModal;
    }
}

function openAuthModal() {
    authMode = 'login';
    switchAuthMode('login');
    const modal = document.getElementById('authModal');
    showDialog(modal);
}

function closeAuthModal() {
    const modal = document.getElementById('authModal');
    hideDialog(modal);
    const message = document.getElementById('authMessage');
    if (message) {
        message.textContent = '';
        message.style.color = '';
    }
    const form = document.getElementById('authForm');
    if (form) {
        form.reset();
    }
}

function switchAuthMode(mode) {
    authMode = mode;
    const loginButton = document.getElementById('authModeLogin');
    const registerButton = document.getElementById('authModeRegister');
    const registerFields = document.querySelectorAll('.auth-register-only');
    const title = document.getElementById('authModalTitle');
    const authMessage = document.getElementById('authMessage');

    if (loginButton && registerButton) {
        loginButton.classList.toggle('active', mode === 'login');
        registerButton.classList.toggle('active', mode === 'register');
    }
    if (title) {
        title.textContent = mode === 'login' ? '登录' : '注册';
    }
    registerFields.forEach(field => {
        field.style.display = mode === 'register' ? 'flex' : 'none';
    });
    if (authMessage) {
        authMessage.textContent = '';
        authMessage.style.color = '';
    }
}

async function handleAuthSubmit(event) {
    event.preventDefault();

    const username = document.getElementById('authUsername')?.value.trim();
    const password = document.getElementById('authPassword')?.value;
    const playerId = document.getElementById('authPlayerId')?.value.trim();
    const authMessage = document.getElementById('authMessage');

    if (!username || !password) {
        if (authMessage) authMessage.textContent = '请填写用户名和密码。';
        return;
    }

    if (authMode === 'register' && !playerId) {
        if (authMessage) authMessage.textContent = '注册时请填写游戏玩家ID。';
        return;
    }

    const endpoint = authMode === 'register' ? '/api/register' : '/api/login';
    const payload = authMode === 'register' ? { username, password, playerId } : { username, password };

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        const result = await response.json();

        if (!response.ok) {
            if (authMessage) {
                authMessage.textContent = result.error || '操作失败，请重试。';
                authMessage.style.color = 'var(--danger)';
            }
            return;
        }

        authToken = result.authToken;
        localStorage.setItem('authToken', authToken);
        currentUser = { username: result.username, playerId: result.playerId };
        updateAuthUi();
        closeAuthModal();
        showToast(result.message || '登录成功', true);
    } catch (error) {
        console.error('Auth request failed:', error);
        if (authMessage) {
            authMessage.textContent = `网络错误：${error.message || '请检查服务器是否已启动。'}`;
            authMessage.style.color = 'var(--danger)';
        }
    }
}

async function handleLogout() {
    if (!authToken) {
        currentUser = null;
        updateAuthUi();
        return;
    }

    try {
        await fetch('/api/logout', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${authToken}`
            }
        });
    } catch (error) {
        console.warn('注销时发生错误', error);
    }

    authToken = null;
    currentUser = null;
    localStorage.removeItem('authToken');
    updateAuthUi();
    showToast('已退出登录。', true);
}

async function loadUserProfile() {
    if (!authToken) {
        currentUser = null;
        updateAuthUi();
        return;
    }

    try {
        const response = await fetch('/api/profile', {
            headers: {
                Authorization: `Bearer ${authToken}`
            }
        });
        if (!response.ok) {
            throw new Error('未登录');
        }
        currentUser = await response.json();
    } catch (error) {
        authToken = null;
        currentUser = null;
        localStorage.removeItem('authToken');
    }
    updateAuthUi();
}

function initScrollingText(root) {
    const host = root || document;
    const OVERFLOW_SAFETY_RATIO = 1;
    const EDGE_PAUSE_MS = 1000;
    host.querySelectorAll('.scrolling-text, .scrolling-id').forEach(container => {
        const text = container.querySelector('.scrolling-text-inner, .scrolling-id-text');
        if (!text) return;

        text.getAnimations().forEach(animation => animation.cancel());
        text.style.animation = 'none';
        text.style.transform = '';
        text.style.removeProperty('--scroll-distance');

        const safeScrollWidth = text.scrollWidth * OVERFLOW_SAFETY_RATIO;
        if (safeScrollWidth > container.clientWidth) {
            const distance = Math.max(1, safeScrollWidth - container.clientWidth);
            const forwardMs = Math.max(2500, (distance / 60) * 1000);
            const returnMs = forwardMs / 5;
            const totalMs = EDGE_PAUSE_MS + forwardMs + EDGE_PAUSE_MS + returnMs;
            const leftPauseEnd = EDGE_PAUSE_MS / totalMs;
            const rightArrive = (EDGE_PAUSE_MS + forwardMs) / totalMs;
            const rightPauseEnd = (EDGE_PAUSE_MS + forwardMs + EDGE_PAUSE_MS) / totalMs;
            const rightTransform = `translateX(-${distance}px)`;

            text.animate([
                { transform: 'translateX(0)', offset: 0 },
                { transform: 'translateX(0)', offset: leftPauseEnd },
                { transform: rightTransform, offset: rightArrive },
                { transform: rightTransform, offset: rightPauseEnd },
                { transform: 'translateX(0)', offset: 1 }
            ], {
                duration: totalMs,
                iterations: Infinity,
                easing: 'linear'
            });
        }
    });
}

function initScrollingIds() {
    initScrollingText(document);
}