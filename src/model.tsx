import { resolvePrint } from "../core/print-design.mjs";
import { shirtProfiles } from "../core/shirt-profiles.mjs";
import { DecalGeometry } from "three/addons/geometries/DecalGeometry.js";
import { printCanvas } from "./print-canvas";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { evaluate, effectOf } from "../core/layers.mjs";
export default function Model({ m, s, onPick, printSide, onPrintRegion }: any) {
  const profile =
    shirtProfiles[m.personalization?.model as keyof typeof shirtProfiles];
  const cameraState = useRef<any>(null),
    regionCallback = useRef(onPrintRegion),
    decals = useRef<THREE.Group | null>(null);
  regionCallback.current = onPrintRegion;
  const host = useRef<HTMLDivElement>(null),
    root = useRef<THREE.Object3D | null>(null),
    fit = useRef<(() => void) | null>(null),
    invalidate = useRef<() => void>(() => {}),
    pick = useRef(onPick),
    groups = useRef(m.groups),
    [error, setError] = useState(""),
    [loaded, setLoaded] = useState(0);
  pick.current = onPick;
  groups.current = m.groups;
  const dispose = (obj: THREE.Object3D) =>
    obj.traverse((v: any) => {
      v.geometry?.dispose();
      for (const mat of v.material
        ? Array.isArray(v.material)
          ? v.material
          : [v.material]
        : []) {
        for (const value of Object.values(mat))
          if (value instanceof THREE.Texture) value.dispose();
        mat.dispose();
      }
    });
  const register = (obj: THREE.Object3D) =>
    obj.traverse((v: any) => {
      if (v.isMesh) {
        v.castShadow = true;
        v.receiveShadow = true;
      }
      v.userData.yenzeVisible = v.visible;
      for (const mat of v.material
        ? Array.isArray(v.material)
          ? v.material
          : [v.material]
        : [])
        if (mat.color) mat.userData.yenzeColor = mat.color.getHex();
    });
  useEffect(() => {
    if (!host.current || (m.kind !== "scene-3d" && !m.model)) return;
    const el = host.current;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setError("Este navegador no puede iniciar el visor 3D.");
      return;
    }
    let dead = false,
      framed = false,
      frames = 3,
      visible = true;
    let lastRegion = "";
    invalidate.current = () => {
      frames = 3;
    };
    setError("");
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene(),
      camera = new THREE.PerspectiveCamera(35, 1, 0.01, 1000),
      controls = new OrbitControls(camera, renderer.domElement);
    cameraState.current = { camera, controls };
    const prints = new THREE.Group();
    decals.current = prints;
    scene.add(prints);
    controls.enableDamping = true;
    controls.addEventListener("change", invalidate.current);
    camera.position.set(3, 2, 4);
    controls.update();
    const environment = new RoomEnvironment();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const environmentMap = pmrem.fromScene(environment, 0.04);
    scene.environment = environmentMap.texture;
    scene.environmentIntensity = 0.55;
    environment.dispose();
    pmrem.dispose();
    scene.add(new THREE.HemisphereLight(0xffffff, 0xb3afaa, 1.6));
    const light = new THREE.DirectionalLight(0xffffff, 2.2);
    light.position.set(3, 6, 4);
    light.castShadow = true;
    light.shadow.mapSize.set(1024, 1024);
    light.shadow.normalBias = 0.02;
    scene.add(light);
    const fill = new THREE.DirectionalLight(0xdbe8ff, 1.7);
    fill.position.set(-4, 2, -3);
    scene.add(fill);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 200),
      new THREE.ShadowMaterial({ opacity: 0.1 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    floor.position.y = -0.51;
    scene.add(floor);
    fit.current = () => {
      if (!root.current) return;
      root.current.position.set(0, 0, 0);
      const bounds = new THREE.Box3().setFromObject(root.current);
      if (bounds.isEmpty()) return;
      const size = bounds.getSize(new THREE.Vector3()),
        center = bounds.getCenter(new THREE.Vector3());
      root.current.position.sub(center);
      floor.position.y = -size.y / 2 - 0.003;
      const radius = Math.max(size.x, size.y, size.z, 0.1);
      if (!framed) {
        if (m.personalization) camera.position.set(0, 0, radius * 2.6);
        else camera.position.set(radius * 1.4, radius * 0.9, radius * 1.7);
        framed = true;
      }
      camera.near = radius / 100;
      camera.far = Math.max(radius * 100, 500);
      camera.updateProjectionMatrix();
      controls.maxDistance = radius * 10;
      controls.minDistance = radius * 0.25;
      controls.target.set(0, 0, 0);
      controls.update();
      light.shadow.camera.left = -radius * 2;
      light.shadow.camera.right = radius * 2;
      light.shadow.camera.top = radius * 2;
      light.shadow.camera.bottom = -radius * 2;
      light.shadow.camera.updateProjectionMatrix();
    };
    if (m.kind === "scene-3d") {
      root.current = new THREE.Group();
      scene.add(root.current);
      setLoaded((v) => v + 1);
    } else
      new GLTFLoader().load(
        "/api/assets/" + m.model,
        (g) => {
          if (dead) {
            dispose(g.scene);
            return;
          }
          root.current = g.scene;
          register(g.scene);
          scene.add(g.scene);
          fit.current?.();
          setLoaded((v) => v + 1);
        },
        undefined,
        () => {
          if (!dead)
            setError(
              "No se puede mostrar este GLB. Revisa su geometría y sus texturas.",
            );
        },
      );
    const ray = new THREE.Raycaster(),
      pointer = new THREE.Vector2();
    let down = [0, 0];
    const start = (e: PointerEvent) => (down = [e.clientX, e.clientY]);
    const end = (e: PointerEvent) => {
      if (
        !root.current ||
        !pick.current ||
        Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5
      )
        return;
      const b = el.getBoundingClientRect();
      pointer.set(
        ((e.clientX - b.left) / b.width) * 2 - 1,
        (-(e.clientY - b.top) / b.height) * 2 + 1,
      );
      ray.setFromCamera(pointer, camera);
      const hit = ray.intersectObject(root.current, true).find((v) => {
        let obj: THREE.Object3D | null = v.object;
        while (obj) {
          if (!obj.visible) return false;
          obj = obj.parent;
        }
        return true;
      });
      if (hit) {
        const obj = hit.object as THREE.Mesh,
          mat = Array.isArray(obj.material)
            ? obj.material[hit.face?.materialIndex || 0]
            : obj.material;
        pick.current(
          groups.current.some((g: any) => g.material === mat?.name)
            ? mat.name
            : obj.name,
        );
      }
    };
    renderer.domElement.addEventListener("pointerdown", start);
    renderer.domElement.addEventListener("pointerup", end);
    const observer = new ResizeObserver(() => {
      const { width, height } = el.getBoundingClientRect();
      renderer.setSize(width, height);
      camera.aspect = width / Math.max(1, height);
      camera.updateProjectionMatrix();
      invalidate.current();
    });
    observer.observe(el);
    const visibility = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) invalidate.current();
    });
    visibility.observe(el);
    renderer.setAnimationLoop(() => {
      if (!visible) return;
      controls.update();
      if (frames > 0) {
        if (m.personalization && regionCallback.current && root.current) {
          const center = new THREE.Box3()
            .setFromObject(root.current)
            .getCenter(new THREE.Vector3());
          const a = new THREE.Vector3(
            -profile.width / 2,
            center.y + profile.y + profile.height / 2,
            profile.z * (camera.position.z < 0 ? -1 : 1),
          ).project(camera);
          const b = new THREE.Vector3(
            profile.width / 2,
            center.y + profile.y - profile.height / 2,
            profile.z * (camera.position.z < 0 ? -1 : 1),
          ).project(camera);
          const w = el.clientWidth,
            h = el.clientHeight;
          const region = {
            left: ((Math.min(a.x, b.x) + 1) * w) / 2,
            top: ((1 - Math.max(a.y, b.y)) * h) / 2,
            width: (Math.abs(b.x - a.x) * w) / 2,
            height: (Math.abs(b.y - a.y) * h) / 2,
          };
          const key = Object.values(region)
            .map((v) => Math.round(v * 2))
            .join(",");
          if (key !== lastRegion) {
            lastRegion = key;
            regionCallback.current(region);
          }
        }
        renderer.render(scene, camera);
        frames--;
      }
    });
    return () => {
      dead = true;
      observer.disconnect();
      visibility.disconnect();
      controls.removeEventListener("change", invalidate.current);
      invalidate.current = () => {};
      renderer.setAnimationLoop(null);
      renderer.domElement.removeEventListener("pointerdown", start);
      renderer.domElement.removeEventListener("pointerup", end);
      controls.dispose();
      dispose(scene);
      environmentMap.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      cameraState.current = null;
      decals.current = null;
      root.current = null;
      fit.current = null;
    };
  }, [m.kind, m.model]);
  useEffect(() => {
    if (m.kind !== "scene-3d" || !root.current) return;
    for (const child of [...root.current.children]) {
      dispose(child);
      root.current.remove(child);
    }
    for (const o of m.objects || []) {
      const [x, y, z] = o.size.map((v: number) => Math.max(0.01, v));
      const geometry =
        o.type === "sphere"
          ? new THREE.SphereGeometry(0.5, 32, 20)
          : o.type === "cylinder"
            ? new THREE.CylinderGeometry(0.5, 0.5, 1, 32)
            : new RoundedBoxGeometry(1, 1, 1, 3, 0.025);
      const material = new THREE.MeshStandardMaterial({
        color: o.color,
        roughness: 0.55,
        metalness: 0.04,
      });
      material.name = o.id;
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = o.id;
      mesh.scale.set(x, y, z);
      mesh.position.set(...(o.position as [number, number, number]));
      mesh.rotation.y = (o.rotation * Math.PI) / 180;
      root.current.add(mesh);
    }
    register(root.current);
    fit.current?.();
    setLoaded((v) => v + 1);
  }, [m.objects, m.kind]);
  useEffect(() => {
    if (!root.current) return;
    let r: any;
    try {
      r = evaluate(m, s);
    } catch {
      return;
    }
    root.current.traverse((obj: any) => {
      obj.visible = obj.userData.yenzeVisible ?? true;
      for (const mat of obj.material
        ? Array.isArray(obj.material)
          ? obj.material
          : [obj.material]
        : [])
        if (mat.color && mat.userData.yenzeColor !== undefined)
          mat.color.setHex(mat.userData.yenzeColor);
    });
    for (const g of m.groups) {
      if (!Object.hasOwn(r.selection, g.id) || r.selection[g.id] === null)
        continue;
      const o = g.options.find((o: any) => o.id === r.selection[g.id]);
      if (!o) continue;
      const effect = effectOf(m, g);
      root.current.traverse((obj: any) => {
        if (effect === "visibility" && obj.name === g.node)
          obj.visible = o.visible;
        if (effect === "material")
          for (const mat of obj.material
            ? Array.isArray(obj.material)
              ? obj.material
              : [obj.material]
            : [])
            if (mat.name === g.material && mat.color && o.color)
              mat.color.set(o.color);
      });
    }
    invalidate.current();
  }, [m.groups, s, loaded]);
  useEffect(() => {
    const state = cameraState.current;
    if (!state || !m.personalization || !root.current) return;
    const { camera, controls } = state;
    controls.enabled = !printSide || printSide === "orbit";
    if (printSide && printSide !== "orbit") {
      controls.enableDamping = false;
      const distance = Math.max(1.9, 1.1 / Math.max(camera.aspect, 0.35));
      camera.position.set(0, 0, printSide === "back" ? -distance : distance);
      controls.target.set(0, 0, 0);
      controls.update();
    } else controls.enableDamping = true;
    invalidate.current();
  }, [printSide, loaded, m.personalization?.type]);
  useEffect(() => {
    if (!m.personalization || !root.current || !decals.current) return;
    let cancelled = false;
    const container = decals.current;
    const design = resolvePrint(m, s);
    const meshes: THREE.Mesh[] = [];
    root.current.updateMatrixWorld(true);
    root.current.traverse((o: any) => {
      if (
        o.isMesh &&
        (Array.isArray(o.material) ? o.material : [o.material]).some(
          (mat: any) => mat.name === profile.material,
        )
      )
        meshes.push(o);
    });
    Promise.all(
      ["front", "back"].map(async (side) => ({
        side,
        canvas: await printCanvas(design, side),
      })),
    )
      .then((prints) => {
        if (cancelled) return;
        const oldTextures = new Set<THREE.Texture>();
        for (const child of container.children) {
          const mat = (child as THREE.Mesh)
            .material as THREE.MeshStandardMaterial;
          if (mat.map) oldTextures.add(mat.map);
        }
        for (const texture of oldTextures) texture.dispose();
        for (const { side, canvas } of prints) {
          const texture = new THREE.CanvasTexture(canvas);
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.anisotropy = 8;
          const existing = container.children.filter(
            (o) => o.name === side,
          ) as THREE.Mesh[];
          if (existing.length) {
            for (const mesh of existing) {
              const mat = mesh.material as THREE.MeshStandardMaterial;
              mat.map = texture;
              mat.needsUpdate = true;
            }
            continue;
          }
          const center = new THREE.Box3()
            .setFromObject(root.current!)
            .getCenter(new THREE.Vector3());
          for (const mesh of meshes) {
            const geometry = new DecalGeometry(
              mesh,
              new THREE.Vector3(
                0,
                center.y + profile.y,
                side === "front" ? profile.z : -profile.z,
              ),
              new THREE.Euler(0, side === "back" ? Math.PI : 0, 0),
              new THREE.Vector3(profile.width, profile.height, profile.depth),
            );
            const mat = new THREE.MeshStandardMaterial({
              map: texture,
              transparent: true,
              depthWrite: false,
              polygonOffset: true,
              polygonOffsetFactor: -4,
              roughness: 1,
              metalness: 0,
            });
            const decal = new THREE.Mesh(geometry, mat);
            decal.name = side;
            container.add(decal);
          }
          if (!meshes.length) texture.dispose();
        }
        invalidate.current();
      })
      .catch(() => {
        if (!cancelled)
          setError(
            "Una imagen del diseño no se puede leer. Sustitúyela en el editor.",
          );
      });
    return () => {
      cancelled = true;
    };
  }, [s?.$print, m.personalization?.design, loaded]);
  return (
    <div className="model-preview" ref={host}>
      {(error ||
        (m.kind === "model-3d" && !m.model) ||
        (m.kind === "scene-3d" && !m.objects?.length)) && (
        <div className="empty">
          {error ||
            (m.kind === "scene-3d"
              ? "Añade tu primera pieza para empezar."
              : "Sube tu modelo para reconocer sus piezas.")}
        </div>
      )}
      {onPick && (
        <span className="model-hint">
          Arrastra para girar · Haz clic en una pieza para editarla
        </span>
      )}
    </div>
  );
}
