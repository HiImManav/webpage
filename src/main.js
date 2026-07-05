import * as THREE from 'three';

// ---------- world constants ----------

const WORLD_SIZE = 120; // sandbox width/depth
const WORLD_HEIGHT = 36; // sandbox ceiling
const CELL = 6; // grid cube size
const EYE_HEIGHT = 1.7;
const CROUCH_EYE_HEIGHT = 1.0;
const PLAYER_RADIUS = 0.6;

// tunable at runtime via the #debug panel
const settings = {
  // movement
  speed: 40, // ground acceleration
  damping: 8, // higher = snappier stops (terminal speed = speed / damping)
  sprintMultiplier: 1.7,
  crouchMultiplier: 0.5,
  jumpVelocity: 9,
  gravity: 26,
  // look
  sensitivity: 0.0022,
  invertY: false,
  fov: 75,
  sprintFovKick: 8, // extra FOV while sprinting, for a sense of speed
  headBob: true,
  bobAmplitude: 0.04,
};

// ---------- scene / camera / renderer ----------

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
scene.fog = new THREE.Fog(0x000000, 8, 65);

const camera = new THREE.PerspectiveCamera(
  settings.fov,
  window.innerWidth / window.innerHeight,
  0.1,
  500
);
camera.position.set(0, EYE_HEIGHT, 25);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

// ---------- white line lattice (cubes everywhere) ----------

function buildLattice() {
  const half = WORLD_SIZE / 2;
  const positions = [];

  for (let y = 0; y <= WORLD_HEIGHT; y += CELL) {
    for (let z = -half; z <= half; z += CELL) {
      positions.push(-half, y, z, half, y, z); // lines along X
    }
    for (let x = -half; x <= half; x += CELL) {
      positions.push(x, y, -half, x, y, half); // lines along Z
    }
  }
  for (let x = -half; x <= half; x += CELL) {
    for (let z = -half; z <= half; z += CELL) {
      positions.push(x, 0, z, x, WORLD_HEIGHT, z); // lines along Y
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3)
  );
  const material = new THREE.LineBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.3,
  });
  return new THREE.LineSegments(geometry, material);
}

const lattice = buildLattice();
scene.add(lattice);

// ---------- the white tower ----------
// Built from four box segments instead of one so a rectangular hole passes
// clean through it near the top. The whole group pivots at ground level and
// leans like Pisa.

const TOWER = {
  x: 0,
  z: -35,
  width: 8,
  depth: 8,
  height: 60,
  lean: THREE.MathUtils.degToRad(5),
};
const HOLE = { width: 4, height: 6, bottom: 47 }; // local Y, near the top

const towerMaterial = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  fog: false,
});

const towerGroup = new THREE.Group();
towerGroup.position.set(TOWER.x, 0, TOWER.z);
towerGroup.rotation.z = TOWER.lean;

{
  const holeTop = HOLE.bottom + HOLE.height;
  const pillarWidth = (TOWER.width - HOLE.width) / 2;

  const segments = [
    // below the hole
    { w: TOWER.width, h: HOLE.bottom, x: 0, y: HOLE.bottom / 2 },
    // above the hole
    {
      w: TOWER.width,
      h: TOWER.height - holeTop,
      x: 0,
      y: (TOWER.height + holeTop) / 2,
    },
    // pillars flanking the hole
    {
      w: pillarWidth,
      h: HOLE.height,
      x: -(HOLE.width + pillarWidth) / 2,
      y: HOLE.bottom + HOLE.height / 2,
    },
    {
      w: pillarWidth,
      h: HOLE.height,
      x: (HOLE.width + pillarWidth) / 2,
      y: HOLE.bottom + HOLE.height / 2,
    },
  ];

  for (const s of segments) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(s.w, s.h, TOWER.depth),
      towerMaterial
    );
    mesh.position.set(s.x, s.y, 0);
    towerGroup.add(mesh);
  }
}

scene.add(towerGroup);

// static AABB obstacles the player can't walk through
const COLLIDERS = [
  { x: TOWER.x, z: TOWER.z, hw: TOWER.width / 2, hd: TOWER.depth / 2 },
];

// ---------- the sign at the tower's base ----------

const SIGN_TEXT = [
  'Traveler,',
  '',
  'You stand in the black sandbox of',
  'Manav Kaushik — a world still under',
  'construction.',
  '',
  'The tower leans because I have not',
  'yet decided whether it should stand',
  'straight.',
  '',
  'More to come.',
  '— M',
].join('\n');

function makeSignTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 12;
  ctx.strokeRect(14, 14, canvas.width - 28, canvas.height - 28);
  ctx.fillStyle = '#000000';
  ctx.font = 'bold 72px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('READ ME', canvas.width / 2, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const sign = new THREE.Group();

const signPost = new THREE.Mesh(
  new THREE.BoxGeometry(0.15, 1.1, 0.15),
  towerMaterial
);
signPost.position.y = 0.55;
sign.add(signPost);

const boardMaterials = [
  towerMaterial, // +x
  towerMaterial, // -x
  towerMaterial, // +y
  towerMaterial, // -y
  new THREE.MeshStandardMaterial({ map: makeSignTexture(), fog: false }), // +z (front)
  towerMaterial, // -z
];
const signBoard = new THREE.Mesh(
  new THREE.BoxGeometry(1.8, 0.9, 0.08),
  boardMaterials
);
signBoard.position.y = 1.55;
sign.add(signBoard);

sign.position.set(0, 0, TOWER.z + TOWER.depth / 2 + 0.9);
scene.add(sign);

// everything the player can click to read — more entries pushed below
const CLICKABLES = [{ object: sign, text: SIGN_TEXT }];

// ---------- curiosities scattered around the void ----------

// deterministic pseudo-random so the layout is identical every visit
function jitter(seed) {
  return (Math.sin(seed * 127.1 + 311.7) * 43758.5453) % 1;
}

function stoneTexture(entries) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ececec';
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = '#181818';
  ctx.textAlign = 'center';
  for (const [text, font, y] of entries) {
    ctx.font = font;
    ctx.fillText(text, 128, y);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// upright slab with a rounded cap and engraved front face
function addStone({ x, z, rotY, width, height, depth, entries }) {
  const group = new THREE.Group();

  const body = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), [
    towerMaterial,
    towerMaterial,
    towerMaterial,
    towerMaterial,
    new THREE.MeshStandardMaterial({ map: stoneTexture(entries), fog: false }),
    towerMaterial,
  ]);
  body.position.y = height / 2;
  group.add(body);

  const capGeometry = new THREE.CylinderGeometry(
    width / 2,
    width / 2,
    depth,
    14,
    1,
    false,
    0,
    Math.PI
  );
  capGeometry.rotateX(-Math.PI / 2); // extrude along depth
  capGeometry.rotateZ(Math.PI / 2); // bulge upward
  const cap = new THREE.Mesh(capGeometry, towerMaterial);
  cap.position.y = height;
  group.add(cap);

  group.position.set(x, 0, z);
  group.rotation.y = rotY;
  scene.add(group);
  COLLIDERS.push({ x, z, hw: width / 2, hd: depth / 2 });
  return group;
}

// --- graveyard of the old website ---
// This repo used to be a Next.js site where a crocodile chased bouncing
// fruit. Those files were deleted, but not forgotten.

const GRAVEYARD = { x: 26, z: -13 };

const DELETED_FILES = [
  'Croc.tsx',
  'BouncingFruits.tsx',
  'apple.png',
  'banana.png',
  'blueberry.png',
  'lemon.png',
  'orange.png',
  'speech-bubble.png',
];

DELETED_FILES.forEach((name, i) => {
  const dot = name.lastIndexOf('.');
  const row = Math.floor(i / 4);
  const col = i % 4;
  addStone({
    x: GRAVEYARD.x + (col - 1.5) * 2.8 + jitter(i) * 0.5,
    z: GRAVEYARD.z + row * 3.4 + jitter(i + 31) * 0.5,
    rotY: jitter(i + 62) * 0.22,
    width: 1.1,
    height: 1.15,
    depth: 0.24,
    entries: [
      ['R.I.P.', '30px Georgia', 76],
      [name.slice(0, dot), 'bold 21px monospace', 140],
      [name.slice(dot), 'bold 21px monospace', 172],
    ],
  });
});

const EPITAPH_TEXT = [
  'Here lies the Old Website',
  '2025 — 2026',
  '',
  'A Next.js shrine of bouncing fruit,',
  'kept by one hungry crocodile.',
  '',
  'It chased the apple. It caught the',
  'banana. It never dropped a frame.',
  '',
  'Deleted in a single commit,',
  'as all things eventually are.',
  '',
  'Its ghost still circles overhead,',
  'waiting for fruit that never falls.',
  '',
  '— M',
].join('\n');

const monument = addStone({
  x: GRAVEYARD.x,
  z: GRAVEYARD.z - 4,
  rotY: 0,
  width: 2.1,
  height: 2.4,
  depth: 0.4,
  entries: [
    ['THE OLD WEBSITE', 'bold 24px Georgia', 64],
    ['2025 — 2026', '20px Georgia', 106],
    ['it bounced. it chomped.', 'italic 17px Georgia', 152],
    ['it shipped.', 'italic 17px Georgia', 178],
    ['~ click to mourn ~', '15px Georgia', 224],
  ],
});
CLICKABLES.push({ object: monument, text: EPITAPH_TEXT });

// the ghost of Croc.tsx, swimming laps over its own grave
const ghostMaterial = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  transparent: true,
  opacity: 0.3,
  fog: false,
  depthWrite: false,
});

const ghostCroc = new THREE.Group();
{
  const part = (w, h, d, x, y, z) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), ghostMaterial);
    mesh.position.set(x, y, z);
    ghostCroc.add(mesh);
  };
  part(3.0, 0.7, 1.2, 0, 0, 0); // body
  part(1.0, 0.55, 0.9, 1.9, -0.05, 0); // head
  part(1.2, 0.28, 0.7, 2.9, -0.18, 0); // snout
  part(0.32, 0.28, 0.32, 2.05, 0.34, -0.28); // eyes
  part(0.32, 0.28, 0.32, 2.05, 0.34, 0.28);
  part(1.5, 0.5, 0.9, -2.1, -0.05, 0); // tail
  part(1.4, 0.32, 0.55, -3.5, -0.12, 0); // tail tip
  part(0.4, 0.7, 0.4, 1.0, -0.55, 0.75); // legs
  part(0.4, 0.7, 0.4, 1.0, -0.55, -0.75);
  part(0.4, 0.7, 0.4, -1.0, -0.55, 0.75);
  part(0.4, 0.7, 0.4, -1.0, -0.55, -0.75);
}
scene.add(ghostCroc);

// --- spiral staircase to nowhere ---
// starts just out of reach and climbs into the dark; fog swallows the top

const stairMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });

const STAIRCASE = { x: 40, z: 12, radius: 5.5, count: 24 };
for (let i = 0; i < STAIRCASE.count; i++) {
  const angle = i * 0.5;
  const step = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 0.25, 1.3),
    stairMaterial
  );
  step.position.set(
    STAIRCASE.x + Math.cos(angle) * STAIRCASE.radius,
    2.6 + i * 0.85,
    STAIRCASE.z + Math.sin(angle) * STAIRCASE.radius
  );
  step.rotation.y = -angle + Math.PI / 2;
  scene.add(step);
}

// --- a caged moon in the far corner ---

const moonMaterial = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  wireframe: true,
});

const moon = new THREE.Group();
moon.position.set(-40, 26, -40);

const moonCore = new THREE.Mesh(
  new THREE.IcosahedronGeometry(3.5, 1),
  moonMaterial
);
moon.add(moonCore);

function makeRing(count, radius, tiltX, tiltZ) {
  const tilt = new THREE.Group();
  tilt.rotation.set(tiltX, 0, tiltZ);
  const spin = new THREE.Group();
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const cube = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.5, 0.5),
      towerMaterial
    );
    cube.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
    cube.rotation.y = angle;
    spin.add(cube);
  }
  tilt.add(spin);
  moon.add(tilt);
  return spin;
}

const ringASpin = makeRing(6, 6, 0.45, 0);
const ringBSpin = makeRing(10, 8.5, -0.2, 0.85);
scene.add(moon);

// --- the watchers ---
// seven obelisks in a ring beneath the moon. Each one quietly turns to
// face you — but only while you aren't looking at it.

const WATCHERS = { x: -40, z: -40, radius: 8, count: 7 };
const watcherPivots = [];
const slitMaterial = new THREE.MeshBasicMaterial({ color: 0x555555 });
for (let i = 0; i < WATCHERS.count; i++) {
  const angle = (i / WATCHERS.count) * Math.PI * 2;
  const x = WATCHERS.x + Math.cos(angle) * WATCHERS.radius;
  const z = WATCHERS.z + Math.sin(angle) * WATCHERS.radius;

  const pivot = new THREE.Group();
  const shaft = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 3.8, 0.7),
    towerMaterial
  );
  shaft.position.y = 1.9;
  const tip = new THREE.Mesh(
    new THREE.CylinderGeometry(0, 0.62, 1.1, 4),
    towerMaterial
  );
  tip.position.y = 4.35;
  tip.rotation.y = Math.PI / 4; // align pyramid faces with the shaft
  const eye = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.55, 0.06),
    slitMaterial
  );
  eye.position.set(0, 3.2, 0.38); // narrow slit on the front face
  pivot.add(shaft, tip, eye);
  pivot.position.set(x, 0, z);
  pivot.rotation.y = angle + Math.PI / 2; // start facing along the ring
  scene.add(pivot);
  watcherPivots.push(pivot);
  COLLIDERS.push({ x, z, hw: 0.35, hd: 0.35 });
}

// --- the hidden constellation ---
// a scrambled cloud of cubes hanging in the western sky. From exactly one
// spot on the floor (marked by a ring) they line up and spell a word.

const VIEWPOINT = new THREE.Vector3(-10, EYE_HEIGHT, 6);
const WORD_CENTER = new THREE.Vector3(-28, 9, -6);

const GLYPHS = {
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
};

{
  const word = 'HELLO';
  const cell = 0.42;
  const columns = word.length * 6 - 1;
  const forward = WORD_CENTER.clone().sub(VIEWPOINT).normalize();
  const right = new THREE.Vector3()
    .crossVectors(forward, THREE.Object3D.DEFAULT_UP)
    .normalize();
  const planeUp = new THREE.Vector3().crossVectors(right, forward).normalize();

  // gather target points on the invisible "text plane"
  const spots = [];
  [...word].forEach((letter, li) => {
    GLYPHS[letter].forEach((rowBits, row) => {
      [...rowBits].forEach((bit, col) => {
        if (bit === '1') spots.push([li * 6 + col, row]);
      });
    });
  });

  const constellation = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    towerMaterial,
    spots.length
  );
  const dummy = new THREE.Object3D();
  spots.forEach(([col, row], i) => {
    const onPlane = WORD_CENTER.clone()
      .addScaledVector(right, (col - (columns - 1) / 2) * cell)
      .addScaledVector(planeUp, (3 - row) * cell);
    // slide each cube a random distance along its sight line; scale keeps
    // the apparent size constant so the word still reads cleanly
    const s = 0.45 + Math.abs(jitter(i)) * 1.15;
    dummy.position.copy(VIEWPOINT).lerp(onPlane, s);
    dummy.rotation.set(
      jitter(i + 500) * Math.PI,
      jitter(i + 700) * Math.PI,
      jitter(i + 900) * Math.PI
    );
    dummy.scale.setScalar(0.34 * s);
    dummy.updateMatrix();
    constellation.setMatrixAt(i, dummy.matrix);
  });
  constellation.frustumCulled = false; // instances span a wide volume
  scene.add(constellation);

  // the marked spot: stand here, look west, see the word
  const plate = new THREE.Mesh(
    new THREE.CylinderGeometry(0.75, 0.75, 0.06, 24),
    towerMaterial
  );
  plate.position.set(VIEWPOINT.x, 0.03, VIEWPOINT.z);
  scene.add(plate);
  const plateRing = new THREE.Mesh(
    new THREE.TorusGeometry(1.05, 0.03, 8, 32),
    towerMaterial
  );
  plateRing.rotation.x = -Math.PI / 2;
  plateRing.position.set(VIEWPOINT.x, 0.06, VIEWPOINT.z);
  scene.add(plateRing);
}

// --- the bell ---
// hangs in a frame north of spawn. Click it: it swings and chimes.

const BELL = { x: 14, z: 38 };
const bellMaterial = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  fog: false,
  side: THREE.DoubleSide, // the inside of the bell is visible from below
});

{
  const postGeometry = new THREE.BoxGeometry(0.35, 3.4, 0.35);
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(postGeometry, towerMaterial);
    post.position.set(BELL.x + side * 1.3, 1.7, BELL.z);
    scene.add(post);
    COLLIDERS.push({ x: BELL.x + side * 1.3, z: BELL.z, hw: 0.175, hd: 0.175 });
  }
  const crossbar = new THREE.Mesh(
    new THREE.BoxGeometry(3.0, 0.35, 0.35),
    towerMaterial
  );
  crossbar.position.set(BELL.x, 3.58, BELL.z);
  scene.add(crossbar);
}

const bellPivot = new THREE.Group();
bellPivot.position.set(BELL.x, 3.4, BELL.z);
{
  const profile = [
    new THREE.Vector2(0.05, 0),
    new THREE.Vector2(0.28, -0.05),
    new THREE.Vector2(0.32, -0.35),
    new THREE.Vector2(0.38, -0.6),
    new THREE.Vector2(0.55, -0.85),
    new THREE.Vector2(0.62, -0.95),
    new THREE.Vector2(0.6, -1.0),
  ];
  const shell = new THREE.Mesh(new THREE.LatheGeometry(profile, 16), bellMaterial);
  const clapper = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 10, 10),
    towerMaterial
  );
  clapper.position.y = -1.02;
  bellPivot.add(shell, clapper);
}
scene.add(bellPivot);

let bellAmp = 0;
let bellPhase = 0;
let audioCtx = null;

function chime() {
  try {
    audioCtx ??= new (window.AudioContext || window.webkitAudioContext)();
    const t0 = audioCtx.currentTime;
    // a soft synthetic bell: fundamental plus two decaying partials
    for (const [freq, gain, dur] of [
      [523.25, 0.12, 2.4],
      [783.99, 0.05, 1.6],
      [1567.98, 0.025, 0.9],
    ]) {
      const osc = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      g.gain.setValueAtTime(gain, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g).connect(audioCtx.destination);
      osc.start(t0);
      osc.stop(t0 + dur);
    }
  } catch {
    // no audio available — the bell still swings
  }
}

CLICKABLES.push({
  object: bellPivot,
  onClick: () => {
    bellAmp = 0.5;
    bellPhase = 0;
    chime();
  },
});

// --- the launch pad ---
// a pulsing disc near the staircase. Step on it and it throws you skyward.

const PAD = { x: 33, z: 17, radius: 1.6, boost: 16 };

function padTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = '#181818';
  ctx.lineWidth = 10;
  for (const r of [36, 72, 108]) {
    ctx.beginPath();
    ctx.arc(128, 128, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const padMesh = new THREE.Mesh(
  new THREE.CylinderGeometry(PAD.radius, PAD.radius, 0.12, 28),
  [
    towerMaterial,
    new THREE.MeshStandardMaterial({ map: padTexture(), fog: false }),
    towerMaterial,
  ]
);
padMesh.position.set(PAD.x, 0.06, PAD.z);
scene.add(padMesh);

// --- void motes ---
// dust rising slowly through the whole sandbox

const MOTE_COUNT = 600;
const moteSpeeds = new Float32Array(MOTE_COUNT);
const motesGeometry = new THREE.BufferGeometry();
{
  const positions = new Float32Array(MOTE_COUNT * 3);
  for (let i = 0; i < MOTE_COUNT; i++) {
    positions[i * 3] = jitter(i * 3) * (WORLD_SIZE / 2);
    positions[i * 3 + 1] = Math.abs(jitter(i * 3 + 1)) * WORLD_HEIGHT;
    positions[i * 3 + 2] = jitter(i * 3 + 2) * (WORLD_SIZE / 2);
    moteSpeeds[i] = 0.15 + Math.abs(jitter(i * 7)) * 0.35;
  }
  motesGeometry.setAttribute(
    'position',
    new THREE.BufferAttribute(positions, 3)
  );
}
const motesMaterial = new THREE.PointsMaterial({
  color: 0xffffff,
  size: 0.12,
  transparent: true,
  opacity: 0.6,
});
const motes = new THREE.Points(motesGeometry, motesMaterial);
scene.add(motes);

// --- the lone door ---
// A freestanding doorframe in the middle of nowhere. Walking through it
// inverts the world. Walking back inverts it back. No explanation given.

const DOOR = { x: -30, z: 20, halfAperture: 1.0 };
{
  const pillarGeometry = new THREE.BoxGeometry(0.45, 4.4, 0.45);
  for (const side of [-1, 1]) {
    const pillar = new THREE.Mesh(pillarGeometry, towerMaterial);
    pillar.position.set(DOOR.x + side * 1.25, 2.2, DOOR.z);
    scene.add(pillar);
    COLLIDERS.push({
      x: DOOR.x + side * 1.25,
      z: DOOR.z,
      hw: 0.225,
      hd: 0.225,
    });
  }
  const lintel = new THREE.Mesh(
    new THREE.BoxGeometry(3.0, 0.45, 0.45),
    towerMaterial
  );
  lintel.position.set(DOOR.x, 4.62, DOOR.z);
  scene.add(lintel);
}

let inverted = false;
const INVERT_MATERIALS = [
  towerMaterial,
  stairMaterial,
  ghostMaterial,
  moonMaterial,
  bellMaterial,
  motesMaterial,
  lattice.material,
];

function setInverted(on) {
  inverted = on;
  document.body.classList.toggle('inverted', on);
  const bg = on ? 0xf4f1e8 : 0x000000;
  scene.background.set(bg);
  scene.fog.color.set(bg);
  const fg = on ? 0x141414 : 0xffffff;
  for (const m of INVERT_MATERIALS) m.color.set(fg);
}

const keyLight = new THREE.DirectionalLight(0xffffff, 2.5);
keyLight.position.set(30, 50, 40);
scene.add(keyLight);

const fillLight = new THREE.AmbientLight(0xffffff, 0.15);
scene.add(fillLight);

// dim uplight so undersides (stairs, ghost croc) aren't pure silhouette
const upLight = new THREE.DirectionalLight(0xffffff, 0.35);
upLight.position.set(-20, -30, -10);
scene.add(upLight);

// ---------- mouse look (click-and-drag) ----------
// Pointer lock is deliberately not used — it's unreliable in some
// browser/display stacks, so drag-look is the one and only camera control.

const MAX_PITCH = Math.PI / 2 - 0.01;

let yaw = 0;
let pitch = 0;
let dragging = false;
let dragMoved = 0;
let lastX = 0;
let lastY = 0;

const canvas = renderer.domElement;

const lookEuler = new THREE.Euler(0, 0, 0, 'YXZ');

function applyLook(dx, dy) {
  yaw -= dx * settings.sensitivity;
  pitch += (settings.invertY ? dy : -dy) * settings.sensitivity;
  pitch = THREE.MathUtils.clamp(pitch, -MAX_PITCH, MAX_PITCH);
  camera.quaternion.setFromEuler(lookEuler.set(pitch, yaw, 0));
}
applyLook(0, 0);

canvas.addEventListener('mousedown', (e) => {
  dragging = true;
  dragMoved = 0;
  lastX = e.clientX;
  lastY = e.clientY;
});

window.addEventListener('mouseup', () => (dragging = false));

document.addEventListener('mousemove', (e) => {
  if (!dragging) return;
  const dx = e.clientX - lastX;
  const dy = e.clientY - lastY;
  dragMoved += Math.abs(dx) + Math.abs(dy);
  lastX = e.clientX;
  lastY = e.clientY;
  applyLook(dx, dy);
});

// ---------- clickables / parchment overlay ----------

const raycaster = new THREE.Raycaster();
const parchment = document.getElementById('parchment');
const parchmentText = document.getElementById('parchment-text');
const pointerNdc = new THREE.Vector2();

// returns the CLICKABLES entry under the cursor, or null
function clickableAt(e) {
  pointerNdc.set(
    (e.clientX / window.innerWidth) * 2 - 1,
    -(e.clientY / window.innerHeight) * 2 + 1
  );
  raycaster.setFromCamera(pointerNdc, camera);
  const hits = raycaster.intersectObjects(
    CLICKABLES.map((c) => c.object),
    true
  );
  if (hits.length === 0) return null;
  for (let obj = hits[0].object; obj; obj = obj.parent) {
    const entry = CLICKABLES.find((c) => c.object === obj);
    if (entry) return entry;
  }
  return null;
}

function openParchment(text) {
  parchmentText.textContent = text;
  parchment.classList.add('open');
}

function closeParchment() {
  parchment.classList.remove('open');
}

parchment.addEventListener('click', (e) => {
  if (e.target === parchment) closeParchment();
});
document
  .getElementById('parchment-close')
  .addEventListener('click', closeParchment);
document.addEventListener('keydown', (e) => {
  if (e.code === 'Escape') closeParchment();
});

canvas.addEventListener('click', (e) => {
  // a drag that ends on the canvas also fires "click" — don't treat it as
  // a genuine click
  if (dragMoved > 4) return;
  const target = clickableAt(e);
  if (!target) return;
  if (target.onClick) target.onClick();
  else openParchment(target.text);
});

// pointer cursor when hovering anything readable
document.addEventListener('mousemove', (e) => {
  if (dragging) return;
  canvas.style.cursor = clickableAt(e) ? 'pointer' : '';
});

// ---------- keyboard input ----------

const keys = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  sprint: false,
  crouch: false,
  jump: false,
};

const KEYMAP = {
  KeyW: 'forward',
  ArrowUp: 'forward',
  KeyS: 'backward',
  ArrowDown: 'backward',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  ShiftLeft: 'sprint',
  ShiftRight: 'sprint',
  KeyC: 'crouch',
  Space: 'jump',
};

document.addEventListener('keydown', (e) => {
  if (!KEYMAP[e.code]) return;
  keys[KEYMAP[e.code]] = true;
  if (e.code === 'Space') e.preventDefault();
});
document.addEventListener('keyup', (e) => {
  if (KEYMAP[e.code]) keys[KEYMAP[e.code]] = false;
});

// alt-tabbing away with a key held would leave it stuck on
window.addEventListener('blur', () => {
  for (const k of Object.keys(keys)) keys[k] = false;
});

// ---------- movement / physics ----------

const velocity = new THREE.Vector3();
let feetY = 0; // 0 = standing on the floor
let verticalVelocity = 0;
let grounded = true;
let eyeHeight = EYE_HEIGHT; // smoothed toward stand/crouch target
let bobPhase = 0;

function collide(pos) {
  // stay inside the sandbox walls
  const bound = WORLD_SIZE / 2 - PLAYER_RADIUS;
  pos.x = THREE.MathUtils.clamp(pos.x, -bound, bound);
  pos.z = THREE.MathUtils.clamp(pos.z, -bound, bound);

  // push out of solid structures (AABB + player radius)
  for (const c of COLLIDERS) {
    const hw = c.hw + PLAYER_RADIUS;
    const hd = c.hd + PLAYER_RADIUS;
    const dx = pos.x - c.x;
    const dz = pos.z - c.z;
    if (Math.abs(dx) >= hw || Math.abs(dz) >= hd) continue;
    const overlapX = hw - Math.abs(dx);
    const overlapZ = hd - Math.abs(dz);
    if (overlapX < overlapZ) {
      pos.x = c.x + Math.sign(dx || 1) * hw;
    } else {
      pos.z = c.z + Math.sign(dz || 1) * hd;
    }
  }
}

const clock = new THREE.Clock();
const scratchDir = new THREE.Vector3();

renderer.setAnimationLoop(() => {
  const delta = Math.min(clock.getDelta(), 0.1);
  const t = clock.elapsedTime;

  // freeze player input while the parchment overlay is up
  const inputEnabled = !parchment.classList.contains('open');

  velocity.x -= velocity.x * settings.damping * delta;
  velocity.z -= velocity.z * settings.damping * delta;

  // normalized wish direction so diagonals aren't faster
  const moveForward = inputEnabled
    ? Number(keys.forward) - Number(keys.backward)
    : 0;
  const moveRight = inputEnabled ? Number(keys.right) - Number(keys.left) : 0;
  const inputLength = Math.hypot(moveForward, moveRight);
  const moving = inputLength > 0;
  const sprinting = moving && keys.sprint && !keys.crouch;

  if (moving) {
    let accel = settings.speed;
    if (sprinting) accel *= settings.sprintMultiplier;
    if (keys.crouch) accel *= settings.crouchMultiplier;
    velocity.z += (moveForward / inputLength) * accel * delta;
    velocity.x += (moveRight / inputLength) * accel * delta;
  }

  // jump / gravity
  if (inputEnabled && keys.jump && grounded) {
    verticalVelocity = settings.jumpVelocity;
    grounded = false;
  }
  if (!grounded) {
    verticalVelocity -= settings.gravity * delta;
    feetY += verticalVelocity * delta;
    if (feetY <= 0) {
      feetY = 0;
      verticalVelocity = 0;
      grounded = true;
    }
  }

  // walk parallel to the ground plane, relative to where we're facing
  const pos = camera.position;
  const prevZ = pos.z;
  pos.x += (Math.sin(yaw) * -velocity.z + Math.cos(yaw) * velocity.x) * delta;
  pos.z += (Math.cos(yaw) * -velocity.z - Math.sin(yaw) * velocity.x) * delta;
  collide(pos);

  // stepping through the lone door flips the world
  if (
    Math.abs(pos.x - DOOR.x) < DOOR.halfAperture &&
    Math.abs(prevZ - DOOR.z) < 1.5 &&
    Math.sign(prevZ - DOOR.z) * Math.sign(pos.z - DOOR.z) < 0
  ) {
    setInverted(!inverted);
  }

  // the launch pad throws anyone standing on it skyward
  if (
    grounded &&
    Math.hypot(pos.x - PAD.x, pos.z - PAD.z) < PAD.radius
  ) {
    verticalVelocity = PAD.boost;
    grounded = false;
  }

  // eye height: smooth stand <-> crouch transition
  const targetEye =
    inputEnabled && keys.crouch ? CROUCH_EYE_HEIGHT : EYE_HEIGHT;
  eyeHeight += (targetEye - eyeHeight) * Math.min(1, 12 * delta);

  // subtle head bob while walking on the ground
  const groundSpeed = Math.hypot(velocity.x, velocity.z);
  let bob = 0;
  if (settings.headBob && grounded && groundSpeed > 0.5) {
    bobPhase += groundSpeed * 2.2 * delta;
    bob = Math.sin(bobPhase) * settings.bobAmplitude;
  }

  pos.y = feetY + eyeHeight + bob;

  // sprint widens the FOV slightly for a sense of speed
  const targetFov = settings.fov + (sprinting ? settings.sprintFovKick : 0);
  if (Math.abs(camera.fov - targetFov) > 0.01) {
    camera.fov += (targetFov - camera.fov) * Math.min(1, 8 * delta);
    camera.updateProjectionMatrix();
  }

  // idle motion for the curiosities
  const crocAngle = t * 0.22;
  ghostCroc.position.set(
    GRAVEYARD.x + Math.cos(crocAngle) * 7,
    4.3 + Math.sin(t * 0.8) * 0.45,
    GRAVEYARD.z + Math.sin(crocAngle) * 7
  );
  ghostCroc.rotation.y = -crocAngle - Math.PI / 2;
  ghostCroc.rotation.z = Math.sin(t * 0.8) * 0.06; // lazy swimming roll
  ringASpin.rotation.y = t * 0.35;
  ringBSpin.rotation.y = -t * 0.22;
  moonCore.rotation.y = t * 0.05;
  padMesh.scale.setScalar(1 + Math.sin(t * 2.5) * 0.03);

  // the watchers turn toward the player, but only while unobserved
  camera.getWorldDirection(scratchDir);
  for (const w of watcherPivots) {
    const dx = w.position.x - pos.x;
    const dz = w.position.z - pos.z;
    if (scratchDir.x * dx + scratchDir.z * dz > 0) continue; // being watched
    const target = Math.atan2(-dx, -dz); // yaw that faces the player
    let diff = target - w.rotation.y;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff)); // shortest arc
    w.rotation.y += diff * Math.min(1, 3 * delta);
  }

  // bell swing decays after a ring
  if (bellAmp > 0.001) {
    bellPhase += 6 * delta;
    bellAmp *= Math.exp(-1.1 * delta);
    bellPivot.rotation.z = Math.sin(bellPhase) * bellAmp;
  }

  // motes drift upward and wrap
  {
    const arr = motesGeometry.attributes.position.array;
    for (let i = 0; i < MOTE_COUNT; i++) {
      arr[i * 3 + 1] += moteSpeeds[i] * delta;
      if (arr[i * 3 + 1] > WORLD_HEIGHT) arr[i * 3 + 1] = 0;
    }
    motesGeometry.attributes.position.needsUpdate = true;
  }

  renderer.render(scene, camera);
  stats?.update();
});

// ---------- resize ----------

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- debug panel (open the site with #debug) ----------

let stats = null;

if (window.location.hash === '#debug') {
  // console access to live state while debugging
  window.__sandbox = {
    camera,
    settings,
    keys,
    state: () => ({
      pos: camera.position.toArray(),
      fov: camera.fov,
      grounded,
      feetY,
      inverted,
      bellAmp,
      watcherYaws: watcherPivots.map((w) => +w.rotation.y.toFixed(3)),
    }),
  };

  Promise.all([
    import('three/addons/libs/lil-gui.module.min.js'),
    import('three/addons/libs/stats.module.js'),
  ]).then(([{ GUI }, { default: Stats }]) => {
    stats = new Stats();
    document.body.appendChild(stats.dom);

    const gui = new GUI({ title: 'sandbox debug' });

    const movement = gui.addFolder('movement');
    movement.add(settings, 'speed', 5, 150, 1);
    movement.add(settings, 'damping', 1, 20, 0.5);
    movement.add(settings, 'sprintMultiplier', 1, 3, 0.05);
    movement.add(settings, 'crouchMultiplier', 0.1, 1, 0.05);
    movement.add(settings, 'jumpVelocity', 3, 20, 0.5);
    movement.add(settings, 'gravity', 5, 60, 1);

    const look = gui.addFolder('look');
    look.add(settings, 'sensitivity', 0.0005, 0.01, 0.0001);
    look.add(settings, 'invertY');
    look.add(settings, 'fov', 50, 110, 1);
    look.add(settings, 'sprintFovKick', 0, 20, 1);
    look.add(settings, 'headBob');
    look.add(settings, 'bobAmplitude', 0, 0.15, 0.005);

    const world = gui.addFolder('world');
    world.add(scene.fog, 'near', 0, 50, 1).name('fog near');
    world.add(scene.fog, 'far', 10, 200, 1).name('fog far');
    world.add(lattice.material, 'opacity', 0, 1, 0.05).name('grid opacity');
    world.add(towerGroup.position, 'y', -30, 30, 1).name('tower sink');
    world
      .add(towerGroup.rotation, 'z', -0.3, 0.3, 0.005)
      .name('tower lean (rad)');
    world
      .add({ invert: () => setInverted(!inverted) }, 'invert')
      .name('invert world');
  });
}
