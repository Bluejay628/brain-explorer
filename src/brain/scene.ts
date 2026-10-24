// Three.js brain scene built from a real anatomical model (public/models/brain.json):
//  - cortex: FreeSurfer fsaverage5 pial surface (an average adult brain), shaded by sulcal depth
//  - regions: Desikan-Killiany atlas labels per vertex
//  - deep structures: FreeSurfer aseg meshes (hippocampus, amygdala, thalamus, …)
//  - glands: approximate markers only (hypothalamus, pituitary, pineal)
// See scripts/build-brain-model.py for how the model file is produced.
//
// This is a model of an AVERAGE brain. It is not any real person's brain and it
// carries no activity data. Highlighting only shows where a region is.

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { REGIONS, meshKeysOf, regionForMeshKey } from "../../shared/regions";

export type Appearance = "tissue" | "lab";
export type Part = "left" | "right" | "cerebellum" | "brainstem" | "deep" | "glands";

export interface BrainSceneOptions {
  onSelect?: (regionId: string | null) => void;
  onHover?: (regionId: string | null, x: number, y: number) => void;
  autoRotate?: boolean;
  interactive?: boolean;
}

interface ModelFile {
  quantization: number;
  regions: { key: string; display: string; lobe: string }[];
  cortex: Record<"lh" | "rh", { positions: string; indices: string; sulc: string; labels: string; vertexCount: number }>;
  subcortical: { key: string; hemi: string; positions: string; indices: string }[];
}

function decode(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

let modelPromise: Promise<ModelFile> | null = null;
export function loadModel(): Promise<ModelFile> {
  modelPromise ??= fetch("/models/brain.json").then((r) => {
    if (!r.ok) throw new Error(`Brain model failed to load (HTTP ${r.status})`);
    return r.json();
  });
  modelPromise.catch(() => (modelPromise = null));
  return modelPromise;
}

const PALETTES = {
  tissue: {
    gyrus: new THREE.Color("#e6b8a8"),
    sulcus: new THREE.Color("#8c5a55"),
    deep: new THREE.Color("#c99a8e"),
    cerebellum: new THREE.Color("#d4a294"),
    stem: new THREE.Color("#d8b3a2"),
    callosum: new THREE.Color("#efe6da"),
    boundary: new THREE.Color("#5b3836"),
  },
  lab: {
    gyrus: new THREE.Color("#8ea4cc"),
    sulcus: new THREE.Color("#2d3a58"),
    deep: new THREE.Color("#4f86b8"),
    cerebellum: new THREE.Color("#7f95c0"),
    stem: new THREE.Color("#7d8fb5"),
    callosum: new THREE.Color("#b9c8e6"),
    boundary: new THREE.Color("#1a2238"),
  },
};
const SELECT = new THREE.Color("#3fd6ff");
const HOVER_MIX = 0.35;
const CITED = new THREE.Color("#8b7bff");
/** Distinct colors for "added" subdivisions (ordered for contrast). */
export const PIN_COLORS = ["#f59e0b", "#22c55e", "#ec4899", "#14b8a6", "#eab308", "#ef4444", "#a855f7", "#84cc16", "#06b6d4", "#f97316"];

const INITIAL_CAMERA = new THREE.Vector3(-4.5, 1.1, -1.35);

interface CortexMesh {
  mesh: THREE.Mesh;
  regionKeyOf: (string | null)[]; // per vertex
  sulc: Float32Array; // -1..1 (positive = deep sulcus)
  boundary: Uint8Array; // 1 if vertex is on an atlas boundary
}

export class BrainScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private cortex: { lh?: CortexMesh; rh?: CortexMesh } = {};
  private cortexMaterial: THREE.MeshStandardMaterial;
  private subMeshes: THREE.Mesh[] = [];
  private markers: THREE.Mesh[] = [];
  private dust: THREE.Points;
  private selected: string | null = null;
  private hovered: string | null = null;
  private cited = new Set<string>();
  private pinned: string[] = [];
  private appearance: Appearance = "tissue";
  private showBoundaries = false;
  private colorAtlas = false;
  private visible: Record<Part, boolean> = { left: true, right: true, cerebellum: true, brainstem: true, deep: false, glands: false };
  private frame = 0;
  private resizeObserver: ResizeObserver;
  private downAt: { x: number; y: number } | null = null;
  private resetAnim: { from: THREE.Vector3; t: number } | null = null;
  private disposed = false;
  readonly ready: Promise<void>;

  constructor(private container: HTMLElement, private opts: BrainSceneOptions = {}) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.setAttribute("aria-hidden", "true");

    this.camera = new THREE.PerspectiveCamera(34, 1, 0.05, 100);
    this.camera.position.copy(INITIAL_CAMERA);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.minDistance = 1.4;
    this.controls.maxDistance = 9;
    this.controls.rotateSpeed = 0.7;
    this.controls.autoRotateSpeed = 0.55;
    this.controls.autoRotate = Boolean(opts.autoRotate);
    this.controls.enableZoom = opts.interactive !== false;
    this.controls.target.set(0, 0, 0);

    // Soft studio lighting: warm key, cool fill, cyan rim.
    this.scene.add(new THREE.HemisphereLight("#f2f5ff", "#1a1420", 1.1));
    const key = new THREE.DirectionalLight("#fff4ea", 2.1);
    key.position.set(-3, 4, -2);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight("#b8c8ff", 0.7);
    fill.position.set(3, 1, 2);
    this.scene.add(fill);
    const rim = new THREE.DirectionalLight("#3fd6ff", 0.9);
    rim.position.set(1, 2, 4);
    this.scene.add(rim);
    this.scene.add(new THREE.AmbientLight("#ffffff", 0.15));

    this.cortexMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, metalness: 0.0 });

    // Decorative particle field (not data).
    const dustGeo = new THREE.BufferGeometry();
    const pts = new Float32Array(600 * 3);
    for (let i = 0; i < 600; i++) {
      const r = 1.8 + Math.random() * 1.6;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      pts.set([r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph) * 0.7, r * Math.sin(ph) * Math.sin(th)], i * 3);
    }
    dustGeo.setAttribute("position", new THREE.BufferAttribute(pts, 3));
    this.dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: "#3fd6ff", size: 0.011, transparent: true, opacity: 0.4, depthWrite: false }));
    this.scene.add(this.dust);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();

    if (opts.interactive !== false) {
      const el = this.renderer.domElement;
      el.addEventListener("pointerdown", this.onDown);
      el.addEventListener("pointerup", this.onUp);
      el.addEventListener("pointermove", this.onMove);
      el.addEventListener("pointerleave", this.onLeave);
    }
    this.controls.addEventListener("start", () => (this.resetAnim = null));
    this.loop();
    this.ready = loadModel().then((m) => {
      if (!this.disposed) this.build(m);
    });
  }

  // ───────────────────────────── building ─────────────────────────────
  private build(model: ModelFile) {
    const q = model.quantization;
    const brain = new THREE.Group();
    for (const h of ["lh", "rh"] as const) {
      const c = model.cortex[h];
      const qpos = new Int16Array(decode(c.positions));
      const pos = new Float32Array(qpos.length);
      for (let i = 0; i < qpos.length; i++) pos[i] = qpos[i] / q;
      const idx = new Uint16Array(decode(c.indices));
      const sulcRaw = new Int8Array(decode(c.sulc));
      const labels = new Uint8Array(decode(c.labels));
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      geo.setIndex(new THREE.BufferAttribute(idx, 1));
      geo.computeVertexNormals();
      geo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(c.vertexCount * 3), 3));
      const regionKeyOf = Array.from(labels, (l) => (l === 255 ? null : model.regions[l].key));
      const sulc = Float32Array.from(sulcRaw, (s) => s / 127);
      // Atlas boundaries: vertices with a neighbor in a different region.
      const boundary = new Uint8Array(c.vertexCount);
      for (let t = 0; t < idx.length; t += 3) {
        const a = idx[t], b = idx[t + 1], d = idx[t + 2];
        if (labels[a] !== labels[b] || labels[b] !== labels[d] || labels[a] !== labels[d]) boundary[a] = boundary[b] = boundary[d] = 1;
      }
      const mesh = new THREE.Mesh(geo, this.cortexMaterial);
      mesh.userData.hemi = h;
      brain.add(mesh);
      this.cortex[h] = { mesh, regionKeyOf, sulc, boundary };
    }

    for (const s of model.subcortical) {
      const qpos = new Int16Array(decode(s.positions));
      const pos = new Float32Array(qpos.length);
      for (let i = 0; i < qpos.length; i++) pos[i] = qpos[i] / q;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      geo.setIndex(new THREE.BufferAttribute(new Uint32Array(decode(s.indices)), 1));
      geo.computeVertexNormals();
      const mat = new THREE.MeshStandardMaterial({ roughness: 0.65, metalness: 0, transparent: true });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.userData = { meshKey: s.key, hemi: s.hemi, regionId: regionForMeshKey(s.key)?.id };
      brain.add(mesh);
      this.subMeshes.push(mesh);
    }

    for (const r of REGIONS.filter((x) => x.marker)) {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(r.id === "pineal-gland" ? 0.022 : 0.03, 24, 16),
        new THREE.MeshStandardMaterial({ color: "#f5b84b", emissive: "#7a4a00", emissiveIntensity: 0.8, roughness: 0.4 }),
      );
      m.position.set(...r.marker!);
      m.userData = { regionId: r.id, marker: true };
      brain.add(m);
      this.markers.push(m);
    }

    this.scene.add(brain);
    this.applyVisibility();
    this.paint();
  }

  // ───────────────────────────── public API ─────────────────────────────
  setSelected(id: string | null) {
    this.selected = id;
    const r = id ? REGIONS.find((x) => x.id === id) : undefined;
    if (r?.kind === "marker" && !this.visible.glands) this.setVisible("glands", true);
    if (r && (r.kind === "deep-structure" || r.parent === "basal-ganglia") && !this.visible.deep) this.setVisible("deep", true);
    this.paint();
  }
  setCited(ids: string[]) {
    this.cited = new Set(ids);
    this.paint();
  }
  setPinned(ids: string[]) {
    this.pinned = ids;
    this.paint();
  }
  setAppearance(a: Appearance) {
    this.appearance = a;
    this.paint();
  }
  setBoundaries(on: boolean) {
    this.showBoundaries = on;
    this.paint();
  }
  setColorAtlas(on: boolean) {
    this.colorAtlas = on;
    this.paint();
  }
  setVisible(part: Part, on: boolean) {
    this.visible[part] = on;
    this.applyVisibility();
  }
  getVisible(): Record<Part, boolean> {
    return { ...this.visible };
  }
  setAutoRotate(on: boolean) {
    this.controls.autoRotate = on;
  }
  rotate(degrees: number) {
    const offset = this.camera.position.clone().sub(this.controls.target);
    offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(degrees));
    this.camera.position.copy(this.controls.target).add(offset);
  }
  zoom(factor: number) {
    const offset = this.camera.position.clone().sub(this.controls.target);
    const len = THREE.MathUtils.clamp(offset.length() * factor, this.controls.minDistance, this.controls.maxDistance);
    this.camera.position.copy(this.controls.target).add(offset.setLength(len));
  }
  reset() {
    this.resetAnim = { from: this.camera.position.clone(), t: 0 };
  }
  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    this.controls.dispose();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((x) => x.dispose());
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  // ───────────────────────────── internals ─────────────────────────────
  private applyVisibility() {
    const xray = this.visible.deep;
    if (this.cortex.lh) this.cortex.lh.mesh.visible = this.visible.left;
    if (this.cortex.rh) this.cortex.rh.mesh.visible = this.visible.right;
    // With deep structures on, the cortex turns see-through so they are visible inside.
    this.cortexMaterial.transparent = xray;
    this.cortexMaterial.opacity = xray ? 0.22 : 1;
    this.cortexMaterial.depthWrite = !xray;
    this.cortexMaterial.needsUpdate = true;
    for (const m of this.subMeshes) {
      const key = m.userData.meshKey as string;
      const hemiOk = m.userData.hemi === "both" || (m.userData.hemi === "left" ? this.visible.left || xray : this.visible.right || xray);
      if (key === "cerebellum") m.visible = this.visible.cerebellum;
      else if (key === "brainstem") m.visible = this.visible.brainstem;
      else m.visible = xray && hemiOk;
    }
    for (const m of this.markers) m.visible = this.visible.glands;
    this.paint();
  }

  /** Highlight colors for this paint: mesh key → color, and region id → color (for markers). */
  private highlightMaps() {
    const byKey = new Map<string, THREE.Color>();
    const byId = new Map<string, THREE.Color>();
    // Lowest priority first, so later entries (cited, selected) win.
    const layers: [string, THREE.Color][] = [
      ...this.pinned.map((id, i): [string, THREE.Color] => [id, new THREE.Color(PIN_COLORS[i % PIN_COLORS.length])]),
      ...[...this.cited].map((id): [string, THREE.Color] => [id, CITED]),
      ...(this.selected ? [[this.selected, SELECT] as [string, THREE.Color]] : []),
    ];
    for (const [id, color] of layers) {
      byId.set(id, color);
      for (const k of meshKeysOf(id)) byKey.set(k, color);
    }
    return { byKey, byId };
  }

  private paint() {
    const pal = PALETTES[this.appearance];
    const tmp = new THREE.Color();
    const atlasColors = new Map<string, THREE.Color>();
    const hoverKeys = this.hovered ? meshKeysOf(this.hovered) : [];
    const { byKey, byId } = this.highlightMaps();
    for (const h of ["lh", "rh"] as const) {
      const c = this.cortex[h];
      if (!c) continue;
      const col = c.mesh.geometry.attributes.color as THREE.BufferAttribute;
      for (let i = 0; i < c.regionKeyOf.length; i++) {
        const key = c.regionKeyOf[i];
        // Realistic shading: gyri (crowns) lighter, sulci (grooves) darker.
        const depth = THREE.MathUtils.smoothstep(c.sulc[i], -0.6, 0.6);
        tmp.copy(pal.gyrus).lerp(pal.sulcus, depth * 0.85);
        const hl = key ? byKey.get(key) : undefined;
        if (hl) tmp.lerp(hl, 0.78).multiplyScalar(1 - depth * 0.25);
        else if (this.colorAtlas && key) {
          let ac = atlasColors.get(key);
          if (!ac) {
            ac = new THREE.Color().setHSL((hashKey(key) % 360) / 360, 0.45, 0.55);
            atlasColors.set(key, ac);
          }
          tmp.lerp(ac, 0.55);
        }
        if (key && hoverKeys.includes(key)) tmp.lerp(new THREE.Color("#ffffff"), HOVER_MIX);
        if (this.showBoundaries && c.boundary[i]) tmp.lerp(pal.boundary, 0.7);
        col.setXYZ(i, tmp.r, tmp.g, tmp.b);
      }
      col.needsUpdate = true;
    }
    for (const m of this.subMeshes) {
      const key = m.userData.meshKey as string;
      const mat = m.material as THREE.MeshStandardMaterial;
      const base = key === "cerebellum" ? pal.cerebellum : key === "brainstem" ? pal.stem : key === "corpus-callosum" ? pal.callosum : pal.deep;
      const hl = byKey.get(key) ?? byId.get(m.userData.regionId);
      mat.color.copy(hl ? hl : base);
      if (hoverKeys.includes(key)) mat.color.lerp(new THREE.Color("#ffffff"), HOVER_MIX);
      mat.emissive.set(hl ? hl : "#000000").multiplyScalar(hl ? 0.25 : 0);
      const isDeep = key !== "cerebellum" && key !== "brainstem";
      mat.opacity = isDeep && !hl ? 0.85 : 1;
    }
    for (const m of this.markers) {
      const id = m.userData.regionId as string;
      const mat = m.material as THREE.MeshStandardMaterial;
      const hl = byId.get(id);
      mat.color.set(hl ?? (id === this.hovered ? "#ffe2a8" : "#f5b84b"));
    }
  }

  private pick(clientX: number, clientY: number): string | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const visibleOnly = (o: THREE.Object3D) => o.visible;
    const special = [...this.markers, ...this.subMeshes.filter((m) => m.userData.meshKey !== "cerebellum" && m.userData.meshKey !== "brainstem")].filter(visibleOnly);
    if (this.visible.deep || this.visible.glands) {
      const hit = this.raycaster.intersectObjects(special, false)[0];
      if (hit) return hit.object.userData.regionId ?? null;
    }
    const targets = [this.cortex.lh?.mesh, this.cortex.rh?.mesh, ...this.subMeshes].filter((m): m is THREE.Mesh => !!m && m.visible);
    const hit = this.raycaster.intersectObjects(targets, false)[0];
    if (!hit) return null;
    if (hit.object.userData.regionId) return hit.object.userData.regionId;
    const c = hit.object === this.cortex.lh?.mesh ? this.cortex.lh : this.cortex.rh;
    if (!c || !hit.face) return null;
    const key = c.regionKeyOf[hit.face.a] ?? c.regionKeyOf[hit.face.b] ?? c.regionKeyOf[hit.face.c];
    return key ? regionForMeshKey(key)?.id ?? null : null;
  }

  private onDown = (e: PointerEvent) => {
    this.downAt = { x: e.clientX, y: e.clientY };
  };
  private onUp = (e: PointerEvent) => {
    if (!this.downAt) return;
    const moved = Math.hypot(e.clientX - this.downAt.x, e.clientY - this.downAt.y);
    this.downAt = null;
    if (moved > 5) return; // a drag (rotation), not a click
    this.opts.onSelect?.(this.pick(e.clientX, e.clientY));
  };
  private onMove = (e: PointerEvent) => {
    if (e.pointerType === "touch" || e.buttons) return;
    const id = this.pick(e.clientX, e.clientY);
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (id !== this.hovered) {
      this.hovered = id;
      this.paint();
    }
    this.opts.onHover?.(id, e.clientX - rect.left, e.clientY - rect.top);
  };
  private onLeave = () => {
    if (this.hovered) {
      this.hovered = null;
      this.paint();
    }
    this.opts.onHover?.(null, 0, 0);
  };

  private resize() {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = w / h < 0.9 ? 48 : 34;
    this.camera.updateProjectionMatrix();
  }

  private loop = () => {
    if (this.disposed) return;
    this.frame = requestAnimationFrame(this.loop);
    if (this.resetAnim) {
      this.resetAnim.t = Math.min(1, this.resetAnim.t + 0.05);
      const k = 1 - Math.pow(1 - this.resetAnim.t, 3);
      this.camera.position.lerpVectors(this.resetAnim.from, INITIAL_CAMERA, k);
      if (this.resetAnim.t >= 1) this.resetAnim = null;
    }
    this.dust.rotation.y += 0.0006;
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };
}

function hashKey(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function webglAvailable(): boolean {
  try {
    const c = document.createElement("canvas");
    return Boolean(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl")));
  } catch {
    return false;
  }
}
