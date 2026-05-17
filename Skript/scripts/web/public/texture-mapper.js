// ==========================================
// 全局材质映射器 (Texture Mapper) - 缓存记忆版
// ==========================================

window.McIconConfig = window.McIconConfig || {
    ICON_PX: Math.round(32 * 1.3),
    RENDER_SIZE: Math.round(64 * 1.3),
    ICON_GAP_RIGHT: Math.round(12 * 1.3),
    FLAT_PAD_RATIO: 0.1,
    /** 仅 3D WebGL：相对槽位位图边长的内部渲染倍数 */
    RENDER_SCALE_3D: 2,
    /** 3D 槽位边长 = ICON_PX × min(实际 DPR, SLOT_DPR_CAP)，再与 RENDER_SIZE 取大；上限 SLOT_BITMAP_MAX_3D */
    SLOT_DPR_CAP: 3,
    SLOT_BITMAP_MAX_3D: 512,
    /** WebGL  framebuffer 单边最大像素，防止极端 DPR+倍数爆显存 */
    SLOT_WEBGL_MAX: 2048
};

window.LoadedTextureCache = window.LoadedTextureCache || new Set();

const TextureConfig = {
    version: '26.1.2',
    getBasePath: function() {
        return `/${this.version}/assets/minecraft/textures`;
    }
};
window.McTexturePackVersion = TextureConfig.version;

window.getSmartId = function(id) {
    let rawId = String(id).toLowerCase().replace(/-/g, '_');
    // 涂蜡铜等无独立贴图/模型，与不涂蜡方块共用资源
    if (rawId.startsWith('waxed_')) rawId = rawId.slice(6);
    if (rawId.startsWith('enchanted_book')) return 'enchanted_book';
    if (rawId === 'enchanted_golden_apple') return 'golden_apple';
    // 项目里的药水按效果拆成独立商品 ID，材质仍复用三种原版瓶型。
    if (rawId === 'water_bottle' || rawId === 'mundane_potion' || rawId === 'thick_potion') return 'potion';
    if (rawId === 'splash_water_bottle') return 'splash_potion';
    if (rawId === 'lingering_water_bottle') return 'lingering_potion';
    if (rawId === 'awkward_potion') return 'potion';
    if (rawId === 'awkward_splash_potion') return 'splash_potion';
    if (rawId === 'awkward_lingering_potion') return 'lingering_potion';
    if (rawId.startsWith('potion')) return 'potion';
    if (rawId.startsWith('lingering_potion')) return 'lingering_potion';
    if (rawId.startsWith('splash_potion')) return 'splash_potion';
    if (rawId.startsWith('arrow_of_')) return 'tipped_arrow';
    // 玻璃板无独立贴图，沿用对应玻璃方块的平面材质（block/glass.png 等）
    if (rawId === 'glass_pane') return 'glass';
    if (rawId.endsWith('_glass_pane')) return rawId.replace(/_glass_pane$/, '_glass');
    return rawId;
};

const POTION_BASE_COLOR = '#385dc6';
const POTION_EFFECT_ALIASES = {
    infestation: 'infested',
    the_turtle_master: 'turtle_master',
    wind_charging: 'wind_charged'
};
const POTION_EFFECT_COLORS = {
    water: POTION_BASE_COLOR,
    awkward: POTION_BASE_COLOR,
    mundane: POTION_BASE_COLOR,
    thick: POTION_BASE_COLOR,
    // Minecraft Wiki "Effect colors" current Java colors; water uses item JSON default tint -13083194.
    fire_resistance: '#ff9900',
    harming: '#a9656a',
    healing: '#f82423',
    infested: '#8c9b8c',
    invisibility: '#f6f6f6',
    leaping: '#fdff84',
    levitation: '#ceffff',
    luck: '#339900',
    night_vision: '#c2ff66',
    oozing: '#99ffa3',
    poison: '#87a363',
    regeneration: '#cd5cab',
    slow_falling: '#f3cfb9',
    slowness: '#8bafe0',
    strength: '#ffc700',
    swiftness: '#33ebff',
    turtle_master: '#8d82e6',
    turtle_master_strong: '#8d85e6',
    water_breathing: '#98dac0',
    weakness: '#484d48',
    weaving: '#78695a',
    wind_charged: '#bdc9ff'
};

const REDSTONE_2D_TEXTURE_ITEMS = new Set(['redstone', 'repeater', 'comparator']);
const TORCH_2D_TEXTURES = {
    torch: 'torch',
    soul_torch: 'soul_torch',
    redstone_torch: 'redstone_torch',
    copper_torch: 'copper_torch'
};
const ITEM_MODEL_2D_TEXTURES = {
    lever: 'block/lever',
    ladder: 'block/ladder',
    lily_pad: 'block/lily_pad',
    cobweb: 'block/cobweb',
    amethyst_cluster: 'block/amethyst_cluster',
    soul_campfire: 'item/soul_campfire',
    hopper: 'item/hopper',
    sunflower: 'block/sunflower_front',
    rose_bush: 'block/rose_bush_top',
    peony: 'block/peony_top',
    brewing_stand: 'item/brewing_stand',
    resin_clump: 'item/resin_clump',
    item_frame: 'item/item_frame',
    glow_item_frame: 'item/glow_item_frame',
    iron_chain: 'item/iron_chain',
    copper_chain: 'item/copper_chain',
    exposed_copper_chain: 'item/exposed_copper_chain',
    weathered_copper_chain: 'item/weathered_copper_chain',
    oxidized_copper_chain: 'item/oxidized_copper_chain'
};

window.isMcPotionItemId = function(id) {
    const n = String(id || '').toLowerCase().replace(/-/g, '_');
    return n === 'potion'
        || n === 'splash_potion'
        || n === 'lingering_potion'
        || n === 'water_bottle'
        || n === 'splash_water_bottle'
        || n === 'lingering_water_bottle'
        || n === 'awkward_potion'
        || n === 'awkward_splash_potion'
        || n === 'awkward_lingering_potion'
        || n === 'mundane_potion'
        || n === 'thick_potion'
        || n.startsWith('potion_of_')
        || n.startsWith('splash_potion_of_')
        || n.startsWith('lingering_potion_of_');
};

window.mcPotionKindFromItemId = function(id) {
    const n = String(id || '').toLowerCase().replace(/-/g, '_');
    if (n.startsWith('splash_') || n.startsWith('splash_potion')) return 'splash_potion';
    if (n.startsWith('lingering_') || n.startsWith('lingering_potion')) return 'lingering_potion';
    return 'potion';
};

window.mcPotionEffectFromItemId = function(id) {
    const n = String(id || '').toLowerCase().replace(/-/g, '_');
    const standalone = {
        potion: 'water',
        splash_potion: 'water',
        lingering_potion: 'water',
        water_bottle: 'water',
        splash_water_bottle: 'water',
        lingering_water_bottle: 'water',
        awkward_potion: 'awkward',
        awkward_splash_potion: 'awkward',
        awkward_lingering_potion: 'awkward',
        mundane_potion: 'mundane',
        thick_potion: 'thick'
    };
    if (standalone[n]) return standalone[n];

    let m = n.match(/^(?:potion|splash_potion|lingering_potion)_of_(.+?)(?:_(?:extended|[0-9]+))?$/);
    if (!m) m = n.match(/^arrow_of_(.+?)(?:_(?:extended|[0-9]+))?$/);
    if (!m) return 'water';
    const effect = m[1];
    return POTION_EFFECT_ALIASES[effect] || effect;
};

window.mcPotionColorHexForItem = function(id) {
    const n = String(id || '').toLowerCase().replace(/-/g, '_');
    if (/^(?:(?:potion|splash_potion|lingering_potion)_of_the_turtle_master|arrow_of_the_turtle_master)_2$/.test(n)) {
        return POTION_EFFECT_COLORS.turtle_master_strong;
    }
    const effect = window.mcPotionEffectFromItemId(id);
    return POTION_EFFECT_COLORS[effect] || POTION_BASE_COLOR;
};

window.mcPotionTextureUrlsForItem = function(itemId) {
    const base = TextureConfig.getBasePath();
    const kind = window.mcPotionKindFromItemId(itemId);
    return [
        `${base}/item/potion_overlay.png`,
        `${base}/item/${kind}.png`,
        `${base}/item/barrier.png`
    ];
};

window.isMcTippedArrowItemId = function(id) {
    const n = String(id || '').toLowerCase().replace(/-/g, '_');
    return n === 'tipped_arrow' || n.startsWith('arrow_of_');
};

window.mcTippedArrowTextureUrlsForItem = function() {
    const base = TextureConfig.getBasePath();
    return [
        `${base}/item/tipped_arrow_head.png`,
        `${base}/item/tipped_arrow_base.png`,
        `${base}/item/barrier.png`
    ];
};

window.isMcFireworkStarItemId = function(id) {
    const n = String(id || '').toLowerCase().replace(/-/g, '_');
    return n === 'firework_star';
};

window.mcFireworkStarTextureUrlsForItem = function() {
    const base = TextureConfig.getBasePath();
    return [
        `${base}/item/firework_star.png`,
        `${base}/item/firework_star_overlay.png`,
        `${base}/item/barrier.png`
    ];
};

window.isMcLeatherArmorItemId = function(id) {
    const n = String(id || '').toLowerCase().replace(/-/g, '_');
    return n === 'leather_helmet'
        || n === 'leather_chestplate'
        || n === 'leather_leggings'
        || n === 'leather_boots'
        || n === 'leather_horse_armor';
};

window.mcLeatherArmorTextureUrlsForItem = function(itemId) {
    const base = TextureConfig.getBasePath();
    const n = String(itemId || '').toLowerCase().replace(/-/g, '_');
    return [
        `${base}/item/${n}.png`,
        `${base}/item/${n}_overlay.png`,
        `${base}/item/barrier.png`
    ];
};

window.isMcClockItemId = function(id) {
    const n = String(id || '').toLowerCase().replace(/-/g, '_');
    return n === 'clock';
};

window.mcClockTextureUrlsForItem = function() {
    const base = TextureConfig.getBasePath();
    return [
        `${base}/item/clock_00.png`,
        `${base}/item/barrier.png`
    ];
};

window.isMcMouseCompassItemId = function(id) {
    const n = String(id || '').toLowerCase().replace(/-/g, '_');
    return n === 'compass' || n === 'recovery_compass';
};

window.mcMouseCompassTextureUrlsForItem = function(itemId) {
    const base = TextureConfig.getBasePath();
    const n = String(itemId || '').toLowerCase().replace(/-/g, '_');
    return [
        `${base}/item/${n}_00.png`,
        `${base}/item/barrier.png`
    ];
};

window.isMcCakeItemId = function(id) {
    const n = String(id || '').toLowerCase().replace(/-/g, '_');
    return n === 'cake';
};

/** 2D 图标贴图 URL 列表（玻璃板仅 block，避免误请求 item/glass_pane 等） */
window.flatTextureUrlsForItem = function(itemId) {
    const base = TextureConfig.getBasePath();
    const smartId = window.getSmartId(itemId);
    if (window.isMcCakeItemId && window.isMcCakeItemId(itemId)) {
        return [`${base}/item/cake.png`, `${base}/item/barrier.png`];
    }
    if (window.isMcTippedArrowItemId && window.isMcTippedArrowItemId(itemId)) {
        return window.mcTippedArrowTextureUrlsForItem(itemId);
    }
    if (window.isMcPotionItemId && window.isMcPotionItemId(itemId)) {
        return window.mcPotionTextureUrlsForItem(itemId);
    }
    if (window.isMcFireworkStarItemId && window.isMcFireworkStarItemId(itemId)) {
        return window.mcFireworkStarTextureUrlsForItem(itemId);
    }
    if (window.isMcLeatherArmorItemId && window.isMcLeatherArmorItemId(itemId)) {
        return window.mcLeatherArmorTextureUrlsForItem(itemId);
    }
    if (window.isMcClockItemId && window.isMcClockItemId(itemId)) {
        return window.mcClockTextureUrlsForItem(itemId);
    }
    if (window.isMcMouseCompassItemId && window.isMcMouseCompassItemId(itemId)) {
        return window.mcMouseCompassTextureUrlsForItem(itemId);
    }
    if (window.isMcGlassPaneItemId && window.isMcGlassPaneItemId(itemId)) {
        return [`${base}/block/${smartId}.png`];
    }
    if (window.isMcBedItemId && window.isMcBedItemId(itemId)) {
        return window.bedInviconUrlsForItem(itemId);
    }
    if (window.isMcBannerItemId && window.isMcBannerItemId(itemId)) {
        return window.bannerInviconUrlsForItem(itemId);
    }
    if (window.isMcCopperGolemStatueItemId && window.isMcCopperGolemStatueItemId(itemId)) {
        return window.copperGolemStatueInviconUrlsForItem(itemId);
    }
    if (window.isMcDecoratedPotItemId && window.isMcDecoratedPotItemId(itemId)) {
        return window.decoratedPotWikiImageUrlsForItem(itemId);
    }
    if (window.isMcShulkerBoxItemId && window.isMcShulkerBoxItemId(itemId)) {
        return window.shulkerBoxWikiImageUrlsForItem(itemId);
    }
    if (window.isMcChestBlockItemId && window.isMcChestBlockItemId(itemId)) {
        return window.chestWikiImageUrlsForItem(itemId);
    }
    if (window.isMcSporeBlossomItemId && window.isMcSporeBlossomItemId(itemId)) {
        return window.sporeBlossomWikiImageUrlsForItem(itemId);
    }
    if (window.isMcConduitItemId && window.isMcConduitItemId(itemId)) {
        return window.conduitWikiImageUrlsForItem(itemId);
    }
    if (window.isMcDriedGhastItemId && window.isMcDriedGhastItemId(itemId)) {
        return window.driedGhastWikiImageUrlsForItem(itemId);
    }
    if (window.isMcHeavyCoreItemId && window.isMcHeavyCoreItemId(itemId)) {
        return window.heavyCoreWikiImageUrlsForItem(itemId);
    }
    if (window.isMcHeadItemId && window.isMcHeadItemId(itemId)) {
        return window.headWikiImageUrlsForItem(itemId);
    }
    if (window.isMcShieldItemId && window.isMcShieldItemId(itemId)) {
        return window.shieldInviconUrlsForItem(itemId);
    }
    if (window.isMcTripwireHookItemId && window.isMcTripwireHookItemId(itemId)) {
        return [`${base}/block/tripwire_hook.png`, `${base}/item/barrier.png`];
    }
    if (window.isMcVineOrRootPlantItemId && window.isMcVineOrRootPlantItemId(itemId)) {
        return window.vineOrRootPlantTextureUrlsForItem(itemId);
    }
    if (window.isMcDoubleTallPlantItemId && window.isMcDoubleTallPlantItemId(itemId)) {
        return window.doubleTallPlantTextureUrlsForItem(itemId);
    }
    if (window.isMcCandleItemId && window.isMcCandleItemId(itemId)) {
        return [`${base}/item/${smartId}.png`, `${base}/item/barrier.png`];
    }
    if (REDSTONE_2D_TEXTURE_ITEMS.has(smartId)) {
        return [`${base}/item/${smartId}.png`, `${base}/item/barrier.png`];
    }
    if (TORCH_2D_TEXTURES[smartId]) {
        return [`${base}/block/${TORCH_2D_TEXTURES[smartId]}.png`, `${base}/item/barrier.png`];
    }
    if (ITEM_MODEL_2D_TEXTURES[smartId]) {
        return [`${base}/${ITEM_MODEL_2D_TEXTURES[smartId]}.png`, `${base}/item/barrier.png`];
    }
    if (smartId === 'sugar_cane') {
        return [`${base}/item/sugar_cane.png`, `${base}/item/barrier.png`];
    }
    if (smartId === 'kelp') {
        return [`${base}/item/kelp.png`, `${base}/item/barrier.png`];
    }
    if (window.isMcAnimatedPrismarineBlockItemId && window.isMcAnimatedPrismarineBlockItemId(itemId)) {
        return [`${base}/block/prismarine.png`, `${base}/item/barrier.png`];
    }
    return [`${base}/block/${smartId}.png`, `${base}/item/${smartId}.png`];
};

/** 玻璃板（非玻璃瓶）：物品栏 2D，贴图由 getSmartId 映射到 glass / *_stained_glass */
window.isMcGlassPaneItemId = function(id) {
    const n = String(id || '').toLowerCase().replace(/-/g, '_');
    if (n === 'glass_pane') return true;
    return n.endsWith('_glass_pane') && !n.endsWith('glass_bottle');
};

window.isMcAnimatedPrismarineBlockItemId = function(id) {
    const n = String(id || '').toLowerCase().replace(/-/g, '_');
    return n === 'prismarine'
        || n === 'prismarine_slab'
        || n === 'prismarine_stairs'
        || n === 'prismarine_wall';
};

/** 铁轨类：物品栏使用 item/generated 的 2D 贴图，不渲染倾斜 3D 方块模型 */
window.isMcRailItemId = function(id) {
    const n = String(id || '').toLowerCase().replace(/-/g, '_');
    return n === 'rail'
        || n === 'powered_rail'
        || n === 'detector_rail'
        || n === 'activator_rail';
};

/** 菌菇类小物品：只包含非完整方块形态，物品栏使用 2D 平面贴图 */
window.isMcMushroomOrFungusItemId = function(id) {
    const n = String(id || '').toLowerCase().replace(/-/g, '_');
    return n === 'brown_mushroom'
        || n === 'red_mushroom'
        || n === 'crimson_fungus'
        || n === 'warped_fungus';
};

/** 盾牌：item/template_shield 为 builtin/entity，商店图标用 Wiki Invicon */
window.isMcShieldItemId = function(id) {
    const n = String(id || '').toLowerCase().replace(/-/g, '_');
    return n === 'shield' || n.endsWith('_shield');
};

window.shieldInviconUrlForItem = function(itemId, wikiHost) {
    const host = wikiHost || 'zh.minecraft.wiki';
    return `https://${host}/images/Invicon_Shield.png`;
};

window.shieldInviconUrlsForItem = function(itemId) {
    return [
        window.shieldInviconUrlForItem(itemId, 'zh.minecraft.wiki'),
        window.shieldInviconUrlForItem(itemId, 'minecraft.wiki'),
        `${TextureConfig.getBasePath()}/item/barrier.png`
    ];
};

window.isMcDecoratedPotItemId = function(id) {
    const n = String(id || '').toLowerCase().replace(/-/g, '_');
    return n === 'decorated_pot';
};

window.decoratedPotWikiImageUrlForItem = function(itemId, wikiHost) {
    const host = wikiHost || 'zh.minecraft.wiki';
    return `https://${host}/images/Decorated_Pot_JE2_BE2.png`;
};

window.decoratedPotWikiImageUrlsForItem = function(itemId) {
    return [
        window.decoratedPotWikiImageUrlForItem(itemId, 'zh.minecraft.wiki'),
        window.decoratedPotWikiImageUrlForItem(itemId, 'minecraft.wiki'),
        `${TextureConfig.getBasePath()}/item/barrier.png`
    ];
};

/** 木门等（非活板门）：物品栏用 2D 平面，绘制时不加 FLAT_PAD（与先前 3D 满幅一致） */
window.isMcDoorItemId = function(id) {
    const n = String(id || '').toLowerCase().replace(/-/g, '_');
    return n.endsWith('_door') && !n.endsWith('_trapdoor');
};

/** 绊线钩：物品栏使用 item/generated 的平面图标，避免误走 block/tripwire_hook 3D 模型 */
window.isMcTripwireHookItemId = function(id) {
    const n = String(id || '').toLowerCase().replace(/-/g, '_');
    return n === 'tripwire_hook';
};

/** 孢子花：使用 Wiki JE 渲染图，避免本地方块平面图过宽/角度不对 */
window.isMcSporeBlossomItemId = function(id) {
    const n = String(id || '').toLowerCase().replace(/-/g, '_');
    return n === 'spore_blossom';
};

window.sporeBlossomWikiImageUrlForItem = function(itemId, wikiHost) {
    const host = wikiHost || 'zh.minecraft.wiki';
    return `https://${host}/images/Spore_Blossom_JE1.png`;
};

window.sporeBlossomWikiImageUrlsForItem = function(itemId) {
    const base = TextureConfig.getBasePath();
    return [
        `/assets/spore-blossom-invicons/Spore_Blossom_JE1.png`,
        window.sporeBlossomWikiImageUrlForItem(itemId, 'zh.minecraft.wiki'),
        window.sporeBlossomWikiImageUrlForItem(itemId, 'minecraft.wiki'),
        `${base}/block/spore_blossom.png`,
        `${base}/item/barrier.png`
    ];
};

/** 潮涌核心：使用 Wiki 物品栏渲染图，避免本地 cube_all 模型被当完整方块渲染 */
window.isMcConduitItemId = function(id) {
    const n = String(id || '').toLowerCase().replace(/-/g, '_');
    return n === 'conduit';
};

window.conduitWikiImageUrlForItem = function(itemId, wikiHost) {
    const host = wikiHost || 'zh.minecraft.wiki';
    return `https://${host}/images/Conduit_JE1_BE1.png`;
};

window.conduitWikiImageUrlsForItem = function(itemId) {
    const base = TextureConfig.getBasePath();
    return [
        window.conduitWikiImageUrlForItem(itemId, 'zh.minecraft.wiki'),
        window.conduitWikiImageUrlForItem(itemId, 'minecraft.wiki'),
        `${base}/block/conduit.png`,
        `${base}/item/barrier.png`
    ];
};

/** 干涸恶魂：使用 Wiki 脱水帧渲染图，并按商店朝向左右镜像 */
window.isMcDriedGhastItemId = function(id) {
    const n = String(id || '').toLowerCase().replace(/-/g, '_');
    return n === 'dried_ghast';
};

window.driedGhastWikiImageUrlForItem = function(itemId, wikiHost) {
    const host = wikiHost || 'zh.minecraft.wiki';
    return `https://${host}/images/Dried_Ghast_Rehydration_0_%28S%29_JE1_BE1.png`;
};

window.driedGhastWikiImageUrlsForItem = function(itemId) {
    const base = TextureConfig.getBasePath();
    return [
        window.driedGhastWikiImageUrlForItem(itemId, 'zh.minecraft.wiki'),
        window.driedGhastWikiImageUrlForItem(itemId, 'minecraft.wiki'),
        `${base}/block/dried_ghast.png`,
        `${base}/item/barrier.png`
    ];
};

window.applyDriedGhastImgMirror = function(img) {
    if (!img) return;
    const src = String(img.currentSrc || img.src || '');
    if (/minecraft\.wiki/i.test(src) && src.indexOf('Dried_Ghast_Rehydration_0_') !== -1) {
        img.style.transform = 'scaleX(-1)';
        return;
    }
    img.style.transform = '';
};

/** 沉重核心：使用 Wiki 物品栏渲染图，避免特殊方块被普通 3D 方块模型处理 */
window.isMcHeavyCoreItemId = function(id) {
    const n = String(id || '').toLowerCase().replace(/-/g, '_');
    return n === 'heavy_core';
};

window.heavyCoreWikiImageUrlForItem = function(itemId, wikiHost) {
    const host = wikiHost || 'zh.minecraft.wiki';
    return `https://${host}/images/Heavy_Core_JE1_BE1.png`;
};

window.heavyCoreWikiImageUrlsForItem = function(itemId) {
    const base = TextureConfig.getBasePath();
    return [
        window.heavyCoreWikiImageUrlForItem(itemId, 'zh.minecraft.wiki'),
        window.heavyCoreWikiImageUrlForItem(itemId, 'minecraft.wiki'),
        `${base}/block/heavy_core.png`,
        `${base}/item/barrier.png`
    ];
};

/** 头颅类（template_skull 为 builtin/entity），商店图标改用 Wiki 2D 渲染图 */
window.isMcHeadItemId = function(id) {
    const n = String(id || '').toLowerCase().replace(/-/g, '_');
    return n === 'skeleton_skull'
        || n === 'wither_skeleton_skull'
        || n === 'zombie_head'
        || n === 'creeper_head'
        || n === 'dragon_head'
        || n === 'piglin_head'
        || n === 'player_head';
};

window.headWikiKeyFromItemId = function(itemId) {
    const n = String(itemId || '').toLowerCase().replace(/-/g, '_');
    const map = {
        skeleton_skull: 'Skeleton_Skull_JE2_BE2',
        wither_skeleton_skull: 'Wither_Skeleton_Skull_JE2_BE2',
        zombie_head: 'Zombie_Head_JE2_BE2',
        creeper_head: 'Creeper_Head_JE1_BE1',
        dragon_head: 'Dragon_Head_JE1_BE1',
        piglin_head: 'Piglin_Head_JE1_BE1',
        player_head: 'Player_Head_JE2_BE2'
    };
    return map[n] || map.skeleton_skull;
};

window.headWikiImageUrlForItem = function(itemId, wikiHost) {
    const host = wikiHost || 'zh.minecraft.wiki';
    return `https://${host}/images/${window.headWikiKeyFromItemId(itemId)}.png`;
};

window.headFallbackTextureUrl = function(itemId) {
    const base = TextureConfig.getBasePath();
    const n = String(itemId || '').toLowerCase().replace(/-/g, '_');
    const map = {
        skeleton_skull: 'entity/skeleton/skeleton',
        wither_skeleton_skull: 'entity/skeleton/wither_skeleton',
        zombie_head: 'entity/zombie/zombie',
        creeper_head: 'entity/creeper/creeper',
        dragon_head: 'entity/enderdragon/dragon',
        piglin_head: 'entity/piglin/piglin',
        player_head: 'entity/player/wide/steve'
    };
    return `${base}/${map[n] || map.skeleton_skull}.png`;
};

window.headWikiImageUrlsForItem = function(itemId) {
    return [
        window.headWikiImageUrlForItem(itemId, 'zh.minecraft.wiki'),
        window.headWikiImageUrlForItem(itemId, 'minecraft.wiki'),
        window.headFallbackTextureUrl(itemId),
        `${TextureConfig.getBasePath()}/item/barrier.png`
    ];
};

window.applyHeadImgMirror = function(img) {
    if (!img) return;
    const src = String(img.currentSrc || img.src || '');
    if (/minecraft\.wiki/i.test(src)) {
        img.style.transform = 'scaleX(-1)';
        return;
    }
    img.style.transform = '';
};

/** 藤类、根须类植物：物品栏统一 2D，部分 ID 的贴图名与物品 ID 不一致 */
window.isMcVineOrRootPlantItemId = function(id) {
    const n = String(id || '').toLowerCase().replace(/-/g, '_');
    if (n === 'muddy_mangrove_roots') return false;
    return n === 'vine'
        || n === 'glow_lichen'
        || n === 'pale_hanging_moss'
        || n.endsWith('_vines')
        || n.endsWith('_roots')
        || n === 'nether_sprouts';
};

window.vineOrRootPlantTextureRefFromItemId = function(itemId) {
    const n = String(itemId || '').toLowerCase().replace(/-/g, '_');
    const map = {
        twisting_vines: 'block/twisting_vines_plant',
        weeping_vines: 'block/weeping_vines_plant',
        nether_sprouts: 'item/nether_sprouts'
    };
    return map[n] || `block/${n}`;
};

window.vineOrRootPlantTextureUrlsForItem = function(itemId) {
    const base = TextureConfig.getBasePath();
    const ref = window.vineOrRootPlantTextureRefFromItemId(itemId);
    return [
        `${base}/${ref}.png`,
        `${base}/block/${window.getSmartId(itemId)}.png`,
        `${base}/item/${window.getSmartId(itemId)}.png`,
        `${base}/item/barrier.png`
    ];
};

/** 双高草本：物品模型使用 *_top，而不是 block/{id}.png */
window.isMcDoubleTallPlantItemId = function(id) {
    const n = String(id || '').toLowerCase().replace(/-/g, '_');
    return n === 'large_fern' || n === 'tall_grass' || n === 'tall_seagrass';
};

window.doubleTallPlantTextureUrlsForItem = function(itemId) {
    const base = TextureConfig.getBasePath();
    const n = String(itemId || '').toLowerCase().replace(/-/g, '_');
    const top = `${base}/block/${n}_top.png`;
    const bottom = `${base}/block/${n}_bottom.png`;
    return [top, bottom, `${base}/item/barrier.png`];
};

/**
 * 箱子方块（special chest；商店图标用 Wiki JE 渲染图）
 * 排除胸甲、运输船、矿车箱。涂蜡铜箱与不涂蜡共用材质。
 */
window.isMcChestBlockItemId = function(id) {
    let n = String(id || '').toLowerCase().replace(/-/g, '_');
    if (n.startsWith('waxed_')) n = n.slice(6);
    if (n === 'chest_minecart' || n.endsWith('_chest_boat') || n.endsWith('_chestplate')) return false;
    if (n === 'chest' || n === 'trapped_chest' || n === 'ender_chest') return true;
    return /^(exposed_|weathered_|oxidized_)?copper_chest$/.test(n);
};

/** 本地回退与 Wiki 键：chest / trapped / ender / copper / exposed / weathered / oxidized */
window.chestWikiVariantFromItemId = function(itemId) {
    let n = String(itemId || '').toLowerCase().replace(/-/g, '_');
    if (n.startsWith('waxed_')) n = n.slice(6);
    if (n === 'chest') return 'chest';
    if (n === 'trapped_chest') return 'trapped';
    if (n === 'ender_chest') return 'ender';
    if (n === 'copper_chest') return 'copper';
    if (n === 'exposed_copper_chest') return 'exposed';
    if (n === 'weathered_copper_chest') return 'weathered';
    if (n === 'oxidized_copper_chest') return 'oxidized';
    return 'chest';
};

window.chestWikiJeFilename = function(variant) {
    const map = {
        chest: 'Chest_JE2_BE3.gif',
        trapped: 'Trapped_Chest_JE1_BE1.gif',
        ender: 'Ender_Chest.gif',
        copper: 'Copper_Chest_(S)_JE2.png',
        exposed: 'Exposed_Copper_Chest_(S)_JE2.png',
        weathered: 'Weathered_Copper_Chest_(S)_JE2.png',
        oxidized: 'Oxidized_Copper_Chest_(S)_JE2.png'
    };
    return map[variant] || map.chest;
};

window.chestWikiImageUrlForItem = function(itemId, wikiHost) {
    const variant = window.chestWikiVariantFromItemId(itemId);
    const file = window.chestWikiJeFilename(variant);
    const host = wikiHost || 'zh.minecraft.wiki';
    return `https://${host}/images/${file}`;
};

/** items/*.json 中 minecraft:chest 的 texture 键 → entity/chest 文件名（2D 回退） */
window.chestEntityTextureKeyFromItemId = function(itemId) {
    const v = window.chestWikiVariantFromItemId(itemId);
    if (v === 'chest') return 'normal';
    if (v === 'trapped') return 'trapped';
    if (v === 'ender') return 'ender';
    if (v === 'copper') return 'copper';
    if (v === 'exposed') return 'copper_exposed';
    if (v === 'weathered') return 'copper_weathered';
    if (v === 'oxidized') return 'copper_oxidized';
    return 'normal';
};

window.chestEntityTextureUrl = function(itemId) {
    const key = window.chestEntityTextureKeyFromItemId(itemId);
    return `${TextureConfig.getBasePath()}/entity/chest/${key}.png`;
};

window.chestLocalKeyFromItemId = function(itemId) {
    return window.chestWikiVariantFromItemId(itemId);
};

window.chestLocalAssetName = function(variant) {
    const file = window.chestWikiJeFilename(variant);
    return file;
};

window.chestWikiImageUrlsForItem = function(itemId) {
    const variant = window.chestWikiVariantFromItemId(itemId);
    const localFile = window.chestWikiJeFilename(variant);
    return [
        `/assets/chest-invicons/${localFile}`,
        window.chestWikiImageUrlForItem(itemId, 'zh.minecraft.wiki'),
        window.chestWikiImageUrlForItem(itemId, 'minecraft.wiki'),
        window.chestEntityTextureUrl(itemId),
        `${TextureConfig.getBasePath()}/item/barrier.png`
    ];
};

/** Wiki JE 图为游戏左右镜像；本地 assets 图应为游戏朝向，勿翻转 */
window.applyChestImgMirror = function(img) {
    if (!img) return;
    const src = String(img.currentSrc || img.src || '');
    if (src.indexOf('/assets/chest-invicons/') !== -1) {
        img.style.transform = '';
        return;
    }
    if (/minecraft\.wiki/i.test(src) || src.indexOf('/entity/chest/') !== -1) {
        img.style.transform = 'scaleX(-1)';
        return;
    }
    img.style.transform = '';
};

/** 潜影盒（special shulker_box；商店图标用 Wiki JE 渲染图） */
window.isMcShulkerBoxItemId = function(id) {
    const n = String(id || '').toLowerCase().replace(/-/g, '_');
    return n === 'shulker_box' || n.endsWith('_shulker_box');
};

window.shulkerBoxSpriteFromItemId = function(itemId) {
    const n = String(itemId || '').toLowerCase().replace(/-/g, '_');
    if (n === 'shulker_box') return 'shulker';
    if (n.endsWith('_shulker_box')) {
        const color = n.slice(0, -12);
        return color ? `shulker_${color}` : 'shulker';
    }
    return 'shulker';
};

window.shulkerBoxLocalKeyFromItemId = function(itemId) {
    const n = String(itemId || '').toLowerCase().replace(/-/g, '_');
    if (n === 'shulker_box') return 'shulker';
    if (n.endsWith('_shulker_box')) {
        const color = n.slice(0, -12);
        return color || 'shulker';
    }
    return 'shulker';
};

window.shulkerBoxAtlasTextureUrl = function(itemId) {
    const sprite = window.shulkerBoxSpriteFromItemId(itemId);
    return `${TextureConfig.getBasePath()}/entity/shulker/${sprite}.png`;
};

/** Wiki：未染色 Shulker_Box_JE1_BE1；有色 {Color}_Shulker_Box_JE2_BE2 */
window.shulkerBoxWikiJeFilenameFromItemId = function(itemId) {
    const n = String(itemId || '').toLowerCase().replace(/-/g, '_');
    if (n === 'shulker_box') return 'Shulker_Box_JE1_BE1';
    if (n.endsWith('_shulker_box')) {
        const color = n.slice(0, -12);
        const titled = color.split('_').map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join('_');
        return `${titled}_Shulker_Box_JE2_BE2`;
    }
    return 'Shulker_Box_JE1_BE1';
};

window.shulkerBoxWikiImageUrlForItem = function(itemId, wikiHost) {
    const file = window.shulkerBoxWikiJeFilenameFromItemId(itemId);
    const host = wikiHost || 'zh.minecraft.wiki';
    return `https://${host}/images/${file}.png`;
};

window.shulkerBoxWikiImageUrlsForItem = function(itemId) {
    const key = window.shulkerBoxLocalKeyFromItemId(itemId);
    return [
        `/assets/shulker-box-invicons/${key}.png`,
        window.shulkerBoxWikiImageUrlForItem(itemId, 'zh.minecraft.wiki'),
        window.shulkerBoxWikiImageUrlForItem(itemId, 'minecraft.wiki'),
        window.shulkerBoxAtlasTextureUrl(itemId),
        `${TextureConfig.getBasePath()}/item/barrier.png`
    ];
};

/** 铜傀儡像（special copper_golem_statue，贴图在 entity/copper_golem/） */
window.isMcCopperGolemStatueItemId = function(id) {
    const n = String(id || '').toLowerCase().replace(/-/g, '_');
    return n === 'copper_golem_statue' || n.endsWith('_copper_golem_statue');
};

window.copperGolemStatueOxidationFromItemId = function(itemId) {
    let n = String(itemId || '').toLowerCase().replace(/-/g, '_');
    if (n.startsWith('waxed_')) n = n.slice(6);
    if (n === 'copper_golem_statue') return 'copper';
    if (n.startsWith('exposed_')) return 'exposed';
    if (n.startsWith('weathered_')) return 'weathered';
    if (n.startsWith('oxidized_')) return 'oxidized';
    return 'copper';
};

window.copperGolemStatueTextureUrl = function(itemId) {
    const basePath = TextureConfig.getBasePath();
    const o = window.copperGolemStatueOxidationFromItemId(itemId);
    const file = o === 'copper' ? 'copper_golem.png' : `copper_golem_${o}.png`;
    return `${basePath}/entity/copper_golem/${file}`;
};

window.copperGolemStatueLocalKeyFromItemId = function(itemId) {
    return window.copperGolemStatueOxidationFromItemId(itemId);
};

/** Wiki JE1 渲染图（清晰）；仅铜/斑驳/氧化三张，锈蚀暂同斑驳 */
window.copperGolemStatueWikiJeFilename = function(oxidation) {
    const map = {
        copper: 'Copper_Golem_Statue_JE1',
        exposed: 'Exposed_Copper_Golem_Statue_JE1',
        weathered: 'Exposed_Copper_Golem_Statue_JE1',
        oxidized: 'Oxidized_Copper_Golem_Statue_JE1'
    };
    return map[oxidation] || map.copper;
};

window.copperGolemStatueWikiImageUrlForItem = function(itemId, wikiHost) {
    const o = window.copperGolemStatueOxidationFromItemId(itemId);
    const file = window.copperGolemStatueWikiJeFilename(o);
    const host = wikiHost || 'zh.minecraft.wiki';
    return `https://${host}/images/${file}.png`;
};

window.copperGolemStatueInviconUrlForItem = window.copperGolemStatueWikiImageUrlForItem;

window.copperGolemStatueInviconUrlsForItem = function(itemId) {
    const key = window.copperGolemStatueLocalKeyFromItemId(itemId);
    return [
        `/assets/copper-golem-statue-invicons/${key}.png`,
        window.copperGolemStatueWikiImageUrlForItem(itemId, 'zh.minecraft.wiki'),
        window.copperGolemStatueWikiImageUrlForItem(itemId, 'minecraft.wiki'),
        window.copperGolemStatueTextureUrl(itemId),
        `${TextureConfig.getBasePath()}/item/barrier.png`
    ];
};

/** Wiki JE1 为游戏左右镜像；本地 assets 图应为游戏朝向，勿翻转 */
window.applyCopperGolemStatueImgMirror = function(img) {
    if (!img) return;
    const src = String(img.currentSrc || img.src || '');
    if (src.indexOf('/assets/copper-golem-statue-invicons/') !== -1) {
        img.style.transform = '';
        return;
    }
    if (src.indexOf('_JE1.png') !== -1 || /minecraft\.wiki/i.test(src)) {
        img.style.transform = 'scaleX(-1)';
        return;
    }
    img.style.transform = '';
};

/** 蜡烛（非插蛋糕上的）：物品栏有独立 item/*_candle.png，勿用 block 方块贴图 */
window.isMcCandleItemId = function(id) {
    const n = String(id || '').toLowerCase().replace(/-/g, '_');
    if (n === 'candle') return true;
    return /_candle$/.test(n) && !/_candle_cake$/.test(n);
};

/** 旗帜（template_banner / banner 特殊模型）；不含 *_banner_pattern */
window.isMcBannerItemId = function(id) {
    const n = String(id || '').toLowerCase().replace(/-/g, '_');
    if (n === 'banner') return true;
    return /_banner$/.test(n) && !/_banner_pattern$/.test(n);
};

window.bannerLocalKeyFromItemId = function(itemId) {
    const n = String(itemId || '').toLowerCase().replace(/-/g, '_');
    if (n === 'banner' || n === 'white_banner') return 'banner';
    if (n.endsWith('_banner')) return n.slice(0, -7);
    return n;
};

/** Wiki：白旗 Invicon_Banner.png；有色 Invicon_Light_Gray_Banner.png 等 */
window.bannerInviconTitleFromItemId = function(itemId) {
    const n = String(itemId || '').toLowerCase().replace(/-/g, '_');
    if (n === 'banner' || n === 'white_banner') return 'Banner';
    const color = n.endsWith('_banner') ? n.slice(0, -7) : n;
    const titled = color.split('_').map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join('_');
    return `${titled}_Banner`;
};

window.bannerInviconUrlForItem = function(itemId, wikiHost) {
    const title = window.bannerInviconTitleFromItemId(itemId);
    const host = wikiHost || 'zh.minecraft.wiki';
    return `https://${host}/images/Invicon_${title}.png`;
};

window.bannerInviconUrlsForItem = function(itemId) {
    const basePath = TextureConfig.getBasePath();
    const key = window.bannerLocalKeyFromItemId(itemId);
    const smartId = window.getSmartId(itemId);
    return [
        `/assets/banner-invicons/${key}.png`,
        window.bannerInviconUrlForItem(itemId, 'zh.minecraft.wiki'),
        window.bannerInviconUrlForItem(itemId, 'minecraft.wiki'),
        `${basePath}/item/${smartId}.png`,
        `${basePath}/item/barrier.png`
    ];
};

/** 各色床（item/template_bed → builtin/entity，贴图在 entity/bed/） */
window.isMcBedItemId = function(id) {
    const n = String(id || '').toLowerCase().replace(/-/g, '_');
    if (n === 'bedrock') return false;
    if (n.startsWith('flower_bed')) return false;
    return /_bed$/.test(n);
};

window.bedWoolColorFromItemId = function(itemId) {
    const n = String(itemId || '').toLowerCase().replace(/-/g, '_');
    if (n.endsWith('_bed')) return n.slice(0, -4);
    return 'red';
};

/** Minecraft Wiki Invicon 床图标（与 Invicon_White_Bed.png 等同命名） */
window.bedInviconTitleFromItemId = function(itemId) {
    const color = window.bedWoolColorFromItemId(itemId);
    return color.split('_').map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join('_');
};

window.bedInviconUrlForItem = function(itemId, wikiHost) {
    const title = window.bedInviconTitleFromItemId(itemId);
    const host = wikiHost || 'zh.minecraft.wiki';
    return `https://${host}/images/Invicon_${title}_Bed.png`;
};

/** 床图标 URL 链：本地 Invicon → 中文 Wiki → 英文 Wiki → entity 贴图 → barrier */
window.bedInviconUrlsForItem = function(itemId) {
    const basePath = TextureConfig.getBasePath();
    const color = window.bedWoolColorFromItemId(itemId);
    return [
        `/assets/bed-invicons/${color}.png`,
        window.bedInviconUrlForItem(itemId, 'zh.minecraft.wiki'),
        window.bedInviconUrlForItem(itemId, 'minecraft.wiki'),
        `${basePath}/entity/bed/${color}.png`,
        `${basePath}/item/barrier.png`
    ];
};

/** 床/旗等 Wiki Invicon：<img> 直链，避免 canvas + crossOrigin 因 CORS 失败 */
window.initMcWikiInviconImages = function(root) {
    if (!root) return;
    root.querySelectorAll('img.item-mc-wiki-invicon').forEach((img) => {
        if (img.dataset.texReady === '1') return;
        const urls = (img.dataset.texUrls || '').split('|').filter(Boolean);
        if (!urls.length) return;
        let idx = 0;
        const itemId = img.dataset.itemId || '';
        const loadNext = () => {
            if (idx >= urls.length) return;
            img.src = urls[idx];
            idx += 1;
        };
        img.onerror = loadNext;
        img.onload = () => {
            if (window.applyChestImgMirror
                && window.isMcChestBlockItemId
                && window.isMcChestBlockItemId(itemId)) {
                window.applyChestImgMirror(img);
            } else if (window.applyCopperGolemStatueImgMirror
                && window.isMcCopperGolemStatueItemId
                && window.isMcCopperGolemStatueItemId(itemId)) {
                window.applyCopperGolemStatueImgMirror(img);
            } else if (window.applyHeadImgMirror
                && window.isMcHeadItemId
                && window.isMcHeadItemId(itemId)) {
                window.applyHeadImgMirror(img);
            } else if (window.applyDriedGhastImgMirror
                && window.isMcDriedGhastItemId
                && window.isMcDriedGhastItemId(itemId)) {
                window.applyDriedGhastImgMirror(img);
            }
            img.dataset.texReady = '1';
            img.style.opacity = '1';
            if (itemId) window.markAsLoaded(img, itemId);
        };
        idx = 0;
        loadNext();
    });
};
window.initBedInviconImages = window.initMcWikiInviconImages;

window.handleTextureError = function(imgElement, originalId) {
    const basePath = TextureConfig.getBasePath();
    const smartId = window.getSmartId(originalId);

    if (!imgElement.dataset.step) imgElement.dataset.step = "1";
    const step = parseInt(imgElement.dataset.step);

    if (window.isMcBedItemId && window.isMcBedItemId(originalId)) {
        if (step === 1) {
            imgElement.dataset.step = "2";
            imgElement.src = window.bedInviconUrlForItem(originalId, 'minecraft.wiki');
        } else if (step === 2) {
            imgElement.dataset.step = "3";
            const color = window.bedWoolColorFromItemId(originalId);
            imgElement.src = `${basePath}/entity/bed/${color}.png`;
        } else if (step === 3) {
            imgElement.dataset.step = "4";
            imgElement.src = `${basePath}/item/barrier.png`;
        }
        return;
    }

    if (window.isMcCandleItemId && window.isMcCandleItemId(originalId)) {
        if (step === 1) {
            imgElement.dataset.step = "2";
            imgElement.src = `${basePath}/item/barrier.png`;
        }
        return;
    }

    if (window.isMcBannerItemId && window.isMcBannerItemId(originalId)) {
        if (step === 1) {
            imgElement.dataset.step = "2";
            imgElement.src = window.bannerInviconUrlForItem(originalId, 'minecraft.wiki');
        } else if (step === 2) {
            imgElement.dataset.step = "3";
            imgElement.src = `${basePath}/item/${smartId}.png`;
        } else if (step === 3) {
            imgElement.dataset.step = "4";
            imgElement.src = `${basePath}/item/barrier.png`;
        }
        return;
    }

    if (window.isMcCopperGolemStatueItemId && window.isMcCopperGolemStatueItemId(originalId)) {
        if (step === 1) {
            imgElement.dataset.step = "2";
            imgElement.src = window.copperGolemStatueWikiImageUrlForItem(originalId, 'minecraft.wiki');
        } else if (step === 2) {
            imgElement.dataset.step = "3";
            imgElement.src = window.copperGolemStatueTextureUrl(originalId);
        } else if (step === 3) {
            imgElement.dataset.step = "4";
            imgElement.src = `${basePath}/item/barrier.png`;
        }
        return;
    }

    if (window.isMcShulkerBoxItemId && window.isMcShulkerBoxItemId(originalId)) {
        if (step === 1) {
            imgElement.dataset.step = "2";
            imgElement.src = window.shulkerBoxWikiImageUrlForItem(originalId, 'minecraft.wiki');
        } else if (step === 2) {
            imgElement.dataset.step = "3";
            imgElement.src = window.shulkerBoxAtlasTextureUrl(originalId);
        } else if (step === 3) {
            imgElement.dataset.step = "4";
            imgElement.src = `${basePath}/item/barrier.png`;
        }
        return;
    }

    if (window.isMcHeadItemId && window.isMcHeadItemId(originalId)) {
        if (step === 1) {
            imgElement.dataset.step = "2";
            imgElement.src = window.headWikiImageUrlForItem(originalId, 'minecraft.wiki');
        } else if (step === 2) {
            imgElement.dataset.step = "3";
            imgElement.src = window.headFallbackTextureUrl(originalId);
            if (window.applyHeadImgMirror) window.applyHeadImgMirror(imgElement);
        } else if (step === 3) {
            imgElement.dataset.step = "4";
            imgElement.src = `${basePath}/item/barrier.png`;
            imgElement.style.transform = '';
        }
        return;
    }

    if (window.isMcShieldItemId && window.isMcShieldItemId(originalId)) {
        if (step === 1) {
            imgElement.dataset.step = "2";
            imgElement.src = window.shieldInviconUrlForItem(originalId, 'minecraft.wiki');
        } else if (step === 2) {
            imgElement.dataset.step = "3";
            imgElement.src = `${basePath}/item/barrier.png`;
        }
        return;
    }

    if (window.isMcSporeBlossomItemId && window.isMcSporeBlossomItemId(originalId)) {
        if (step === 1) {
            imgElement.dataset.step = "2";
            imgElement.src = window.sporeBlossomWikiImageUrlForItem(originalId, 'minecraft.wiki');
        } else if (step === 2) {
            imgElement.dataset.step = "3";
            imgElement.src = `${basePath}/block/spore_blossom.png`;
        } else if (step === 3) {
            imgElement.dataset.step = "4";
            imgElement.src = `${basePath}/item/barrier.png`;
        }
        return;
    }

    if (window.isMcChestBlockItemId && window.isMcChestBlockItemId(originalId)) {
        if (step === 1) {
            imgElement.dataset.step = "2";
            imgElement.src = window.chestWikiImageUrlForItem(originalId, 'minecraft.wiki');
        } else if (step === 2) {
            imgElement.dataset.step = "3";
            imgElement.src = window.chestEntityTextureUrl(originalId);
            if (window.applyChestImgMirror) window.applyChestImgMirror(imgElement);
        } else if (step === 3) {
            imgElement.dataset.step = "4";
            imgElement.src = `${basePath}/item/barrier.png`;
            imgElement.style.transform = '';
        }
        return;
    }

    if (step === 1) {
        imgElement.dataset.step = "2";
        imgElement.src = `${basePath}/block/${smartId}.png`;
    } else if (step === 2) {
        imgElement.dataset.step = "3";
        imgElement.src = `${basePath}/item/${smartId}.png`;
    } else if (step === 3) {
        imgElement.dataset.step = "4";
        imgElement.src = `${basePath}/item/barrier.png`;
    }
};

window.markAsLoaded = function(el, itemId) {
    window.LoadedTextureCache.add(itemId);
    if (el && el.style) {
        el.style.opacity = 1;
    }
};

window.getTextureHtml = function(itemId, itemName) {
    const texUrls = window.flatTextureUrlsForItem(itemId).join('|');
    const safeId = String(itemId).replace(/"/g, '&quot;');
    const safeName = String(itemName || itemId).replace(/"/g, '&quot;');
    const isCached = window.LoadedTextureCache.has(itemId);
    const initialOpacity = isCached ? 1 : 0;
    const transitionStyle = isCached ? 'none' : 'opacity 0.3s ease';

    const cfg = window.McIconConfig;
    const glintHtml = window.McEnchantGlint && window.McEnchantGlint.itemHasGlint(itemId)
        ? window.McEnchantGlint.glintOverlayHtml()
        : '';
    if (window.isMcBedItemId && window.isMcBedItemId(itemId)) {
        return `
        <span class="item-icon-mount" data-item-id="${safeId}" data-item-name="${safeName}"
            style="width:${cfg.ICON_PX}px; height:${cfg.ICON_PX}px; margin-right:${cfg.ICON_GAP_RIGHT}px; display:inline-flex; align-items:center; justify-content:center; background: rgba(255,255,255,0.03); border-radius:4px; flex-shrink: 0; position:relative;">
            <img class="item-mc-wiki-invicon" data-tex-urls="${texUrls}" data-item-id="${safeId}" alt=""
                style="width:${cfg.ICON_PX}px; height:${cfg.ICON_PX}px; image-rendering:pixelated; object-fit:contain; opacity: ${initialOpacity}; transition: ${transitionStyle}; display:block;"
                title="${safeName}" referrerpolicy="no-referrer" />
            ${glintHtml}
        </span>
    `;
    }
    if (window.isMcBannerItemId && window.isMcBannerItemId(itemId)) {
        return `
        <span class="item-icon-mount" data-item-id="${safeId}" data-item-name="${safeName}"
            style="width:${cfg.ICON_PX}px; height:${cfg.ICON_PX}px; margin-right:${cfg.ICON_GAP_RIGHT}px; display:inline-flex; align-items:center; justify-content:center; background: rgba(255,255,255,0.03); border-radius:4px; flex-shrink: 0; position:relative;">
            <img class="item-mc-wiki-invicon" data-tex-urls="${texUrls}" data-item-id="${safeId}" alt=""
                style="width:${cfg.ICON_PX}px; height:${cfg.ICON_PX}px; image-rendering:pixelated; object-fit:contain; opacity: ${initialOpacity}; transition: ${transitionStyle}; display:block;"
                title="${safeName}" referrerpolicy="no-referrer" />
            ${glintHtml}
        </span>
    `;
    }
    if (window.isMcCopperGolemStatueItemId && window.isMcCopperGolemStatueItemId(itemId)) {
        return `
        <span class="item-icon-mount" data-item-id="${safeId}" data-item-name="${safeName}"
            style="width:${cfg.ICON_PX}px; height:${cfg.ICON_PX}px; margin-right:${cfg.ICON_GAP_RIGHT}px; display:inline-flex; align-items:center; justify-content:center; background: rgba(255,255,255,0.03); border-radius:4px; flex-shrink: 0; position:relative;">
            <img class="item-mc-wiki-invicon item-copper-golem-statue-wiki" data-tex-urls="${texUrls}" data-item-id="${safeId}" alt=""
                style="width:${cfg.ICON_PX}px; height:${cfg.ICON_PX}px; image-rendering:pixelated; object-fit:contain; opacity: ${initialOpacity}; transition: ${transitionStyle}; display:block;"
                title="${safeName}" referrerpolicy="no-referrer" />
            ${glintHtml}
        </span>
    `;
    }
    if (window.isMcDecoratedPotItemId && window.isMcDecoratedPotItemId(itemId)) {
        return `
        <span class="item-icon-mount" data-item-id="${safeId}" data-item-name="${safeName}"
            style="width:${cfg.ICON_PX}px; height:${cfg.ICON_PX}px; margin-right:${cfg.ICON_GAP_RIGHT}px; display:inline-flex; align-items:center; justify-content:center; background: rgba(255,255,255,0.03); border-radius:4px; flex-shrink: 0; position:relative;">
            <img class="item-mc-wiki-invicon" data-tex-urls="${texUrls}" data-item-id="${safeId}" alt=""
                style="width:${cfg.ICON_PX}px; height:${cfg.ICON_PX}px; image-rendering:pixelated; object-fit:contain; opacity: ${initialOpacity}; transition: ${transitionStyle}; display:block;"
                title="${safeName}" referrerpolicy="no-referrer" />
            ${glintHtml}
        </span>
    `;
    }
    if (window.isMcShulkerBoxItemId && window.isMcShulkerBoxItemId(itemId)) {
        return `
        <span class="item-icon-mount" data-item-id="${safeId}" data-item-name="${safeName}"
            style="width:${cfg.ICON_PX}px; height:${cfg.ICON_PX}px; margin-right:${cfg.ICON_GAP_RIGHT}px; display:inline-flex; align-items:center; justify-content:center; background: rgba(255,255,255,0.03); border-radius:4px; flex-shrink: 0; position:relative;">
            <img class="item-mc-wiki-invicon" data-tex-urls="${texUrls}" data-item-id="${safeId}" alt=""
                style="width:${cfg.ICON_PX}px; height:${cfg.ICON_PX}px; image-rendering:pixelated; object-fit:contain; opacity: ${initialOpacity}; transition: ${transitionStyle}; display:block;"
                title="${safeName}" referrerpolicy="no-referrer" />
            ${glintHtml}
        </span>
    `;
    }
    if (window.isMcSporeBlossomItemId && window.isMcSporeBlossomItemId(itemId)) {
        return `
        <span class="item-icon-mount" data-item-id="${safeId}" data-item-name="${safeName}"
            style="width:${cfg.ICON_PX}px; height:${cfg.ICON_PX}px; margin-right:${cfg.ICON_GAP_RIGHT}px; display:inline-flex; align-items:center; justify-content:center; background: rgba(255,255,255,0.03); border-radius:4px; flex-shrink: 0; position:relative;">
            <img class="item-mc-wiki-invicon" data-tex-urls="${texUrls}" data-item-id="${safeId}" alt=""
                style="width:${cfg.ICON_PX}px; height:${cfg.ICON_PX}px; image-rendering:pixelated; object-fit:contain; opacity: ${initialOpacity}; transition: ${transitionStyle}; display:block;"
                title="${safeName}" referrerpolicy="no-referrer" />
            ${glintHtml}
        </span>
    `;
    }
    if (window.isMcConduitItemId && window.isMcConduitItemId(itemId)) {
        return `
        <span class="item-icon-mount" data-item-id="${safeId}" data-item-name="${safeName}"
            style="width:${cfg.ICON_PX}px; height:${cfg.ICON_PX}px; margin-right:${cfg.ICON_GAP_RIGHT}px; display:inline-flex; align-items:center; justify-content:center; background: rgba(255,255,255,0.03); border-radius:4px; flex-shrink: 0; position:relative;">
            <img class="item-mc-wiki-invicon" data-tex-urls="${texUrls}" data-item-id="${safeId}" alt=""
                style="width:${cfg.ICON_PX}px; height:${cfg.ICON_PX}px; image-rendering:pixelated; object-fit:contain; opacity: ${initialOpacity}; transition: ${transitionStyle}; display:block;"
                title="${safeName}" referrerpolicy="no-referrer" />
            ${glintHtml}
        </span>
    `;
    }
    if (window.isMcDriedGhastItemId && window.isMcDriedGhastItemId(itemId)) {
        return `
        <span class="item-icon-mount" data-item-id="${safeId}" data-item-name="${safeName}"
            style="width:${cfg.ICON_PX}px; height:${cfg.ICON_PX}px; margin-right:${cfg.ICON_GAP_RIGHT}px; display:inline-flex; align-items:center; justify-content:center; background: rgba(255,255,255,0.03); border-radius:4px; flex-shrink: 0; position:relative;">
            <img class="item-mc-wiki-invicon item-dried-ghast-wiki" data-tex-urls="${texUrls}" data-item-id="${safeId}" alt=""
                style="width:${cfg.ICON_PX}px; height:${cfg.ICON_PX}px; image-rendering:pixelated; object-fit:contain; opacity: ${initialOpacity}; transition: ${transitionStyle}; display:block;"
                title="${safeName}" referrerpolicy="no-referrer" />
            ${glintHtml}
        </span>
    `;
    }
    if (window.isMcHeavyCoreItemId && window.isMcHeavyCoreItemId(itemId)) {
        return `
        <span class="item-icon-mount" data-item-id="${safeId}" data-item-name="${safeName}"
            style="width:${cfg.ICON_PX}px; height:${cfg.ICON_PX}px; margin-right:${cfg.ICON_GAP_RIGHT}px; display:inline-flex; align-items:center; justify-content:center; background: rgba(255,255,255,0.03); border-radius:4px; flex-shrink: 0; position:relative;">
            <img class="item-mc-wiki-invicon" data-tex-urls="${texUrls}" data-item-id="${safeId}" alt=""
                style="width:${cfg.ICON_PX}px; height:${cfg.ICON_PX}px; image-rendering:pixelated; object-fit:contain; opacity: ${initialOpacity}; transition: ${transitionStyle}; display:block;"
                title="${safeName}" referrerpolicy="no-referrer" />
            ${glintHtml}
        </span>
    `;
    }
    if (window.isMcHeadItemId && window.isMcHeadItemId(itemId)) {
        return `
        <span class="item-icon-mount" data-item-id="${safeId}" data-item-name="${safeName}"
            style="width:${cfg.ICON_PX}px; height:${cfg.ICON_PX}px; margin-right:${cfg.ICON_GAP_RIGHT}px; display:inline-flex; align-items:center; justify-content:center; background: rgba(255,255,255,0.03); border-radius:4px; flex-shrink: 0; position:relative;">
            <img class="item-mc-wiki-invicon item-head-wiki" data-tex-urls="${texUrls}" data-item-id="${safeId}" alt=""
                style="width:${cfg.ICON_PX}px; height:${cfg.ICON_PX}px; image-rendering:pixelated; object-fit:contain; opacity: ${initialOpacity}; transition: ${transitionStyle}; display:block;"
                title="${safeName}" referrerpolicy="no-referrer" />
            ${glintHtml}
        </span>
    `;
    }
    if (window.isMcShieldItemId && window.isMcShieldItemId(itemId)) {
        return `
        <span class="item-icon-mount" data-item-id="${safeId}" data-item-name="${safeName}"
            style="width:${cfg.ICON_PX}px; height:${cfg.ICON_PX}px; margin-right:${cfg.ICON_GAP_RIGHT}px; display:inline-flex; align-items:center; justify-content:center; background: rgba(255,255,255,0.03); border-radius:4px; flex-shrink: 0; position:relative;">
            <img class="item-mc-wiki-invicon" data-tex-urls="${texUrls}" data-item-id="${safeId}" alt=""
                style="width:${cfg.ICON_PX}px; height:${cfg.ICON_PX}px; image-rendering:pixelated; object-fit:contain; opacity: ${initialOpacity}; transition: ${transitionStyle}; display:block;"
                title="${safeName}" referrerpolicy="no-referrer" />
            ${glintHtml}
        </span>
    `;
    }
    if (window.isMcChestBlockItemId && window.isMcChestBlockItemId(itemId)) {
        return `
        <span class="item-icon-mount" data-item-id="${safeId}" data-item-name="${safeName}"
            style="width:${cfg.ICON_PX}px; height:${cfg.ICON_PX}px; margin-right:${cfg.ICON_GAP_RIGHT}px; display:inline-flex; align-items:center; justify-content:center; background: rgba(255,255,255,0.03); border-radius:4px; flex-shrink: 0; position:relative;">
            <img class="item-mc-wiki-invicon item-chest-wiki" data-tex-urls="${texUrls}" data-item-id="${safeId}" alt=""
                style="width:${cfg.ICON_PX}px; height:${cfg.ICON_PX}px; image-rendering:pixelated; object-fit:contain; opacity: ${initialOpacity}; transition: ${transitionStyle}; display:block;"
                title="${safeName}" referrerpolicy="no-referrer" />
            ${glintHtml}
        </span>
    `;
    }
    return `
        <span class="item-icon-mount" data-item-id="${safeId}" data-item-name="${safeName}"
            style="width:${cfg.ICON_PX}px; height:${cfg.ICON_PX}px; margin-right:${cfg.ICON_GAP_RIGHT}px; display:inline-flex; align-items:center; justify-content:center; background: rgba(255,255,255,0.03); border-radius:4px; flex-shrink: 0; position:relative;">
            <canvas class="item-tex-anim" width="${cfg.RENDER_SIZE}" height="${cfg.RENDER_SIZE}" data-tex-urls="${texUrls}" data-item-id="${safeId}"
                style="width:${cfg.ICON_PX}px; height:${cfg.ICON_PX}px; image-rendering:pixelated; opacity: ${initialOpacity}; transition: ${transitionStyle}; display:block;"
                title="${safeName}"></canvas>
            ${glintHtml}
        </span>
    `;
};
