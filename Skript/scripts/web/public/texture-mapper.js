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

window.getSmartId = function(id) {
    const rawId = id.toLowerCase();
    if (rawId.startsWith('enchanted_book')) return 'enchanted_book';
    if (rawId.startsWith('potion')) return 'potion';
    if (rawId.startsWith('lingering_potion')) return 'lingering_potion';
    if (rawId.startsWith('splash_potion')) return 'splash_potion';
    if (rawId.startsWith('arrow_of_')) return 'tipped_arrow';
    return rawId;
};

window.handleTextureError = function(imgElement, originalId) {
    const basePath = TextureConfig.getBasePath();
    const smartId = window.getSmartId(originalId);

    if (!imgElement.dataset.step) imgElement.dataset.step = "1";
    const step = parseInt(imgElement.dataset.step);

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
    const smartId = window.getSmartId(itemId);
    const base = TextureConfig.getBasePath();
    const texUrls = [
        `${base}/block/${smartId}.png`,
        `${base}/item/${smartId}.png`
    ].join('|');
    const safeId = String(itemId).replace(/"/g, '&quot;');
    const safeName = String(itemName || itemId).replace(/"/g, '&quot;');
    const isCached = window.LoadedTextureCache.has(itemId);
    const initialOpacity = isCached ? 1 : 0;
    const transitionStyle = isCached ? 'none' : 'opacity 0.3s ease';

    const cfg = window.McIconConfig;
    const glintHtml = window.McEnchantGlint && window.McEnchantGlint.itemHasGlint(itemId)
        ? window.McEnchantGlint.glintOverlayHtml()
        : '';
    return `
        <span class="item-icon-mount" data-item-id="${safeId}" data-item-name="${safeName}"
            style="width:${cfg.ICON_PX}px; height:${cfg.ICON_PX}px; margin-right:${cfg.ICON_GAP_RIGHT}px; display:inline-flex; align-items:center; justify-content:center; background: rgba(255,255,255,0.03); border-radius:4px; flex-shrink: 0; position:relative;">
            <canvas class="item-tex-anim" width="${cfg.RENDER_SIZE}" height="${cfg.RENDER_SIZE}" data-tex-urls="${texUrls}"
                style="width:${cfg.ICON_PX}px; height:${cfg.ICON_PX}px; image-rendering:pixelated; opacity: ${initialOpacity}; transition: ${transitionStyle}; display:block;"
                title="${safeName}"></canvas>
            ${glintHtml}
        </span>
    `;
};
