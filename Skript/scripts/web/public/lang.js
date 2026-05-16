// ==========================================
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


// ==========================================
// 补充译名：zh_cn.json 无 item/block.minecraft.* 对应时使用
// ==========================================

const ItemDict = {
    "lingering_water_bottle": "滞留水瓶",
    "splash_water_bottle": "喷溅水瓶",
    "enchanted_book_aqua_affinity_1": "附魔书 (水下速掘)",
    "enchanted_book_blast_protection_1": "附魔书 (爆炸保护 I)",
    "enchanted_book_blast_protection_2": "附魔书 (爆炸保护 II)",
    "enchanted_book_blast_protection_3": "附魔书 (爆炸保护 III)",
    "enchanted_book_blast_protection_4": "附魔书 (爆炸保护 IV)",
    "enchanted_book_channeling_1": "附魔书 (引雷)",
    "enchanted_book_binding_curse_1": "附魔书 (绑定诅咒)",
    "enchanted_book_vanishing_curse_1": "附魔书 (消失诅咒)",
    "enchanted_book_depth_strider_1": "附魔书 (深海探索者 I)",
    "enchanted_book_depth_strider_2": "附魔书 (深海探索者 II)",
    "enchanted_book_depth_strider_3": "附魔书 (深海探索者 III)",
    "enchanted_book_efficiency_1": "附魔书 (效率 I)",
    "enchanted_book_efficiency_2": "附魔书 (效率 II)",
    "enchanted_book_efficiency_3": "附魔书 (效率 III)",
    "enchanted_book_efficiency_4": "附魔书 (效率 IV)",
    "enchanted_book_efficiency_5": "附魔书 (效率 V)",
    "enchanted_book_feather_falling_1": "附魔书 (摔落保护 I)",
    "enchanted_book_feather_falling_2": "附魔书 (摔落保护 II)",
    "enchanted_book_feather_falling_3": "附魔书 (摔落保护 III)",
    "enchanted_book_feather_falling_4": "附魔书 (摔落保护 IV)",
    "enchanted_book_fire_aspect_1": "附魔书 (火焰附加 I)",
    "enchanted_book_fire_aspect_2": "附魔书 (火焰附加 II)",
    "enchanted_book_fire_protection_1": "附魔书 (火焰保护 I)",
    "enchanted_book_fire_protection_2": "附魔书 (火焰保护 II)",
    "enchanted_book_fire_protection_3": "附魔书 (火焰保护 III)",
    "enchanted_book_fire_protection_4": "附魔书 (火焰保护 IV)",
    "enchanted_book_flame_1": "附魔书 (火矢)",
    "enchanted_book_fortune_1": "附魔书 (时运 I)",
    "enchanted_book_fortune_2": "附魔书 (时运 II)",
    "enchanted_book_fortune_3": "附魔书 (时运 III)",
    "enchanted_book_frost_walker_1": "附魔书 (冰霜行者 I)",
    "enchanted_book_frost_walker_2": "附魔书 (冰霜行者 II)",
    "enchanted_book_impaling_1": "附魔书 (穿刺 I)",
    "enchanted_book_impaling_2": "附魔书 (穿刺 II)",
    "enchanted_book_impaling_3": "附魔书 (穿刺 III)",
    "enchanted_book_impaling_4": "附魔书 (穿刺 IV)",
    "enchanted_book_impaling_5": "附魔书 (穿刺 V)",
    "enchanted_book_infinity_1": "附魔书 (无限)",
    "enchanted_book_knockback_1": "附魔书 (击退 I)",
    "enchanted_book_knockback_2": "附魔书 (击退 II)",
    "enchanted_book_looting_1": "附魔书 (抢夺 I)",
    "enchanted_book_looting_2": "附魔书 (抢夺 II)",
    "enchanted_book_looting_3": "附魔书 (抢夺 III)",
    "enchanted_book_loyalty_1": "附魔书 (忠诚 I)",
    "enchanted_book_loyalty_2": "附魔书 (忠诚 II)",
    "enchanted_book_loyalty_3": "附魔书 (忠诚 III)",
    "enchanted_book_luck_of_the_sea_1": "附魔书 (海之眷顾 I)",
    "enchanted_book_luck_of_the_sea_2": "附魔书 (海之眷顾 II)",
    "enchanted_book_luck_of_the_sea_3": "附魔书 (海之眷顾 III)",
    "enchanted_book_lure_1": "附魔书 (饵钓 I)",
    "enchanted_book_lure_2": "附魔书 (饵钓 II)",
    "enchanted_book_lure_3": "附魔书 (饵钓 III)",
    "enchanted_book_mending_1": "附魔书 (经验修补)",
    "enchanted_book_multishot_1": "附魔书 (多重射击)",
    "enchanted_book_piercing_1": "附魔书 (穿透 I)",
    "enchanted_book_piercing_2": "附魔书 (穿透 II)",
    "enchanted_book_piercing_3": "附魔书 (穿透 III)",
    "enchanted_book_piercing_4": "附魔书 (穿透 IV)",
    "enchanted_book_power_1": "附魔书 (力量 I)",
    "enchanted_book_power_2": "附魔书 (力量 II)",
    "enchanted_book_power_3": "附魔书 (力量 III)",
    "enchanted_book_power_4": "附魔书 (力量 IV)",
    "enchanted_book_power_5": "附魔书 (力量 V)",
    "enchanted_book_projectile_protection_1": "附魔书 (弹射物保护 I)",
    "enchanted_book_projectile_protection_2": "附魔书 (弹射物保护 II)",
    "enchanted_book_projectile_protection_3": "附魔书 (弹射物保护 III)",
    "enchanted_book_projectile_protection_4": "附魔书 (弹射物保护 IV)",
    "enchanted_book_protection_1": "附魔书 (保护 I)",
    "enchanted_book_protection_2": "附魔书 (保护 II)",
    "enchanted_book_protection_3": "附魔书 (保护 III)",
    "enchanted_book_protection_4": "附魔书 (保护 IV)",
    "enchanted_book_punch_1": "附魔书 (冲击 I)",
    "enchanted_book_punch_2": "附魔书 (冲击 II)",
    "enchanted_book_quick_charge_1": "附魔书 (快速装填 I)",
    "enchanted_book_quick_charge_2": "附魔书 (快速装填 II)",
    "enchanted_book_quick_charge_3": "附魔书 (快速装填 III)",
    "enchanted_book_respiration_1": "附魔书 (水下呼吸 I)",
    "enchanted_book_respiration_2": "附魔书 (水下呼吸 II)",
    "enchanted_book_respiration_3": "附魔书 (水下呼吸 III)",
    "enchanted_book_riptide_1": "附魔书 (激流 I)",
    "enchanted_book_riptide_2": "附魔书 (激流 II)",
    "enchanted_book_riptide_3": "附魔书 (激流 III)",
    "enchanted_book_sharpness_1": "附魔书 (锋利 I)",
    "enchanted_book_sharpness_2": "附魔书 (锋利 II)",
    "enchanted_book_sharpness_3": "附魔书 (锋利 III)",
    "enchanted_book_sharpness_4": "附魔书 (锋利 IV)",
    "enchanted_book_sharpness_5": "附魔书 (锋利 V)",
    "enchanted_book_silk_touch_1": "附魔书 (丝绸之触)",
    "enchanted_book_smite_1": "附魔书 (亡灵杀手 I)",
    "enchanted_book_smite_2": "附魔书 (亡灵杀手 II)",
    "enchanted_book_smite_3": "附魔书 (亡灵杀手 III)",
    "enchanted_book_smite_4": "附魔书 (亡灵杀手 IV)",
    "enchanted_book_smite_5": "附魔书 (亡灵杀手 V)",
    "enchanted_book_soul_speed_1": "附魔书 (灵魂速行 I)",
    "enchanted_book_soul_speed_2": "附魔书 (灵魂速行 II)",
    "enchanted_book_soul_speed_3": "附魔书 (灵魂速行 III)",
    "enchanted_book_sweeping_1": "附魔书 (横扫之刃 I)",
    "enchanted_book_sweeping_2": "附魔书 (横扫之刃 II)",
    "enchanted_book_sweeping_3": "附魔书 (横扫之刃 III)",
    "enchanted_book_thorns_1": "附魔书 (荆棘 I)",
    "enchanted_book_thorns_2": "附魔书 (荆棘 II)",
    "enchanted_book_thorns_3": "附魔书 (荆棘 III)",
    "enchanted_book_unbreaking_1": "附魔书 (耐久 I)",
    "enchanted_book_unbreaking_2": "附魔书 (耐久 II)",
    "enchanted_book_unbreaking_3": "附魔书 (耐久 III)",
    "enchanted_book_bane_of_arthropods_1": "附魔书 (节肢杀手 I)",
    "enchanted_book_bane_of_arthropods_2": "附魔书 (节肢杀手 II)",
    "enchanted_book_bane_of_arthropods_3": "附魔书 (节肢杀手 III)",
    "enchanted_book_bane_of_arthropods_4": "附魔书 (节肢杀手 IV)",
    "enchanted_book_bane_of_arthropods_5": "附魔书 (节肢杀手 V)",
    "enchanted_book_breach_1": "附魔书 (破重 I)",
    "enchanted_book_breach_2": "附魔书 (破重 II)",
    "enchanted_book_breach_3": "附魔书 (破重 III)",
    "enchanted_book_breach_4": "附魔书 (破重 IV)",
    "enchanted_book_density_1": "附魔书 (密度 I)",
    "enchanted_book_density_2": "附魔书 (密度 II)",
    "enchanted_book_density_3": "附魔书 (密度 III)",
    "enchanted_book_density_4": "附魔书 (密度 IV)",
    "enchanted_book_density_5": "附魔书 (密度 V)",
    "enchanted_book_wind_burst_1": "附魔书 (风爆 I)",
    "enchanted_book_wind_burst_2": "附魔书 (风爆 II)",
    "enchanted_book_wind_burst_3": "附魔书 (风爆 III)",
    "enchanted_book_fire_aspect_1": "附魔书 (火焰附加 I)",
    "enchanted_book_fire_aspect_2": "附魔书 (火焰附加 II)",
    "enchanted_book_knockback_1": "附魔书 (击退 I)",
    "enchanted_book_knockback_2": "附魔书 (击退 II)",
    "enchanted_book_looting_1": "附魔书 (抢夺 I)",
    "enchanted_book_looting_2": "附魔书 (抢夺 II)",
    "enchanted_book_looting_3": "附魔书 (抢夺 III)",
    "enchanted_book_sweeping_1": "附魔书 (横扫之刃 I)",
    "enchanted_book_sweeping_2": "附魔书 (横扫之刃 II)",
    "enchanted_book_sweeping_3": "附魔书 (横扫之刃 III)",
    "enchanted_book_unbreaking_1": "附魔书 (耐久 I)",
    "enchanted_book_unbreaking_2": "附魔书 (耐久 II)",
    "enchanted_book_unbreaking_3": "附魔书 (耐久 III)",
    "enchanted_book_mending_1": "附魔书 (经验修补)",
    "enchanted_book_vanishing_curse_1": "附魔书 (消失诅咒)",
    "enchanted_book_binding_curse_1": "附魔书 (绑定诅咒)",
    "enchanted_book_curse_of_binding_1": "绑定诅咒附魔书I",
    "enchanted_book_curse_of_vanishing_1": "消失诅咒附魔书I",
    "enchanted_book_sweeping_edge_1": "横扫之刃附魔书I",
    "enchanted_book_sweeping_edge_2": "横扫之刃附魔书II",
    "enchanted_book_sweeping_edge_3": "横扫之刃附魔书III",
    "enchanted_book_swift_sneak_1": "迅捷潜行附魔书I",
    "enchanted_book_swift_sneak_2": "迅捷潜行附魔书II",
    "enchanted_book_swift_sneak_3": "迅捷潜行附魔书III",
};

// ==========================================
// 物品分类汉化（与 items.yml category 字段对应）
// ==========================================
const CategoryDict = {
    archaeology: '考古',
    armor: '盔甲',
    brewing: '酿造',
    brick: '砖块',
    copper: '铜',
    'deep dark': '深暗之域',
    discs: '唱片',
    drops: '掉落物',
    dyed: '染色',
    earth: '土石',
    enchantments: '附魔',
    end: '末地',
    food: '食物',
    ice: '冰系',
    light: '光源',
    nether: '下界',
    ocean: '海洋',
    ores: '矿石',
    plants: '植物',
    redstone: '红石',
    sand: '沙子',
    stone: '石头',
    tools: '工具',
    transport: '运输',
    utility: '实用物品',
    weapons: '武器',
    wood: '木材',
    unknown: '未知'
};

/**
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


window.getChineseCategory = function(category) {
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
    return raw.split(/[\s_-]+/)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
};
