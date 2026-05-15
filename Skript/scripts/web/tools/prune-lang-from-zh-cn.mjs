/**
 * 从 zh_cn.json 解析 item.minecraft.*，并从 lang.js ItemDict 移除已有官方译名的条目。
 * 运行: node Skript/scripts/web/tools/prune-lang-from-zh-cn.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', 'public');
const zhCnPath = path.join(publicDir, '26.1.2', 'assets', 'minecraft', 'lang', 'zh_cn.json');
const langJsPath = path.join(publicDir, 'lang.js');

const EFFECT_ID_ALIASES = {
    infestation: 'infested',
    the_turtle_master: 'turtle_master',
    wind_charging: 'wind_charged'
};

function normalizeEffectId(effect) {
    return EFFECT_ID_ALIASES[effect] || effect;
}

function buildMcLangMaps(lang) {
    const itemByKey = {};
    const blockByKey = {};
    for (const [k, v] of Object.entries(lang)) {
        if (k.startsWith('item.minecraft.')) {
            itemByKey[k.slice('item.minecraft.'.length)] = v;
        } else if (k.startsWith('block.minecraft.')) {
            blockByKey[k.slice('block.minecraft.'.length)] = v;
        }
    }
    return { itemByKey, blockByKey };
}

function romanLevelSuffix(level) {
    if (level === '2') return ' II';
    if (level === '3') return ' III';
    if (level === '4') return ' IV';
    return '';
}

function lookupMcItemName(itemId, maps) {
    const itemByKey = maps.itemByKey;
    const blockByKey = maps.blockByKey;
    const id = String(itemId).toLowerCase().replace(/-/g, '_');
    if (itemByKey[id]) return itemByKey[id];
    if (blockByKey[id]) return blockByKey[id];

    const standalone = {
        water_bottle: 'potion.effect.water',
        awkward_potion: 'potion.effect.awkward',
        mundane_potion: 'potion.effect.mundane',
        thick_potion: 'potion.effect.thick',
        awkward_splash_potion: 'splash_potion.effect.awkward',
        awkward_lingering_potion: 'lingering_potion.effect.awkward'
    };
    if (standalone[id] && itemByKey[standalone[id]]) {
        return itemByKey[standalone[id]];
    }

    let m = id.match(/^(potion|splash_potion|lingering_potion)_of_(.+)_extended$/);
    if (m) {
        const effect = normalizeEffectId(m[2]);
        const base = itemByKey[m[1] + '.effect.' + effect];
        if (base) return base;
    }

    m = id.match(/^(potion|splash_potion|lingering_potion)_of_(.+)_([0-9]+)$/);
    if (m) {
        const effect = normalizeEffectId(m[2]);
        const base = itemByKey[m[1] + '.effect.' + effect];
        if (base) return base + romanLevelSuffix(m[3]);
    }

    m = id.match(/^(potion|splash_potion|lingering_potion)_of_(.+)$/);
    if (m) {
        const effect = normalizeEffectId(m[2]);
        const base = itemByKey[m[1] + '.effect.' + effect];
        if (base) return base;
    }

    m = id.match(/^arrow_of_(.+)_extended$/);
    if (m) {
        const effect = normalizeEffectId(m[1]);
        const base = itemByKey['tipped_arrow.effect.' + effect];
        if (base) return base;
    }

    m = id.match(/^arrow_of_(.+)_([0-9]+)$/);
    if (m) {
        const effect = normalizeEffectId(m[1]);
        const base = itemByKey['tipped_arrow.effect.' + effect];
        if (base) return base + romanLevelSuffix(m[2]);
    }

    return null;
}

function parseItemDict(langJs) {
    const start = langJs.indexOf('const ItemDict = {');
    const end = langJs.indexOf('\n};', start);
    if (start < 0 || end < 0) throw new Error('ItemDict block not found');
    const block = langJs.slice(start, end + 3);
    const entries = [];
    const re = /"([^"]+)":\s*"((?:\\.|[^"\\])*)"/g;
    let match;
    while ((match = re.exec(block)) !== null) {
        entries.push({
            key: match[1],
            value: match[2].replace(/\\"/g, '"').replace(/\\\\/g, '\\')
        });
    }
    return entries;
}

function escapeJsString(s) {
    return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function formatItemDict(entries) {
    const lines = [
        '// ==========================================',
        '// 补充译名：zh_cn.json 无 item/block.minecraft.* 对应时使用',
        '// ==========================================',
        '',
        'const ItemDict = {'
    ];
    for (const { key, value } of entries) {
        lines.push(`    "${key}": "${escapeJsString(value)}",`);
    }
    lines.push('};');
    return lines.join('\n');
}

const LOADER_AND_LOOKUP = `// ==========================================
// Minecraft 官方中文（zh_cn.json → item/block.minecraft.*）
// ==========================================
const MC_LANG_URL = '26.1.2/assets/minecraft/lang/zh_cn.json';

const EFFECT_ID_ALIASES = {
    infestation: 'infested',
    the_turtle_master: 'turtle_master',
    wind_charging: 'wind_charged'
};

let mcLangMaps = null;

function normalizeEffectId(effect) {
    return EFFECT_ID_ALIASES[effect] || effect;
}

function buildMcLangMaps(lang) {
    const itemByKey = {};
    const blockByKey = {};
    for (const [k, v] of Object.entries(lang)) {
        if (k.startsWith('item.minecraft.')) {
            itemByKey[k.slice('item.minecraft.'.length)] = v;
        } else if (k.startsWith('block.minecraft.')) {
            blockByKey[k.slice('block.minecraft.'.length)] = v;
        }
    }
    return { itemByKey, blockByKey };
}

function romanLevelSuffix(level) {
    if (level === '2') return ' II';
    if (level === '3') return ' III';
    if (level === '4') return ' IV';
    return '';
}

function lookupMcItemName(itemId, maps) {
    const itemByKey = maps.itemByKey;
    const blockByKey = maps.blockByKey;
    const id = String(itemId).toLowerCase().replace(/-/g, '_');
    if (itemByKey[id]) return itemByKey[id];
    if (blockByKey[id]) return blockByKey[id];

    const standalone = {
        water_bottle: 'potion.effect.water',
        awkward_potion: 'potion.effect.awkward',
        mundane_potion: 'potion.effect.mundane',
        thick_potion: 'potion.effect.thick',
        awkward_splash_potion: 'splash_potion.effect.awkward',
        awkward_lingering_potion: 'lingering_potion.effect.awkward'
    };
    if (standalone[id] && itemByKey[standalone[id]]) {
        return itemByKey[standalone[id]];
    }

    let m = id.match(/^(potion|splash_potion|lingering_potion)_of_(.+)_extended$/);
    if (m) {
        const effect = normalizeEffectId(m[2]);
        const base = itemByKey[m[1] + '.effect.' + effect];
        if (base) return base;
    }

    m = id.match(/^(potion|splash_potion|lingering_potion)_of_(.+)_([0-9]+)$/);
    if (m) {
        const effect = normalizeEffectId(m[2]);
        const base = itemByKey[m[1] + '.effect.' + effect];
        if (base) return base + romanLevelSuffix(m[3]);
    }

    m = id.match(/^(potion|splash_potion|lingering_potion)_of_(.+)$/);
    if (m) {
        const effect = normalizeEffectId(m[2]);
        const base = itemByKey[m[1] + '.effect.' + effect];
        if (base) return base;
    }

    m = id.match(/^arrow_of_(.+)_extended$/);
    if (m) {
        const effect = normalizeEffectId(m[1]);
        const base = itemByKey['tipped_arrow.effect.' + effect];
        if (base) return base;
    }

    m = id.match(/^arrow_of_(.+)_([0-9]+)$/);
    if (m) {
        const effect = normalizeEffectId(m[1]);
        const base = itemByKey['tipped_arrow.effect.' + effect];
        if (base) return base + romanLevelSuffix(m[2]);
    }

    return null;
}

window.mcLangReady = fetch(MC_LANG_URL)
    .then((r) => {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
    })
    .then((lang) => {
        mcLangMaps = buildMcLangMaps(lang);
    })
    .catch((err) => {
        console.warn('无法加载 zh_cn.json，将仅使用 ItemDict 兜底', err);
        mcLangMaps = { itemByKey: {}, blockByKey: {} };
    });

`;

const GET_CHINESE_NAME = `/**
 * 物品中文名：zh_cn item.minecraft.* → block.minecraft.* → ItemDict 兜底。
 */
window.getChineseName = function(itemId) {
    const id = String(itemId).toLowerCase().replace(/-/g, '_');

    if (mcLangMaps) {
        const mc = lookupMcItemName(id, mcLangMaps);
        if (mc) return mc;
    }

    if (ItemDict[id]) {
        return ItemDict[id];
    }

    return id.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};

`;

const GET_CHINESE_CATEGORY = `window.getChineseCategory = function(category) {
    if (category == null || category === '') {
        return CategoryDict.unknown;
    }
    const raw = String(category).trim();
    const lower = raw.toLowerCase();
    if (CategoryDict[raw]) {
        return CategoryDict[raw];
    }
    if (CategoryDict[lower]) {
        return CategoryDict[lower];
    }
    return raw.split(/[\\s_-]+/)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
};
`;

const langJs = fs.readFileSync(langJsPath, 'utf8');
const zhCn = JSON.parse(fs.readFileSync(zhCnPath, 'utf8'));
const mcMaps = buildMcLangMaps(zhCn);
const entries = parseItemDict(langJs);

const kept = [];
const removed = [];
for (const entry of entries) {
    if (lookupMcItemName(entry.key, mcMaps)) {
        removed.push(entry.key);
    } else {
        kept.push(entry);
    }
}

// Preserve CategoryDict from current file
let categoryBlock = '';
const catMarker = '// 物品分类汉化';
const catMarkerIdx = langJs.indexOf(catMarker);
const catStart = langJs.indexOf('const CategoryDict = {', catMarkerIdx >= 0 ? catMarkerIdx : 0);
if (catStart >= 0) {
    const catEnd = langJs.indexOf('\n};', catStart) + 3;
    const headerStart = langJs.lastIndexOf('// ==========================================', catStart);
    categoryBlock = langJs.slice(headerStart >= 0 ? headerStart : catStart, catEnd);
} else {
    throw new Error('CategoryDict block not found in lang.js');
}

const finalJs = [
    LOADER_AND_LOOKUP,
    formatItemDict(kept),
    '',
    categoryBlock,
    '',
    GET_CHINESE_NAME,
    GET_CHINESE_CATEGORY
].join('\n');

fs.writeFileSync(langJsPath, finalJs, 'utf8');
console.log(`ItemDict: ${entries.length} -> ${kept.length} (removed ${removed.length})`);
