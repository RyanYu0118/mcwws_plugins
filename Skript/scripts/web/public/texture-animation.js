// ==========================================
// Minecraft 动画贴图（.mcmeta 竖条胶片）
// ==========================================
(function (global) {
    const TICK_MS = 50;
    const metaCache = new Map();
    const threeTextures = new Set();
    const domEntries = new Set();
    const clockEntries = new Set();
    const pointerCompassEntries = new Set();
    const rainbowLayerEntries = new Set();
    const clockFrameCache = new Map();
    const pointerCompassFrameCache = new Map();
    let pointerCompassTracking = false;
    let pointerX = null;
    let pointerY = null;
    let rafId = null;

    const ASSET_VER = global.McTexturePackVersion || '26.1.2';
    const POINTER_COMPASS_TILT_COS = Math.cos(Math.PI / 4);

    const colormapResolved = new Map();
    const colormapLoading = new Map();

    function normalizeTintId(id) {
        return String(id || '').toLowerCase().replace(/-/g, '_');
    }

    /** 2D 绘制后乘 grass.png 色谱（与 Java 草类方块一致） */
    const GRASS_TINT_2D_IDS = new Set([
        'grass_block', 'grass', 'short_grass', 'tall_grass', 'fern', 'large_fern',
        'bamboo', 'moss_block', 'moss_carpet',
        'small_dripleaf', 'big_dripleaf', 'seagrass', 'tall_seagrass'
    ]);

    /** 2D 绘制后乘 foliage.png 色谱（藤蔓等普通叶色系） */
    const FOLIAGE_TINT_2D_IDS = new Set([
        'vine'
    ]);

    const FIXED_TINT_2D_RGB = {
        leaf_litter: [130, 94, 54],
        lily_pad: [113, 195, 92]
    };

    const GRASS_2D_DEFAULT_BIOME = [0.8, 0.4];
    const FOLIAGE_2D_DEFAULT_BIOME = [0.48, 0.62];

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

    function clockFrameUrl(frame) {
        const idx = String(frame).padStart(2, '0');
        return `/${ASSET_VER}/assets/minecraft/textures/item/clock_${idx}.png`;
    }

    function pointerCompassFrameUrl(kind, frame) {
        const idx = String(frame).padStart(2, '0');
        return `/${ASSET_VER}/assets/minecraft/textures/item/${kind}_${idx}.png`;
    }

    function clockFrameForBrowserTime(date) {
        const seconds = date.getHours() * 3600
            + date.getMinutes() * 60
            + date.getSeconds()
            + date.getMilliseconds() / 1000;
        const noon = 12 * 3600;
        const sinceNoon = (seconds - noon + 24 * 3600) % (24 * 3600);
        return Math.floor((sinceNoon / (24 * 3600)) * 64) % 64;
    }

    function pointerCompassFrameForCanvas(canvas) {
        if (!canvas || pointerX == null || pointerY == null) return 0;
        const rect = canvas.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = pointerX - cx;
        const dy = pointerY - cy;
        if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) return 0;
        // The compass sprite is viewed at an angled pitch, so its north/south axis is foreshortened on screen.
        const planeDy = dy / POINTER_COMPASS_TILT_COS;
        const clockwiseFromSouth = (Math.atan2(-dx, planeDy) + Math.PI * 2) % (Math.PI * 2);
        return Math.round((clockwiseFromSouth / (Math.PI * 2)) * 32) % 32;
    }

    function colormapKindFor2d(itemIdRaw) {
        const id = normalizeTintId(itemIdRaw);
        if (!id) return null;
        if (GRASS_TINT_2D_IDS.has(id)) return 'grass';
        if (FOLIAGE_TINT_2D_IDS.has(id)) return 'foliage';
        if (global.getSmartId) {
            const sid = normalizeTintId(global.getSmartId(id));
            if (GRASS_TINT_2D_IDS.has(sid)) return 'grass';
            if (FOLIAGE_TINT_2D_IDS.has(sid)) return 'foliage';
        }
        return null;
    }

    function fixedTintRgbFor2d(itemIdRaw) {
        const id = normalizeTintId(itemIdRaw);
        if (FIXED_TINT_2D_RGB[id]) return FIXED_TINT_2D_RGB[id];
        if (global.getSmartId) {
            const sid = normalizeTintId(global.getSmartId(id));
            if (FIXED_TINT_2D_RGB[sid]) return FIXED_TINT_2D_RGB[sid];
        }
        return null;
    }

    function biomeParamsFor2d(kind) {
        return kind === 'grass' ? GRASS_2D_DEFAULT_BIOME : FOLIAGE_2D_DEFAULT_BIOME;
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

    async function loadColormapBuffer(kind) {
        if (colormapResolved.has(kind)) return colormapResolved.get(kind);
        if (colormapLoading.has(kind)) return colormapLoading.get(kind);
        const file = kind === 'grass' ? 'grass.png' : 'foliage.png';
        const url = `/${ASSET_VER}/assets/minecraft/textures/colormap/${file}`;
        const p = new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                const c = document.createElement('canvas');
                c.width = img.naturalWidth || img.width;
                c.height = img.naturalHeight || img.height;
                c.getContext('2d').drawImage(img, 0, 0);
                const buf = { canvas: c, w: c.width, h: c.height };
                colormapResolved.set(kind, buf);
                resolve(buf);
            };
            img.onerror = () => {
                colormapResolved.set(kind, null);
                resolve(null);
            };
            img.src = url;
        });
        colormapLoading.set(kind, p);
        const out = await p;
        colormapLoading.delete(kind);
        return out;
    }

    function flatPadRatioForCanvas(canvas) {
        const rawId = itemIdForCanvas(canvas);
        if (global.isMcDoorItemId && global.isMcDoorItemId(rawId)) return 0;
        if (global.isMcBedItemId && global.isMcBedItemId(rawId)) return 0;
        if (global.isMcCopperGolemStatueItemId && global.isMcCopperGolemStatueItemId(rawId)) return 0;
        if (global.isMcShulkerBoxItemId && global.isMcShulkerBoxItemId(rawId)) return 0;
        return iconCfg().FLAT_PAD_RATIO || 0;
    }

    function padInsetForCanvas(canvas) {
        const cw = canvas.width;
        return cw * flatPadRatioForCanvas(canvas);
    }

    /** 仅对非透明像素做色谱乘法着色，避免污染透明背景 */
    function multiplyColormapTintPixels(ctx, x, y, w, h, rgb) {
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

    async function applyColormapTint2dIfNeeded(canvas) {
        if (!canvas || !canvas.getContext) return;
        const rawId = itemIdForCanvas(canvas);
        const fixedRgb = fixedTintRgbFor2d(rawId);
        if (fixedRgb) {
            const ctx = canvas.getContext('2d');
            const inset = padInsetForCanvas(canvas);
            const rw = canvas.width - inset * 2;
            const rh = canvas.height - inset * 2;
            multiplyColormapTintPixels(ctx, inset, inset, rw, rh, fixedRgb);
            return;
        }
        const kind = colormapKindFor2d(rawId);
        if (!kind) return;
        const buf = await loadColormapBuffer(kind);
        if (!buf) return;
        const [t, hum] = biomeParamsFor2d(kind);
        const rgb = sampleColormapBuf(buf, t, hum);
        if (!rgb) return;
        const ctx = canvas.getContext('2d');
        const inset = padInsetForCanvas(canvas);
        const rw = canvas.width - inset * 2;
        const rh = canvas.height - inset * 2;
        multiplyColormapTintPixels(ctx, inset, inset, rw, rh, rgb);
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

    function hexToRgb(hex) {
        const raw = String(hex || '').replace('#', '');
        if (!/^[0-9a-f]{6}$/i.test(raw)) return [56, 93, 198];
        return [
            parseInt(raw.slice(0, 2), 16),
            parseInt(raw.slice(2, 4), 16),
            parseInt(raw.slice(4, 6), 16)
        ];
    }

    function hslToRgb(h, s, l) {
        const hue = ((h % 360) + 360) % 360 / 360;
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        const channel = (tRaw) => {
            let t = tRaw;
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };
        return [
            Math.round(channel(hue + 1 / 3) * 255),
            Math.round(channel(hue) * 255),
            Math.round(channel(hue - 1 / 3) * 255)
        ];
    }

    function rainbowRgbAt(now) {
        return hslToRgb((now / 5000) * 360, 0.9, 0.58);
    }

    function tintedPotionOverlayCanvas(img, rgb) {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth || img.width;
        c.height = img.naturalHeight || img.height;
        const ctx = c.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, c.width, c.height);
        const d = data.data;
        const tr = rgb[0] / 255;
        const tg = rgb[1] / 255;
        const tb = rgb[2] / 255;
        for (let i = 0; i < d.length; i += 4) {
            if (d[i + 3] <= 6) continue;
            d[i] = Math.min(255, Math.round(d[i] * tr));
            d[i + 1] = Math.min(255, Math.round(d[i + 1] * tg));
            d[i + 2] = Math.min(255, Math.round(d[i + 2] * tb));
        }
        ctx.putImageData(data, 0, 0);
        return c;
    }

    async function renderPotionCanvas(canvas) {
        if (!canvas || !canvas.getContext || !global.isMcPotionItemId) return false;
        const itemId = itemIdForCanvas(canvas);
        if (!global.isMcPotionItemId(itemId)) return false;

        const urls = global.mcPotionTextureUrlsForItem
            ? global.mcPotionTextureUrlsForItem(itemId)
            : [];
        if (urls.length < 2) return false;

        try {
            const [overlay, bottle] = await Promise.all([
                loadImage(urls[0]),
                loadImage(urls[1])
            ]);
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.imageSmoothingEnabled = false;

            const colorHex = global.mcPotionColorHexForItem
                ? global.mcPotionColorHexForItem(itemId)
                : '#385dc6';
            const tintedOverlay = tintedPotionOverlayCanvas(overlay, hexToRgb(colorHex));

            drawImageWithFlatPadding(ctx, tintedOverlay, 0, 0, tintedOverlay.width, tintedOverlay.height);
            drawImageWithFlatPadding(
                ctx,
                bottle,
                0,
                0,
                bottle.naturalWidth || bottle.width,
                bottle.naturalHeight || bottle.height
            );
            return true;
        } catch {
            return false;
        }
    }

    async function renderTippedArrowCanvas(canvas) {
        if (!canvas || !canvas.getContext || !global.isMcTippedArrowItemId) return false;
        const itemId = itemIdForCanvas(canvas);
        if (!global.isMcTippedArrowItemId(itemId)) return false;

        const urls = global.mcTippedArrowTextureUrlsForItem
            ? global.mcTippedArrowTextureUrlsForItem(itemId)
            : [];
        if (urls.length < 2) return false;

        try {
            const [head, base] = await Promise.all([
                loadImage(urls[0]),
                loadImage(urls[1])
            ]);
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.imageSmoothingEnabled = false;

            const colorHex = global.mcPotionColorHexForItem
                ? global.mcPotionColorHexForItem(itemId)
                : '#385dc6';
            const tintedHead = tintedPotionOverlayCanvas(head, hexToRgb(colorHex));

            drawImageWithFlatPadding(ctx, tintedHead, 0, 0, tintedHead.width, tintedHead.height);
            drawImageWithFlatPadding(
                ctx,
                base,
                0,
                0,
                base.naturalWidth || base.width,
                base.naturalHeight || base.height
            );
            return true;
        } catch {
            return false;
        }
    }

    function drawRainbowLayerEntry(entry, now) {
        if (!entry || !entry.canvas || !entry.base || !entry.overlay) return;
        const ctx = entry.canvas.getContext('2d');
        if (!ctx) return;
        const rgb = rainbowRgbAt(now);
        const tinted = tintedPotionOverlayCanvas(entry.tintTarget, rgb);
        ctx.clearRect(0, 0, entry.canvas.width, entry.canvas.height);
        ctx.imageSmoothingEnabled = false;
        if (entry.mode === 'leather') {
            drawImageWithFlatPadding(ctx, tinted, 0, 0, tinted.width, tinted.height);
            drawImageWithFlatPadding(ctx, entry.overlay, 0, 0, entry.overlay.width, entry.overlay.height);
        } else {
            drawImageWithFlatPadding(ctx, entry.base, 0, 0, entry.base.width, entry.base.height);
            drawImageWithFlatPadding(ctx, tinted, 0, 0, tinted.width, tinted.height);
        }
    }

    async function renderRainbowLayerCanvas(canvas, mode) {
        if (!canvas || !canvas.getContext) return false;
        const itemId = itemIdForCanvas(canvas);
        const urls = mode === 'leather' && global.mcLeatherArmorTextureUrlsForItem
            ? global.mcLeatherArmorTextureUrlsForItem(itemId)
            : mode === 'firework' && global.mcFireworkStarTextureUrlsForItem
                ? global.mcFireworkStarTextureUrlsForItem(itemId)
                : [];
        if (urls.length < 2) return false;
        try {
            const [base, overlay] = await Promise.all([
                loadImage(urls[0]),
                loadImage(urls[1])
            ]);
            const entry = {
                canvas,
                base,
                overlay,
                tintTarget: mode === 'leather' ? base : overlay,
                mode
            };
            rainbowLayerEntries.add(entry);
            drawRainbowLayerEntry(entry, performance.now());
            ensureLoop();
            return true;
        } catch {
            return false;
        }
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

    function physicalFrameCount(img) {
        if (!img.width) return 1;
        return Math.max(1, Math.round(img.height / img.width));
    }

    function frameEntryIndex(entry, physicalFrames) {
        const frameIndex = typeof entry === 'number' ? entry : entry && entry.index;
        return Math.min(physicalFrames - 1, Math.max(0, Number(frameIndex) || 0));
    }

    function frameEntryDurationTicks(entry, meta) {
        if (entry && typeof entry === 'object' && Number(entry.time) > 0) {
            return Number(entry.time);
        }
        return meta.frametime || 1;
    }

    function frameStateAt(meta, physicalFrames, elapsedMs) {
        if (meta.frames && meta.frames.length) {
            const frameDurations = meta.frames.map((entry) => frameEntryDurationTicks(entry, meta) * TICK_MS);
            const totalMs = frameDurations.reduce((sum, ms) => sum + ms, 0) || TICK_MS;
            let t = elapsedMs % totalMs;
            let seq = 0;
            while (seq < frameDurations.length - 1 && t >= frameDurations[seq]) {
                t -= frameDurations[seq];
                seq += 1;
            }
            const duration = frameDurations[seq] || TICK_MS;
            const nextSeq = (seq + 1) % meta.frames.length;
            return {
                frame: frameEntryIndex(meta.frames[seq], physicalFrames),
                nextFrame: frameEntryIndex(meta.frames[nextSeq], physicalFrames),
                progress: Math.min(1, Math.max(0, t / duration))
            };
        }
        const msPer = (meta.frametime || 1) * TICK_MS;
        const frame = Math.floor(elapsedMs / msPer) % physicalFrames;
        return {
            frame,
            nextFrame: (frame + 1) % physicalFrames,
            progress: Math.min(1, Math.max(0, (elapsedMs % msPer) / msPer))
        };
    }

    function drawAnimationFrame(ctx, img, frameW, frameH, frame, nextFrame, progress, interpolate, drawFn) {
        if (!ctx) return;
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.imageSmoothingEnabled = false;
        ctx.globalAlpha = 1;
        drawFn(ctx, img, 0, frame * frameH, frameW, frameH);
        if (interpolate && nextFrame !== frame && progress > 0) {
            ctx.globalAlpha = progress;
            drawFn(ctx, img, 0, nextFrame * frameH, frameW, frameH);
            ctx.globalAlpha = 1;
        }
    }

    function ensureLoop() {
        if (rafId !== null) return;
        const tick = (now) => {
            threeTextures.forEach((tex) => {
                const a = tex.userData.mcAnim;
                if (!a) return;
                const state = frameStateAt(a.meta, a.frames, now - a.startMs);
                if (a.ctx && a.img) {
                    drawAnimationFrame(
                        a.ctx,
                        a.img,
                        a.frameW,
                        a.frameH,
                        state.frame,
                        state.nextFrame,
                        state.progress,
                        a.meta.interpolate,
                        (ctx, img, sx, sy, sw, sh) => ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh)
                    );
                    tex.needsUpdate = true;
                } else {
                    tex.offset.y = 1 - (state.frame + 1) / a.frames;
                }
            });
            domEntries.forEach((e) => {
                if (!e.canvas || !e.canvas.isConnected) {
                    domEntries.delete(e);
                    return;
                }
                const state = frameStateAt(e.meta, e.frames, now - e.startMs);
                const ctx = e.canvas.getContext('2d');
                if (!ctx) return;
                drawAnimationFrame(
                    ctx,
                    e.img,
                    e.frameW,
                    e.frameH,
                    state.frame,
                    state.nextFrame,
                    state.progress,
                    e.meta.interpolate,
                    drawImageWithFlatPadding
                );
                if (e.colormapTintRgb) {
                    const inset = padInsetForCanvas(e.canvas);
                    const rw = e.canvas.width - inset * 2;
                    const rh = e.canvas.height - inset * 2;
                    multiplyColormapTintPixels(ctx, inset, inset, rw, rh, e.colormapTintRgb);
                }
            });
            clockEntries.forEach((e) => {
                if (!e.canvas || !e.canvas.isConnected) {
                    clockEntries.delete(e);
                    return;
                }
                updateClockEntry(e);
            });
            pointerCompassEntries.forEach((e) => {
                if (!e.canvas || !e.canvas.isConnected) {
                    pointerCompassEntries.delete(e);
                    return;
                }
                updatePointerCompassEntry(e);
            });
            rainbowLayerEntries.forEach((e) => {
                if (!e.canvas || !e.canvas.isConnected) {
                    rainbowLayerEntries.delete(e);
                    return;
                }
                drawRainbowLayerEntry(e, now);
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
        const frames = physicalFrameCount(img);
        if (frames <= 1) return false;

        tex.wrapS = THREE.ClampToEdgeWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.magFilter = THREE.NearestFilter;
        tex.minFilter = THREE.NearestFilter;
        tex.colorSpace = THREE.SRGBColorSpace;
        const anim = {
            meta,
            frames,
            startMs: performance.now()
        };
        if (meta.interpolate) {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.width;
            tex.image = canvas;
            tex.repeat.set(1, 1);
            tex.offset.set(0, 0);
            anim.img = img;
            anim.ctx = canvas.getContext('2d');
            anim.frameW = img.width;
            anim.frameH = img.width;
            drawAnimationFrame(
                anim.ctx,
                img,
                anim.frameW,
                anim.frameH,
                0,
                0,
                0,
                false,
                (ctx, source, sx, sy, sw, sh) => ctx.drawImage(source, sx, sy, sw, sh, 0, 0, sw, sh)
            );
            tex.needsUpdate = true;
        } else {
            tex.repeat.set(1, 1 / frames);
            tex.offset.set(0, 1 - 1 / frames);
        }
        tex.userData.mcAnim = anim;
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

    function loadClockFrame(frame) {
        const normalized = ((frame % 64) + 64) % 64;
        if (clockFrameCache.has(normalized)) return clockFrameCache.get(normalized);
        const promise = loadImage(clockFrameUrl(normalized));
        clockFrameCache.set(normalized, promise);
        return promise;
    }

    function ensurePointerCompassTracking() {
        if (pointerCompassTracking || typeof window === 'undefined') return;
        pointerCompassTracking = true;
        const updatePointer = (event) => {
            pointerX = event.clientX;
            pointerY = event.clientY;
        };
        window.addEventListener('pointermove', updatePointer, { passive: true });
        window.addEventListener('mousemove', updatePointer, { passive: true });
    }

    function loadPointerCompassFrame(kind, frame) {
        const normalized = ((frame % 32) + 32) % 32;
        const key = `${kind}:${normalized}`;
        if (pointerCompassFrameCache.has(key)) return pointerCompassFrameCache.get(key);
        const promise = loadImage(pointerCompassFrameUrl(kind, normalized));
        pointerCompassFrameCache.set(key, promise);
        return promise;
    }

    function drawClockFrame(entry, frame) {
        const targetFrame = ((frame % 64) + 64) % 64;
        loadClockFrame(targetFrame).then((img) => {
            if (!entry.canvas || !entry.canvas.isConnected || entry.frame !== targetFrame) return;
            const ctx = entry.canvas.getContext('2d');
            if (!ctx) return;
            ctx.clearRect(0, 0, entry.canvas.width, entry.canvas.height);
            ctx.imageSmoothingEnabled = false;
            drawImageWithFlatPadding(ctx, img, 0, 0, img.width, img.height);
        }).catch(() => {});
    }

    function updateClockEntry(entry) {
        const frame = clockFrameForBrowserTime(new Date());
        if (entry.frame === frame) return;
        entry.frame = frame;
        drawClockFrame(entry, frame);
    }

    function initClockCanvas(canvas) {
        if (!canvas || !canvas.getContext) return false;
        const entry = { canvas, frame: -1 };
        clockEntries.add(entry);
        updateClockEntry(entry);
        ensureLoop();
        return true;
    }

    function drawPointerCompassFrame(entry, frame) {
        const targetFrame = ((frame % 32) + 32) % 32;
        loadPointerCompassFrame(entry.kind, targetFrame).then((img) => {
            if (!entry.canvas || !entry.canvas.isConnected || entry.frame !== targetFrame) return;
            const ctx = entry.canvas.getContext('2d');
            if (!ctx) return;
            ctx.clearRect(0, 0, entry.canvas.width, entry.canvas.height);
            ctx.imageSmoothingEnabled = false;
            drawImageWithFlatPadding(ctx, img, 0, 0, img.width, img.height);
        }).catch(() => {});
    }

    function updatePointerCompassEntry(entry) {
        const frame = pointerCompassFrameForCanvas(entry.canvas);
        if (entry.frame === frame) return;
        entry.frame = frame;
        drawPointerCompassFrame(entry, frame);
    }

    function initPointerCompassCanvas(canvas) {
        if (!canvas || !canvas.getContext) return false;
        const itemId = normalizeTintId(itemIdForCanvas(canvas));
        if (itemId !== 'compass' && itemId !== 'recovery_compass') return false;
        ensurePointerCompassTracking();
        const entry = { canvas, kind: itemId, frame: -1 };
        pointerCompassEntries.add(entry);
        updatePointerCompassEntry(entry);
        ensureLoop();
        return true;
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
        const frames = physicalFrameCount(img);
        if (frames <= 1) return false;

        const frameW = img.width;
        const frameH = img.width;
        const itemId = itemIdForCanvas(canvas);
        let colormapTintRgb = fixedTintRgbFor2d(itemId);
        const colormapKind = colormapKindFor2d(itemId);
        if (!colormapTintRgb && colormapKind) {
            const buf = await loadColormapBuffer(colormapKind);
            if (buf) {
                const [t, hum] = biomeParamsFor2d(colormapKind);
                colormapTintRgb = sampleColormapBuf(buf, t, hum);
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
            colormapTintRgb
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
                await applyColormapTint2dIfNeeded(canvas);
                return true;
            } catch {
                continue;
            }
        }
        return false;
    }

    async function initCanvasFromUrls(canvas, urls) {
        if (global.isMcFireworkStarItemId && global.isMcFireworkStarItemId(itemIdForCanvas(canvas))) {
            const ok = await renderRainbowLayerCanvas(canvas, 'firework');
            if (ok) return true;
        }
        if (global.isMcLeatherArmorItemId && global.isMcLeatherArmorItemId(itemIdForCanvas(canvas))) {
            const ok = await renderRainbowLayerCanvas(canvas, 'leather');
            if (ok) return true;
        }
        if (global.isMcClockItemId && global.isMcClockItemId(itemIdForCanvas(canvas))) {
            const ok = initClockCanvas(canvas);
            if (ok) return true;
        }
        if (global.isMcMouseCompassItemId && global.isMcMouseCompassItemId(itemIdForCanvas(canvas))) {
            const ok = initPointerCompassCanvas(canvas);
            if (ok) return true;
        }
        if (global.isMcTippedArrowItemId && global.isMcTippedArrowItemId(itemIdForCanvas(canvas))) {
            const ok = await renderTippedArrowCanvas(canvas);
            if (ok) return true;
        }
        if (global.isMcPotionItemId && global.isMcPotionItemId(itemIdForCanvas(canvas))) {
            const ok = await renderPotionCanvas(canvas);
            if (ok) return true;
        }
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
