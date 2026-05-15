// ==========================================
// 附魔光效（滚动 glint 叠加层，兼容 2D / 3D 图标）
// ==========================================
(function (global) {
    const VERSION = '26.1.2';
    const GLINT_URL = `/${VERSION}/assets/minecraft/textures/misc/enchanted_glint_item.png`;

    const GLINT_ALWAYS = new Set([
        'experience_bottle',
        'enchanted_golden_apple',
        'ominous_bottle'
    ]);

    let glintSource = null;
    let glintLoadPromise = null;

    /** 资源包未包含 PNG 时的对角彩虹 glint（与 MC 滚动叠加类似） */
    function createProceduralGlintCanvas() {
        const size = 64;
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext('2d');
        const data = ctx.createImageData(size, size);
        const d = data.data;
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const i = (y * size + x) * 4;
                const phase = (x + y) * 0.42;
                d[i] = 128 + Math.floor(127 * Math.sin(phase));
                d[i + 1] = 128 + Math.floor(127 * Math.sin(phase + 2.1));
                d[i + 2] = 128 + Math.floor(127 * Math.sin(phase + 4.2));
                d[i + 3] = 160 + (((x * 7 + y * 11) & 255) % 96);
            }
        }
        ctx.putImageData(data, 0, 0);
        return canvas;
    }
    const overlayTargets = new Set();
    let rafId = null;

    function normalizeId(id) {
        return String(id).toLowerCase().replace(/-/g, '_');
    }

    function itemHasGlint(itemId) {
        const id = normalizeId(itemId);
        if (id.startsWith('enchanted_book')) return true;
        if (GLINT_ALWAYS.has(id)) return true;
        if (id.startsWith('ominous_bottle')) return true;
        return false;
    }

    function loadGlintImage() {
        if (glintLoadPromise) return glintLoadPromise;
        glintLoadPromise = new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                glintSource = img;
                resolve(img);
            };
            img.onerror = () => {
                glintSource = createProceduralGlintCanvas();
                resolve(glintSource);
            };
            img.src = GLINT_URL;
        });
        return glintLoadPromise;
    }

    /** 与物品实际像素对齐：主 canvas（2D 贴图或 3D 渲染结果） */
    function getMaskCanvas(glintCanvas) {
        const host = glintCanvas && glintCanvas.parentElement;
        const first = host && host.firstElementChild;
        if (first && first.tagName === 'CANVAS' && first !== glintCanvas) return first;
        return null;
    }

    function drawGlintOnCanvas(ctx, nowMs, maskCanvas) {
        if (!glintSource || !ctx) return;
        const w = ctx.canvas.width;
        const h = ctx.canvas.height;
        const t = (nowMs || performance.now()) * 0.0003;
        const scrollX = (t % 1) * glintSource.width;
        const scrollY = (t * 0.6 % 1) * glintSource.height;
        const gw = glintSource.width;
        const gh = glintSource.height;

        ctx.clearRect(0, 0, w, h);
        ctx.save();
        const cfg = global.McIconConfig || { FLAT_PAD_RATIO: 0.1 };
        const pad = cfg.FLAT_PAD_RATIO || 0;
        const inset = !maskCanvas || maskCanvas.width < 1 ? w * pad : 0;
        const inner = w - inset * 2;
        if (inset > 0) {
            ctx.beginPath();
            ctx.rect(inset, inset, inner, inner);
            ctx.clip();
        }
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.5;
        const spanW = inset > 0 ? inner : w;
        const spanH = inset > 0 ? inner : h;
        for (let x = -gw; x < spanW + gw; x += gw) {
            for (let y = -gh; y < spanH + gh; y += gh) {
                const dx = inset > 0 ? x + inset : x;
                const dy = inset > 0 ? y + inset : y;
                ctx.drawImage(glintSource, dx - scrollX, dy - scrollY);
            }
        }
        ctx.restore();

        if (maskCanvas && maskCanvas.width > 0 && maskCanvas.height > 0) {
            ctx.globalCompositeOperation = 'destination-in';
            ctx.globalAlpha = 1;
            ctx.drawImage(maskCanvas, 0, 0, w, h);
            ctx.globalCompositeOperation = 'source-over';
        }
    }

    function ensureLoop() {
        if (rafId !== null) return;
        const tick = (now) => {
            overlayTargets.forEach((entry) => {
                if (!entry.canvas.isConnected) {
                    overlayTargets.delete(entry);
                    return;
                }
                const ctx = entry.canvas.getContext('2d');
                if (ctx) drawGlintOnCanvas(ctx, now, entry.maskCanvas);
            });
            if (overlayTargets.size > 0) {
                rafId = requestAnimationFrame(tick);
            } else {
                rafId = null;
            }
        };
        rafId = requestAnimationFrame(tick);
    }

    function registerOverlay(canvas, itemId) {
        if (!canvas || !itemHasGlint(itemId)) return;
        const maskCanvas = getMaskCanvas(canvas);
        overlayTargets.add({ canvas, itemId, maskCanvas });
        loadGlintImage().then(() => {
            const ctx = canvas.getContext('2d');
            if (ctx) drawGlintOnCanvas(ctx, performance.now(), maskCanvas);
            ensureLoop();
        });
    }

    function glintOverlayHtml() {
        const cfg = global.McIconConfig || { RENDER_SIZE: 83 };
        const s = cfg.RENDER_SIZE;
        return `<canvas class="item-glint-overlay" width="${s}" height="${s}" aria-hidden="true"
            style="position:absolute;inset:0;width:100%;height:100%;image-rendering:pixelated;pointer-events:none;mix-blend-mode:plus-lighter;"></canvas>`;
    }

    function initInContainer(root) {
        if (!root) return;
        root.querySelectorAll('.item-glint-overlay').forEach((canvas) => {
            const host = canvas.closest('[data-item-id]');
            const itemId = host && host.dataset.itemId;
            if (itemId) registerOverlay(canvas, itemId);
        });
    }

    global.McEnchantGlint = {
        itemHasGlint,
        loadGlintImage,
        drawGlintOnCanvas,
        registerOverlay,
        glintOverlayHtml,
        initInContainer
    };
})(typeof window !== 'undefined' ? window : globalThis);
