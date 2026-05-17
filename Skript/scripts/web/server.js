const express = require('express');
const fs = require('fs');
const yaml = require('js-yaml');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const { createAnalyticsService } = require('./analytics');

const app = express();
const PORT = 8002;
const HOST = process.env.HOST || '0.0.0.0';

app.use(cors());
app.use(express.json());

// 【关键修改】开启静态文件托管，将 public 文件夹变成网站根目录！
app.use(express.static(path.join(__dirname, 'public')));

// 当访客访问主页时，默认重定向到精美的物品目录页
app.get('/', (req, res) => {
    res.redirect('/items.html');
});

// 数据文件路径保持不变
const DATA_PATH = path.join(__dirname, 'mcwws', 'economy', 'web_prices.yml');
const MAPPING_PATH = path.join(__dirname, 'mcwws', 'ultimateshop_mappings.yml');
const ULTIMATE_SHOP_SHOPS_DIR = path.join(__dirname, '..', '..', '..', 'UltimateShop', 'shops');
const DB_DIR = path.join(__dirname, 'data');
const USER_DB_FILE = path.join(DB_DIR, 'users.json');
const TRANSACTIONS_CSV = path.join(DB_DIR, 'transactions.csv');
const TRANSACTIONS_YAML = path.join(DB_DIR, 'transactions_store.yml');
const LEGACY_TRANSACTIONS_CSV = path.join(__dirname, '..', '..', '..', 'DynamicShop', 'transactions', 'transactions.csv');
const ITEMS_DB_PATH = path.join(__dirname, '..', 'mcwws', 'economy', 'database', 'items.yml');

if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
}

if (!fs.existsSync(TRANSACTIONS_CSV)) {
    fs.writeFileSync(
        TRANSACTIONS_CSV,
        'id,playerUuid,playerName,type,shopId,productId,amount,timestamp\n',
        'utf8'
    );
}

const analytics = createAnalyticsService({
    transactionsCsvPath: TRANSACTIONS_CSV,
    transactionsYamlPath: TRANSACTIONS_YAML,
    legacyCsvPath: LEGACY_TRANSACTIONS_CSV,
    webPricesPath: DATA_PATH,
    itemsDbPath: ITEMS_DB_PATH,
    ultimateShopShopsDir: ULTIMATE_SHOP_SHOPS_DIR
});

if (!fs.existsSync(USER_DB_FILE)) {
    fs.writeFileSync(USER_DB_FILE, JSON.stringify([]), 'utf8');
}

function readUsers() {
    try {
        return JSON.parse(fs.readFileSync(USER_DB_FILE, 'utf8') || '[]');
    } catch (error) {
        console.error('读取用户数据库失败', error);
        return [];
    }
}

function saveUsers(users) {
    fs.writeFileSync(USER_DB_FILE, JSON.stringify(users, null, 2), 'utf8');
}

function loadYamlFile(filePath) {
    if (!fs.existsSync(filePath)) {
        return {};
    }

    try {
        return yaml.load(fs.readFileSync(filePath, 'utf8')) || {};
    } catch (error) {
        console.error(`读取 YAML 文件失败: ${filePath}`, error);
        return {};
    }
}

function normalizeMaterialId(material) {
    if (material == null || material === '') {
        return null;
    }
    return String(material).trim().toLowerCase().replace(/-/g, '_');
}

function firstEconomyPriceAmount(priceSection) {
    if (!priceSection || typeof priceSection !== 'object') {
        return null;
    }
    const keys = Object.keys(priceSection).sort((a, b) => Number(a) - Number(b));
    for (let i = 0; i < keys.length; i += 1) {
        const entry = priceSection[keys[i]];
        if (entry && typeof entry === 'object' && Object.prototype.hasOwnProperty.call(entry, 'amount')) {
            return entry.amount;
        }
    }
    return null;
}

function collectProductMaterials(products) {
    const out = [];
    if (!products || typeof products !== 'object') {
        return out;
    }
    Object.keys(products).forEach((k) => {
        const slot = products[k];
        if (slot && typeof slot === 'object' && slot.material != null) {
            const norm = normalizeMaterialId(slot.material);
            if (norm) {
                out.push(norm);
            }
        }
    });
    return out;
}

/**
 * 扫描 UltimateShop/shops/*.yml，按物品 material（与网页 itemId 小写一致）建立可交易报价列表。
 * @returns {Record<string, Array<{shopId: string, shopTitle: string|null, slot: string, buyAmount: *, sellAmount: *}>>}
 */
function buildUltimateShopCatalogByMaterial() {
    const catalog = {};
    if (!fs.existsSync(ULTIMATE_SHOP_SHOPS_DIR)) {
        return catalog;
    }

    const files = fs.readdirSync(ULTIMATE_SHOP_SHOPS_DIR).filter((f) => f.endsWith('.yml'));
    files.forEach((file) => {
        const shopId = path.basename(file, '.yml');
        const doc = loadYamlFile(path.join(ULTIMATE_SHOP_SHOPS_DIR, file));
        const items = doc.items;
        if (!items || typeof items !== 'object') {
            return;
        }
        const shopTitle = doc.settings && doc.settings['shop-name'] != null ? doc.settings['shop-name'] : null;

        Object.keys(items).forEach((slot) => {
            const def = items[slot];
            if (!def || typeof def !== 'object') {
                return;
            }
            const materials = [...new Set(collectProductMaterials(def.products))];
            if (materials.length === 0) {
                return;
            }
            const buyAmount = firstEconomyPriceAmount(def['buy-prices']);
            const sellAmount = firstEconomyPriceAmount(def['sell-prices']);
            const offer = {
                shopId,
                shopTitle,
                slot,
                buyAmount,
                sellAmount
            };
            materials.forEach((mat) => {
                if (!catalog[mat]) {
                    catalog[mat] = [];
                }
                catalog[mat].push(offer);
            });
        });
    });

    return catalog;
}

function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

function hashPassword(password, salt) {
    return crypto.scryptSync(password, salt, 64).toString('hex');
}

function authenticate(req) {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
        return null;
    }
    const token = authHeader.substring(7);
    if (!token) {
        return null;
    }
    const users = readUsers();
    return users.find(user => user.authToken === token) || null;
}

app.post('/api/register', (req, res) => {
    try {
        const { username, password, playerId } = req.body || {};
        if (!username || !password || !playerId) {
            return res.status(400).json({ error: '请填写用户名、密码和游戏玩家ID。' });
        }

        const users = readUsers();
        if (users.some(user => user.username === username)) {
            return res.status(409).json({ error: '用户名已存在，请换一个用户名。' });
        }

        const salt = crypto.randomBytes(16).toString('hex');
        const passwordHash = hashPassword(password, salt);
        const authToken = generateToken();
        const createdAt = new Date().toISOString();

        const newUser = {
            id: users.length > 0 ? Math.max(...users.map(user => user.id || 0)) + 1 : 1,
            username,
            passwordHash,
            passwordSalt: salt,
            playerId,
            authToken,
            createdAt
        };

        users.push(newUser);
        saveUsers(users);

        res.json({
            status: 'ok',
            username,
            playerId,
            authToken,
            message: '注册成功，已自动登录。'
        });
    } catch (error) {
        console.error('注册失败:', error);
        res.status(500).json({ error: '注册失败，请稍后重试。' });
    }
});

app.post('/api/login', (req, res) => {
    try {
        const { username, password } = req.body || {};
        if (!username || !password) {
            return res.status(400).json({ error: '请填写用户名和密码。' });
        }

        const users = readUsers();
        const user = users.find(item => item.username === username);
        if (!user) {
            return res.status(401).json({ error: '用户名或密码错误。' });
        }

        const passwordHash = hashPassword(password, user.passwordSalt);
        if (passwordHash !== user.passwordHash) {
            return res.status(401).json({ error: '用户名或密码错误。' });
        }

        const authToken = generateToken();
        user.authToken = authToken;
        saveUsers(users);

        res.json({
            status: 'ok',
            username: user.username,
            playerId: user.playerId,
            authToken,
            message: '登录成功。'
        });
    } catch (error) {
        console.error('登录失败:', error);
        res.status(500).json({ error: '登录失败，请稍后重试。' });
    }
});

app.post('/api/logout', (req, res) => {
    try {
        const authHeader = req.headers.authorization || '';
        if (authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            const users = readUsers();
            const user = users.find(item => item.authToken === token);
            if (user) {
                user.authToken = null;
                saveUsers(users);
            }
        }
        res.json({ status: 'ok', message: '已退出登录。' });
    } catch (error) {
        console.error('注销失败:', error);
        res.status(500).json({ error: '注销失败，请稍后重试。' });
    }
});

app.get('/api/profile', (req, res) => {
    try {
        const user = authenticate(req);
        if (!user) {
            return res.status(401).json({ error: '需要登录。' });
        }
        res.json({
            username: user.username,
            playerId: user.playerId,
            createdAt: user.createdAt
        });
    } catch (error) {
        console.error('获取用户信息失败:', error);
        res.status(500).json({ error: '获取用户信息失败。' });
    }
});

// 提供数据接口，同时返回 UltimateShop 映射配置
app.get('/api/prices', (req, res) => {
    try {
        if (!fs.existsSync(DATA_PATH)) {
            return res.status(404).json({ error: '暂无数据' });
        }

        const fileContents = fs.readFileSync(DATA_PATH, 'utf8');
        const rawData = yaml.load(fileContents) || {};
        const mappings = loadYamlFile(MAPPING_PATH);
        const usCatalog = buildUltimateShopCatalogByMaterial();

        const responseData = {};
        Object.keys(rawData).forEach(key => {
            const mapping = mappings[key] || {};
            const normKey = normalizeMaterialId(key) || key;
            const ultimateShopOffers = usCatalog[normKey] || [];
            responseData[key] = {
                buy: rawData[key].buy,
                sell: rawData[key].sell,
                shop: mapping.shop || null,
                item: mapping.item || null,
                amount: mapping.amount || 1,
                displayName: mapping.displayName || null,
                ultimateShopOffers
            };
        });

        res.json(responseData);
    } catch (error) {
        console.error('读取价格数据出错:', error);
        res.status(500).json({ error: '读取错误' });
    }
});

// ── 仪表板：交易与分析（UltimateShop 日志 + 历史 DynamicShop CSV）──
app.get('/api/recent', (req, res) => {
    try {
        const limit = Math.min(Number(req.query.limit) || 500, 5000);
        res.json(analytics.getTransactions(limit));
    } catch (error) {
        console.error('读取最近交易失败:', error);
        res.status(500).json({ error: '读取失败' });
    }
});

app.get('/api/stats', (req, res) => {
    try {
        res.json(analytics.getStats());
    } catch (error) {
        console.error('读取统计失败:', error);
        res.status(500).json({ error: '读取失败' });
    }
});

app.get('/api/analytics/economy', (req, res) => {
    try {
        res.json(analytics.getEconomyHealth());
    } catch (error) {
        console.error('读取经济健康指标失败:', error);
        res.status(500).json({ error: '读取失败' });
    }
});

app.get('/api/analytics/leaderboard', (req, res) => {
    try {
        const type = req.query.type || 'buyers';
        const limit = Math.min(Number(req.query.limit) || 5, 50);
        res.json(analytics.getLeaderboard(type, limit));
    } catch (error) {
        console.error('读取排行榜失败:', error);
        res.status(500).json({ error: '读取失败' });
    }
});

app.get('/api/analytics/trends', (req, res) => {
    try {
        const limit = Math.min(Number(req.query.limit) || 10, 50);
        res.json(analytics.getTrends(limit));
    } catch (error) {
        console.error('读取市场趋势失败:', error);
        res.status(500).json({ error: '读取失败' });
    }
});

app.get('/api/analytics/price-history/:item', (req, res) => {
    try {
        const hours = Math.min(Number(req.query.hours) || 168, 24 * 30);
        const item = normalizeMaterialId(req.params.item) || req.params.item;
        res.json(analytics.getPriceHistory(item, hours));
    } catch (error) {
        console.error('读取价格历史失败:', error);
        res.status(500).json({ error: '读取失败' });
    }
});

app.get('/api/shop/item/:item', (req, res) => {
    try {
        const item = normalizeMaterialId(req.params.item) || req.params.item;
        res.json(analytics.getItemDetails(item));
    } catch (error) {
        console.error('读取物品详情失败:', error);
        res.status(500).json({ error: '读取失败' });
    }
});

app.post('/api/buy', (req, res) => {
    try {
        const user = authenticate(req);
        const { itemId, amount } = req.body || {};
        if (!itemId) {
            return res.status(400).json({ error: '缺少 itemId 参数' });
        }

        if (!fs.existsSync(DATA_PATH)) {
            return res.status(404).json({ error: '暂无数据' });
        }

        const fileContents = fs.readFileSync(DATA_PATH, 'utf8');
        const rawData = yaml.load(fileContents) || {};
        const itemData = rawData[itemId];
        if (!itemData) {
            return res.status(404).json({ error: '未找到该商品' });
        }

        const mappings = loadYamlFile(MAPPING_PATH);
        const mapping = mappings[itemId];
        if (!mapping || !mapping.shop || !mapping.item) {
            return res.status(422).json({ error: '该商品未配置 UltimateShop 映射' });
        }

        const buyAmount = Number(amount) || mapping.amount || 1;
        const command = `/shop quickbuy ${mapping.shop} ${mapping.item}${buyAmount > 1 ? ` ${buyAmount}` : ''}`;

        // 如果你有 Minecraft 服务器桥接，可以在这里执行 command。
        // 目前返回给前端用于提示或后续桥接处理。
        res.json({
            status: 'ok',
            itemId,
            shop: mapping.shop,
            shopItem: mapping.item,
            amount: buyAmount,
            command,
            user: user ? { username: user.username, playerId: user.playerId } : null,
            message: user ? `已为玩家 ${user.username} 生成购买指令。` : '已生成购买指令，可在 Minecraft 中由玩家执行或通过服务器桥接调用。'
        });
    } catch (error) {
        console.error('处理购买请求出错:', error);
        res.status(500).json({ error: '购买失败' });
    }
});

app.listen(PORT, HOST, () => {
    analytics.reload();
    console.log(`✅ 高级版 UI 服务已启动！访问: http://${HOST}:${PORT}`);
    console.log(`📱 局域网访问: http://192.168.0.101:${PORT}`);
    console.log(`📊 仪表板交易记录: ${TRANSACTIONS_YAML}`);
});