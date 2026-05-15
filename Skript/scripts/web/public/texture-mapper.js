// ==========================================
// 全局材质映射器 (Texture Mapper) - 缓存记忆版
// ==========================================

// 创建一个全局 Set，用来记录哪些物品图标已经成功加载过了
window.LoadedTextureCache = window.LoadedTextureCache || new Set();

const TextureConfig = {
    version: '26.1.2',
    getBasePath: function() {
        return `/${this.version}/assets/minecraft/textures`;
    }
};

/**
 * 智能 ID 处理：处理附魔书、药水、药水箭等带后缀的物品
 */
window.getSmartId = function(id) {
    const rawId = id.toLowerCase();
    if (rawId.startsWith('enchanted_book')) return 'enchanted_book';
    if (rawId.startsWith('potion')) return 'potion';
    if (rawId.startsWith('lingering_potion')) return 'lingering_potion';
    if (rawId.startsWith('splash_potion')) return 'splash_potion';
    if (rawId.startsWith('arrow_of_')) return 'tipped_arrow';
    return rawId;
};

/**
 * 全局错误捕获：静默切换
 */
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

/**
 * 核心逻辑：记录成功状态
 */
window.markAsLoaded = function(imgElement, itemId) {
    // 1. 将该物品 ID 存入已加载缓存
    window.LoadedTextureCache.add(itemId);
    // 2. 执行淡入动画
    imgElement.style.opacity = 1;
};

/**
 * 渲染函数：根据缓存决定是否闪烁
 */
window.getTextureHtml = function(itemId, itemName) {
    const smartId = window.getSmartId(itemId);
    const initialSrc = `${TextureConfig.getBasePath()}/item/${smartId}.png`;
    
    // 检查这个物品是否已经加载成功过
    const isCached = window.LoadedTextureCache.has(itemId);

    // 如果已经加载过，初始透明度就是 1 (不闪烁)；如果是第一次加载，初始透明度是 0 (平滑淡入)
    const initialOpacity = isCached ? 1 : 0;
    const transitionStyle = isCached ? 'none' : 'opacity 0.3s ease';

    return `
        <div style="width:32px; height:32px; margin-right:12px; display:flex; align-items:center; justify-content:center; background: rgba(255,255,255,0.03); border-radius:4px; flex-shrink: 0;">
            <img src="${initialSrc}" 
                 onload="window.markAsLoaded(this, '${itemId}')"
                 onerror="window.handleTextureError(this, '${itemId}')"
                 style="width:32px; height:32px; image-rendering:pixelated; object-fit: contain; opacity: ${initialOpacity}; transition: ${transitionStyle};" 
                 alt="${itemName}">
        </div>
    `;
};