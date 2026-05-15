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

    function padInset(ctx) {
        const cfg = global.McIconConfig || { FLAT_PAD_RATIO: 0.1 };
        const w = ctx.canvas.width;
        return w * (cfg.FLAT_PAD_RATIO || 0);
    }

    function drawGlintOnCanvas(ctx, nowMs, useFlatPad) {
        if (!glintSource || !ctx) return;
        const w = ctx.canvas.width;
        const h = ctx.canvas.height;
        const inset = useFlatPad ? padInset(ctx) : 0;
        const size = w - inset * 2;
        const t = (nowMs || performance.now()) * 0.003;
        const scrollX = (t % 1) * glintSource.width;
        const scrollY = (t * 0.6 % 1) * glintSource.height;
        const gw = glintSource.width;
        const gh = glintSource.height;

        ctx.save();
        ctx.clearRect(0, 0, w, h);
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.72;
        ctx.beginPath();
        ctx.rect(inset, inset, size, size);
        ctx.clip();
        for (let x = -gw; x < size + gw; x += gw) {
            for (let y = -gh; y < size + gh; y += gh) {
                ctx.drawImage(glintSource, x - scrollX, y - scrollY);
            }
        }
        ctx.restore();
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
                if (ctx) drawGlintOnCanvas(ctx, now, entry.useFlatPad);
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
        const host = canvas.parentElement;
        const useFlatPad = !!(host && host.querySelector('.item-tex-anim'));
        overlayTargets.add({ canvas, itemId, useFlatPad });
        loadGlintImage().then((img) => {
            if (!img) return;
            const ctx = canvas.getContext('2d');
            if (ctx) drawGlintOnCanvas(ctx, performance.now(), useFlatPad);
            ensureLoop();
        });
    }

    function glintOverlayHtml() {
        const cfg = global.McIconConfig || { RENDER_SIZE: 83 };
        const s = cfg.RENDER_SIZE;
        return `<canvas class="item-glint-overlay" width="${s}" height="${s}" aria-hidden="true"
            style="position:absolute;inset:0;width:100%;height:100%;image-rendering:pixelated;pointer-events:none;"></canvas>`;
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
