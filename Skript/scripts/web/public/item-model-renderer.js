// ==========================================
// Minecraft 物品 3D 图标（单 WebGL + 队列 + 缓存，仅渲染可见格子）
// ==========================================
(function (global) {
    const VERSION = '26.1.2';
    const ASSET_BASE = `/${VERSION}/assets/minecraft`;
    const RENDER_SIZE = 64;
    const ICON_PX = 32;

    const DEFAULT_GUI = {
        rotation: [30, 225, 0],
        translation: [0, 0, 0],
        scale: [0.625, 0.625, 0.625]
    };

    const modelJsonCache = new Map();
    const iconCache = new Map();
    const textureCache = new Map();
    let renderer = null;
    let camera = null;

    function getThree() {
        return global.THREE;
    }
    let queue = [];
    let draining = false;
    const pendingRenders = new Map();

    function normalizeId(id) {
        return String(id).toLowerCase().replace(/-/g, '_');
    }

    function parentToPath(parent) {
        if (!parent) return null;
        let p = String(parent);
        if (p.startsWith('minecraft:')) p = p.slice(10);
        return p;
    }

    function textureToUrl(ref) {
        if (!ref || ref[0] === '#') return null;
        let t = String(ref);
        if (t.startsWith('minecraft:')) t = t.slice(10);
        const i = t.indexOf('/');
        if (i < 0) return null;
        return `${ASSET_BASE}/textures/${t.slice(0, i)}/${t.slice(i + 1)}.png`;
    }

    function modelCandidates(itemId) {
        const id = normalizeId(itemId);
        const list = [`item/${id}`, `block/${id}_inventory`, `block/${id}`];
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
                .map((k) => merged.textures[k]);
        }

        return merged;
    }

    async function resolveModel(itemId) {
        for (const path of modelCandidates(itemId)) {
            const m = await mergeModel(path, new Set());
            if (m && (m.elements.length || m.layers.length)) return m;
        }
        return null;
    }

    function loadTexture(url) {
        if (!url) return Promise.resolve(null);
        if (textureCache.has(url)) return textureCache.get(url);
        const p = new Promise((resolve) => {
            new THREE.TextureLoader().load(
                url,
                (t) => {
                    t.magFilter = THREE.NearestFilter;
                    t.minFilter = THREE.NearestFilter;
                    t.colorSpace = THREE.SRGBColorSpace;
                    resolve(t);
                },
                undefined,
                () => resolve(null)
            );
        });
        textureCache.set(url, p);
        return p;
    }

    function mcUv(uv) {
        return [
            uv[0] / 16, 1 - uv[1] / 16,
            uv[2] / 16, 1 - uv[3] / 16
        ];
    }

    function pushFace(group, from, to, faceName, face, resolveTex) {
        const url = resolveTex(face.texture);
        if (!url) return;

        const [x1, y1, z1] = from.map((c) => c / 16 - 0.5);
        const [x2, y2, z2] = to.map((c) => c / 16 - 0.5);
        const uv = mcUv(face.uv || [0, 0, 16, 16]);

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
            case 'down':
                positions = [x1, y1, z1, x2, y1, z1, x2, y1, z2, x1, y1, z2];
                uvs = [uv[0], uv[3], uv[2], uv[3], uv[2], uv[1], uv[0], uv[1]];
                break;
            default:
                return;
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geo.setIndex([0, 1, 2, 0, 2, 3]);
        geo.computeVertexNormals();

        const meshHolder = { geo, url, group };
        group.__meshes = group.__meshes || [];
        group.__meshes.push(meshHolder);
    }

    async function finalizeGroup(group) {
        const holders = group.__meshes || [];
        delete group.__meshes;
        for (const h of holders) {
            const tex = await loadTexture(h.url);
            const mat = new THREE.MeshLambertMaterial({
                map: tex,
                transparent: true,
                side: THREE.DoubleSide
            });
            const mesh = new THREE.Mesh(h.geo, mat);
            group.add(mesh);
        }
    }

    async function buildFromElements(model) {
        const root = new THREE.Group();
        const resolveTex = (ref) => {
            if (!ref) return null;
            if (ref[0] === '#') return textureToUrl(model.textures[ref.slice(1)]);
            return textureToUrl(ref);
        };

        model.elements.forEach((el) => {
            Object.entries(el.faces || {}).forEach(([name, face]) => {
                pushFace(root, el.from, el.to, name, face, resolveTex);
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
        const gui = (model.display && model.display.gui) || DEFAULT_GUI;
        const rot = gui.rotation || DEFAULT_GUI.rotation;
        const trans = gui.translation || DEFAULT_GUI.translation;
        const scale = gui.scale || DEFAULT_GUI.scale;
        obj.rotation.set(
            THREE.MathUtils.degToRad(rot[0]),
            THREE.MathUtils.degToRad(rot[1]),
            THREE.MathUtils.degToRad(rot[2])
        );
        obj.position.set(trans[0] / 16, trans[1] / 16, trans[2] / 16);
        obj.scale.set(scale[0], scale[1], scale[2]);
    }

    function initRenderer() {
        const THREE = getThree();
        if (!THREE) return false;
        if (renderer) return true;
        renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, preserveDrawingBuffer: true });
        renderer.setSize(RENDER_SIZE, RENDER_SIZE);
        renderer.setPixelRatio(1);
        renderer.setClearColor(0x000000, 0);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        camera = new THREE.PerspectiveCamera(35, 1, 0.05, 50);
        return true;
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

    function fitCamera(group) {
        const box = new THREE.Box3().setFromObject(group);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z, 0.05);
        const dist = maxDim * 2.35;
        camera.position.set(center.x + dist, center.y + dist * 0.82, center.z + dist);
        camera.lookAt(center);
    }

    async function renderItemToDataUrl(itemId) {
        if (iconCache.has(itemId)) return iconCache.get(itemId);
        const THREE = getThree();
        if (!THREE || !initRenderer()) {
            return null;
        }

        const model = await resolveModel(itemId);
        if (!model) {
            iconCache.set(itemId, null);
            return null;
        }

        const group = model.layers.length
            ? await buildFromLayers(model.layers)
            : await buildFromElements(model);

        if (!group) {
            iconCache.set(itemId, null);
            return null;
        }

        applyGuiTransform(group, model);

        const renderScene = new THREE.Scene();
        const amb = new THREE.AmbientLight(0xffffff, 0.9);
        const dir = new THREE.DirectionalLight(0xffffff, 0.6);
        dir.position.set(3, 5, 4);
        renderScene.add(amb);
        renderScene.add(dir);
        renderScene.add(group);
        fitCamera(group);

        renderer.setRenderTarget(null);
        renderer.render(renderScene, camera);
        const dataUrl = renderer.domElement.toDataURL('image/png');

        disposeObject(group);
        iconCache.set(itemId, dataUrl);
        return dataUrl;
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
        if (iconCache.has(itemId)) return Promise.resolve(iconCache.get(itemId));
        if (pendingRenders.has(itemId)) return pendingRenders.get(itemId);
        const promise = new Promise((resolve) => {
            queue.push({ itemId, resolve });
            drainQueue();
        });
        pendingRenders.set(itemId, promise);
        promise.finally(() => pendingRenders.delete(itemId));
        return promise;
    }

    function applyIconToSlot(slot, dataUrl) {
        const canvas = slot.querySelector('canvas');
        const fallback = slot.querySelector('.item-icon-fallback');
        if (dataUrl && canvas) {
            const img = new Image();
            img.onload = () => {
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, RENDER_SIZE, RENDER_SIZE);
                ctx.drawImage(img, 0, 0);
                canvas.style.opacity = '1';
                if (fallback) fallback.innerHTML = '';
            };
            img.src = dataUrl;
        } else if (fallback && typeof global.getTextureHtml === 'function') {
            fallback.innerHTML = global.getTextureHtml(slot.dataset.itemId, slot.dataset.itemName || '');
            if (canvas) canvas.style.opacity = '0';
        }
    }

    global.McItemIcon = {
        mountGrid(gridEl) {
            if (!gridEl || !global.McItemIcon.enabled) return;
            if (!getThree()) {
                gridEl.querySelectorAll('.item-icon-3d').forEach((slot) => {
                    applyIconToSlot(slot, null);
                });
                return;
            }
            gridEl.querySelectorAll('.item-icon-3d').forEach((slot) => {
                const itemId = slot.dataset.itemId;
                if (!itemId) return;
                const fallback = slot.querySelector('.item-icon-fallback');
                if (
                    fallback &&
                    !iconCache.has(itemId) &&
                    typeof global.getTextureHtml === 'function'
                ) {
                    fallback.innerHTML = global.getTextureHtml(
                        itemId,
                        slot.dataset.itemName || itemId
                    );
                }
                enqueueRender(itemId).then((url) => applyIconToSlot(slot, url));
            });
        },

        getIconSlotHtml(itemId, itemName) {
            const safeId = String(itemId).replace(/"/g, '&quot;');
            const safeName = String(itemName || itemId).replace(/"/g, '&quot;');
            return `
            <div class="item-icon-3d" data-item-id="${safeId}" data-item-name="${safeName}"
                 style="width:${ICON_PX}px;height:${ICON_PX}px;margin-right:12px;flex-shrink:0;position:relative;background:rgba(255,255,255,0.03);border-radius:4px;">
                <canvas width="${RENDER_SIZE}" height="${RENDER_SIZE}"
                    style="width:${ICON_PX}px;height:${ICON_PX}px;image-rendering:pixelated;opacity:0;transition:opacity 0.25s;display:block;"></canvas>
                <div class="item-icon-fallback" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;"></div>
            </div>`;
        },

        enabled: true
    };
})();
