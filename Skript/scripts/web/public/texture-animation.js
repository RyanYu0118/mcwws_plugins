// ==========================================
// Minecraft 动画贴图（.mcmeta 竖条胶片）
// ==========================================
(function (global) {
    const TICK_MS = 50;
    const metaCache = new Map();
    const threeTextures = new Set();
    const domEntries = new Set();
    let rafId = null;

    const ASSET_VER = global.McTexturePackVersion || '26.1.2';

    const grassColormapResolved = new Map();
    const grassColormapLoading = new Map();

    function normalizeTintId(id) {
        return String(id || '').toLowerCase().replace(/-/g, '_');
    }

    /** 2D 绘制后乘 grass.png 色谱（与 Java 草类方块一致） */
    const GRASS_TINT_2D_IDS = new Set([
        'grass_block', 'grass', 'short_grass', 'tall_grass', 'fern', 'large_fern',
        'sugar_cane', 'bamboo', 'moss_block', 'moss_carpet',
        'small_dripleaf', 'big_dripleaf', 'seagrass', 'tall_seagrass'
    ]);

    const GRASS_2D_DEFAULT_BIOME = [0.8, 0.4];

    function iconCfg() {
        return global.McIconConfig || { FLAT_PAD_RATIO: 0.1 };
    }

    function itemIdForCanvas(canvas) {
        if (!canvas) return '';
        const d = canvas.dataset && canvas.dataset.itemId;
        if (d) return d;
        const host = canvas.closest && canvas.closest('[data-item-id]');
        return (host && host.dataset && host.dataset.itemId) || '';
    }

    function needsGrassTint2d(itemIdRaw) {
        const id = normalizeTintId(itemIdRaw);
        if (!id) return false;
        if (GRASS_TINT_2D_IDS.has(id)) return true;
        if (global.getSmartId) {
            const sid = normalizeTintId(global.getSmartId(id));
            if (GRASS_TINT_2D_IDS.has(sid)) return true;
        }
        return false;
    }

    function grassBiomeParamsFor2d() {
        return GRASS_2D_DEFAULT_BIOME;
    }

    function sampleColormapBuf(buf, temperature, downfall) {
        if (!buf || !buf.canvas || buf.w < 1 || buf.h < 1) return null;
        const adjT = Math.min(1, Math.max(0, temperature));
        let adjH = Math.min(1, Math.max(0, downfall));
        adjH *= adjT;
        const x = Math.min(buf.w - 1, Math.max(0, Math.floor((1 - adjT) * (buf.w - 1))));
        const y = Math.min(buf.h - 1, Math.max(0, Math.floor((1 - adjH) * (buf.h - 1))));
        const ctx = buf.canvas.getContext('2d');
        const d = ctx.getImageData(x, y, 1, 1).data;
        return [d[0], d[1], d[2]];
    }

    async function loadColormapGrassBuffer() {
        if (grassColormapResolved.has('buf')) return grassColormapResolved.get('buf');
        if (grassColormapLoading.has('p')) return grassColormapLoading.get('p');
        const url = `/${ASSET_VER}/assets/minecraft/textures/colormap/grass.png`;
        const p = new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                const c = document.createElement('canvas');
                c.width = img.naturalWidth || img.width;
                c.height = img.naturalHeight || img.height;
                c.getContext('2d').drawImage(img, 0, 0);
                const buf = { canvas: c, w: c.width, h: c.height };
                grassColormapResolved.set('buf', buf);
                resolve(buf);
            };
            img.onerror = () => {
                grassColormapResolved.set('buf', null);
                resolve(null);
            };
            img.src = url;
        });
        grassColormapLoading.set('p', p);
        const out = await p;
        grassColormapLoading.delete('p');
        return out;
    }

    function flatPadRatioForCanvas(canvas) {
        const rawId = itemIdForCanvas(canvas);
        if (global.isMcDoorItemId && global.isMcDoorItemId(rawId)) return 0;
        if (global.isMcBedItemId && global.isMcBedItemId(rawId)) return 0;
        if (global.isMcCopperGolemStatueItemId && global.isMcCopperGolemStatueItemId(rawId)) return 0;
        return iconCfg().FLAT_PAD_RATIO || 0;
    }

    function padInsetForCanvas(canvas) {
        const cw = canvas.width;
        return cw * flatPadRatioForCanvas(canvas);
    }

    /** 仅对非透明像素做 grass 乘法着色，避免污染透明背景 */
    function multiplyGrassTintPixels(ctx, x, y, w, h, rgb) {
        if (!ctx || w < 1 || h < 1 || !rgb) return;
        const tr = rgb[0] / 255;
        const tg = rgb[1] / 255;
        const tb = rgb[2] / 255;
        let imgData;
        try {
            imgData = ctx.getImageData(x, y, w, h);
        } catch {
            return;
        }
        const d = imgData.data;
        const ALPHA_THRESHOLD = 6;
        for (let i = 0; i < d.length; i += 4) {
            if (d[i + 3] <= ALPHA_THRESHOLD) continue;
            d[i] = Math.min(255, Math.round(d[i] * tr));
            d[i + 1] = Math.min(255, Math.round(d[i + 1] * tg));
            d[i + 2] = Math.min(255, Math.round(d[i + 2] * tb));
        }
        ctx.putImageData(imgData, x, y);
    }

    async function applyGrassTint2dIfNeeded(canvas) {
        if (!canvas || !canvas.getContext) return;
        const rawId = itemIdForCanvas(canvas);
        if (!needsGrassTint2d(rawId)) return;
        const buf = await loadColormapGrassBuffer();
        if (!buf) return;
        const [t, hum] = grassBiomeParamsFor2d(rawId);
        const rgb = sampleColormapBuf(buf, t, hum);
        if (!rgb) return;
        const ctx = canvas.getContext('2d');
        const inset = padInsetForCanvas(canvas);
        const rw = canvas.width - inset * 2;
        const rh = canvas.height - inset * 2;
        multiplyGrassTintPixels(ctx, inset, inset, rw, rh, rgb);
    }

    function drawImageWithFlatPadding(ctx, img, sx, sy, sw, sh) {
        const cw = ctx.canvas.width;
        const ch = ctx.canvas.height;
        const pad = flatPadRatioForCanvas(ctx.canvas);
        const inset = cw * pad;
        const sizeW = cw - inset * 2;
        const sizeH = ch - inset * 2;
        ctx.drawImage(img, sx, sy, sw, sh, inset, inset, sizeW, sizeH);
    }

    async function fetchAnimationMeta(pngUrl) {
        if (metaCache.has(pngUrl)) return metaCache.get(pngUrl);
        try {
            const res = await fetch(`${pngUrl}.mcmeta`);
            if (!res.ok) {
                metaCache.set(pngUrl, null);
                return null;
            }
            const json = await res.json();
            if (!json || !json.animation) {
                metaCache.set(pngUrl, null);
                return null;
            }
            const anim = json.animation;
            const meta = {
                frametime: anim.frametime ?? 1,
                frames: Array.isArray(anim.frames) ? anim.frames : null,
                interpolate: !!anim.interpolate
            };
            metaCache.set(pngUrl, meta);
            return meta;
        } catch {
            metaCache.set(pngUrl, null);
            return null;
        }
    }

    function frameCount(img, meta) {
        if (meta.frames && meta.frames.length) return meta.frames.length;
        if (!img.width) return 1;
        return Math.max(1, Math.round(img.height / img.width));
    }

    function frameIndexAt(meta, frames, elapsedMs) {
        const msPer = (meta.frametime || 1) * TICK_MS;
        if (meta.frames && meta.frames.length) {
            const idx = Math.floor(elapsedMs / msPer) % meta.frames.length;
            return meta.frames[idx];
        }
        return Math.floor(elapsedMs / msPer) % frames;
    }

    function ensureLoop() {
        if (rafId !== null) return;
        const tick = (now) => {
            threeTextures.forEach((tex) => {
                const a = tex.userData.mcAnim;
                if (!a) return;
                const fi = frameIndexAt(a.meta, a.frames, now - a.startMs);
                tex.offset.y = 1 - (fi + 1) / a.frames;
            });
            domEntries.forEach((e) => {
                const fi = frameIndexAt(e.meta, e.frames, now - e.startMs);
                const ctx = e.canvas.getContext('2d');
                if (!ctx) return;
                ctx.clearRect(0, 0, e.canvas.width, e.canvas.height);
                ctx.imageSmoothingEnabled = false;
                drawImageWithFlatPadding(
                    ctx,
                    e.img,
                    0, fi * e.frameH, e.frameW, e.frameH
                );
                if (e.grassTintRgb) {
                    const inset = padInsetForCanvas(e.canvas);
                    const rw = e.canvas.width - inset * 2;
                    const rh = e.canvas.height - inset * 2;
                    multiplyGrassTintPixels(ctx, inset, inset, rw, rh, e.grassTintRgb);
                }
            });
            if (typeof global.McItemIcon !== 'undefined' && global.McItemIcon.renderAnimatedSlots) {
                global.McItemIcon.renderAnimatedSlots();
            }
            rafId = requestAnimationFrame(tick);
        };
        rafId = requestAnimationFrame(tick);
    }

    function setupThreeTexture(tex, img, meta) {
        const THREE = global.THREE;
        if (!THREE) return false;
        const frames = frameCount(img, meta);
        if (frames <= 1) return false;

        tex.wrapS = THREE.ClampToEdgeWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(1, 1 / frames);
        tex.offset.set(0, 1 - 1 / frames);
        tex.magFilter = THREE.NearestFilter;
        tex.minFilter = THREE.NearestFilter;
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.userData.mcAnim = {
            meta,
            frames,
            startMs: performance.now()
        };
        threeTextures.add(tex);
        ensureLoop();
        return true;
    }

    function loadImage(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = url;
        });
    }

    async function attachDomCanvas(canvas, pngUrl) {
        const meta = await fetchAnimationMeta(pngUrl);
        if (!meta) return false;
        let img;
        try {
            img = await loadImage(pngUrl);
        } catch {
            return false;
        }
        const frames = frameCount(img, meta);
        if (frames <= 1) return false;

        const frameW = img.width;
        const frameH = img.width;
        let grassTintRgb = null;
        if (needsGrassTint2d(itemIdForCanvas(canvas))) {
            const buf = await loadColormapGrassBuffer();
            if (buf) {
                const id = itemIdForCanvas(canvas);
                const [t, hum] = grassBiomeParamsFor2d(id);
                grassTintRgb = sampleColormapBuf(buf, t, hum);
            }
        }
        domEntries.add({
            canvas,
            img,
            meta,
            frames,
            frameW,
            frameH,
            startMs: performance.now(),
            grassTintRgb
        });
        ensureLoop();
        return true;
    }

    async function initStaticCanvas(canvas, urls) {
        for (const url of urls) {
            try {
                const img = await loadImage(url);
                const ctx = canvas.getContext('2d');
                if (!ctx) return false;
                ctx.imageSmoothingEnabled = false;
                const meta = await fetchAnimationMeta(url);
                if (meta && img.width > 0) {
                    drawImageWithFlatPadding(ctx, img, 0, 0, img.width, img.width);
                } else {
                    drawImageWithFlatPadding(ctx, img, 0, 0, img.width, img.height);
                }
                await applyGrassTint2dIfNeeded(canvas);
                return true;
            } catch {
                continue;
            }
        }
        return false;
    }

    async function initCanvasFromUrls(canvas, urls) {
        for (const url of urls) {
            if (await attachDomCanvas(canvas, url)) return true;
        }
        return initStaticCanvas(canvas, urls);
    }

    function initInContainer(root) {
        if (!root) return;
        if (global.initMcWikiInviconImages) {
            global.initMcWikiInviconImages(root);
        } else if (global.initBedInviconImages) {
            global.initBedInviconImages(root);
        }
        root.querySelectorAll('canvas.item-tex-anim[data-tex-urls]').forEach((canvas) => {
            if (canvas.dataset.texReady === '1') return;
            const urls = (canvas.dataset.texUrls || '').split('|').filter(Boolean);
            initCanvasFromUrls(canvas, urls).then((ok) => {
                if (!ok) return;
                canvas.dataset.texReady = '1';
                canvas.style.opacity = '1';
                const id = canvas.dataset.itemId;
                if (id && global.LoadedTextureCache) {
                    global.LoadedTextureCache.add(id);
                }
            });
        });
    }

    global.McTextureAnim = {
        fetchAnimationMeta,
        setupThreeTexture,
        attachDomCanvas,
        initCanvasFromUrls,
        initInContainer,
        async isAnimatedPngUrl(url) {
            const meta = await fetchAnimationMeta(url);
            if (!meta) return false;
            return true;
        }
    };
})(typeof window !== 'undefined' ? window : globalThis);
