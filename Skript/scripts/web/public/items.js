// ==========================================
// 流浪世界服务器商店系统 物品目录 - 核心逻辑 (Skript 适配版)
// ==========================================

// 全局状态（新增 sortReverse 变量）
let allItems = [];
let filteredItems = [];
let currentSort = 'name';
let searchQuery = '';
let sortReverse = false; // 逆序状态，默认关闭
let hideUntradable = false; // 隐藏无 UltimateShop 上架（不可交易）的物品
let currentUser = null;
let authToken = localStorage.getItem('authToken') || null;
let authMode = 'login';
let currentPage = 1;
const PAGE_SIZE = 60;
let searchTimer = null;

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    loadItems();
    setupEventListeners();
    loadUserProfile();
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
        allItems = Object.keys(rawData).map(key => ({
            id: key,
            name: window.getChineseName ? window.getChineseName(key) : key,
            buyPrice: rawData[key].buy,
            sellPrice: rawData[key].sell,
            shop: rawData[key].shop || null,
            shopItem: rawData[key].item || null,
            buyAmount: rawData[key].amount || 1,
            displayName: rawData[key].displayName || null,
            ultimateShopOffers: Array.isArray(rawData[key].ultimateShopOffers)
                ? rawData[key].ultimateShopOffers
                : []
        }));

        filterAndRenderItems();

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

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function closeTradeModal() {
    const modal = document.getElementById('tradeModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

function openTradeModal(item) {
    const modal = document.getElementById('tradeModal');
    const title = document.getElementById('tradeModalTitle');
    const body = document.getElementById('tradeModalBody');
    if (!modal || !title || !body) {
        return;
    }

    title.textContent = `UltimateShop · ${item.name}`;

    const offers = item.ultimateShopOffers || [];
    const blocks = offers.map((o, idx) => {
        const shopLabel = o.shopTitle != null && String(o.shopTitle).trim() !== ''
            ? escapeHtml(String(o.shopTitle))
            : escapeHtml(o.shopId);
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
                    <dt>买入价（配置）</dt>
                    <dd>${escapeHtml(formatUltimateShopPrice(o.buyAmount))}</dd>
                    <dt>卖出价（配置）</dt>
                    <dd>${escapeHtml(formatUltimateShopPrice(o.sellAmount))}</dd>
                </dl>
            </div>
        `;
    }).join('');

    body.innerHTML = `
        <p style="margin:0 0 16px 0; color:#94a3b8; font-size:0.9rem;">
            以下为 UltimateShop 商店 YAML 中的报价（可能与游戏内占位符解析后的实际金额不同）。
        </p>
        <div class="trade-offer-list">${blocks}</div>
    `;

    modal.classList.add('active');
}

function handleTradeClick(itemId) {
    const item = allItems.find(i => i.id === itemId);
    if (!item) {
        return showToast('未找到该物品。', false);
    }
    const offers = item.ultimateShopOffers || [];
    if (!offers.length) {
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
function filterAndRenderItems() {
    filteredItems = allItems.filter(item => {
        const query = searchQuery.toLowerCase();
        if (!query) return true;
        
        // 原始匹配
        const nameMatch = item.name.toLowerCase().includes(query);
        const idMatch = item.id.toLowerCase().includes(query);
        
        // 拼音匹配
        let pinyinMatch = false;
        try {
            const namePinyin = pinyinPro.pinyin(item.name, { toneType: 'none', type: 'string' }).toLowerCase().replace(/\s+/g, '');
            const namePinyinInitial = pinyinPro.pinyin(item.name, { pattern: 'initial', toneType: 'none', type: 'string' }).toLowerCase().replace(/\s+/g, '');
            pinyinMatch = namePinyin.includes(query) || namePinyinInitial.includes(query);
        } catch (e) {
            // 如果拼音转换失败，使用原始匹配
        }
        
        return nameMatch || idMatch || pinyinMatch;
    });

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

function setupEventListeners() {
    // 监听搜索框输入
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value.toLowerCase();
            clearTimeout(searchTimer);
            searchTimer = setTimeout(() => {
                currentPage = 1;
                filterAndRenderItems();
            }, 200);
        });
    }

    // 监听刷新按钮
    const refreshButton = document.getElementById('refreshButton');
    if (refreshButton) {
        refreshButton.addEventListener('click', async () => {
            refreshButton.disabled = true;
            refreshButton.textContent = '刷新中...';
            await loadItems();
            refreshButton.disabled = false;
            refreshButton.textContent = '⟳';
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

    function bindPager(prevId, nextId, scrollAfter) {
        const pagePrev = document.getElementById(prevId);
        const pageNext = document.getElementById(nextId);
        if (pagePrev) {
            pagePrev.addEventListener('click', () => {
                if (currentPage > 1) {
                    currentPage -= 1;
                    renderCards();
                    if (scrollAfter) {
                        scrollItemsGridIntoView();
                    }
                }
            });
        }
        if (pageNext) {
            pageNext.addEventListener('click', () => {
                const pageCount = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
                if (currentPage < pageCount) {
                    currentPage += 1;
                    renderCards();
                    if (scrollAfter) {
                        scrollItemsGridIntoView();
                    }
                }
            });
        }
    }

    bindPager('pagePrev', 'pageNext', false);
    bindPager('pagePrevBottom', 'pageNextBottom', true);

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
    if (!grid) return;

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
        return;
    }

    const pageCount = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    const pageItems = filteredItems.slice(startIndex, startIndex + PAGE_SIZE);

    grid.innerHTML = pageItems.map(item => {
        const offers = item.ultimateShopOffers || [];
        const canTrade = offers.length > 0;
        const tradeBtnClass = canTrade ? 'trade-btn trade-btn--active' : 'trade-btn trade-btn--disabled';

        return `
        <div class="glass card-hover" style="border-radius:12px; padding:20px; transition:all 0.3s ease; position:relative; overflow:hidden; border:1px solid rgba(255,255,255,0.05); background: var(--bg-card);">
            
            <div style="position: absolute; top: 0; left: 0; width: 100%; height: 3px; background: linear-gradient(90deg, #3b82f6, #8b5cf6);"></div>

            <div style="display:flex; align-items:center; margin-bottom:15px; margin-top: 5px;">
                ${getTextureHtml(item.id, item.name)}
                <div style="min-width:0; width:100%;">
                    <h3 style="margin:0; font-size:1.1rem; color:#F1F5F9; font-weight: 600;">${item.name}</h3>
                    <span class="scrolling-id" style="font-size:0.75rem; color:#64748b; text-transform: lowercase;"><span class="scrolling-id-text">${item.id}</span></span>
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
    initScrollingIds();
    renderPagination();
}

function renderPagination() {
    const pageCount = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
    const label = `第 ${currentPage} / ${pageCount} 页`;
    const prevDisabled = currentPage <= 1;
    const nextDisabled = currentPage >= pageCount;

    const pairs = [
        ['pageInfo', 'pagePrev', 'pageNext', 'pageJumpInput'],
        ['pageInfoBottom', 'pagePrevBottom', 'pageNextBottom', 'pageJumpInputBottom']
    ];
    pairs.forEach(([infoId, prevId, nextId, inputId]) => {
        const pageInfo = document.getElementById(infoId);
        const pagePrev = document.getElementById(prevId);
        const pageNext = document.getElementById(nextId);
        const pageInput = document.getElementById(inputId);
        
        if (pageInfo) {
            pageInfo.textContent = label;
        }
        if (pagePrev) {
            pagePrev.disabled = prevDisabled;
        }
        if (pageNext) {
            pageNext.disabled = nextDisabled;
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
    if (modal) {
        modal.classList.add('active');
    }
}

function closeAuthModal() {
    const modal = document.getElementById('authModal');
    if (modal) {
        modal.classList.remove('active');
    }
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

function initScrollingIds() {
    document.querySelectorAll('.scrolling-id').forEach(container => {
        const text = container.querySelector('.scrolling-id-text');
        if (!text) return;

        if (text.scrollWidth > container.clientWidth) {
            const distance = text.scrollWidth - container.clientWidth;
            const duration = Math.max(5, distance / 30);
            text.style.animation = `scroll-text ${duration}s linear infinite`;
            text.style.setProperty('--scroll-distance', `-${distance}px`);
        } else {
            text.style.animation = 'none';
        }
    });
}