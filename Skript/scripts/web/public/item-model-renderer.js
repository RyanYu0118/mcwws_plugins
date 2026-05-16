// ==========================================
// Minecraft 物品 3D 图标（单 WebGL + 队列 + 缓存，仅渲染可见格子）
// ==========================================
(function (global) {
    const VERSION = '26.1.2';
    const ASSET_BASE = `/${VERSION}/assets/minecraft`;
    const cfg = global.McIconConfig || {
        ICON_PX: Math.round(32 * 1.3),
        RENDER_SIZE: Math.round(64 * 1.3),
        ICON_GAP_RIGHT: Math.round(12 * 1.3),
        FLAT_PAD_RATIO: 0.1,
        RENDER_SCALE_3D: 2,
        SLOT_DPR_CAP: 3,
        SLOT_BITMAP_MAX_3D: 512,
        SLOT_WEBGL_MAX: 2048
    };
    const RENDER_SIZE = cfg.RENDER_SIZE;
    const ICON_PX = cfg.ICON_PX;
    const ICON_GAP_RIGHT = cfg.ICON_GAP_RIGHT;

    function getMcCfg() {
        return global.McIconConfig || cfg;
    }

    /** 含 Ctrl+/ 缩放、visualViewport 缩放时的有效 DPR（有上限） */
    function getEffectiveDevicePixelRatio() {
        let dpr = (typeof window !== 'undefined' && window.devicePixelRatio) ? window.devicePixelRatio : 1;
        if (typeof window !== 'undefined' && window.visualViewport && window.visualViewport.scale) {
            dpr *= window.visualViewport.scale;
        }
        const c = getMcCfg();
        const cap = Number(c.SLOT_DPR_CAP);
        const dprCap = Number.isFinite(cap) && cap > 0 ? cap : 3;
        return Math.min(dprCap, Math.max(1, dpr));
    }

    /** 3D 槽位 canvas 位图边长：随屏幕 DPR 变，保证物理像素≈锐利 */
    function get3dSlotBitmapSize() {
        const c = getMcCfg();
        const iconPx = Math.round(Number(c.ICON_PX) || ICON_PX);
        const minSz = Math.round(Number(c.RENDER_SIZE) || RENDER_SIZE);
        const maxSz = Number(c.SLOT_BITMAP_MAX_3D);
        const maxCap = Number.isFinite(maxSz) && maxSz > 0 ? maxSz : 512;
        const dpr = getEffectiveDevicePixelRatio();
        const base = Math.round(iconPx * dpr * 1.02);
        return Math.min(maxCap, Math.max(minSz, base));
    }

    function getWebglRenderSize() {
        const slot = get3dSlotBitmapSize();
        const c = getMcCfg();
        const scale = Math.max(1, Math.min(4, Number(c.RENDER_SCALE_3D) || 2));
        const raw = Math.round(slot * scale);
        const cap = Number(c.SLOT_WEBGL_MAX);
        const webCap = Number.isFinite(cap) && cap > 0 ? cap : 2048;
        return Math.min(webCap, Math.max(slot, raw));
    }

    let lastMountedGrid = null;
    let lastSlotBitmapSnap = -1;
    let viewportListenersBound = false;
    let viewportResizeTimer = null;

    const DEFAULT_GUI = {
        rotation: [30, 225, 0],
        translation: [0, 0, 0],
        scale: [0.625, 0.625, 0.625]
    };
    // 物品栏格正交视锥半宽（越小图标越大）；对齐 MC GUI 固定机位
    const GUI_FRUSTUM_HALF = 0.36;
    // 占 NDC 视口比例（2.0 为满幅），略留边避免贴边裁切
    const GUI_CELL_FILL = 0.9;

    const FACE_NORMAL = {
        north: [0, 0, -1],
        south: [0, 0, 1],
        east: [1, 0, 0],
        west: [-1, 0, 0],
        up: [0, 1, 0],
        down: [0, -1, 0]
    };

    function computeViewShade(faceName, model) {
        const THREE = getThree();
        const base = FACE_NORMAL[faceName];
        if (!base) return 0.8;

        const gui = (model.display && model.display.gui) || DEFAULT_GUI;
        const rot = gui.rotation || DEFAULT_GUI.rotation;
        const n = new THREE.Vector3(base[0], base[1], base[2]);
        n.applyEuler(new THREE.Euler(
            THREE.MathUtils.degToRad(rot[0]),
            THREE.MathUtils.degToRad(rot[1]),
            THREE.MathUtils.degToRad(rot[2]),
            'XYZ'
        ));

        if (n.z < 0.12) return 0.5;
        if (n.y > 0.55) return 1.0;

        const sx = n.x;
        if (sx > 0.12) return 0.15;
        if (sx < -0.12) return 0.35;
        return 0.68;
    }

    const modelJsonCache = new Map();
    const iconCache = new Map();
    const use3dCache = new Map();
    const textureCache = new Map();
    let renderer = null;
    let camera = null;

    function getThree() {
        return global.THREE;
    }
    let queue = [];
    let draining = false;
    const pendingRenders = new Map();
    const animatedSlots = [];

    /** 物品自身 ID（勿映射到 glass 等，否则玻璃板会误走玻璃的 3D） */
    function normalizeId(id) {
        return String(id).toLowerCase().replace(/-/g, '_');
    }

    /** 资源包贴图/方块模型路径用（涂蜡→未涂蜡、玻璃板→玻璃等） */
    function assetId(id) {
        if (global.getSmartId) return global.getSmartId(id);
        return normalizeId(id);
    }

    /** 草丛、草方块等（物品栏用 2D 平面贴图） */
    const GRASS_LIKE_IDS = new Set([
        'grass', 'short_grass', 'tall_grass', 'fern', 'large_fern', 'dead_bush',
        'seagrass', 'tall_seagrass', 'crimson_roots', 'warped_roots', 'nether_sprouts',
        'short_dry_grass', 'tall_dry_grass', 'leaf_litter'
    ]);

    /** 花类（含盆栽前缀），物品栏用 2D */
    const FLOWER_IDS = new Set([
        'dandelion', 'poppy', 'blue_orchid', 'allium', 'azure_bluet',
        'red_tulip', 'orange_tulip', 'white_tulip', 'pink_tulip', 'oxeye_daisy',
        'cornflower', 'lily_of_the_valley', 'torchflower', 'wither_rose', 'spore_blossom',
        'open_eyeblossom', 'closed_eyeblossom', 'sunflower', 'lilac', 'rose_bush', 'peony',
        'pitcher_plant', 'pitcher_pod', 'pink_petals', 'wildflowers', 'chorus_flower',
        'azalea', 'flowering_azalea', 'mangrove_propagule', 'cactus_flower',
        'firefly_bush'
    ]);

    const BUSH_BLOCK_IDS = new Set(['sweet_berry_bush']);

    function isMcDoorBlockId(id) {
        return !!(id && id.endsWith('_door') && !id.endsWith('_trapdoor'));
    }

    function isMcTrapdoorBlockId(id) {
        return !!(id && id.endsWith('_trapdoor'));
    }

    function isMcGlassPaneItemId(id) {
        if (global.isMcGlassPaneItemId) return global.isMcGlassPaneItemId(id);
        const n = normalizeId(id);
        return n === 'glass_pane' || (n.endsWith('_glass_pane') && n !== 'glass_bottle');
    }

    function isMcConduitItemId(id) {
        return normalizeId(id) === 'conduit';
    }

    function iconForce2dFlatIcon(id) {
        if (!id) return false;
        const nid = normalizeId(id);
        if (global.isMcBedItemId && global.isMcBedItemId(nid)) return true;
        if (global.isMcBannerItemId && global.isMcBannerItemId(nid)) return true;
        if (global.isMcCopperGolemStatueItemId && global.isMcCopperGolemStatueItemId(nid)) return true;
        if (global.isMcShulkerBoxItemId && global.isMcShulkerBoxItemId(nid)) return true;
        if (global.isMcChestBlockItemId && global.isMcChestBlockItemId(nid)) return true;
        if (global.isMcCandleItemId && global.isMcCandleItemId(nid)) return true;
        if (global.isMcTripwireHookItemId && global.isMcTripwireHookItemId(nid)) return true;
        if (global.isMcVineOrRootPlantItemId && global.isMcVineOrRootPlantItemId(nid)) return true;
        if (isMcGlassPaneItemId(nid)) return true;
        if (isMcDoorBlockId(nid)) return true;
        if (GRASS_LIKE_IDS.has(nid)) return true;
        if (FLOWER_IDS.has(nid)) return true;
        if (BUSH_BLOCK_IDS.has(nid)) return true;
        if (nid.endsWith('_sapling')) return true;
        if (nid.startsWith('potted_')) return true;
        if (/_tulip$/.test(nid) || /_orchid$/.test(nid)) return true;
        return false;
    }

    /** 花、草丛等走 2D：item 路径优先；门与原版物品栏一致走 2D 平面 */
    function modelCandidatesFlatFirst(itemId) {
        const id = normalizeId(itemId);
        const itemPath = `item/${id}`;
        // 玻璃板只用 item/generated（layer0=block/glass），勿并入 block/glass 立方体模型
        if (isMcGlassPaneItemId(id)) return [itemPath];
        if (global.isMcCandleItemId && global.isMcCandleItemId(id)) return [itemPath];
        if (global.isMcTripwireHookItemId && global.isMcTripwireHookItemId(id)) return [itemPath];
        if (global.isMcVineOrRootPlantItemId && global.isMcVineOrRootPlantItemId(id)) return [itemPath];
        const rest = modelCandidates(itemId).filter((p) => p !== itemPath);
        return [itemPath, ...rest];
    }

    function parentToPath(parent) {
        if (!parent) return null;
        let p = String(parent);
        if (p.startsWith('minecraft:')) p = p.slice(10);
        return p;
    }

    /** 1.21+ 方块 JSON 中 textures 值可为 { sprite: "minecraft:..." } */
    function textureMapValueToString(val) {
        if (!val) return null;
        if (typeof val === 'string') return val;
        if (typeof val === 'object' && typeof val.sprite === 'string') return val.sprite;
        return null;
    }

    function textureToUrl(ref) {
        if (!ref || ref[0] === '#') return null;
        let t = String(ref);
        if (t.startsWith('minecraft:')) t = t.slice(10);
        const i = t.indexOf('/');
        if (i < 0) return null;
        return `${ASSET_BASE}/textures/${t.slice(0, i)}/${t.slice(i + 1)}.png`;
    }

    function resolveTextureRef(ref, textures, depth) {
        if (!ref || !textures) return null;
        if (depth > 12) return null;
        if (ref[0] !== '#') return textureToUrl(ref);
        const nextRaw = textures[ref.slice(1)];
        const next = textureMapValueToString(nextRaw) || (typeof nextRaw === 'string' ? nextRaw : null);
        if (!next) return null;
        if (next[0] === '#') return resolveTextureRef(next, textures, depth + 1);
        return textureToUrl(next);
    }

    function modelCandidates(itemId) {
        const id = normalizeId(itemId);
        const asset = assetId(itemId);
        const trapdoorBlockParts = isMcTrapdoorBlockId(id)
            ? [`block/${id}_bottom`, `block/${id}_top`, `block/${id}_open`]
            : [];
        const list = [
            `block/${asset}_inventory`,
            ...trapdoorBlockParts,
            `block/${asset}`,
            `item/${id}`
        ];
        if (id.startsWith('enchanted_book')) list.unshift('item/enchanted_book');
        if (/^(potion|splash_potion|lingering_potion)/.test(id)) list.unshift('item/potion');
        if (id.startsWith('arrow_of_')) list.unshift('item/tipped_arrow');
        return [...new Set(list)];
    }

    async function fetchModelJson(path) {
        if (modelJsonCache.has(path)) return modelJsonCache.get(path);
        try {
            const res = await fetch(`${ASSET_BASE}/models/${path}.json`);
            const data = res.ok ? await res.json() : null;
            modelJsonCache.set(path, data);
            return data;
        } catch {
            modelJsonCache.set(path, null);
            return null;
        }
    }

    async function mergeModel(path, visited) {
        if (!path || visited.has(path)) return null;
        visited.add(path);

        if (path === 'builtin/generated') {
            return { elements: [], layers: [], textures: {}, display: { gui: { ...DEFAULT_GUI } } };
        }
        if (path === 'builtin/entity' || path === 'builtin/missing') return null;

        const json = await fetchModelJson(path);
        if (!json) return null;

        let merged = { elements: [], layers: [], textures: {}, display: {} };

        if (json.parent) {
            const parentMerged = await mergeModel(parentToPath(json.parent), visited);
            if (parentMerged) merged = parentMerged;
        }

        if (json.textures) merged.textures = { ...merged.textures, ...json.textures };
        if (json.elements) merged.elements = json.elements;
        if (json.display) merged.display = { ...merged.display, ...json.display };

        const parentPath = parentToPath(json.parent);
        const isGenerated = !json.elements && (
            parentPath === 'item/generated' || path === 'item/generated'
        );
        if (isGenerated || (merged.elements.length === 0 && Object.keys(merged.textures).some((k) => k.startsWith('layer')))) {
            merged.layers = Object.keys(merged.textures)
                .filter((k) => k.startsWith('layer'))
                .sort()
                .map((k) => textureMapValueToString(merged.textures[k]) || (typeof merged.textures[k] === 'string' ? merged.textures[k] : null))
                .filter(Boolean);
        }
        if (!Array.isArray(merged.layers)) merged.layers = [];

        return merged;
    }

    function resolveConduitDisplayModel() {
        return {
            elements: [
                {
                    from: [3, 3, 3],
                    to: [13, 13, 13],
                    faces: {
                        north: { texture: '#base', uv: [0, 0, 16, 16] },
                        south: { texture: '#base', uv: [0, 0, 16, 16] },
                        east: { texture: '#base', uv: [16, 0, 32, 16] },
                        west: { texture: '#base', uv: [16, 0, 32, 16] },
                        up: { texture: '#base', uv: [0, 0, 16, 16] },
                        down: { texture: '#base', uv: [16, 0, 32, 16] }
                    }
                }
            ],
            textureSize: [32, 16],
            textures: {
                base: 'minecraft:entity/conduit/base'
            },
            display: {
                gui: {
                    rotation: [30, 45, 0],
                    translation: [0, 0, 0],
                    scale: [1, 1, 1]
                }
            }
        };
    }

    async function resolveModel(itemId) {
        const id = normalizeId(itemId);
        if (isMcConduitItemId(id)) return resolveConduitDisplayModel();
        const paths = iconForce2dFlatIcon(id) ? modelCandidatesFlatFirst(itemId) : modelCandidates(itemId);
        let flatModel = null;
        for (const path of paths) {
            const m = await mergeModel(path, new Set());
            if (!m) continue;

            if (iconForce2dFlatIcon(id)) {
                if (modelNeeds3d(m)) continue;
                if (m.layers && m.layers.length) return m;
                if (!modelNeeds3d(m) && !flatModel) flatModel = m;
                continue;
            }

            if (modelNeeds3d(m)) return m;
            if (m.layers && m.layers.length && !flatModel) flatModel = m;
        }
        return flatModel;
    }

    function modelNeeds3d(model) {
        return !!(model && model.elements && model.elements.length > 0);
    }

    async function prefers3d(itemId) {
        const id = normalizeId(itemId);
        if (use3dCache.has(id)) return use3dCache.get(id);
        if (iconForce2dFlatIcon(id) || isMcGlassPaneItemId(id)) {
            use3dCache.set(id, false);
            return false;
        }
        const model = await resolveModel(itemId);
        const needs = modelNeeds3d(model);
        use3dCache.set(id, needs);
        return needs;
    }

    async function itemUsesAnimatedTextures(model) {
        if (!global.McTextureAnim || !model || !model.textures) return false;
        const urls = new Set();
        Object.values(model.textures).forEach((ref) => {
            const u = resolveTextureRef(ref, model.textures, 0);
            if (u) urls.add(u);
        });
        for (const url of urls) {
            const meta = await global.McTextureAnim.fetchAnimationMeta(url);
            if (meta) return true;
        }
        return false;
    }

    function loadTexture(url) {
        if (!url) return Promise.resolve(null);
        if (textureCache.has(url)) return textureCache.get(url);
        const p = new Promise((resolve) => {
            const THREE = getThree();
            new THREE.TextureLoader().load(
                url,
                async (t) => {
                    t.magFilter = THREE.NearestFilter;
                    t.minFilter = THREE.NearestFilter;
                    t.colorSpace = THREE.SRGBColorSpace;
                    const meta = global.McTextureAnim
                        ? await global.McTextureAnim.fetchAnimationMeta(url)
                        : null;
                    if (meta && t.image && global.McTextureAnim.setupThreeTexture(t, t.image, meta)) {
                        t.userData.mcAnimated = true;
                    }
                    resolve(t);
                },
                undefined,
                () => resolve(null)
            );
        });
        textureCache.set(url, p);
        return p;
    }

    /** 群系色谱：树叶等用 foliage.png，草方块等用 grass.png（与 Java 采样公式一致） */
    const colormapResolved = new Map();
    const colormapLoading = new Map();

    async function loadColormapImage(kind) {
        if (colormapResolved.has(kind)) return colormapResolved.get(kind);
        if (colormapLoading.has(kind)) return colormapLoading.get(kind);
        const file = kind === 'grass' ? 'grass.png' : 'foliage.png';
        const url = `${ASSET_BASE}/textures/colormap/${file}`;
        const p = new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                const c = document.createElement('canvas');
                c.width = img.naturalWidth || img.width;
                c.height = img.naturalHeight || img.height;
                const ctx = c.getContext('2d');
                ctx.drawImage(img, 0, 0);
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

    /** Java ColorResolver：湿度先 clamp 再乘温度，再映射到 colormap 像素 */
    function sampleColormapBuffer(buf, temperature, downfall) {
        if (!buf || !buf.canvas || buf.w < 1 || buf.h < 1) return null;
        const adjT = Math.min(1, Math.max(0, temperature));
        let adjH = Math.min(1, Math.max(0, downfall));
        adjH *= adjT;
        const x = Math.min(buf.w - 1, Math.max(0, Math.floor((1 - adjT) * (buf.w - 1))));
        const y = Math.min(buf.h - 1, Math.max(0, Math.floor((1 - adjH) * (buf.h - 1))));
        const ctx = buf.canvas.getContext('2d');
        const d = ctx.getImageData(x, y, 1, 1).data;
        return [d[0] / 255, d[1] / 255, d[2] / 255];
    }

    const GRASS_COLORMAP_IDS = new Set([
        'grass_block', 'grass', 'short_grass', 'tall_grass', 'fern', 'large_fern',
        'sugar_cane', 'tall_seagrass', 'seagrass', 'bamboo',
        'moss_block', 'moss_carpet', 'small_dripleaf', 'big_dripleaf'
    ]);

    /** 树叶等用 foliage 图上的 (温度, 湿度) 近似原版常见群系 */
    const FOLIAGE_BIOME_BY_LEAVES = {
        spruce_leaves: [0.15, 0.35],
        birch_leaves: [0.38, 0.42],
        jungle_leaves: [0.9, 0.85],
        acacia_leaves: [0.95, 0.25],
        dark_oak_leaves: [0.45, 0.58],
        mangrove_leaves: [0.55, 0.75],
        oak_leaves: [0.48, 0.62],
        azalea_leaves: [0.45, 0.55],
        flowering_azalea_leaves: [0.45, 0.55],
        cherry_leaves: [0.52, 0.48],
        pale_oak_leaves: [0.42, 0.55]
    };

    const FOLIAGE_DEFAULT_BIOME = [0.48, 0.62];
    const GRASS_DEFAULT_BIOME = [0.8, 0.4];

    function colormapKindForItem(itemId) {
        const id = normalizeId(itemId);
        if (GRASS_COLORMAP_IDS.has(id)) return 'grass';
        return 'foliage';
    }

    function biomeParamsForItem(itemId, kind) {
        const id = normalizeId(itemId);
        if (kind === 'grass') {
            return GRASS_DEFAULT_BIOME;
        }
        if (FOLIAGE_BIOME_BY_LEAVES[id]) return FOLIAGE_BIOME_BY_LEAVES[id];
        if (id.endsWith('_leaves')) return FOLIAGE_DEFAULT_BIOME;
        return FOLIAGE_DEFAULT_BIOME;
    }

    function mcUv(uv, texW, texH) {
        const w = texW || 16;
        const h = texH || 16;
        return [
            uv[0] / w, 1 - uv[1] / h,
            uv[2] / w, 1 - uv[3] / h
        ];
    }

    function pushFace(group, from, to, faceName, face, resolveTex, model) {
        // GUI 斜视机位下底面不可见，不生成 mesh（减绘制、透明块少一层）
        if (faceName === 'down') return;
        const url = resolveTex(face.texture);
        if (!url) return;

        const [x1, y1, z1] = from.map((c) => c / 16 - 0.5);
        const [x2, y2, z2] = to.map((c) => c / 16 - 0.5);
        const texSize = model.textureSize || model.texture_size || [16, 16];
        const uv = mcUv(face.uv || [0, 0, texSize[0], texSize[1]], texSize[0], texSize[1]);

        let positions;
        let uvs;
        switch (faceName) {
            case 'north':
                positions = [x1, y1, z1, x2, y1, z1, x2, y2, z1, x1, y2, z1];
                uvs = [uv[0], uv[3], uv[2], uv[3], uv[2], uv[1], uv[0], uv[1]];
                break;
            case 'south':
                positions = [x2, y1, z2, x1, y1, z2, x1, y2, z2, x2, y2, z2];
                uvs = [uv[0], uv[3], uv[2], uv[3], uv[2], uv[1], uv[0], uv[1]];
                break;
            case 'west':
                positions = [x1, y1, z2, x1, y1, z1, x1, y2, z1, x1, y2, z2];
                uvs = [uv[0], uv[3], uv[2], uv[3], uv[2], uv[1], uv[0], uv[1]];
                break;
            case 'east':
                positions = [x2, y1, z1, x2, y1, z2, x2, y2, z2, x2, y2, z1];
                uvs = [uv[0], uv[3], uv[2], uv[3], uv[2], uv[1], uv[0], uv[1]];
                break;
            case 'up':
                positions = [x1, y2, z2, x2, y2, z2, x2, y2, z1, x1, y2, z1];
                uvs = [uv[0], uv[3], uv[2], uv[3], uv[2], uv[1], uv[0], uv[1]];
                break;
            default:
                return;
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        // FrontSide：正面为 CCW。当前顶点序里仅 up 与 Three 外法向一致，其余面需反转索引以免被背面剔除误删
        const triIdx = faceName === 'up' ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];
        geo.setIndex(triIdx);
        geo.computeVertexNormals();

        const shade = computeViewShade(faceName, model);
        const tintindex = face.tintindex;
        const meshHolder = { geo, url, shade, tintindex };
        group.__meshes = group.__meshes || [];
        group.__meshes.push(meshHolder);
    }

    async function finalizeGroup(group) {
        const THREE = getThree();
        const itemId = group.userData.mcItemId || '';
        const holders = group.__meshes || [];
        delete group.__meshes;

        const needsBiomeTint = holders.some(
            (h) => h.tintindex !== undefined && h.tintindex !== null && h.tintindex >= 0
        );
        let colormapBuf = null;
        if (needsBiomeTint && itemId) {
            const kind = colormapKindForItem(itemId);
            colormapBuf = await loadColormapImage(kind);
        }
        const [temp, downfall] = needsBiomeTint && itemId
            ? biomeParamsForItem(itemId, colormapKindForItem(itemId))
            : [0, 0];
        const tintRgb = colormapBuf ? sampleColormapBuffer(colormapBuf, temp, downfall) : null;

        for (const h of holders) {
            const tex = await loadTexture(h.url);
            if (!tex) continue;
            const shade = h.shade ?? 0.8;
            let r = shade;
            let g = shade;
            let b = shade;
            if (
                tintRgb
                && h.tintindex !== undefined
                && h.tintindex !== null
                && h.tintindex >= 0
            ) {
                r = tintRgb[0] * shade;
                g = tintRgb[1] * shade;
                b = tintRgb[2] * shade;
            }
            const mat = new THREE.MeshBasicMaterial({
                map: tex,
                color: new THREE.Color(r, g, b),
                transparent: true,
                // 单面绘制：背对机位的面不渲染（立方体约一半面被剔除，玻璃少画内侧面、减轻透明叠层）
                side: THREE.FrontSide
            });
            const mesh = new THREE.Mesh(h.geo, mat);
            group.add(mesh);
        }
    }

    async function buildFromElements(model, itemId) {
        const root = new THREE.Group();
        root.userData.mcItemId = normalizeId(itemId || '');
        const resolveTex = (ref) => resolveTextureRef(ref, model.textures, 0);

        model.elements.forEach((el) => {
            Object.entries(el.faces || {}).forEach(([name, face]) => {
                pushFace(root, el.from, el.to, name, face, resolveTex, model);
            });
        });

        await finalizeGroup(root);
        return root.children.length ? root : null;
    }

    async function buildFromLayers(layers) {
        const root = new THREE.Group();
        let z = 0;
        for (const layer of layers) {
            const tex = await loadTexture(textureToUrl(layer));
            if (!tex) continue;
            const mat = new THREE.MeshBasicMaterial({
                map: tex,
                transparent: true,
                side: THREE.DoubleSide,
                depthWrite: false
            });
            const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
            mesh.position.z = z;
            z += 0.002;
            root.add(mesh);
        }
        return root.children.length ? root : null;
    }

    function applyGuiTransform(obj, model) {
        const THREE = getThree();
        const gui = (model.display && model.display.gui) || DEFAULT_GUI;
        const rot = gui.rotation || DEFAULT_GUI.rotation;
        const trans = gui.translation || DEFAULT_GUI.translation;
        const scale = gui.scale || DEFAULT_GUI.scale;
        // MC：绕方块中心 (8,8,8) 依次绕 X、Y、Z 旋转（度）
        obj.rotation.order = 'XYZ';
        obj.rotation.set(
            THREE.MathUtils.degToRad(rot[0]),
            THREE.MathUtils.degToRad(rot[1]),
            THREE.MathUtils.degToRad(rot[2])
        );
        obj.position.set(trans[0] / 16, trans[1] / 16, trans[2] / 16);
        obj.scale.set(scale[0], scale[1], scale[2]);
    }

    function setupMcItemCamera() {
        const THREE = getThree();
        const h = GUI_FRUSTUM_HALF;
        if (!camera || !(camera instanceof THREE.OrthographicCamera)) {
            camera = new THREE.OrthographicCamera(-h, h, h, -h, 0.1, 100);
        } else {
            camera.left = -h;
            camera.right = h;
            camera.top = h;
            camera.bottom = -h;
        }
        // 固定机位看向原点，斜二测感由 display.gui 旋转提供（与游戏物品栏一致）
        camera.position.set(0, 0, 10);
        camera.lookAt(0, 0, 0);
        camera.up.set(0, 1, 0);
        camera.updateProjectionMatrix();
    }

    function getBoxCorners(box, out) {
        const { min, max } = box;
        out[0].set(min.x, min.y, min.z);
        out[1].set(max.x, min.y, min.z);
        out[2].set(min.x, max.y, min.z);
        out[3].set(max.x, max.y, min.z);
        out[4].set(min.x, min.y, max.z);
        out[5].set(max.x, min.y, max.z);
        out[6].set(min.x, max.y, max.z);
        out[7].set(max.x, max.y, max.z);
    }

    function getNdcBounds(group, cam, scratch) {
        const THREE = getThree();
        group.updateMatrixWorld(true);
        cam.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(group);
        if (box.isEmpty()) return null;

        const corners = scratch.corners;
        getBoxCorners(box, corners);
        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;
        const p = scratch.vec;
        for (let i = 0; i < 8; i += 1) {
            p.copy(corners[i]).project(cam);
            minX = Math.min(minX, p.x);
            maxX = Math.max(maxX, p.x);
            minY = Math.min(minY, p.y);
            maxY = Math.max(maxY, p.y);
        }
        return {
            span: Math.max(maxX - minX, maxY - minY, 0.0001),
            minX,
            maxX,
            minY,
            maxY,
            midX: (minX + maxX) / 2,
            midY: (minY + maxY) / 2
        };
    }

    /** 物品栏图标：投影超出 NDC 安全边时整体再缩小一档 */
    function clampNdcExtentIfNeeded(group, cam, scratch) {
        group.updateMatrixWorld(true);
        const bounds = getNdcBounds(group, cam, scratch);
        if (!bounds || bounds.minX == null) return;
        const m = Math.max(
            Math.abs(bounds.minX),
            Math.abs(bounds.maxX),
            Math.abs(bounds.minY),
            Math.abs(bounds.maxY)
        );
        const ndcSafe = 0.9;
        if (m > ndcSafe) {
            group.scale.multiplyScalar(ndcSafe / m);
        }
    }

    function fitModelToGuiCell(group, cam) {
        const scratch = {
            corners: Array.from({ length: 8 }, () => new THREE.Vector3()),
            vec: new THREE.Vector3()
        };
        const targetSpan = 2 * GUI_CELL_FILL;
        let bounds = getNdcBounds(group, cam, scratch);
        if (!bounds) return;

        if (bounds.span > targetSpan) {
            group.scale.multiplyScalar(targetSpan / bounds.span);
            bounds = getNdcBounds(group, cam, scratch);
        }
        if (!bounds) return;

        if (Math.abs(bounds.midX) > 0.002 || Math.abs(bounds.midY) > 0.002) {
            group.updateMatrixWorld(true);
            const THREE = getThree();
            const center = new THREE.Box3().setFromObject(group).getCenter(scratch.vec);
            const ndc = center.clone().project(cam);
            const worldW = (cam.right - cam.left) * 0.5;
            const worldH = (cam.top - cam.bottom) * 0.5;
            group.position.x -= ndc.x * worldW;
            group.position.y -= ndc.y * worldH;
        }

        clampNdcExtentIfNeeded(group, cam, scratch);
    }

    function initRenderer() {
        const THREE = getThree();
        if (!THREE) return false;
        if (renderer) return true;
        renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
        const w = getWebglRenderSize();
        renderer.setSize(w, w, false);
        renderer.setPixelRatio(1);
        renderer.setClearColor(0x000000, 0);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        setupMcItemCamera();
        return true;
    }

    function ensureWebglRendererSize() {
        if (!renderer) return;
        const w = getWebglRenderSize();
        const el = renderer.domElement;
        if (el.width !== w || el.height !== w) {
            renderer.setSize(w, w, false);
        }
    }

    function sync3dSlotCanvasSize(slot) {
        const canvas = slot && slot.querySelector && slot.querySelector('canvas');
        if (!canvas) return;
        const s = get3dSlotBitmapSize();
        if (canvas.width !== s || canvas.height !== s) {
            canvas.width = s;
            canvas.height = s;
        }
    }

    function bindViewportRescaleOnce() {
        if (viewportListenersBound || typeof window === 'undefined') return;
        viewportListenersBound = true;
        function scheduleRemountFor3dResolution() {
            clearTimeout(viewportResizeTimer);
            viewportResizeTimer = setTimeout(() => {
                const s = get3dSlotBitmapSize();
                if (s === lastSlotBitmapSnap) return;
                lastSlotBitmapSnap = s;
                iconCache.clear();
                use3dCache.clear();
                if (lastMountedGrid && lastMountedGrid.isConnected && global.McItemIcon) {
                    global.McItemIcon.mountGrid(lastMountedGrid);
                }
            }, 140);
        }
        window.addEventListener('resize', scheduleRemountFor3dResolution);
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', scheduleRemountFor3dResolution);
        }
    }

    function disposeObject(obj) {
        obj.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                const mats = Array.isArray(child.material) ? child.material : [child.material];
                mats.forEach((m) => m.dispose());
            }
        });
    }

    function paintSlotCanvas(slot) {
        const canvas = slot.querySelector('canvas');
        if (!canvas) return;
        sync3dSlotCanvasSize(slot);
        ensureWebglRendererSize();
        const cw = canvas.width;
        const ch = canvas.height;
        const web = getWebglRenderSize();
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, cw, ch);
        ctx.imageSmoothingEnabled = web > cw;
        if (ctx.imageSmoothingQuality !== undefined) {
            ctx.imageSmoothingQuality = 'high';
        }
        ctx.drawImage(renderer.domElement, 0, 0, web, web, 0, 0, cw, ch);
        canvas.style.opacity = '1';
        const fallback = slot.querySelector('.item-icon-fallback');
        if (fallback) fallback.innerHTML = '';
    }

    function renderGroupOnce(group) {
        ensureWebglRendererSize();
        const renderScene = new THREE.Scene();
        renderScene.add(group);
        renderer.setRenderTarget(null);
        renderer.render(renderScene, camera);
    }

    function mountAnimatedSlot(slot, group) {
        animatedSlots.push({ slot, group });
        slot.dataset.mcAnimated = '1';
        sync3dSlotCanvasSize(slot);
        renderGroupOnce(group);
        paintSlotCanvas(slot);
    }

    function pruneAnimatedSlots() {
        for (let i = animatedSlots.length - 1; i >= 0; i -= 1) {
            if (!animatedSlots[i].slot.isConnected) {
                disposeObject(animatedSlots[i].group);
                animatedSlots.splice(i, 1);
            }
        }
    }

    async function renderItemToSlot(slot, itemId) {
        const THREE = getThree();
        const id = normalizeId(itemId);
        if (!THREE || !initRenderer()) {
            applyIconToSlot(slot, null);
            return;
        }
        sync3dSlotCanvasSize(slot);
        ensureWebglRendererSize();

        const cached = iconCache.get(id);
        if (cached && cached !== 'ANIMATED') {
            applyIconToSlot(slot, cached);
            return;
        }

        const model = await resolveModel(itemId);
        if (!model || !modelNeeds3d(model)) {
            use3dCache.set(id, false);
            applyIconToSlot(slot, null);
            return;
        }
        use3dCache.set(id, true);
        const group = await buildFromElements(model, itemId);
        if (!group) {
            iconCache.set(id, null);
            applyIconToSlot(slot, null);
            return;
        }

        applyGuiTransform(group, model);
        setupMcItemCamera();
        fitModelToGuiCell(group, camera);

        const hasAnimation = await itemUsesAnimatedTextures(model);
        if (hasAnimation) {
            iconCache.set(id, 'ANIMATED');
            mountAnimatedSlot(slot, group);
            return;
        }

        sync3dSlotCanvasSize(slot);
        ensureWebglRendererSize();
        renderGroupOnce(group);
        const dataUrl = renderer.domElement.toDataURL('image/png');
        disposeObject(group);
        iconCache.set(id, dataUrl);
        applyIconToSlot(slot, dataUrl);
    }

    async function renderItemToDataUrl(itemId) {
        const id = normalizeId(itemId);
        if (iconCache.has(id)) {
            const c = iconCache.get(id);
            return c === 'ANIMATED' ? null : c;
        }
        return null;
    }

    function drainQueue() {
        if (draining || !queue.length) return;
        draining = true;
        const { itemId, resolve } = queue.shift();
        renderItemToDataUrl(itemId)
            .then(resolve)
            .catch(() => resolve(null))
            .finally(() => {
                draining = false;
                if (queue.length) requestAnimationFrame(drainQueue);
            });
    }

    function enqueueRender(itemId) {
        const id = normalizeId(itemId);
        if (use3dCache.has(id) && use3dCache.get(id) === false) {
            return Promise.resolve(null);
        }
        const cached = iconCache.get(id);
        if (cached && cached !== 'ANIMATED') return Promise.resolve(cached);
        if (pendingRenders.has(id)) return pendingRenders.get(id);
        const promise = new Promise((resolve) => {
            queue.push({ itemId: id, resolve });
            drainQueue();
        });
        pendingRenders.set(id, promise);
        promise.finally(() => pendingRenders.delete(id));
        return promise;
    }

    function applyIconToSlot(slot, dataUrl) {
        const canvas = slot.querySelector('canvas');
        const fallback = slot.querySelector('.item-icon-fallback');
        if (dataUrl && canvas) {
            const img = new Image();
            img.onload = () => {
                sync3dSlotCanvasSize(slot);
                const ctx = canvas.getContext('2d');
                const cw = canvas.width;
                const ch = canvas.height;
                ctx.clearRect(0, 0, cw, ch);
                const iw = img.naturalWidth || img.width;
                const ih = img.naturalHeight || img.height;
                ctx.imageSmoothingEnabled = iw > cw || ih > ch;
                if (ctx.imageSmoothingQuality !== undefined) {
                    ctx.imageSmoothingQuality = 'high';
                }
                ctx.drawImage(img, 0, 0, iw, ih, 0, 0, cw, ch);
                canvas.style.opacity = '1';
                if (fallback) fallback.innerHTML = '';
            };
            img.src = dataUrl;
        } else if (fallback && typeof global.getTextureHtml === 'function') {
            fallback.innerHTML = global.getTextureHtml(slot.dataset.itemId, slot.dataset.itemName || '');
            if (canvas) canvas.style.opacity = '0';
        }
    }

    getMcCfg().get3dSlotBitmapSize = get3dSlotBitmapSize;

    global.McItemIcon = {
        renderAnimatedSlots() {
            if (!renderer || !camera) return;
            pruneAnimatedSlots();
            animatedSlots.forEach((entry) => {
                renderGroupOnce(entry.group);
                paintSlotCanvas(entry.slot);
            });
        },

        async mountGrid(gridEl) {
            if (!gridEl || !global.McItemIcon.enabled) return;
            pruneAnimatedSlots();
            animatedSlots.length = 0;
            const mounts = [...gridEl.querySelectorAll('.item-icon-mount')];
            for (const wrap of mounts) {
                const itemId = wrap.dataset.itemId;
                if (!itemId) continue;
                const itemName = wrap.dataset.itemName || itemId;
                if (!(await prefers3d(itemId))) continue;
                if (!getThree()) continue;

                const holder = document.createElement('div');
                holder.innerHTML = global.McItemIcon.getIconSlotHtml(itemId, itemName).trim();
                const slot = holder.firstElementChild;
                if (!slot) continue;
                wrap.replaceWith(slot);

                const fallback = slot.querySelector('.item-icon-fallback');
                if (
                    fallback &&
                    !iconCache.has(normalizeId(itemId)) &&
                    typeof global.getTextureHtml === 'function'
                ) {
                    fallback.innerHTML = global.getTextureHtml(itemId, itemName);
                }
                await renderItemToSlot(slot, itemId);
            }
            if (global.McTextureAnim) {
                global.McTextureAnim.initInContainer(gridEl);
            }
            if (global.McEnchantGlint) {
                global.McEnchantGlint.initInContainer(gridEl);
            }
            lastMountedGrid = gridEl;
            lastSlotBitmapSnap = get3dSlotBitmapSize();
            bindViewportRescaleOnce();
        },

        prefers3d,

        getIconSlotHtml(itemId, itemName) {
            const safeId = String(itemId).replace(/"/g, '&quot;');
            const safeName = String(itemName || itemId).replace(/"/g, '&quot;');
            const slotPx = get3dSlotBitmapSize();
            const glintHtml = global.McEnchantGlint && global.McEnchantGlint.itemHasGlint(itemId)
                ? global.McEnchantGlint.glintOverlayHtml(slotPx)
                : '';
            return `
            <div class="item-icon-3d" data-item-id="${safeId}" data-item-name="${safeName}"
                 style="width:${ICON_PX}px;height:${ICON_PX}px;margin-right:${ICON_GAP_RIGHT}px;flex-shrink:0;position:relative;background:rgba(255,255,255,0.03);border-radius:4px;">
                <canvas width="${slotPx}" height="${slotPx}"
                    style="width:${ICON_PX}px;height:${ICON_PX}px;image-rendering:auto;opacity:0;transition:opacity 0.25s;display:block;"></canvas>
                <div class="item-icon-fallback" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;"></div>
                ${glintHtml}
            </div>`;
        },

        enabled: true
    };
})(typeof window !== 'undefined' ? window : globalThis);
