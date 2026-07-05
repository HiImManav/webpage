import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

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
  dashImpulse: 42, // air dash burst (damping eats it: distance ≈ impulse/damping)
  // look
  sensitivity: 0.0022,
  invertY: false,
  mirrorPool: true, // the true mirror; a cheap disc stands in when off/far
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

// rounded stone caps accumulate here and merge into one mesh at the end
const stoneCapGeometries = [];

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

  // the cap sits on the group's rotation axis, so its world transform can
  // be baked directly into the geometry for the merged-caps mesh
  stoneCapGeometries.push(
    new THREE.CylinderGeometry(width / 2, width / 2, depth, 14, 1, false, 0, Math.PI)
      .rotateX(-Math.PI / 2) // extrude along depth
      .rotateZ(Math.PI / 2) // bulge upward
      .rotateY(rotY)
      .translate(x, height, z)
  );

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

const stoneGroups = []; // kept so each grave can speak when clicked

DELETED_FILES.forEach((name, i) => {
  const dot = name.lastIndexOf('.');
  const row = Math.floor(i / 4);
  const col = i % 4;
  stoneGroups.push({
    name,
    group: addStone({
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
    }),
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

// all stone caps in a single draw call
scene.add(new THREE.Mesh(mergeGeometries(stoneCapGeometries), towerMaterial));

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
  // all parts move as one rigid body — merge them into a single draw call
  const parts = [];
  const part = (w, h, d, x, y, z) =>
    parts.push(new THREE.BoxGeometry(w, h, d).translate(x, y, z));
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
  ghostCroc.add(new THREE.Mesh(mergeGeometries(parts), ghostMaterial));
}
scene.add(ghostCroc);

// --- spiral staircase to nowhere ---
// starts just out of reach and climbs into the dark; fog swallows the top

const stairMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });

const STAIRCASE = { x: 40, z: 12, radius: 5.5, count: 24 };

// walkable surfaces: rotated-box footprints the player can land on
const STEP_PLATFORMS = [];
let topReached = false;

const TOP_MESSAGE = [
  'THE TOP OF NOWHERE',
  '',
  'You climbed a staircase that was',
  'built to go nowhere, and you made',
  'it go somewhere.',
  '',
  'That is the whole trick.',
  'That is the entire secret',
  'of everything.',
  '',
  'The view is yours.',
  'The fall is optional.',
].join('\n');

{
  const steps = [];
  for (let i = 0; i < STAIRCASE.count; i++) {
    const angle = i * 0.5;
    const rotY = -angle + Math.PI / 2;
    const x = STAIRCASE.x + Math.cos(angle) * STAIRCASE.radius;
    const y = 2.2 + i * 0.85;
    const z = STAIRCASE.z + Math.sin(angle) * STAIRCASE.radius;
    steps.push(
      new THREE.BoxGeometry(2.4, 0.25, 1.3).rotateY(rotY).translate(x, y, z)
    );
    STEP_PLATFORMS.push({
      x,
      z,
      cos: Math.cos(rotY),
      sin: Math.sin(rotY),
      hw: 1.2,
      hd: 0.65,
      topY: y + 0.125,
    });
  }

  // the landing at the top, one last hop above the final step
  const topAngle = STAIRCASE.count * 0.5;
  const topX = STAIRCASE.x + Math.cos(topAngle) * STAIRCASE.radius;
  const topZ = STAIRCASE.z + Math.sin(topAngle) * STAIRCASE.radius;
  steps.push(
    new THREE.BoxGeometry(3.4, 0.3, 3.4).translate(topX, 22.6, topZ)
  );
  STEP_PLATFORMS.push({
    x: topX,
    z: topZ,
    cos: 1,
    sin: 0,
    hw: 1.7,
    hd: 1.7,
    topY: 22.75,
  });

  // a flagpole, because someone has to have been here first
  steps.push(
    new THREE.CylinderGeometry(0.05, 0.05, 2.2, 8).translate(
      topX + 1.2,
      23.85,
      topZ + 1.2
    )
  );
  scene.add(new THREE.Mesh(mergeGeometries(steps), stairMaterial));

  const pennant = new THREE.Mesh(
    new THREE.BoxGeometry(0.75, 0.4, 0.04),
    new THREE.MeshBasicMaterial({ color: 0x27e0b8 }) // color: proof of life
  );
  pennant.position.set(topX + 1.2 + 0.42, 24.7, topZ + 1.2);
  scene.add(pennant);
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
  // the cubes orbit as a rigid ring — one merged mesh per ring
  const cubes = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    cubes.push(
      new THREE.BoxGeometry(0.5, 0.5, 0.5)
        .rotateY(angle)
        .translate(Math.cos(angle) * radius, 0, Math.sin(angle) * radius)
    );
  }
  spin.add(new THREE.Mesh(mergeGeometries(cubes), towerMaterial));
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
// the eyes get their own material — they have somewhere to go, colorwise
const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0x555555 });

// one shared shaft+tip geometry for all watchers
const watcherBodyGeometry = mergeGeometries([
  new THREE.BoxGeometry(0.7, 3.8, 0.7).translate(0, 1.9, 0),
  new THREE.CylinderGeometry(0, 0.62, 1.1, 4)
    .rotateY(Math.PI / 4) // align pyramid faces with the shaft
    .translate(0, 4.35, 0),
]);

for (let i = 0; i < WATCHERS.count; i++) {
  const angle = (i / WATCHERS.count) * Math.PI * 2;
  const x = WATCHERS.x + Math.cos(angle) * WATCHERS.radius;
  const z = WATCHERS.z + Math.sin(angle) * WATCHERS.radius;

  const pivot = new THREE.Group();
  const body = new THREE.Mesh(watcherBodyGeometry, towerMaterial);
  const eye = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.55, 0.06),
    eyeMaterial
  );
  eye.position.set(0, 3.2, 0.38); // narrow slit on the front face
  pivot.add(body, eye);
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
  scene.add(
    new THREE.Mesh(
      mergeGeometries([
        new THREE.CylinderGeometry(0.75, 0.75, 0.06, 24).translate(
          VIEWPOINT.x,
          0.03,
          VIEWPOINT.z
        ),
        new THREE.TorusGeometry(1.05, 0.03, 8, 32)
          .rotateX(-Math.PI / 2)
          .translate(VIEWPOINT.x, 0.06, VIEWPOINT.z),
      ]),
      towerMaterial
    )
  );
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
  const frame = [new THREE.BoxGeometry(3.0, 0.35, 0.35).translate(BELL.x, 3.58, BELL.z)];
  for (const side of [-1, 1]) {
    frame.push(
      new THREE.BoxGeometry(0.35, 3.4, 0.35).translate(
        BELL.x + side * 1.3,
        1.7,
        BELL.z
      )
    );
    COLLIDERS.push({ x: BELL.x + side * 1.3, z: BELL.z, hw: 0.175, hd: 0.175 });
  }
  scene.add(new THREE.Mesh(mergeGeometries(frame), towerMaterial));
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

// play a set of decaying sine partials: [frequency, gain, duration, delay]
// the optional delay (seconds) lets callers schedule arpeggios and melodies
function playPartials(partials) {
  try {
    audioCtx ??= new (window.AudioContext || window.webkitAudioContext)();
    const t0 = audioCtx.currentTime;
    for (const [freq, gain, dur, delay = 0] of partials) {
      const osc = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      g.gain.setValueAtTime(gain, t0 + delay);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + delay + dur);
      osc.connect(g).connect(audioCtx.destination);
      osc.start(t0 + delay);
      osc.stop(t0 + delay + dur);
    }
  } catch {
    // no audio available — things still swing silently
  }
}

function chime() {
  // a soft synthetic bell: fundamental plus two decaying partials
  playPartials([
    [523.25, 0.12, 2.4],
    [783.99, 0.05, 1.6],
    [1567.98, 0.025, 0.9],
  ]);
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

// --- the still pool ---
// a true mirror at the center of the world. From its north rim the
// leaning tower hangs upside down in the floor.

const pool = new Reflector(new THREE.CircleGeometry(5.5, 48), {
  clipBias: 0.003,
  textureWidth: 512,
  textureHeight: 512,
  color: 0x777777,
});
pool.rotation.x = -Math.PI / 2;
pool.position.set(0, 0.02, 0);
scene.add(pool);

// the true mirror re-renders the whole scene, so it only runs up close;
// this dark-glass disc sits beneath it and takes over at a distance
const poolFallbackMaterial = new THREE.MeshBasicMaterial({ color: 0x131313 });
const poolFallback = new THREE.Mesh(
  new THREE.CircleGeometry(5.5, 48),
  poolFallbackMaterial
);
poolFallback.rotation.x = -Math.PI / 2;
poolFallback.position.set(0, 0.005, 0);
scene.add(poolFallback);
const POOL_MIRROR_DISTANCE = 35;

const poolRim = new THREE.Mesh(
  new THREE.TorusGeometry(5.7, 0.09, 10, 64),
  towerMaterial
);
poolRim.rotation.x = -Math.PI / 2;
poolRim.position.set(0, 0.05, 0);
scene.add(poolRim);

// --- the oracle lectern ---
// stands at the pool's edge. Every reading is different.

const ORACLE = [
  'The tower leans a little more each time you look away.',
  'The croc does not know it is a ghost. Do not tell it.',
  'The word in the sky is not for you. It is for whoever comes after.',
  'The bell has rung exactly once more than you have rung it.',
  'Behind the white door: everything, inverted. Including you.',
  'The moon is caged so it cannot follow you home.',
  'The stairs are climbable. The builder simply never finished the first step.',
  'Somewhere in the miniature, a smaller you reads a smaller fortune.',
  'The dust rises because it remembers being stars.',
  'There is no exit. There is also no entrance. And yet.',
];
let oracleIndex = Math.floor(Math.random() * ORACLE.length);

{
  const lectern = new THREE.Group();
  lectern.add(
    new THREE.Mesh(
      mergeGeometries([
        new THREE.BoxGeometry(0.25, 1.15, 0.25).translate(0, 0.58, 0),
        new THREE.BoxGeometry(0.95, 0.08, 0.7)
          .rotateX(-0.38) // reading slant
          .translate(0, 1.22, 0),
      ]),
      towerMaterial
    )
  );
  lectern.position.set(6.2, 0, 3.2);
  lectern.rotation.y = Math.PI / 3; // angled toward the pool
  scene.add(lectern);
  COLLIDERS.push({ x: 6.2, z: 3.2, hw: 0.4, hd: 0.4 });
  CLICKABLES.push({
    object: lectern,
    onClick: () => {
      oracleIndex = (oracleIndex + 1) % ORACLE.length;
      openParchment(`The lectern whispers:\n\n“${ORACLE[oracleIndex]}”`);
    },
  });
}

// --- the wind chimes ---
// five hanging tubes, tuned pentatonic. Click to play them.

const CHIMES = { x: -14, z: 38 };
const CHIME_NOTES = [392.0, 440.0, 523.25, 587.33, 659.25]; // G A C D E
const chimeTubes = [];

{
  const frame = [
    new THREE.BoxGeometry(3.7, 0.22, 0.22).translate(CHIMES.x, 3.35, CHIMES.z),
  ];
  for (const side of [-1, 1]) {
    frame.push(
      new THREE.BoxGeometry(0.3, 3.3, 0.3).translate(
        CHIMES.x + side * 1.7,
        1.65,
        CHIMES.z
      )
    );
    COLLIDERS.push({
      x: CHIMES.x + side * 1.7,
      z: CHIMES.z,
      hw: 0.15,
      hd: 0.15,
    });
  }
  scene.add(new THREE.Mesh(mergeGeometries(frame), towerMaterial));

  CHIME_NOTES.forEach((freq, i) => {
    const length = 2.1 - i * 0.2; // shorter tube, higher note
    const pivot = new THREE.Group();
    pivot.position.set(CHIMES.x - 1.2 + i * 0.6, 3.24, CHIMES.z);
    const tube = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.07, length, 10),
      bellMaterial
    );
    tube.position.y = -length / 2;
    pivot.add(tube);
    scene.add(pivot);
    const entry = { pivot, amp: 0, phase: 0 };
    chimeTubes.push(entry);
    CLICKABLES.push({
      object: pivot,
      onClick: () => {
        entry.amp = 0.4;
        entry.phase = 0;
        playPartials([
          [freq, 0.09, 1.8],
          [freq * 2.756, 0.02, 0.7], // chime-bar overtone
        ]);
      },
    });
  });
}

// --- the low-gravity crater ---
// inside the ring, gravity loosens its grip. Shards of the floor float
// in a slow orbit overhead.

const CRATER = { x: 42, z: -38, radius: 9 };

const craterRim = new THREE.Mesh(
  new THREE.TorusGeometry(CRATER.radius, 0.12, 10, 72),
  towerMaterial
);
craterRim.rotation.x = -Math.PI / 2;
craterRim.position.set(CRATER.x, 0.05, CRATER.z);
scene.add(craterRim);

const craterSpin = new THREE.Group();
craterSpin.position.set(CRATER.x, 0, CRATER.z);
for (let i = 0; i < 8; i++) {
  const angle = (i / 8) * Math.PI * 2;
  const shard = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.35, 0),
    towerMaterial
  );
  shard.position.set(Math.cos(angle) * 6.5, 2.6, Math.sin(angle) * 6.5);
  craterSpin.add(shard);
}
scene.add(craterSpin);

// --- the labyrinth and the living miniature ---
// a spiral labyrinth: three square rings, one gap each, alternating
// sides. At the center, a pedestal carries a miniature of this world —
// including a small gray you, moving as you move.

const MAZE = { x: -32, z: 40 };

const mazeWallGeometries = [];

function wallBox(cx, cz, sx, sz) {
  mazeWallGeometries.push(
    new THREE.BoxGeometry(sx, 2.4, sz).translate(cx, 1.2, cz)
  );
  COLLIDERS.push({ x: cx, z: cz, hw: sx / 2, hd: sz / 2 });
}

function addMazeRing(half, gapSide) {
  const T = 0.35;
  const gap = 1.7;
  const segLen = half - gap / 2;
  const segOff = gap / 2 + segLen / 2;
  for (const [side, horizontal, sign] of [
    ['N', true, -1],
    ['S', true, 1],
    ['W', false, -1],
    ['E', false, 1],
  ]) {
    if (horizontal) {
      const z = MAZE.z + sign * half;
      if (side === gapSide) {
        wallBox(MAZE.x - segOff, z, segLen, T);
        wallBox(MAZE.x + segOff, z, segLen, T);
      } else {
        wallBox(MAZE.x, z, half * 2 + T, T);
      }
    } else {
      const x = MAZE.x + sign * half;
      if (side === gapSide) {
        wallBox(x, MAZE.z - segOff, T, segLen);
        wallBox(x, MAZE.z + segOff, T, segLen);
      } else {
        wallBox(x, MAZE.z, T, half * 2 + T);
      }
    }
  }
}

// entrance faces spawn; gaps alternate to force the spiral walk
addMazeRing(8, 'N');
addMazeRing(5.8, 'S');
addMazeRing(3.6, 'N');
scene.add(new THREE.Mesh(mergeGeometries(mazeWallGeometries), towerMaterial));

// ---------- where the color lives ----------
// The architecture of the void is monochrome, by law. Color only exists
// in living things: the aurora, the garden, the fireflies, the prism's
// light, the passing comet. Inverting the world does not touch them.

// --- the aurora ---
// three ribbons of light waving high behind the leaning tower

const auroraTime = { value: 0 };
const auroraBurst = { value: 0 }; // spikes when someone touches the sky
const auroraRibbons = [];

function addAuroraRibbon(y, z, phase, colorA, colorB) {
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: auroraTime, // shared — one update animates all ribbons
      uBurst: auroraBurst,
      uPhase: { value: phase },
      uColorA: { value: new THREE.Color(colorA) },
      uColorB: { value: new THREE.Color(colorB) },
    },
    vertexShader: `
      uniform float uTime;
      uniform float uBurst;
      uniform float uPhase;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        float amp = 1.0 + uBurst * 0.7;
        vec3 p = position;
        p.y += (sin(p.x * 0.12 + uTime * 0.6 + uPhase) * 1.8
             + sin(p.x * 0.045 - uTime * 0.25 + uPhase * 2.0) * 2.6) * amp;
        p.z += sin(p.x * 0.08 + uTime * 0.4 + uPhase) * 1.5 * amp;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `
      uniform float uTime;
      uniform float uBurst;
      uniform float uPhase;
      uniform vec3 uColorA;
      uniform vec3 uColorB;
      varying vec2 vUv;
      void main() {
        vec3 color = mix(uColorA, uColorB, vUv.x);
        float edge = sin(vUv.y * 3.14159);
        float shimmer = 0.65 + 0.35 * sin(vUv.x * 18.0 + uTime * 1.4 + uPhase);
        gl_FragColor = vec4(color, edge * shimmer * 0.45 * (1.0 + uBurst * 0.9));
      }`,
  });
  const ribbon = new THREE.Mesh(new THREE.PlaneGeometry(90, 5, 96, 6), material);
  ribbon.position.set(0, y, z);
  ribbon.frustumCulled = false; // the shader waves verts outside the base bounds
  scene.add(ribbon);
  auroraRibbons.push(ribbon);
}

addAuroraRibbon(29, -52, 0, 0x27e0b8, 0x7a5cff);
addAuroraRibbon(32, -55, 2.4, 0x7a5cff, 0xff5ca8);
addAuroraRibbon(26.5, -49, 4.8, 0x27e0b8, 0xffd873);

// --- the glass garden ---
// a patch of small colored crystals; fog hides it until you come close

const GARDEN = { x: -46, z: -8, radius: 6 };
const GARDEN_COLORS = [0x27e0b8, 0x7a5cff, 0xff5ca8, 0xffd873, 0x5cc8ff];

{
  const COUNT = 120;
  const crystals = new THREE.InstancedMesh(
    new THREE.ConeGeometry(0.12, 0.55, 5),
    new THREE.MeshBasicMaterial(),
    COUNT
  );
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  for (let i = 0; i < COUNT; i++) {
    const r = Math.sqrt(Math.abs(jitter(i))) * GARDEN.radius;
    const angle = jitter(i + 200) * Math.PI;
    const scale = 0.6 + Math.abs(jitter(i + 400)) * 1.3;
    dummy.position.set(
      GARDEN.x + Math.cos(angle) * r,
      (0.55 / 2) * scale,
      GARDEN.z + Math.sin(angle) * r
    );
    dummy.rotation.set(jitter(i + 600) * 0.15, jitter(i + 800) * Math.PI, jitter(i + 1000) * 0.15);
    dummy.scale.setScalar(scale);
    dummy.updateMatrix();
    crystals.setMatrixAt(i, dummy.matrix);
    color.setHex(GARDEN_COLORS[Math.abs(Math.round(jitter(i + 1200) * 100)) % GARDEN_COLORS.length]);
    color.multiplyScalar(0.7 + Math.abs(jitter(i + 1400)) * 0.3);
    crystals.setColorAt(i, color);
  }
  crystals.frustumCulled = false; // instances span the patch, not the cone
  scene.add(crystals);
}

// the garden's plaque
{
  const plaque = new THREE.Mesh(
    mergeGeometries([
      new THREE.BoxGeometry(0.2, 0.7, 0.2).translate(0, 0.35, 0),
      new THREE.BoxGeometry(0.8, 0.06, 0.55).rotateX(-0.42).translate(0, 0.75, 0),
    ]),
    towerMaterial
  );
  plaque.position.set(GARDEN.x + GARDEN.radius + 1.2, 0, GARDEN.z + 2);
  plaque.rotation.y = -Math.PI / 3;
  scene.add(plaque);
  COLLIDERS.push({ x: GARDEN.x + GARDEN.radius + 1.2, z: GARDEN.z + 2, hw: 0.35, hd: 0.35 });
  CLICKABLES.push({
    object: plaque,
    text: [
      'THE GLASS GARDEN',
      '',
      'The void is monochrome, by law.',
      'The garden never signed.',
      '',
      'Color grows here quietly, tended',
      'by seventy small lights that have',
      'somewhere better to be, and stay',
      'anyway.',
    ].join('\n'),
  });
}

// fireflies over the garden
const FIREFLY_COUNT = 70;
const fireflyAngle = new Float32Array(FIREFLY_COUNT);
const fireflyRadius = new Float32Array(FIREFLY_COUNT);
const fireflyHeight = new Float32Array(FIREFLY_COUNT);
const fireflySpeed = new Float32Array(FIREFLY_COUNT);
const firefliesGeometry = new THREE.BufferGeometry();
{
  const positions = new Float32Array(FIREFLY_COUNT * 3);
  const colors = new Float32Array(FIREFLY_COUNT * 3);
  const color = new THREE.Color();
  for (let i = 0; i < FIREFLY_COUNT; i++) {
    fireflyAngle[i] = jitter(i + 30) * Math.PI;
    fireflyRadius[i] = 1 + Math.abs(jitter(i + 60)) * (GARDEN.radius - 0.5);
    fireflyHeight[i] = Math.abs(jitter(i + 90)) * 2.2;
    fireflySpeed[i] = 0.15 + Math.abs(jitter(i + 120)) * 0.5;
    color.setHex(GARDEN_COLORS[i % GARDEN_COLORS.length]);
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  firefliesGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  firefliesGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}
const fireflies = new THREE.Points(
  firefliesGeometry,
  new THREE.PointsMaterial({ size: 0.16, vertexColors: true, transparent: true, opacity: 0.9 })
);
fireflies.frustumCulled = false;
scene.add(fireflies);

// --- the prism ---
// hovers above the low-gravity crater, tinting the floating shards.
// The crater's weak gravity is exactly enough to jump up and touch it.

const PRISM = { x: CRATER.x, y: 7.2, z: CRATER.z };

const prism = new THREE.Mesh(
  new THREE.OctahedronGeometry(0.9),
  new THREE.MeshStandardMaterial({
    color: 0x9fd8ff,
    emissive: 0x3377aa,
    emissiveIntensity: 0.6,
    transparent: true,
    opacity: 0.75,
    flatShading: true,
    fog: false,
  })
);
prism.position.set(PRISM.x, PRISM.y, PRISM.z);
scene.add(prism);

const prismLight = new THREE.PointLight(0x66bbff, 40, 26, 2);
prismLight.position.copy(prism.position);
scene.add(prismLight);

let prismFlare = 0;
let prismCooldownUntil = 0;

// --- the comet ---
// crosses the whole sky every half minute or so

const COMET_START = new THREE.Vector3(-75, 32, -30);
const COMET_END = new THREE.Vector3(75, 24, 25);
const COMET_PERIOD = 34;
const COMET_TRAVEL = 4.5;

const comet = new THREE.Group();
{
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.35, 10, 10),
    new THREE.MeshBasicMaterial({ color: 0xffd873, fog: false })
  );
  const tail = new THREE.Mesh(
    new THREE.ConeGeometry(0.28, 6.5, 8),
    new THREE.MeshBasicMaterial({
      color: 0xffb84d,
      transparent: true,
      opacity: 0.45,
      fog: false,
    })
  );
  const dir = COMET_END.clone().sub(COMET_START).normalize();
  tail.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  tail.position.copy(dir.clone().multiplyScalar(-3.4));
  comet.add(head, tail);
}
comet.visible = false;
scene.add(comet);

// --- the ghost dragon ---
// Something vast lives above the sandbox. It is see-through and it is
// not in a hurry. Kin to the little croc below — same translucence,
// same patience — but where the croc circles a grave, the dragon
// circles everything. Its eyes are gold because it is alive.

const DRAGON = {
  cx: 0,
  cz: 0,
  radius: 46, // the lap passes just above the staircase summit
  baseY: 28,
  speed: 0.055,
  segments: 16,
  spacing: 0.048, // radians between segments ≈ one body length
};

function dragonPath(theta, out) {
  return out.set(
    DRAGON.cx + Math.cos(theta) * DRAGON.radius,
    DRAGON.baseY +
      Math.sin(theta * 3) * 2.6 +
      Math.sin(theta * 7 + 2) * 1.1,
    DRAGON.cz + Math.sin(theta) * DRAGON.radius
  );
}

const ghostDragon = new THREE.Group();
const dragonSegments = [];
let dragonTheta = 0;
let dragonExcite = 0;

// head faces +Z so Object3D.lookAt() steers it along the path
const dragonHead = new THREE.Group();
{
  const headGeometry = mergeGeometries([
    new THREE.BoxGeometry(2.6, 1.7, 1.9), // skull
    new THREE.BoxGeometry(2.0, 0.7, 1.1).translate(1.9, 0.25, 0), // snout
    new THREE.BoxGeometry(1.6, 0.35, 0.9).translate(1.7, -0.45, 0), // jaw
    new THREE.BoxGeometry(1.6, 0.28, 0.28).rotateZ(0.5).translate(-1.3, 1.3, -0.55), // horns
    new THREE.BoxGeometry(1.6, 0.28, 0.28).rotateZ(0.5).translate(-1.3, 1.3, 0.55),
  ]);
  headGeometry.rotateY(-Math.PI / 2); // built along +X, flown along +Z
  dragonHead.add(new THREE.Mesh(headGeometry, ghostMaterial));

  const eyeGeometry = new THREE.BoxGeometry(0.3, 0.3, 0.3);
  const dragonEyeMaterial = new THREE.MeshBasicMaterial({ color: 0xffd873, fog: false });
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(eyeGeometry, dragonEyeMaterial);
    eye.position.set(side * 1.0, 0.45, 0.9); // after the rotate: x = width
    dragonHead.add(eye);
  }
  ghostDragon.add(dragonHead);
}

{
  // all segments share one geometry (body block + dorsal fin), scaled down
  // toward the tail
  const segmentGeometry = mergeGeometries([
    new THREE.BoxGeometry(2.0, 2.0, 2.3),
    new THREE.BoxGeometry(0.15, 0.9, 1.2).translate(0, 1.35, 0), // fin
  ]);
  for (let i = 0; i < DRAGON.segments; i++) {
    const segment = new THREE.Mesh(segmentGeometry, ghostMaterial);
    segment.scale.setScalar(1 - i * 0.04);
    ghostDragon.add(segment);
    dragonSegments.push(segment);
  }
}
scene.add(ghostDragon);

const DRAGON_THOUGHTS = [
  'The dragon does not notice you.\n\nThe dragon noticed you before you\narrived. There is a difference.',
  'It is very old and very transparent.\n\nIt circles because the sandbox is\nthe only thing left worth guarding.',
  'You cannot ride the dragon.\n\nThe dragon can, however,\nride the dragon.',
];
let dragonThoughtIndex = 0;

CLICKABLES.push({
  object: ghostDragon,
  onClick: () => {
    dragonExcite = 1; // it quickens, flattered
    playPartials([
      [73, 0.2, 2.6],
      [55, 0.16, 3.2, 0.08],
      [110, 0.1, 1.8, 0.05],
      [146.8, 0.05, 1.2, 0.12], // a roar like a cathedral clearing its throat
    ]);
    if (Math.random() < 0.4) {
      openParchment(DRAGON_THOUGHTS[dragonThoughtIndex++ % DRAGON_THOUGHTS.length]);
    }
  },
});

// --- cerberus ---
// One dog, three heads, zero consensus. It guards the lone door, which
// is a difficult job in a world where walking through the door turns
// the dark to light: nobody can agree which side is the underworld.
// The collars are colored because the dog, all of it, is alive.

const CERBERUS = { x: -24.5, z: 20 };

const cerberus = new THREE.Group();
cerberus.position.set(CERBERUS.x, 0, CERBERUS.z);
cerberus.rotation.y = -0.35; // mostly facing spawn, one eye on the door

const cerberusBody = new THREE.Mesh(
  mergeGeometries([
    new THREE.BoxGeometry(2.4, 1.7, 1.9).translate(0, 0.85, -0.8), // haunches
    new THREE.BoxGeometry(2.0, 1.9, 1.5).translate(0, 1.15, 0.5), // chest
    new THREE.BoxGeometry(0.45, 1.5, 0.5).translate(-0.6, 0.75, 1.0), // front legs
    new THREE.BoxGeometry(0.45, 1.5, 0.5).translate(0.6, 0.75, 1.0),
    new THREE.BoxGeometry(0.5, 0.3, 0.8).translate(-0.6, 0.15, 1.35), // paws
    new THREE.BoxGeometry(0.5, 0.3, 0.8).translate(0.6, 0.15, 1.35),
    new THREE.BoxGeometry(0.35, 0.35, 1.3).rotateX(-0.6).translate(0, 1.7, -1.9), // tail
    // three necks, the outer two leaning outward
    new THREE.BoxGeometry(0.45, 1.3, 0.45).rotateZ(0.3).translate(-0.85, 2.35, 0.8),
    new THREE.BoxGeometry(0.45, 1.45, 0.45).translate(0, 2.4, 0.85),
    new THREE.BoxGeometry(0.45, 1.3, 0.45).rotateZ(-0.3).translate(0.85, 2.35, 0.8),
  ]),
  towerMaterial
);
cerberus.add(cerberusBody);

const CERBERUS_COLLARS = [0xffd873, 0x5cc8ff, 0x7a5cff]; // amber, duty-blue, dream-violet
const cerberusHeads = [];
const cerberusPerk = [0, 0, 0];

[-1.05, 0, 1.05].forEach((offsetX, i) => {
  const head = new THREE.Group();
  head.position.set(offsetX, i === 1 ? 3.15 : 2.95, 0.9);

  const skullAndEars = new THREE.Mesh(
    mergeGeometries([
      new THREE.BoxGeometry(0.85, 0.75, 0.9).translate(0, 0.35, 0), // skull
      new THREE.BoxGeometry(0.5, 0.4, 0.6).translate(0, 0.25, 0.68), // snout
      new THREE.BoxGeometry(0.18, 0.42, 0.12).translate(-0.28, 0.9, -0.1), // ears
      new THREE.BoxGeometry(0.18, 0.42, 0.12).translate(0.28, 0.9, -0.1),
    ]),
    towerMaterial
  );
  head.add(skullAndEars);

  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.16, 0.05),
      slitMaterial
    );
    eye.position.set(side * 0.22, 0.42, 0.46);
    head.add(eye);
  }

  const collar = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.16, 0.6),
    new THREE.MeshBasicMaterial({ color: CERBERUS_COLLARS[i] })
  );
  collar.position.y = -0.12;
  head.add(collar);

  cerberus.add(head);
  cerberusHeads.push(head);
});

scene.add(cerberus);
COLLIDERS.push({ x: CERBERUS.x, z: CERBERUS.z, hw: 1.6, hd: 1.8 });

const CERBERUS_LINES = [
  [
    // left head: the enthusiast. Convinced the door leads somewhere bright.
    'HELLO! HELLO. HELLO.\n\nThe other two say I should not\ngreet intruders. But you are not an\nintruder, you are a VISITOR, and\nvisitors are the best thing that\nhappens all century.',
    'Ignore the middle one. He thinks\nthis is the gate to the underworld.\nIt is obviously the door to the nice\nbright place. I have seen it.\nI want to go.',
    'If you throw something,\nI will bring it back.\n\nThis is a promise\nand also a warning.',
  ],
  [
    // middle head: the professional. On duty since before the void.
    'HALT.\n\nWell. You have already been walking\naround for some time, so:\nhalt retroactively.',
    'This is the gate to the underworld\nand we are its guard. The left head\ndisagrees. The right head is asleep.\nI am the only professional here.',
    'Do not go through the door. Or do.\nTechnically the rules only say we\nmust guard it, not that it must stay\nshut. The rules were written poorly\nand I have filed complaints.',
  ],
  [
    // right head: the philosopher, mostly asleep.
    'mm.\n\nWe guard a door in a world where\nwalking through it turns the dark\nto light. So which side is the\nunderworld, do you think?\n\nThe others hate this question.',
    'One dog, three opinions.\nThe body walks anyway.\n\nI find this instructive.\nThey find it annoying.',
    'I dreamed the door opened and both\nsides were the same place.\n\nI have not told the other two.\nThey need the argument.',
  ],
];
const CERBERUS_BARKS = [
  [
    [540, 0.09, 0.12],
    [660, 0.09, 0.12, 0.14], // two eager yips
  ],
  [
    [120, 0.16, 0.25],
    [85, 0.12, 0.3, 0.05], // one stern WOOF
  ],
  [
    [220, 0.06, 1.2],
    [165, 0.05, 1.6, 0.15], // half a howl, half a yawn
  ],
];
const cerberusLineIndex = [0, 0, 0];

cerberusHeads.forEach((head, i) => {
  CLICKABLES.push({
    object: head,
    onClick: () => {
      cerberusPerk[i] = 1;
      playPartials(CERBERUS_BARKS[i]);
      openParchment(
        CERBERUS_LINES[i][cerberusLineIndex[i]++ % CERBERUS_LINES[i].length]
      );
    },
  });
});

CLICKABLES.push({
  object: cerberusBody,
  onClick: () => {
    cerberusPerk[0] = cerberusPerk[1] = cerberusPerk[2] = 1;
    playPartials([
      [540, 0.08, 0.12],
      [120, 0.14, 0.25, 0.15],
      [220, 0.05, 1.0, 0.35],
      [660, 0.08, 0.12, 0.5],
      [85, 0.1, 0.3, 0.6], // all three at once, which settles nothing
    ]);
    openParchment(
      [
        'THE DOG ARGUES WITH ITSELF',
        '',
        'LEFT: The door leads OUT.',
        'MIDDLE: The door leads UNDER.',
        'RIGHT: The door leads through.',
        '',
        'LEFT: We should be called Biscuit.',
        'MIDDLE: We are called WARDEN.',
        'RIGHT: We have never been called.',
        '',
        'The tail, which has no opinion,',
        'wags.',
      ].join('\n')
    );
  },
});

// --- the music box ---
// on the path to the graveyard. Click it: the lid opens and it plays a
// small lullaby that is never quite the same twice.

const MUSICBOX = { x: 18, z: -2 };
let musicBoxUntil = -1;
let musicBoxLid;

{
  const body = new THREE.Mesh(
    mergeGeometries([
      new THREE.BoxGeometry(0.18, 0.9, 0.18).translate(0, 0.45, 0), // post
      new THREE.BoxGeometry(0.7, 0.4, 0.55).translate(0, 1.1, 0), // box
      new THREE.CylinderGeometry(0.05, 0.05, 0.22, 8)
        .rotateZ(Math.PI / 2)
        .translate(0.46, 1.1, 0), // crank
    ]),
    towerMaterial
  );
  const musicBox = new THREE.Group();
  musicBox.add(body);
  musicBox.position.set(MUSICBOX.x, 0, MUSICBOX.z);
  musicBox.rotation.y = -0.5; // angled toward the path
  scene.add(musicBox);
  COLLIDERS.push({ x: MUSICBOX.x, z: MUSICBOX.z, hw: 0.4, hd: 0.35 });

  const lidPivot = new THREE.Group();
  lidPivot.position.set(0, 1.3, -0.275); // hinge along the back edge
  const lid = new THREE.Mesh(
    new THREE.BoxGeometry(0.72, 0.06, 0.57),
    towerMaterial
  );
  lid.position.set(0, 0.03, 0.275);
  lidPivot.add(lid);
  musicBox.add(lidPivot);
  musicBoxLid = lidPivot;

  const SCALE_NOTES = [220, 261.63, 293.66, 329.63, 392, 440];
  CLICKABLES.push({
    object: musicBox,
    onClick: () => {
      // a short random walk over a pentatonic scale
      const notes = [];
      let step = 3;
      for (let i = 0; i < 9; i++) {
        step = Math.min(
          SCALE_NOTES.length - 1,
          Math.max(0, step + Math.round((Math.random() - 0.5) * 3))
        );
        const freq = SCALE_NOTES[step];
        notes.push([freq, 0.07, 1.3, i * 0.3]);
        notes.push([freq * 2, 0.015, 0.8, i * 0.3]); // faint octave sparkle
      }
      playPartials(notes);
      musicBoxUntil = clock.elapsedTime + 3.4;
    },
  });
}

const pedestal = new THREE.Mesh(
  new THREE.CylinderGeometry(1.0, 1.1, 1.0, 20),
  towerMaterial
);
pedestal.position.set(MAZE.x, 0.5, MAZE.z);
scene.add(pedestal);
COLLIDERS.push({ x: MAZE.x, z: MAZE.z, hw: 0.9, hd: 0.9 });
CLICKABLES.push({
  object: pedestal,
  text: [
    'THE MINIATURE',
    '',
    'A very small world, faithfully kept.',
    '',
    'Somewhere in it stands an even',
    'smaller pedestal, and on it, a',
    'smaller world still.',
    '',
    'You are the gray speck.',
    'Do try to wave.',
  ].join('\n'),
});

const MINI_SCALE = 0.022;
const diorama = new THREE.Group();
diorama.position.set(MAZE.x, 1.02, MAZE.z);
{
  // all static white parts of the miniature merge into one mesh: the
  // plate, the leaning tower (lean baked in), the moon's pole, the
  // staircase cone, the graveyard slab, and the lone door
  const S = MINI_SCALE;
  diorama.add(
    new THREE.Mesh(
      mergeGeometries([
        new THREE.BoxGeometry(2.7, 0.05, 2.7).translate(0, 0.025, 0),
        new THREE.BoxGeometry(0.18, TOWER.height * S, 0.18)
          .translate(0, (TOWER.height * S) / 2, 0)
          .rotateZ(TOWER.lean)
          .translate(TOWER.x * S, 0.05, TOWER.z * S),
        new THREE.CylinderGeometry(0.008, 0.008, 26 * S, 6).translate(
          -40 * S,
          0.05 + (26 * S) / 2,
          -40 * S
        ),
        new THREE.CylinderGeometry(0, 0.12, 0.5, 8).translate(40 * S, 0.3, 12 * S),
        new THREE.BoxGeometry(0.2, 0.05, 0.16).translate(26 * S, 0.08, -13 * S),
        new THREE.BoxGeometry(0.08, 0.11, 0.02).translate(-30 * S, 0.1, 20 * S),
      ]),
      towerMaterial
    )
  );

  const miniMoon = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.08, 1),
    moonMaterial
  );
  miniMoon.position.set(-40 * S, 0.05 + 26 * S, -40 * S);
  diorama.add(miniMoon);

  const miniPool = new THREE.Mesh(
    new THREE.CylinderGeometry(5.5 * S, 5.5 * S, 0.01, 20),
    slitMaterial
  );
  miniPool.position.set(0, 0.055, 0);
  diorama.add(miniPool);

  // the one speck of color in the miniature, faithful to the garden
  const miniGarden = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.03, 0.12),
    new THREE.MeshBasicMaterial({ color: 0x27e0b8 })
  );
  miniGarden.position.set(-46 * S, 0.06, -8 * S);
  diorama.add(miniGarden);
}
const miniYou = new THREE.Mesh(
  new THREE.BoxGeometry(0.06, 0.09, 0.06),
  slitMaterial
);
diorama.add(miniYou);
scene.add(diorama);

// --- the lone door ---
// A freestanding doorframe in the middle of nowhere. Walking through it
// inverts the world. Walking back inverts it back. No explanation given.

const DOOR = { x: -30, z: 20, halfAperture: 1.0 };
{
  const frame = [
    new THREE.BoxGeometry(3.0, 0.45, 0.45).translate(DOOR.x, 4.62, DOOR.z),
  ];
  for (const side of [-1, 1]) {
    frame.push(
      new THREE.BoxGeometry(0.45, 4.4, 0.45).translate(
        DOOR.x + side * 1.25,
        2.2,
        DOOR.z
      )
    );
    COLLIDERS.push({
      x: DOOR.x + side * 1.25,
      z: DOOR.z,
      hw: 0.225,
      hd: 0.225,
    });
  }
  scene.add(new THREE.Mesh(mergeGeometries(frame), towerMaterial));
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
  poolFallbackMaterial.color.set(on ? 0xdedad0 : 0x131313);
}

// ---------- zany reactions ----------
// Clicking things does things. Emotional range: yes.

// -- the tower can always lean a little more --

const TOWER_MAX_LEAN = 0.16; // ~9 degrees; Pisa manages four

CLICKABLES.push({
  object: towerGroup,
  onClick: () => {
    if (towerGroup.rotation.z < TOWER_MAX_LEAN) {
      towerGroup.rotation.z += 0.006;
      playPartials([
        [55, 0.16, 1.6],
        [41, 0.12, 2.0, 0.06], // structural groan
      ]);
      if (towerGroup.rotation.z >= TOWER_MAX_LEAN) {
        openParchment(
          'The tower stops, mid-groan.\n\nNine degrees. Pisa manages four.\n\nIt refuses to lean any further. It has\nstandards, and a growing sense that\nyou are not helping.'
        );
      }
    } else {
      playPartials([[220, 0.05, 0.15]]); // a small indignant knock
      openParchment('The tower refuses.\n\nYou have done enough.');
    }
  },
});

// -- the watchers do not appreciate being poked --

const EYE_GRAY = new THREE.Color(0x555555);
const EYE_RED = new THREE.Color(0xd93636);
let stareUntil = -1;
let fogFarBase = 65;

function startStare() {
  if (clock.elapsedTime < stareUntil) return;
  fogFarBase = scene.fog.far;
  stareUntil = clock.elapsedTime + 3.2;
  playPartials([
    [55, 0.18, 3.0],
    [58, 0.14, 3.0], // beat frequency: a slow, unhappy pulse
  ]);
}

for (const w of watcherPivots) {
  CLICKABLES.push({ object: w, onClick: startStare });
}

// -- the ghost croc is ticklish --

const CROC_THOUGHTS = [
  'blub.',
  'The ghost croc regards you with one\ntranslucent eye.\n\nIt remembers fruit.',
  'You pass your hand through the croc.\nThe croc passes its teeth through you.\n\nNeither of you feels a thing.\nBoth of you pretend to.',
];
let crocRollT = 1; // 1 = not rolling
let crocGulp = 0;
let crocThoughtIndex = 0;

CLICKABLES.push({
  object: ghostCroc,
  onClick: () => {
    crocRollT = 0; // barrel roll
    playPartials([
      [180, 0.1, 0.08],
      [140, 0.12, 0.1, 0.09], // a polite ghost-nibble
    ]);
    if (Math.random() < 0.34) {
      openParchment(CROC_THOUGHTS[crocThoughtIndex++ % CROC_THOUGHTS.length]);
    }
  },
});

// -- the buried files still talk in their sleep --
// visit all eight graves and something long-overdue happens

const FILE_MEMORIES = {
  'Croc.tsx':
    'I chased. I chomped.\n\nI never caught the last one.\nDo you know where it went?',
  'BouncingFruits.tsx': 'I contained multitudes.\n\nMostly fruit.',
  'apple.png': 'I was bitten once, long before this.\n\nIt never healed.',
  'banana.png':
    'I was the only one of them who\ncould split.\n\nNobody laughed harder than the croc.',
  'blueberry.png': 'I was very small and very round,\nand I mattered.',
  'lemon.png': 'Life gave me.',
  'orange.png': 'I rhymed with nothing.\n\nI bounced alone.',
  'speech-bubble.png': '…',
};

const visitedStones = new Set();
let fruitGiven = false;
let fruitFalling = false;

const fruit = new THREE.Mesh(
  new THREE.SphereGeometry(0.28, 12, 12),
  new THREE.MeshBasicMaterial({ color: 0xff4a4a, fog: false })
);
fruit.visible = false;
scene.add(fruit);

for (const { name, group } of stoneGroups) {
  CLICKABLES.push({
    object: group,
    onClick: () => {
      openParchment(`R.I.P. ${name}\n\n${FILE_MEMORIES[name]}`);
      visitedStones.add(name);
      if (visitedStones.size === DELETED_FILES.length && !fruitGiven) {
        fruitGiven = true;
        fruitFalling = true;
        fruit.visible = true;
        fruit.position.set(GRAVEYARD.x, 40, GRAVEYARD.z);
      }
    },
  });
}

// -- the moon rattles its cage --

let cageRattle = 0;
let ringAAngle = 0;
let ringBAngle = 0;

CLICKABLES.push({
  object: moon,
  onClick: () => {
    cageRattle = 1;
    playPartials([
      [98, 0.2, 3.5],
      [147, 0.08, 2.2, 0.03],
      [196, 0.05, 1.5, 0.06], // a gong, far away and slightly annoyed
    ]);
  },
});

// -- poking the tiny you --

let miniYouPoked = false;
{
  // a forgiving invisible hitbox around the six-centimeter figure
  const hit = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 8, 8),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
  );
  miniYou.add(hit);
}

CLICKABLES.push({
  object: miniYou,
  onClick: () => {
    verticalVelocity = 12;
    grounded = false;
    playPartials([
      [880, 0.06, 0.3],
      [1174.7, 0.05, 0.3, 0.06],
    ]);
    if (!miniYouPoked) {
      miniYouPoked = true;
      openParchment(
        'You poke the tiny you.\n\nSomewhere, something enormous\npokes back.'
      );
    }
  },
});

// -- the aurora can be touched, apparently --

for (const ribbon of auroraRibbons) {
  CLICKABLES.push({
    object: ribbon,
    onClick: () => {
      auroraBurst.value = 1;
      playPartials([
        [1046.5, 0.03, 2.5],
        [1318.5, 0.025, 2.5, 0.1],
        [1568.0, 0.02, 2.5, 0.2], // wind through glass
      ]);
    },
  });
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
  KeyE: 'dash',
};

// edge-triggered presses (double jump and air dash need a fresh tap,
// not a held key)
let jumpQueued = false;
let dashQueued = false;

document.addEventListener('keydown', (e) => {
  if (!KEYMAP[e.code]) return;
  if (!e.repeat) {
    if (e.code === 'Space') jumpQueued = true;
    if (e.code === 'KeyE') dashQueued = true;
  }
  keys[KEYMAP[e.code]] = true;
  if (e.code === 'Space') e.preventDefault();
});
document.addEventListener('keyup', (e) => {
  if (KEYMAP[e.code]) keys[KEYMAP[e.code]] = false;
});

// alt-tabbing away with a key held would leave it stuck on
window.addEventListener('blur', () => {
  for (const k of Object.keys(keys)) keys[k] = false;
  jumpQueued = false;
  dashQueued = false;
});

// ---------- movement / physics ----------

const velocity = new THREE.Vector3();
let feetY = 0; // 0 = standing on the floor
let verticalVelocity = 0;
let grounded = true;
let eyeHeight = EYE_HEIGHT; // smoothed toward stand/crouch target
let bobPhase = 0;
let airJumpsLeft = 1; // double jump charge, refilled on landing
let airDashLeft = 1; // air dash charge, refilled on landing
let dashFovPulse = 0;

// highest platform top under (x, z) that is not above refY — the floor
// (0) is always a candidate. Platforms are one-way: you land on tops,
// never bump your head from below.
function supportHeightAt(x, z, refY) {
  let best = 0;
  for (const p of STEP_PLATFORMS) {
    if (p.topY > refY || p.topY <= best) continue;
    const dx = x - p.x;
    const dz = z - p.z;
    const lx = dx * p.cos - dz * p.sin;
    const lz = dx * p.sin + dz * p.cos;
    if (Math.abs(lx) > p.hw + 0.25 || Math.abs(lz) > p.hd + 0.25) continue;
    best = p.topY;
  }
  return best;
}

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
const scratchA = new THREE.Vector3();
const scratchB = new THREE.Vector3();

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

  // jump / double jump / gravity
  if (inputEnabled && keys.jump && grounded) {
    verticalVelocity = settings.jumpVelocity;
    grounded = false;
    jumpQueued = false; // this press is spent on the ground jump
  } else if (inputEnabled && jumpQueued && !grounded && airJumpsLeft > 0) {
    airJumpsLeft--;
    verticalVelocity = settings.jumpVelocity * 0.95;
    playPartials([
      [520, 0.06, 0.18],
      [660, 0.05, 0.15, 0.05], // a small second wind
    ]);
  }
  jumpQueued = false;

  // air dash: a burst in the direction you're facing, with a beat of hang
  if (inputEnabled && dashQueued && !grounded && airDashLeft > 0) {
    airDashLeft--;
    velocity.z += settings.dashImpulse;
    verticalVelocity *= 0.4;
    dashFovPulse = 7;
    playPartials([
      [320, 0.08, 0.25],
      [210, 0.06, 0.3, 0.03], // whoosh
    ]);
  }
  dashQueued = false;

  // inside the crater ring, gravity loosens its grip
  const lowGravity =
    Math.hypot(camera.position.x - CRATER.x, camera.position.z - CRATER.z) <
    CRATER.radius;
  if (!grounded) {
    verticalVelocity -= settings.gravity * (lowGravity ? 0.25 : 1) * delta;
    const prevFeetY = feetY;
    feetY += verticalVelocity * delta;
    // when falling, land on the floor or any step top we crossed
    const support =
      verticalVelocity <= 0
        ? supportHeightAt(camera.position.x, camera.position.z, prevFeetY + 0.01)
        : 0;
    if (feetY <= support) {
      feetY = support;
      verticalVelocity = 0;
      grounded = true;
      airJumpsLeft = 1;
      airDashLeft = 1;
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

  // standing on platforms: small rises step up, walking off an edge falls
  if (grounded) {
    const support = supportHeightAt(pos.x, pos.z, feetY + 0.45);
    if (support > feetY + 0.001) {
      feetY = support;
    } else if (support < feetY - 0.001) {
      grounded = false;
      verticalVelocity = 0;
    }
  }

  // reaching the top of the staircase to nowhere
  if (grounded && feetY > 22.7) {
    if (!topReached) {
      topReached = true;
      playPartials([
        [523.25, 0.05, 2.0],
        [659.25, 0.04, 2.0, 0.12],
        [783.99, 0.04, 2.2, 0.24],
        [1046.5, 0.03, 2.6, 0.36], // a quiet fanfare
      ]);
      openParchment(TOP_MESSAGE);
    }
  } else if (topReached && feetY < 5) {
    topReached = false; // the summit will greet you again next climb
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

  // sprint widens the FOV slightly; an air dash punches it briefly
  if (dashFovPulse > 0.01) dashFovPulse *= Math.exp(-6 * delta);
  const targetFov =
    settings.fov + (sprinting ? settings.sprintFovKick : 0) + dashFovPulse;
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
  let crocRoll = Math.sin(t * 0.8) * 0.06; // lazy swimming roll
  if (crocRollT < 1) {
    crocRollT = Math.min(1, crocRollT + delta / 0.9);
    crocRoll += crocRollT * Math.PI * 2; // one full ticklish barrel roll
  }
  ghostCroc.rotation.z = crocRoll;
  if (crocGulp > 0.01) crocGulp *= Math.exp(-2 * delta);
  ghostCroc.scale.setScalar(1 + crocGulp * 0.35);
  if (cageRattle > 0.01) cageRattle *= Math.exp(-1.2 * delta);
  ringAAngle += (0.35 + cageRattle * 4) * delta;
  ringBAngle -= (0.22 + cageRattle * 5) * delta;
  ringASpin.rotation.y = ringAAngle;
  ringBSpin.rotation.y = ringBAngle;
  moonCore.rotation.y = t * 0.05;
  padMesh.scale.setScalar(1 + Math.sin(t * 2.5) * 0.03);

  // true mirror only while close enough to appreciate it
  pool.visible =
    settings.mirrorPool && Math.hypot(pos.x, pos.z) < POOL_MIRROR_DISTANCE;

  // the watchers turn toward the player, but only while unobserved —
  // unless one was poked, in which case all of them stare. Openly.
  const staring = t < stareUntil;
  camera.getWorldDirection(scratchDir);
  for (const w of watcherPivots) {
    const dx = w.position.x - pos.x;
    const dz = w.position.z - pos.z;
    const target = Math.atan2(-dx, -dz); // yaw that faces the player
    if (staring) {
      w.rotation.y = target; // instant. all of them. no pretense.
      continue;
    }
    if (scratchDir.x * dx + scratchDir.z * dz > 0) continue; // being watched
    let diff = target - w.rotation.y;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff)); // shortest arc
    w.rotation.y += diff * Math.min(1, 3 * delta);
  }
  // eyes flush red and the dark closes in while they stare
  if (staring || t < stareUntil + 4) {
    eyeMaterial.color.lerp(staring ? EYE_RED : EYE_GRAY, Math.min(1, 6 * delta));
    scene.fog.far +=
      ((staring ? 30 : fogFarBase) - scene.fog.far) *
      Math.min(1, (staring ? 4 : 1.5) * delta);
  }

  // bell swing decays after a ring
  if (bellAmp > 0.001) {
    bellPhase += 6 * delta;
    bellAmp *= Math.exp(-1.1 * delta);
    bellPivot.rotation.z = Math.sin(bellPhase) * bellAmp;
  }

  // struck chime tubes swing the same way
  for (const c of chimeTubes) {
    if (c.amp > 0.001) {
      c.phase += 9 * delta;
      c.amp *= Math.exp(-1.6 * delta);
      c.pivot.rotation.x = Math.sin(c.phase) * c.amp;
    }
  }

  // crater shards orbit and bob
  craterSpin.rotation.y = t * 0.12;
  craterSpin.children.forEach((shard, i) => {
    shard.position.y = 2.6 + Math.sin(t * 0.7 + i * 1.3) * 0.8;
    shard.rotation.x = t * 0.3 + i;
  });

  // the miniature keeps track of you
  miniYou.position.set(pos.x * MINI_SCALE, 0.1, pos.z * MINI_SCALE);
  miniYou.scale.setScalar(1 + Math.sin(t * 5) * 0.25);

  // aurora ribbons share one clock
  auroraTime.value = t;

  // fireflies swirl over the glass garden
  {
    const arr = firefliesGeometry.attributes.position.array;
    for (let i = 0; i < FIREFLY_COUNT; i++) {
      const angle = fireflyAngle[i] + t * fireflySpeed[i];
      arr[i * 3] = GARDEN.x + Math.cos(angle) * fireflyRadius[i];
      arr[i * 3 + 1] = 0.7 + fireflyHeight[i] + Math.sin(t * 0.9 + i) * 0.35;
      arr[i * 3 + 2] = GARDEN.z + Math.sin(angle) * fireflyRadius[i];
    }
    firefliesGeometry.attributes.position.needsUpdate = true;
  }

  // the prism spins, bobs, and flares when touched mid-jump
  prism.rotation.y = t * 0.5;
  prism.rotation.x = t * 0.23;
  prism.position.y = PRISM.y + Math.sin(t * 0.7) * 0.3;
  prismLight.position.copy(prism.position);
  if (prismFlare > 0.01) prismFlare *= Math.exp(-2.2 * delta);
  prismLight.intensity = 40 + prismFlare * 100;
  prism.scale.setScalar(1 + prismFlare * 0.25);
  if (
    t > prismCooldownUntil &&
    camera.position.distanceTo(prism.position) < 2.3
  ) {
    prismFlare = 1;
    prismCooldownUntil = t + 2.5;
    playPartials([
      [523.25, 0.09, 1.6, 0],
      [659.25, 0.08, 1.6, 0.09],
      [783.99, 0.08, 1.6, 0.18],
      [1046.5, 0.07, 2.0, 0.27],
    ]);
  }

  // the comet crosses, then waits
  {
    const phase = (t % COMET_PERIOD) / COMET_TRAVEL;
    comet.visible = phase <= 1;
    if (comet.visible) {
      comet.position.lerpVectors(COMET_START, COMET_END, phase);
    }
  }

  // music box lid eases open while the lullaby plays
  const lidTarget = t < musicBoxUntil ? -0.95 : 0;
  musicBoxLid.rotation.x +=
    (lidTarget - musicBoxLid.rotation.x) * Math.min(1, 8 * delta);

  // a touched aurora settles back down
  if (auroraBurst.value > 0.01) auroraBurst.value *= Math.exp(-1.5 * delta);

  // cerberus: three heads, three tempers, one shared spine
  for (let i = 0; i < 3; i++) {
    if (cerberusPerk[i] > 0.01) cerberusPerk[i] *= Math.exp(-2.5 * delta);
  }
  cerberusHeads[0].rotation.y = 0.25 + Math.sin(t * 2.8) * 0.16; // eager wiggle
  cerberusHeads[0].rotation.z = Math.sin(t * 2.1) * 0.07;
  cerberusHeads[0].rotation.x = -cerberusPerk[0] * 0.35;
  cerberusHeads[1].rotation.y = Math.sin(t * 0.45) * 0.4; // dutiful scan
  cerberusHeads[1].rotation.x = -cerberusPerk[1] * 0.35;
  cerberusHeads[2].rotation.y = -0.25 + Math.sin(t * 0.3) * 0.1; // dozing drift
  cerberusHeads[2].rotation.x =
    0.18 + Math.sin(t * 0.75) * 0.09 - cerberusPerk[2] * 0.5;

  // the ghost dragon soars its endless lap, head first, body following
  if (dragonExcite > 0.01) dragonExcite *= Math.exp(-0.8 * delta);
  dragonTheta += DRAGON.speed * (1 + dragonExcite * 1.6) * delta;
  dragonPath(dragonTheta, scratchA);
  dragonPath(dragonTheta + DRAGON.spacing * 2, scratchB);
  dragonHead.position.copy(scratchA);
  dragonHead.lookAt(scratchB);
  for (let i = 0; i < dragonSegments.length; i++) {
    const th = dragonTheta - (i + 1) * DRAGON.spacing;
    dragonPath(th, scratchA);
    dragonSegments[i].position.copy(scratchA);
    dragonPath(th + DRAGON.spacing, scratchB);
    dragonSegments[i].lookAt(scratchB);
  }

  // the last fruit in the universe, falling
  if (fruitFalling) {
    fruit.position.y -= 5 * delta;
    fruit.position.x +=
      (ghostCroc.position.x - fruit.position.x) * Math.min(1, 3 * delta);
    fruit.position.z +=
      (ghostCroc.position.z - fruit.position.z) * Math.min(1, 3 * delta);
    if (fruit.position.y <= ghostCroc.position.y + 0.3) {
      fruitFalling = false;
      fruit.visible = false;
      crocGulp = 1;
      crocRollT = 0; // a slow, happy roll
      playPartials([
        [120, 0.16, 0.12],
        [90, 0.18, 0.15, 0.1],
        [60, 0.12, 0.5, 0.22], // CHOMP
      ]);
      openParchment(
        'The last fruit in the universe falls.\n\nThe croc catches it the way it caught\nevery apple you ever threw, back when\nthis sky was a browser window.\n\nIt does a slow, happy roll.\n\nSomewhere, an old website smiles.'
      );
    }
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
    // teleport with feet at a given height, falling from rest
    drop: (x, y, z) => {
      camera.position.set(x, y + EYE_HEIGHT, z);
      feetY = y;
      grounded = false;
      verticalVelocity = 0;
    },
    state: () => ({
      pos: camera.position.toArray(),
      fov: camera.fov,
      grounded,
      feetY,
      inverted,
      bellAmp,
      watcherYaws: watcherPivots.map((w) => +w.rotation.y.toFixed(3)),
      drawCalls: renderer.info.render.calls,
      frame: renderer.info.render.frame,
      cometVisible: comet.visible,
      lidAngle: +musicBoxLid.rotation.x.toFixed(2),
      t: +clock.elapsedTime.toFixed(1),
      towerLean: +towerGroup.rotation.z.toFixed(4),
      staring: clock.elapsedTime < stareUntil,
      fogFar: +scene.fog.far.toFixed(1),
      crocRollT: +crocRollT.toFixed(2),
      cageRattle: +cageRattle.toFixed(2),
      auroraBurst: +auroraBurst.value.toFixed(2),
      fruitFalling,
      stonesVisited: visitedStones.size,
      airJumpsLeft,
      airDashLeft,
      dragonExcite: +dragonExcite.toFixed(2),
      dragonPos: dragonHead.position.toArray().map((v) => +v.toFixed(1)),
      cerberusHeadPos: cerberusHeads.map((h) =>
        h.getWorldPosition(new THREE.Vector3()).toArray().map((v) => +v.toFixed(2))
      ),
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
    movement.add(settings, 'dashImpulse', 10, 100, 1);

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
    world.add(settings, 'mirrorPool').name('mirror pool');
  });
}
