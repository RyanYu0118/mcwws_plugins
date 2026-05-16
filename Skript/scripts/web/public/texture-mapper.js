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
    if (rawId.startsWith('potion')) return 'potion';
    if (rawId.startsWith('lingering_potion')) return 'lingering_potion';
    if (rawId.startsWith('splash_potion')) return 'splash_potion';
    if (rawId.startsWith('arrow_of_')) return 'tipped_arrow';
    // 玻璃板无独立贴图，沿用对应玻璃方块的平面材质（block/glass.png 等）
    if (rawId === 'glass_pane') return 'glass';
    if (rawId.endsWith('_glass_pane')) return rawId.replace(/_glass_pane$/, '_glass');
    return rawId;
};

/** 2D 图标贴图 URL 列表（玻璃板仅 block，避免误请求 item/glass_pane 等） */
window.flatTextureUrlsForItem = function(itemId) {
    const base = TextureConfig.getBasePath();
    const smartId = window.getSmartId(itemId);
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
    if (window.isMcShulkerBoxItemId && window.isMcShulkerBoxItemId(itemId)) {
        return window.shulkerBoxWikiImageUrlsForItem(itemId);
    }
    if (window.isMcCandleItemId && window.isMcCandleItemId(itemId)) {
        return [`${base}/item/${smartId}.png`, `${base}/item/barrier.png`];
    }
    return [`${base}/block/${smartId}.png`, `${base}/item/${smartId}.png`];
};

/** 玻璃板（非玻璃瓶）：物品栏 2D，贴图由 getSmartId 映射到 glass / *_stained_glass */
window.isMcGlassPaneItemId = function(id) {
    const n = String(id || '').toLowerCase().replace(/-/g, '_');
    if (n === 'glass_pane') return true;
    return n.endsWith('_glass_pane') && !n.endsWith('glass_bottle');
};

/** 木门等（非活板门）：物品栏用 2D 平面，绘制时不加 FLAT_PAD（与先前 3D 满幅一致） */
window.isMcDoorItemId = function(id) {
    const n = String(id || '').toLowerCase().replace(/-/g, '_');
    return n.endsWith('_door') && !n.endsWith('_trapdoor');
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
            if (window.applyCopperGolemStatueImgMirror
                && window.isMcCopperGolemStatueItemId
                && window.isMcCopperGolemStatueItemId(itemId)) {
                window.applyCopperGolemStatueImgMirror(img);
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
