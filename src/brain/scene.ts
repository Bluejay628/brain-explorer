// Three.js brain scene.
//
// MODEL STATUS: SCHEMATIC PLACEHOLDER. The geometry below is generated
// procedurally (ellipsoids + noise "folds" + approximate fissures). Region
// boundaries are rough approximations for orientation and teaching only —
// they are NOT anatomically exact and carry NO activity or research data.
//
// To use a real, licensed anatomical mesh later, replace `buildCortex()` with
// a GLTFLoader that loads a model whose meshes are named by region id (see
// README → "Replacing the brain model"). Everything else (picking, selection,
// controls) works with any meshes that carry `userData.regionId`.

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { createNoise3D } from "./noise";
import { REGIONS } from "../../shared/regions";

export interface BrainSceneOptions {
  onSelect?: (regionId: string | null) => void;
  onHover?: (regionId: string | null, x: number, y: number) => void;
  autoRotate?: boolean;
  interactive?: boolean;
}

const CORTEX_REGIONS = ["frontal-lobe", "prefrontal-cortex", "parietal-lobe", "temporal-lobe", "occipital-lobe"] as const;
const REGION_INDEX = new Map(REGIONS.map((r, i) => [r.id, i]));

const BASE = new THREE.Color("#6f82a8");
const SELECT = new THREE.Color("#3fd6ff");
const HOVER = new THREE.Color("#8fb3e6");
const CITED = new THREE.Color("#8b7bff");
const LOBE_TINTS: Record<string, THREE.Color> = {
  "frontal-lobe": new THREE.Color("#4f6fa8"),
  "prefrontal-cortex": new THREE.Color("#5a7fc0"),
  "parietal-lobe": new THREE.Color("#4f8a9e"),
  "temporal-lobe": new THREE.Color("#6a63a8"),
  "occipital-lobe": new THREE.Color("#3f7f8f"),
  cerebellum: new THREE.Color("#5b6f96"),
  brainstem: new THREE.Color("#4e5d7d"),
};

const INITIAL_CAMERA = new THREE.Vector3(-3.1, 1.05, 1.55);

// ─────────────────────────── geometry builders ───────────────────────────

function centralSulcusZ(y: number) {
  return -0.08 + 0.22 * (0.7 - y);
}
function fissureY(z: number) {
  return -0.1 + 0.28 * ((0.42 - z) / 0.84);
}

/** Approximate lobe for a point on the (pre-displacement) hemisphere surface. */
function classifyCortex(x: number, y: number, z: number): string {
  if (z < -0.66) return "occipital-lobe";
  const lateral = Math.abs(x) > 0.25 || y < -0.15;
  if (lateral && y < fissureY(z) && z < 0.55 && z > -0.66) return "temporal-lobe";
  if (z > centralSulcusZ(y)) return z > 0.5 ? "prefrontal-cortex" : "frontal-lobe";
  return "parietal-lobe";
}

interface CortexData {
  geometry: THREE.BufferGeometry;
  regionOf: Uint8Array; // per-vertex region index
  shade: Float32Array; // per-vertex fold shading (0..1)
}

function buildHemisphere(side: 1 | -1, noise: (x: number, y: number, z: number) => number): CortexData {
  const geo = new THREE.SphereGeometry(1, 240, 170);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const n = pos.count;
  const regionOf = new Uint8Array(n);
  const shade = new Float32Array(n);
  const v = new THREE.Vector3();
  const normal = new THREE.Vector3();

  for (let i = 0; i < n; i++) {
    v.fromBufferAttribute(pos, i);
    // Sphere → hemisphere ellipsoid. Medial half is flattened toward the midline.
    const lateralSide = v.x * side > 0;
    let x = v.x * (lateralSide ? 0.6 : 0.14);
    let y = v.y * 0.7;
    let z = v.z * 1.0;
    if (y < 0) y *= 0.72; // flatter base
    x *= 1 - 0.14 * Math.max(0, z); // narrower frontal pole
    if (z > 0.3 && y < -0.12) y += (z - 0.3) * 0.22; // orbitofrontal underside rises
    if (z < -0.5) y *= 1 - (Math.abs(z) - 0.5) * 0.35; // occipital taper
    x += side * 0.16;

    const region = classifyCortex(x - side * 0.16, y, z);
    regionOf[i] = REGION_INDEX.get(region)!;

    // Folding: the zero-crossings of noise form narrow, meandering grooves
    // (sulci) separating broad rounded plateaus (gyri).
    normal.set(x - side * 0.16, y * 1.3, z * 0.7).normalize();
    const f = 4.3;
    const warp = noise(x * 1.6 + 5, y * 1.6, z * 1.6) * 0.35; // bends the folds so they meander
    const a = Math.abs(noise(x * f + warp, y * f, z * f * 0.85 - warp));
    const b = Math.abs(noise(x * f * 1.9 + 9, y * f * 1.9, z * f * 1.9));
    const gyrus = THREE.MathUtils.smoothstep(a, 0.02, 0.26);
    const minor = THREE.MathUtils.smoothstep(b, 0.0, 0.1);
    const ridge = gyrus * 0.9 + minor * 0.1;
    let disp = (ridge - 0.8) * 0.058;

    // Major grooves (only on the lateral surface).
    if (lateralSide) {
      const dSylvian = Math.abs(y - fissureY(z));
      if (z > -0.62 && z < 0.5 && dSylvian < 0.055) disp -= 0.05 * (1 - dSylvian / 0.055);
      const dCentral = Math.abs(z - centralSulcusZ(y));
      if (y > fissureY(z) + 0.03 && dCentral < 0.035) disp -= 0.028 * (1 - dCentral / 0.035);
    }
    shade[i] = THREE.MathUtils.clamp(0.28 + ridge * 0.85 + (disp < -0.045 ? -0.2 : 0), 0.18, 1.1);

    pos.setXYZ(i, x + normal.x * disp, y + normal.y * disp, z + normal.z * disp);
  }
  geo.computeVertexNormals();
  geo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  return { geometry: geo, regionOf, shade };
}

function buildCerebellum(noise: (x: number, y: number, z: number) => number): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(1, 120, 80);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    let x = v.x * 0.56, y = v.y * 0.27, z = v.z * 0.34;
    x *= 1 - 0.18 * Math.exp(-(v.x * v.x) * 30) * (v.z < 0 ? 1 : 0); // midline notch (vermis)
    const folia = Math.sin(v.y * 34 + noise(v.x * 3, v.y * 3, v.z * 3) * 1.4) * 0.012;
    const len = Math.hypot(x, y, z) || 1;
    pos.setXYZ(i, x + (x / len) * folia, y + (y / len) * folia, z + (z / len) * folia);
  }
  geo.computeVertexNormals();
  return geo;
}

function ellipsoid(sx: number, sy: number, sz: number) {
  const g = new THREE.SphereGeometry(1, 32, 24);
  g.scale(sx, sy, sz);
  return g;
}

function tube(points: [number, number, number][], radius: number) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  return new THREE.TubeGeometry(curve, 40, radius, 12, false);
}

/** Approximate positions of deep structures (both hemispheres). */
function deepStructureGeometries(): [string, THREE.BufferGeometry, [number, number, number]][] {
  const out: [string, THREE.BufferGeometry, [number, number, number]][] = [];
  for (const s of [1, -1]) {
    out.push(["thalamus", ellipsoid(0.1, 0.085, 0.15), [s * 0.1, -0.02, -0.12]]);
    out.push(["basal-ganglia", ellipsoid(0.07, 0.13, 0.22), [s * 0.25, 0.02, 0.1]]);
    out.push(["amygdala", ellipsoid(0.06, 0.06, 0.07), [s * 0.34, -0.3, 0.24]]);
    out.push(["hippocampus", tube([[s * 0.34, -0.3, 0.14], [s * 0.36, -0.26, -0.05], [s * 0.3, -0.16, -0.3], [s * 0.2, -0.04, -0.38]], 0.045), [0, 0, 0]]);
    out.push(["insula", ellipsoid(0.035, 0.13, 0.22), [s * 0.47, -0.02, 0.06]]);
    out.push(["anterior-cingulate", tube([[s * 0.05, 0.02, 0.56], [s * 0.05, 0.22, 0.48], [s * 0.05, 0.34, 0.25], [s * 0.05, 0.36, -0.02]], 0.05), [0, 0, 0]]);
  }
  return out;
}

// ─────────────────────────────── scene ───────────────────────────────

export class BrainScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private hemis: { mesh: THREE.Mesh; data: CortexData }[] = [];
  private solidMeshes: THREE.Mesh[] = []; // cerebellum, brainstem
  private deepMeshes: THREE.Mesh[] = [];
  private cortexMaterial: THREE.MeshStandardMaterial;
  private dust: THREE.Points;
  private selected: string | null = null;
  private hovered: string | null = null;
  private cited = new Set<string>();
  private xray = false;
  private showLobes = false;
  private frame = 0;
  private resizeObserver: ResizeObserver;
  private downAt: { x: number; y: number } | null = null;
  private resetAnim: { from: THREE.Vector3; t: number } | null = null;
  private disposed = false;

  constructor(private container: HTMLElement, private opts: BrainSceneOptions = {}) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.setAttribute("aria-hidden", "true");

    this.camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
    this.camera.position.copy(INITIAL_CAMERA);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.minDistance = 2.0;
    this.controls.maxDistance = 7;
    this.controls.rotateSpeed = 0.7;
    this.controls.autoRotateSpeed = 0.55;
    this.controls.autoRotate = Boolean(opts.autoRotate);
    this.controls.enableZoom = opts.interactive !== false;
    this.controls.target.set(0, -0.08, -0.05);

    // Lighting: cool key light, cyan rim, violet back light.
    this.scene.add(new THREE.HemisphereLight("#9fb8ff", "#0a0f1e", 0.85));
    const key = new THREE.DirectionalLight("#dfe9ff", 1.5);
    key.position.set(-3, 4, 3);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight("#3fd6ff", 1.4);
    rim.position.set(3, 1, -3);
    this.scene.add(rim);
    const back = new THREE.DirectionalLight("#8b7bff", 0.8);
    back.position.set(0, -3, -4);
    this.scene.add(back);

    this.cortexMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.08, emissive: new THREE.Color("#0a1a33"), emissiveIntensity: 0.6 });

    const noise = createNoise3D(11);
    const brain = new THREE.Group();
    for (const side of [1, -1] as const) {
      const data = buildHemisphere(side, noise);
      const mesh = new THREE.Mesh(data.geometry, this.cortexMaterial);
      mesh.userData.kind = "cortex";
      this.hemis.push({ mesh, data });
      brain.add(mesh);
    }
    const solidMat = (color: THREE.Color) =>
      new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.08, emissive: new THREE.Color("#0a1a33"), emissiveIntensity: 0.6, transparent: true });
    const cereb = new THREE.Mesh(buildCerebellum(noise), solidMat(BASE.clone()));
    cereb.position.set(0, -0.5, -0.66);
    cereb.rotation.x = 0.25;
    cereb.userData.regionId = "cerebellum";
    const stem = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.55, 8, 20), solidMat(BASE.clone()));
    stem.position.set(0, -0.72, -0.26);
    stem.rotation.x = 0.32;
    stem.userData.regionId = "brainstem";
    const pons = new THREE.Mesh(ellipsoid(0.15, 0.13, 0.13), stem.material);
    pons.position.set(0, -0.56, -0.16);
    pons.userData.regionId = "brainstem";
    this.solidMeshes.push(cereb, stem, pons);
    brain.add(cereb, stem, pons);

    for (const [id, geo, p] of deepStructureGeometries()) {
      const m = new THREE.Mesh(
        geo,
        new THREE.MeshStandardMaterial({ color: "#3fd6ff", emissive: "#145a80", emissiveIntensity: 0.9, roughness: 0.4, transparent: true, opacity: 0.85 }),
      );
      m.position.set(...p);
      m.userData.regionId = id;
      m.visible = false;
      this.deepMeshes.push(m);
      brain.add(m);
    }
    this.scene.add(brain);

    // Decorative particle field (not data).
    const dustGeo = new THREE.BufferGeometry();
    const pts = new Float32Array(700 * 3);
    for (let i = 0; i < 700; i++) {
      const r = 1.7 + Math.random() * 1.6;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      pts.set([r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph) * 0.7, r * Math.sin(ph) * Math.sin(th)], i * 3);
    }
    dustGeo.setAttribute("position", new THREE.BufferAttribute(pts, 3));
    this.dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: "#3fd6ff", size: 0.012, transparent: true, opacity: 0.45, depthWrite: false }));
    this.scene.add(this.dust);

    this.paint();
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
  }

  // ── public API ──
  setSelected(id: string | null) {
    this.selected = id;
    const deep = id && this.deepMeshes.some((m) => m.userData.regionId === id);
    if (deep && !this.xray) this.setXray(true);
    this.paint();
  }
  setCited(ids: string[]) {
    this.cited = new Set(ids);
    this.paint();
  }
  setXray(on: boolean) {
    this.xray = on;
    this.cortexMaterial.transparent = on;
    this.cortexMaterial.opacity = on ? 0.16 : 1;
    this.cortexMaterial.depthWrite = !on;
    this.cortexMaterial.needsUpdate = true;
    for (const m of this.solidMeshes) {
      const mat = m.material as THREE.MeshStandardMaterial;
      mat.opacity = on ? 0.25 : 1;
      mat.depthWrite = !on;
    }
    for (const m of this.deepMeshes) m.visible = on;
    this.paint();
  }
  setShowLobes(on: boolean) {
    this.showLobes = on;
    this.paint();
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

  // ── internals ──
  private colorFor(id: string, base: THREE.Color): THREE.Color {
    if (id === this.selected) return SELECT;
    if (this.cited.has(id)) return CITED;
    if (id === this.hovered) return HOVER;
    return this.showLobes ? LOBE_TINTS[id] ?? base : base;
  }

  private paint() {
    const tmp = new THREE.Color();
    for (const { mesh, data } of this.hemis) {
      const col = mesh.geometry.attributes.color as THREE.BufferAttribute;
      for (let i = 0; i < data.regionOf.length; i++) {
        const id = REGIONS[data.regionOf[i]].id;
        // Selecting "frontal lobe" also lights up its prefrontal part.
        const effective = id === "prefrontal-cortex" && this.selected === "frontal-lobe" ? "frontal-lobe" : id;
        tmp.copy(this.colorFor(effective, BASE)).multiplyScalar(data.shade[i]);
        col.setXYZ(i, tmp.r, tmp.g, tmp.b);
      }
      col.needsUpdate = true;
    }
    for (const m of this.solidMeshes) {
      (m.material as THREE.MeshStandardMaterial).color.copy(this.colorFor(m.userData.regionId, BASE));
    }
    for (const m of this.deepMeshes) {
      const id = m.userData.regionId;
      const mat = m.material as THREE.MeshStandardMaterial;
      const active = id === this.selected || id === this.hovered || this.cited.has(id);
      mat.color.set(id === this.selected ? "#3fd6ff" : this.cited.has(id) ? "#8b7bff" : active ? "#8fdcff" : "#1f3d5e");
      mat.emissive.set(id === this.selected ? "#1a7fb0" : active ? "#24507a" : "#0b1a2c");
      mat.opacity = active ? 0.95 : 0.4;
    }
  }

  private pick(clientX: number, clientY: number): string | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    if (this.xray) {
      const deep = this.raycaster.intersectObjects(this.deepMeshes, false)[0];
      if (deep) return deep.object.userData.regionId;
    }
    const hit = this.raycaster.intersectObjects([...this.hemis.map((h) => h.mesh), ...this.solidMeshes], false)[0];
    if (!hit) return null;
    if (hit.object.userData.regionId) return hit.object.userData.regionId;
    const hemi = this.hemis.find((h) => h.mesh === hit.object);
    if (!hemi || !hit.face) return null;
    return REGIONS[hemi.data.regionOf[hit.face.a]].id;
  }

  private onDown = (e: PointerEvent) => {
    this.downAt = { x: e.clientX, y: e.clientY };
  };
  private onUp = (e: PointerEvent) => {
    if (!this.downAt) return;
    const moved = Math.hypot(e.clientX - this.downAt.x, e.clientY - this.downAt.y);
    this.downAt = null;
    if (moved > 5) return; // it was a drag (rotation), not a click
    const id = this.pick(e.clientX, e.clientY);
    this.opts.onSelect?.(id);
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
    // Keep the whole brain in view on narrow screens.
    this.camera.fov = w / h < 0.9 ? 50 : 36;
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

export function webglAvailable(): boolean {
  try {
    const c = document.createElement("canvas");
    return Boolean(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl")));
  } catch {
    return false;
  }
}

export { CORTEX_REGIONS };
