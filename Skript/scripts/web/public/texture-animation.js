// ==========================================
// Minecraft 动画贴图（.mcmeta 竖条胶片）
// ==========================================
(function (global) {
    const TICK_MS = 50;
    const metaCache = new Map();
    const threeTextures = new Set();
    const domEntries = new Set();
    let rafId = null;

    function iconCfg() {
        return global.McIconConfig || { FLAT_PAD_RATIO: 0.1 };
    }

    function drawImageWithFlatPadding(ctx, img, sx, sy, sw, sh) {
        const cw = ctx.canvas.width;
        const ch = ctx.canvas.height;
        const pad = iconCfg().FLAT_PAD_RATIO || 0;
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
        domEntries.add({
            canvas,
            img,
            meta,
            frames,
            frameW,
            frameH,
            startMs: performance.now()
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
