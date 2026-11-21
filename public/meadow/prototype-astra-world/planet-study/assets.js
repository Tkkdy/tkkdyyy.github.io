import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { ASSET } from "./config.js";
function normalizedGroup(scene, names, pivot) {
  const group = new THREE.Group();
  for (const name of names) {
    const source = scene.getObjectByName(name);
    if (!source) throw Error("缺少已验收资产：" + name);
    const mesh = source.clone();
    mesh.geometry = source.geometry.clone().applyMatrix4(source.matrixWorld);
    mesh.geometry.translate(-pivot[0], -pivot[1], -pivot[2]);
    mesh.position.set(0, 0, 0);
    mesh.quaternion.identity();
    mesh.scale.set(1, 1, 1);
    mesh.castShadow = true;
    mesh.receiveShadow = false;
    group.add(mesh);
  }
  return group;
}
// Split merged baked rocks by welded connectivity, preserving all exported attributes.
function splitRocks(source) {
  const geometry = source.geometry.clone().applyMatrix4(source.matrixWorld),
    pos = geometry.attributes.position,
    idx =
      geometry.index?.array ||
      Uint32Array.from({ length: pos.count }, (_, i) => i),
    parent = Array.from({ length: pos.count }, (_, i) => i),
    weld = new Map();
  const find = (i) => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  const union = (a, b) => {
    parent[find(a)] = find(b);
  };
  for (let i = 0; i < pos.count; i++) {
    const key = [pos.getX(i), pos.getY(i), pos.getZ(i)]
      .map((v) => Math.round(v * 10000))
      .join(",");
    if (weld.has(key)) union(i, weld.get(key));
    else weld.set(key, i);
  }
  for (let i = 0; i < idx.length; i += 3) {
    union(idx[i], idx[i + 1]);
    union(idx[i], idx[i + 2]);
  }
  const parts = new Map();
  for (let i = 0; i < idx.length; i += 3) {
    const root = find(idx[i]);
    if (!parts.has(root)) parts.set(root, []);
    parts.get(root).push(idx[i], idx[i + 1], idx[i + 2]);
  }
  return [...parts.values()].map((indices) => {
    const g = new THREE.BufferGeometry();
    for (const [name, a] of Object.entries(geometry.attributes)) {
      const data = new a.array.constructor(indices.length * a.itemSize);
      indices.forEach((index, i) => {
        for (let k = 0; k < a.itemSize; k++)
          data[i * a.itemSize + k] = a.array[index * a.itemSize + k];
      });
      g.setAttribute(
        name,
        new THREE.BufferAttribute(data, a.itemSize, a.normalized),
      );
    }
    g.computeBoundingBox();
    const center = g.boundingBox.getCenter(new THREE.Vector3()),
      foot = g.boundingBox.min.y;
    g.translate(-center.x, -foot, -center.z);
    const mesh = new THREE.Mesh(g, source.material);
    mesh.castShadow = true;
    return mesh;
  });
}
export async function loadApprovedAssets() {
  const response = await fetch(ASSET);
  if (!response.ok) throw Error("小样资产加载失败");
  const data = await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer(),
    gltf = await new GLTFLoader().parseAsync(data, new URL(".", ASSET).href);
  gltf.scene.updateMatrixWorld(true);
  const lamps = new Map();
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      m.toneMapped = false;
      if (m.emissive?.getHex() && m.emissiveIntensity > 0)
        lamps.set(m, m.emissiveIntensity);
    }
  });
  return {
    cottage: normalizedGroup(
      gltf.scene,
      ["cottage_painted_scene", "windows_soft_amber", "windows_amber_glass"],
      [-1, 0.243714451, -0.4],
    ),
    tree: normalizedGroup(
      gltf.scene,
      ["blossom_painted_scene", "blossom_painted_petals"],
      [2.6, 0.145, -1],
    ),
    rocks: splitRocks(
      gltf.scene.getObjectByName("meadow_stones_painted_scene"),
    ),
    lamps,
    assetBytes: data.byteLength,
  };
}
