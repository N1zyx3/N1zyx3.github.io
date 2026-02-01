/* =========================
   SCENE SETUP
========================= */
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);
camera.position.z = 6;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

/* =========================
   TESSERACT (4D)
========================= */
const vertices4D = [];
for (let x of [-1, 1])
for (let y of [-1, 1])
for (let z of [-1, 1])
for (let w of [-1, 1]) {
  vertices4D.push({ x, y, z, w });
}

const edges = [];
for (let i = 0; i < vertices4D.length; i++) {
  for (let j = i + 1; j < vertices4D.length; j++) {
    let diff = 0;
    for (const k of ['x', 'y', 'z', 'w']) {
      if (vertices4D[i][k] !== vertices4D[j][k]) diff++;
    }
    if (diff === 1) edges.push([i, j]);
  }
}

/* =========================
   4D ROTATIONS
========================= */
function rotateXW(v, a) {
  const c = Math.cos(a), s = Math.sin(a);
  return { x: v.x * c - v.w * s, y: v.y, z: v.z, w: v.x * s + v.w * c };
}
function rotateYW(v, a) {
  const c = Math.cos(a), s = Math.sin(a);
  return { x: v.x, y: v.y * c - v.w * s, z: v.z, w: v.y * s + v.w * c };
}
function rotateZW(v, a) {
  const c = Math.cos(a), s = Math.sin(a);
  return { x: v.x, y: v.y, z: v.z * c - v.w * s, w: v.z * s + v.w * c };
}

/* =========================
   4D → 3D PROJECTION
========================= */
function project4Dto3D(v) {
  const d = 3;
  const scale = d / (d - v.w);
  return new THREE.Vector3(
    v.x * scale,
    v.y * scale,
    v.z * scale
  );
}

/* =========================
   GEOMETRY
========================= */
const geometry = new THREE.BufferGeometry();
const material = new THREE.LineBasicMaterial({ color: 0x38bdf8 });
const lines = new THREE.LineSegments(geometry, material);
scene.add(lines);

/* =========================
   MOUSE CONTROL
========================= */
let target = { x: 0, y: 0 };
let angle = { x: 0, y: 0 };

window.addEventListener("mousemove", e => {
  target.x = (e.clientX / window.innerWidth - 0.5) * Math.PI;
  target.y = (e.clientY / window.innerHeight - 0.5) * Math.PI;
});

/* =========================
   ANIMATION
========================= */
function animate() {
  requestAnimationFrame(animate);

  angle.x += (target.x - angle.x) * 0.08;
  angle.y += (target.y - angle.y) * 0.08;

  const projected = vertices4D.map(v => {
    let r = rotateXW(v, angle.x);
    r = rotateYW(r, angle.y);
    r = rotateZW(r, angle.x * 0.7);
    return project4Dto3D(r);
  });

  const positions = [];
  for (const [a, b] of edges) {
    positions.push(
      projected[a].x, projected[a].y, projected[a].z,
      projected[b].x, projected[b].y, projected[b].z
    );
  }

  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3)
  );

  renderer.render(scene, camera);
}

animate();
