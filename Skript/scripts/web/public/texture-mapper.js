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

/** 蜡烛（非插蛋糕上的）：物品栏有独立 item/*_candle.png，勿用 block 方块贴图 */
window.isMcCandleItemId = function(id) {
    const n = String(id || '').toLowerCase().replace(/-/g, '_');
    if (n === 'candle') return true;
    return /_candle$/.test(n) && !/_candle_cake$/.test(n);
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

/** 床用 <img> 直链 Wiki，避免 canvas + crossOrigin 因 CORS 无法绘制 */
window.initBedInviconImages = function(root) {
    if (!root) return;
    root.querySelectorAll('img.item-bed-invicon').forEach((img) => {
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
            img.dataset.texReady = '1';
            img.style.opacity = '1';
            if (itemId) window.markAsLoaded(img, itemId);
        };
        idx = 0;
        loadNext();
    });
};

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
            <img class="item-bed-invicon" data-tex-urls="${texUrls}" data-item-id="${safeId}" alt=""
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
