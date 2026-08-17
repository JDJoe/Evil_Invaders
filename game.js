/* ============================================================
   Village Defense – Silly Sniper Edition
   Billboard FPS village holdout
   ============================================================ */
(() => {
  'use strict';

  const MAP_W = 900, MAP_H = 600, SCALE = 0.07;
  const paths = [
    [{x:-120,y:-10},{x:40,y:80},{x:160,y:150},{x:300,y:210},{x:390,y:260},{x:450,y:300}],
    [{x:1020,y:-20},{x:860,y:70},{x:740,y:140},{x:600,y:200},{x:510,y:255},{x:450,y:300}],
    [{x:-120,y:610},{x:40,y:520},{x:160,y:450},{x:300,y:380},{x:390,y:335},{x:450,y:300}],
    [{x:1020,y:620},{x:860,y:530},{x:740,y:460},{x:600,y:390},{x:510,y:340},{x:450,y:300}],
    [{x:450,y:-90},{x:450,y:20},{x:450,y:90},{x:450,y:170},{x:450,y:240},{x:450,y:300}],
    [{x:450,y:690},{x:450,y:580},{x:450,y:510},{x:450,y:430},{x:450,y:360},{x:450,y:300}],
    [{x:-160,y:300},{x:20,y:300},{x:110,y:300},{x:220,y:300},{x:330,y:300},{x:450,y:300}],
    [{x:1060,y:300},{x:880,y:300},{x:790,y:300},{x:680,y:300},{x:570,y:300},{x:450,y:300}]
  ];
  const villageRect = {x:360, y:240, w:180, h:120};
  // Screen-space assist only. Real hits come from the body capsule.
  // These shrink with distance so a far speck is not a free kill.
  const AIM_PX = 30;
  const AIM_SCOPE_PX = 22;
  const AIM_NEAR = 12;
  const AIM_FAR = 38;

  const $ = (id) => document.getElementById(id);
  const mapToWorld = (x, y) => new THREE.Vector3((x - MAP_W / 2) * SCALE, 0, (y - MAP_H / 2) * SCALE);

  function housePlots() {
    const cx = 450, cy = 300;
    const ring = [
      { a: 0.35, r: 86 }, { a: 1.12, r: 94 }, { a: 1.95, r: 88 }, { a: 2.75, r: 96 },
      { a: 3.55, r: 90 }, { a: 4.30, r: 98 }, { a: 5.05, r: 84 }, { a: 5.75, r: 92 }
    ];
    return ring.map((p, i) => ({
      mapX: cx + Math.cos(p.a) * p.r,
      mapY: cy + Math.sin(p.a) * p.r,
      rot: p.a + Math.PI / 2,
      gold: i % 3 === 0,
      w: 2.2 + (i % 3) * 0.15,
      h: 2.2 + ((i + 1) % 3) * 0.18,
      d: 2.05 + (i % 2) * 0.15
    }));
  }

  function fieldBounds() {
    let minX = villageRect.x, maxX = villageRect.x + villageRect.w;
    let minY = villageRect.y, maxY = villageRect.y + villageRect.h;
    paths.forEach((p) => p.forEach((pt) => {
      minX = Math.min(minX, pt.x); maxX = Math.max(maxX, pt.x);
      minY = Math.min(minY, pt.y); maxY = Math.max(maxY, pt.y);
    }));
    const pad = 48;
    return { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad };
  }
  function mapXform() {
    const b = fieldBounds();
    const bw = b.maxX - b.minX, bh = b.maxY - b.minY;
    const s = Math.min(MAP_W / bw, MAP_H / bh);
    return {
      s,
      ox: (MAP_W - bw * s) / 2 - b.minX * s,
      oy: (MAP_H - bh * s) / 2 - b.minY * s
    };
  }
  function toCanvas(x, y) {
    const t = mapXform();
    return { x: x * t.s + t.ox, y: y * t.s + t.oy };
  }
  function toMap(cx, cy) {
    const t = mapXform();
    return { x: (cx - t.ox) / t.s, y: (cy - t.oy) / t.s };
  }

  const IMAGES = {
    grass: 'assets/tex_grass.png',
    dirt: 'assets/tex_dirt.png',
    roof: 'assets/tex_roof.png',
    plaster: 'assets/tex_plaster.png',
    sky: 'assets/tex_sky.png',
    house: 'assets/tex_house.png',
    houseGold: 'assets/tex_house_gold.png',
    ei: 'assets/spr_ei.png?v=4',
    eiSprinty: 'assets/spr_ei_sprinty.png?v=4',
    eiTanky: 'assets/spr_ei_tanky.png?v=4',
    eiBoss: 'assets/spr_ei_boss.png?v=4',
    eiBean: 'assets/spr_ei_bean.png',
    soldier: 'assets/spr_soldier.png',
    tree: 'assets/spr_tree.png',
    bush: 'assets/spr_bush.png',
    rock: 'assets/spr_rock.png',
    crate: 'assets/spr_crate.png',
    hay: 'assets/spr_hay.png',
    cottage: 'assets/spr_cottage.png',
    villagerBaker: 'assets/spr_villager_baker.png',
    villagerWoman: 'assets/spr_villager_woman.png',
    villagerFarmer: 'assets/spr_villager_farmer.png',
    rifle: 'assets/spr_rifle.png',
    win: 'assets/win.png'
  };

  const imgs = {};
  const tex = {};
  let shadowTex = null;

  const HS_KEY = 'vd_highscore';
  let highScore = Number(localStorage.getItem(HS_KEY) || 0);
  let lastRunScore = null;

  /* ---------------- audio ---------------- */
  const Sfx = {
    ctx: null, muted: false, musicGain: null, musicTimer: 0,
    ensure() {
      if (this.ctx) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.28;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.12;
      this.musicGain.connect(this.master);
    },
    beep(freq, dur, type = 'square', vol = 0.3, slide = 0) {
      if (this.muted || !this.ctx) return;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type;
      o.frequency.value = freq;
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), this.ctx.currentTime + dur);
      g.gain.setValueAtTime(vol, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
      o.connect(g); g.connect(this.master);
      o.start(); o.stop(this.ctx.currentTime + dur);
    },
    noise(dur, vol = 0.2) {
      if (this.muted || !this.ctx) return;
      const n = this.ctx.sampleRate * dur;
      const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const f = this.ctx.createBiquadFilter();
      f.type = 'bandpass'; f.frequency.value = 1800;
      const g = this.ctx.createGain();
      g.gain.value = vol;
      src.connect(f); f.connect(g); g.connect(this.master);
      src.start();
    },
    shoot(charged) { this.noise(charged ? 0.18 : 0.08, charged ? 0.35 : 0.18); this.beep(charged ? 140 : 220, 0.08, 'sawtooth', 0.15, -80); },
    oyVey() {
      if (this.muted) return;
      try {
        if (window.speechSynthesis) {
          const u = new SpeechSynthesisUtterance('Oy vey');
          u.rate = 1.22;
          u.pitch = 1.4;
          u.volume = 0.9;
          u.lang = 'en-US';
          window.speechSynthesis.speak(u);
        }
      } catch (err) { /* ignore */ }
    },
    hit() { this.beep(880, 0.06, 'square', 0.16); },
    head() { this.beep(1240, 0.08, 'triangle', 0.2); this.beep(1860, 0.1, 'sine', 0.1); },
    kill() { this.beep(520, 0.14, 'square', 0.18, -280); },
    boss() { this.beep(90, 0.4, 'sawtooth', 0.25, -40); this.beep(180, 0.5, 'square', 0.12); },
    hurt() { this.beep(70, 0.25, 'sawtooth', 0.22); },
    pickup() { this.beep(660, 0.08, 'sine', 0.16); this.beep(990, 0.12, 'sine', 0.12); },
    shop() { this.beep(440, 0.08, 'triangle', 0.14); this.beep(660, 0.1, 'triangle', 0.1); },
    tickMusic(dt) {
      if (this.muted || !this.ctx || !gameRunning) return;
      this.musicTimer -= dt;
      if (this.musicTimer > 0) return;
      this.musicTimer = 0.42;
      const scale = [196, 233, 262, 294, 349];
      const f = scale[(Math.random() * scale.length) | 0];
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'triangle';
      o.frequency.value = f / 2;
      g.gain.setValueAtTime(0.07, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.4);
      o.connect(g); g.connect(this.musicGain);
      o.start(); o.stop(this.ctx.currentTime + 0.42);
    }
  };

  /* ---------------- asset load ---------------- */
  function loadImage(src) {
    return new Promise((resolve) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => resolve(null);
      im.src = src;
    });
  }
  function makeTex(image, repeat) {
    if (!image) return null;
    const t = new THREE.Texture(image);
    t.colorSpace = THREE.SRGBColorSpace;
    t.needsUpdate = true;
    if (repeat) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(repeat, repeat);
    }
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    return t;
  }
  function makeShadowTex() {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(32, 32, 4, 32, 32, 30);
    grd.addColorStop(0, 'rgba(0,0,0,0.45)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c);
    t.needsUpdate = true;
    return t;
  }

  async function loadAll() {
    const keys = Object.keys(IMAGES);
    let done = 0;
    const total = keys.length;
    const tick = () => {
      done++;
      $('loadStatus').textContent = `Loading field kit… ${done}/${total}`;
    };
    await Promise.all(keys.map(async (k) => {
      imgs[k] = await loadImage(IMAGES[k]);
      tick();
    }));
    tex.grass = makeTex(imgs.grass, 18);
    tex.dirt = makeTex(imgs.dirt, 2);
    tex.roof = makeTex(imgs.roof, 2);
    tex.plaster = makeTex(imgs.plaster, 1);
    tex.sky = makeTex(imgs.sky);
    tex.house = makeTex(imgs.house);
    tex.houseGold = makeTex(imgs.houseGold);
    ['ei','eiSprinty','eiTanky','eiBoss','eiBean','soldier','tree','bush','rock','crate','hay','cottage','villagerBaker','villagerWoman','villagerFarmer'].forEach((k) => {
      tex[k] = makeTex(imgs[k]);
    });
    shadowTex = makeShadowTex();
    if (imgs.sky) {
      $('title').style.backgroundImage = `url(${IMAGES.sky})`;
    }
    $('loadStatus').textContent = 'Ready.';
    $('btnPlay').disabled = false;
    updateTitleScores();
  }

  /* ---------------- planning ---------------- */
  const canvas = $('mapCanvas');
  const ctx = canvas.getContext('2d');
  let placeMode = null, sniperPos = null, soldiers = [];

  function drawMap() {
    if (imgs.grass) {
      const pat = ctx.createPattern(imgs.grass, 'repeat');
      ctx.fillStyle = pat || '#27ae60';
    } else ctx.fillStyle = '#27ae60';
    ctx.fillRect(0, 0, MAP_W, MAP_H);

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(120,80,40,0.95)';
    ctx.lineWidth = 10;
    paths.forEach((p) => {
      const a = toCanvas(p[0].x, p[0].y);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      for (let i = 1; i < p.length; i++) {
        const b = toCanvas(p[i].x, p[i].y);
        ctx.lineTo(b.x, b.y);
      }
      ctx.stroke();
    });
    ctx.restore();

    housePlots().forEach((p) => {
      const c = toCanvas(p.mapX, p.mapY);
      ctx.fillStyle = p.gold ? '#d4ac0d' : '#f5e6c8';
      ctx.strokeStyle = '#c0392b';
      ctx.lineWidth = 2;
      ctx.fillRect(c.x - 10, c.y - 8, 20, 16);
      ctx.strokeRect(c.x - 10, c.y - 8, 20, 16);
    });
    const well = toCanvas(villageRect.x + villageRect.w / 2, villageRect.y + villageRect.h / 2);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px Roboto Condensed';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.strokeText('WELL', well.x - 22, well.y + 5);
    ctx.fillText('WELL', well.x - 22, well.y + 5);

    if (sniperPos) {
      const c = toCanvas(sniperPos.x, sniperPos.y);
      ctx.fillStyle = '#3498db';
      ctx.beginPath(); ctx.arc(c.x, c.y, 10, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 12px Roboto Condensed';
      ctx.fillText('YOU', c.x - 12, c.y + 4);
    }
    soldiers.forEach((s, i) => {
      const c = toCanvas(s.x, s.y);
      ctx.fillStyle = '#2ecc71';
      ctx.beginPath(); ctx.arc(c.x, c.y, 9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#000'; ctx.font = 'bold 11px Roboto Condensed';
      ctx.fillText('S' + (i + 1), c.x - 7, c.y + 4);
    });
  }

  function setActive(id) {
    ['btnSniper', 'btnSoldier'].forEach((b) => $(b).classList.remove('active'));
    if (id) $(id).classList.add('active');
  }

  $('btnSniper').onclick = () => { placeMode = 'sniper'; setActive('btnSniper'); };
  $('btnSoldier').onclick = () => {
    if (soldiers.length >= 3) return;
    placeMode = 'soldier'; setActive('btnSoldier');
  };
  $('btnReset').onclick = () => {
    sniperPos = null; soldiers = []; placeMode = null;
    $('soldierCount').textContent = '0';
    $('btnStart').disabled = true;
    setActive(null);
    drawMap();
  };
  canvas.onclick = (e) => {
    const rect = canvas.getBoundingClientRect();
    const x0 = (e.clientX - rect.left) * (MAP_W / rect.width);
    const y0 = (e.clientY - rect.top) * (MAP_H / rect.height);
    const mapped = toMap(x0, y0);
    const x = mapped.x, y = mapped.y;
    if (placeMode === 'sniper') {
      sniperPos = {x, y}; placeMode = null; setActive(null);
    } else if (placeMode === 'soldier' && soldiers.length < 3) {
      soldiers.push({x, y});
      $('soldierCount').textContent = soldiers.length;
      if (soldiers.length === 3) { placeMode = null; setActive(null); }
    }
    $('btnStart').disabled = !(sniperPos && soldiers.length >= 1);
    drawMap();
  };

  /* ---------------- game state ---------------- */
  let scene, camera, renderer, clock;
  let villageHP = 100, player = {yaw: 0, pitch: 0};
  const keys = {};
  let eiList = [], soldierMeshes = [], pickups = [], mines = [], particles = [];
  let isPointerLocked = false, gameRunning = false, worldReady = false;
  let charges = 3, mineCount = 0, isCharging = false, chargeStart = 0;
  let soldierTarget = null;
  let waveNumber = 1, currentWaveSize = 4;
  let score = 0, combo = 1, comboTimer = 0, lastShot = 0;
  let dmgBonus = 0, dmgBoostT = 0, recoil = 0, shake = 0, slowMo = 0, pendingAir = 0;
  let villageGroup = null, listenersBound = false, looping = false;
  let spawnQueue = [], spawnTimer = 0, lastVillageFlash = 0, waveClearPending = false;
  let airTimer = 0;

  const TYPES = {
    regular: { hp: 1, speed: 0.92, scale: 0.70, score: 100, key: 'ei' },
    sprinty: { hp: 1, speed: 1.42, scale: 0.58, score: 160, key: 'eiSprinty' },
    bean:    { hp: 1, speed: 1.48, scale: 0.50, score: 80, key: 'eiBean' },
    tanky:   { hp: 2, speed: 0.68, scale: 0.88, score: 260, key: 'eiTanky' },
    boss:    { hp: 4, speed: 0.58, scale: 1.12, score: 1600, key: 'eiBoss' }
  };

  function mat(map, color) {
    if (map) return new THREE.MeshLambertMaterial({ map });
    return new THREE.MeshLambertMaterial({ color: color || 0x888888 });
  }
  function addHitProxy(g, rad, h) {
    const cyl = Math.max(0.3, h - rad * 1.15);
    const proxy = new THREE.Mesh(
      new THREE.CapsuleGeometry(rad, cyl, 3, 8),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
    );
    proxy.position.y = rad * 0.5 + cyl * 0.5;
    proxy.userData.isHitProxy = true;
    g.add(proxy);
    g.userData.hitProxy = proxy;
    return proxy;
  }

  function spriteOf(map, w, h) {
    if (!map) return null;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map, transparent: true, alphaTest: 0.2, depthWrite: true
    }));
    s.scale.set(w, h, 1);
    s.center.set(0.5, 0.5);
    s.position.y = h * 0.5;
    s.userData.baseY = h * 0.5;
    return s;
  }
  function addShadow(parent, size) {
    if (!shadowTex) return;
    const s = new THREE.Mesh(
      new THREE.CircleGeometry(size, 16),
      new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false })
    );
    s.rotation.x = -Math.PI / 2;
    s.position.y = 0.03;
    parent.add(s);
  }

  function makeHouse(w, h, d, front, side) {
    const g = new THREE.Group();
    const mats = [
      mat(side || tex.plaster, 0xe8d5b5),
      mat(side || tex.plaster, 0xe8d5b5),
      mat(tex.plaster, 0xe8d5b5),
      mat(tex.plaster, 0xe8d5b5),
      mat(front, 0xf5e6c8),
      mat(front, 0xf5e6c8)
    ];
    const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats);
    box.position.y = h / 2;
    box.castShadow = true;
    g.add(box);
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(Math.max(w, d) * 0.78, h * 0.5, 4),
      mat(tex.roof, 0xc0392b)
    );
    roof.position.y = h + h * 0.22;
    roof.rotation.y = Math.PI / 4;
    g.add(roof);
    return g;
  }

  function addRoad(a, b) {
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const len = a.distanceTo(b);
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(2.35, 0.05, len + 0.5),
      mat(tex.dirt, 0x8d6e4a)
    );
    box.position.set(mid.x, 0.02, mid.z);
    const dir = b.clone().sub(a);
    box.rotation.y = Math.atan2(dir.x, dir.z);
    scene.add(box);
  }

  function scatterBillboards() {
    const spots = [];
    const randRing = (n, r0, r1, key, w, h) => {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = r0 + Math.random() * (r1 - r0);
        const x = Math.cos(a) * r, z = Math.sin(a) * r;
        if (Math.hypot(x, z) < 7) continue;
        const spr = spriteOf(tex[key], w * (0.8 + Math.random() * 0.5), h * (0.8 + Math.random() * 0.4));
        if (!spr) continue;
        spr.position.set(x, spr.userData.baseY || 0, z);
        scene.add(spr);
        spots.push(spr);
      }
    };
    randRing(16, 28, 62, 'tree', 4.2, 7.2);
    randRing(10, 20, 40, 'bush', 1.8, 2.2);
    randRing(8, 18, 36, 'rock', 1.4, 1.2);
    randRing(5, 14, 22, 'hay', 1.5, 1.2);
    placeVillagers();
  }

  let villagerMeshes = [];
  function placeVillagers() {
    villagerMeshes.forEach((v) => scene.remove(v));
    villagerMeshes = [];
    const plots = housePlots();
    const folks = [
      { key: 'villagerBaker', plot: 0, off: 2.2, w: 1.45, h: 2.0 },
      { key: 'villagerWoman', plot: 2, off: 2.1, w: 1.4, h: 1.95 },
      { key: 'villagerFarmer', plot: 4, off: 2.3, w: 1.5, h: 2.05 },
      { key: 'villagerWoman', plot: 6, off: 2.0, w: 1.35, h: 1.9 }
    ];
    folks.forEach((f, i) => {
      const g = new THREE.Group();
      const spr = spriteOf(tex[f.key], f.w, f.h);
      if (!spr) return;
      g.add(spr);
      addShadow(g, 0.4);
      addHitProxy(g, 0.62, f.h);
      const p = plots[f.plot] || plots[0];
      const wpos = mapToWorld(p.mapX, p.mapY);
      g.position.set(wpos.x + f.off, 0, wpos.z + f.off * 0.3);
      g.userData.sprite = spr;
      g.userData.kind = 'villager';
      g.userData.flash = 0;
      g.userData.walkT = i * 1.7;
      scene.add(g);
      villagerMeshes.push(g);
    });
  }

  let villageHouses = [];
  function buildVillage() {
    villageGroup = new THREE.Group();
    villageHouses = [];
    housePlots().forEach((p) => {
      const house = makeHouse(p.w, p.h, p.d, p.gold ? tex.houseGold : tex.house, tex.plaster);
      const w = mapToWorld(p.mapX, p.mapY);
      house.position.set(w.x, 0.02, w.z);
      house.rotation.y = p.rot;
      villageGroup.add(house);
      villageHouses.push({ mesh: house, x: w.x, z: w.z, hp: 8, maxHp: 8, baseY: 0.02 });
    });
    // well
    const well = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 0.8, 10), mat(tex.plaster, 0xbbbbbb));
    well.position.set(0.2, 0.4, 0.2);
    villageGroup.add(well);
    const wellRoof = new THREE.Mesh(new THREE.ConeGeometry(0.8, 0.6, 4), mat(tex.roof, 0xc0392b));
    wellRoof.position.set(0.2, 1.5, 0.2);
    wellRoof.rotation.y = Math.PI / 4;
    villageGroup.add(wellRoof);
    scene.add(villageGroup);
  }

  function nearestStandingHouse(pos, range) {
    let best = null, bestD = range;
    villageHouses.forEach((h) => {
      if (h.hp <= 0) return;
      const d = Math.hypot(pos.x - h.x, pos.z - h.z);
      if (d < bestD) { bestD = d; best = h; }
    });
    return best;
  }

  function resetHouses() {
    villageHouses.forEach((h) => {
      h.hp = h.maxHp;
      h.mesh.position.y = h.baseY || 0.02;
      h.mesh.rotation.x = 0;
      h.mesh.rotation.z = 0;
    });
  }

  function smashHouse(h, amount) {
    if (!h || h.hp <= 0) return;
    h.hp = Math.max(0, h.hp - amount);
    const hurt = 1 - h.hp / h.maxHp;
    h.mesh.rotation.z = hurt * 0.18;
    if (h.hp <= 0) {
      h.mesh.position.y = -2.4;
      showMessage('HOUSE DOWN', 800);
    } else {
      showMessage('THEY ARE WRECKING A HOUSE', 700);
    }
  }

  function createUnit(type) {
    const spec = TYPES[type] || TYPES.regular;
    const g = new THREE.Group();
    const h = 2.15 * spec.scale;
    const w = (type === 'tanky' ? 2.0 : type === 'sprinty' || type === 'bean' ? 1.45 : 1.7) * spec.scale;
    const spr = spriteOf(tex[spec.key], w, h);
    if (spr) {
      g.add(spr);
      g.userData.sprite = spr;
    } else {
      const body = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.4 * spec.scale, 0.8 * spec.scale, 4, 8),
        new THREE.MeshLambertMaterial({ color: type === 'boss' ? 0xc0392b : 0x8e44ad })
      );
      body.position.y = spec.scale;
      g.add(body);
    }
    const rad = Math.max(0.40, w * 0.34);
    const cyl = Math.max(0.35, h - rad * 1.2);
    const proxy = new THREE.Mesh(
      new THREE.CapsuleGeometry(rad, cyl, 3, 8),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
    );
    proxy.position.y = rad * 0.55 + cyl * 0.5;
    proxy.userData.isHitProxy = true;
    g.add(proxy);
    g.userData.hitProxy = proxy;
    addShadow(g, 0.4 * spec.scale);
    if (type === 'tanky' || type === 'boss') {
      const bg = new THREE.Mesh(
        new THREE.PlaneGeometry(1.3 * spec.scale, 0.12),
        new THREE.MeshBasicMaterial({ color: 0x111111, depthTest: false })
      );
      const fill = new THREE.Mesh(
        new THREE.PlaneGeometry(1.24 * spec.scale, 0.08),
        new THREE.MeshBasicMaterial({ color: 0xe74c3c, depthTest: false })
      );
      bg.position.y = h + 0.25;
      fill.position.y = h + 0.25;
      fill.position.z = 0.01;
      g.add(bg); g.add(fill);
      g.userData.hpFill = fill;
      g.userData.hpBg = bg;
      g.userData.hpW = 1.24 * spec.scale;
    }
    g.userData = Object.assign(g.userData, {
      hp: spec.hp, maxHp: spec.hp, type, speed: spec.speed,
      path: null, pathIndex: 0, score: spec.score, flash: 0,
      walkT: Math.random(), zig: Math.random() * Math.PI * 2,
      slamT: 10 + Math.random() * 6, hitH: h, biteT: 1.1,
      spillT: type === 'boss' ? 1.4 : 0, spilled: 0
    });
    return g;
  }

  function squadCap() {
    if (currentWaveSize < 10) return 1;
    if (currentWaveSize < 16) return 2;
    return 3;
  }

  function deploySquad(reset) {
    if (reset) {
      soldierMeshes.forEach((s) => { if (s) scene.remove(s); });
      soldierMeshes = [];
    }
    const cap = Math.min(squadCap(), soldiers.length);
    for (let i = cap; i < soldierMeshes.length; i++) {
      if (soldierMeshes[i]) scene.remove(soldierMeshes[i]);
      soldierMeshes[i] = null;
    }
    let arrived = 0;
    for (let i = 0; i < cap; i++) {
      if (!reset && soldierMeshes[i] && soldierMeshes[i].userData.hp > 0) continue;
      if (soldierMeshes[i]) scene.remove(soldierMeshes[i]);
      const m = createSoldierMesh();
      const src = soldiers[i] || soldiers[0];
      const w = mapToWorld(src.x, src.y);
      m.position.set(w.x, 0, w.z);
      scene.add(m);
      soldierMeshes[i] = m;
      arrived++;
    }
    return arrived;
  }

  function createSoldierMesh() {
    const g = new THREE.Group();
    const spr = spriteOf(tex.soldier, 1.55, 2.05);
    if (spr) { g.add(spr); g.userData.sprite = spr; }
    else {
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 0.9, 4, 8), new THREE.MeshLambertMaterial({ color: 0x27ae60 }));
      body.position.y = 1;
      g.add(body);
    }
    addShadow(g, 0.45);
    addHitProxy(g, 0.7, 2.05);
    g.userData.hp = 8;
    g.userData.maxHp = 8;
    g.userData.lastShot = 0;
    g.userData.flash = 0;
    g.userData.kind = 'soldier';
    g.userData.hitH = 2.05;
    return g;
  }

  /* ---------------- world boot ---------------- */
  function startMission() {
    Sfx.ensure();
    $('planning').style.display = 'none';
    $('game').style.display = 'block';
    $('crosshair').style.display = 'block';

    const nest = mapToWorld(sniperPos.x, sniperPos.y);
    player.yaw = Math.atan2(-nest.x, -nest.z);
    player.pitch = 0;

    if (!worldReady) {
      scene = new THREE.Scene();
      scene.background = new THREE.Color(0x87b8e0);
      scene.fog = new THREE.Fog(0x9ec9e8, 58, 130);

      camera = new THREE.PerspectiveCamera(68, 1, 0.1, 280);
      camera.position.set(nest.x, 3.1, nest.z);

      renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
      renderer.shadowMap.enabled = true;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      const canvas = renderer.domElement;
      canvas.style.position = 'absolute';
      canvas.style.top = '0';
      canvas.style.left = '0';
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.zIndex = '1';
      canvas.style.display = 'block';
      $('game').appendChild(canvas);
      fitRenderer();

      const hemi = new THREE.HemisphereLight(0xc8e4ff, 0x4a7a3a, 0.85);
      scene.add(hemi);
      const sun = new THREE.DirectionalLight(0xfff2d4, 0.95);
      sun.position.set(18, 28, 12);
      sun.castShadow = true;
      scene.add(sun);

      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(140, 140),
        mat(tex.grass, 0x2d8a3e)
      );
      ground.rotation.x = -Math.PI / 2;
      ground.receiveShadow = true;
      scene.add(ground);

      if (tex.sky) {
        const sky = new THREE.Mesh(
          new THREE.SphereGeometry(110, 24, 16),
          new THREE.MeshBasicMaterial({ map: tex.sky, side: THREE.BackSide, fog: false })
        );
        scene.add(sky);
      }

      paths.forEach((p) => {
        for (let i = 0; i < p.length - 1; i++) {
          addRoad(mapToWorld(p[i].x, p[i].y), mapToWorld(p[i + 1].x, p[i + 1].y));
        }
      });

      buildVillage();
      scatterBillboards();
      worldReady = true;
    } else {
      camera.position.set(nest.x, 3.1, nest.z);
    }

    clearMines();
    cancelAirstrike();
    deploySquad(true);

    bindInput();
    clock = new THREE.Clock();
    gameRunning = true;
    waveClearPending = false;
    if ($('waveClearHint')) $('waveClearHint').style.display = 'none';
    charges = 3;
    mineCount = 0;
    villageHP = 100;
    waveNumber = 1;
    currentWaveSize = 4;
    score = 0;
    combo = 1;
    dmgBonus = 0;
    pendingAir = 0;
    updateHUD();
    spawnWave();
    startLoop();
    if ($('lockHint')) $('lockHint').style.display = 'block';
    renderer.domElement.requestPointerLock();
  }

  function bindInput() {
    if (listenersBound) return;
    listenersBound = true;
    document.addEventListener('click', (e) => {
      if (!gameRunning) return;
      if (e.target.closest('#minimap') || e.target.closest('.overlay') || e.target.closest('button')) return;
      if (!isPointerLocked) renderer.domElement.requestPointerLock();
    });
    document.addEventListener('pointerlockchange', () => {
      isPointerLocked = document.pointerLockElement === renderer.domElement;
      const hint = $('lockHint');
      if (hint) hint.style.display = (gameRunning && !isPointerLocked) ? 'block' : 'none';
    });
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('keydown', (e) => {
      keys[e.code] = true;
      if (e.code === 'KeyM') { Sfx.muted = !Sfx.muted; showMessage(Sfx.muted ? 'AUDIO OFF' : 'AUDIO ON', 700); }
      if (e.code === 'Escape' && isPointerLocked) document.exitPointerLock();
      if (e.code === 'KeyQ' && gameRunning) {
        soldierTarget = camera.position.clone();
        soldierTarget.y = 0;
        showMessage('SQUAD: RALLYING ON YOU', 800);
      }
      if (e.code === 'KeyF' && gameRunning && isPointerLocked) plantMine();
      if ((e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space') && waveClearPending) {
        e.preventDefault();
        confirmWaveClear();
      }
    });
    document.addEventListener('keyup', (e) => { keys[e.code] = false; });
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mouseup', onMouseUp);
    window.addEventListener('resize', fitRenderer);
    $('minimap').oncontextmenu = (e) => {
      e.preventDefault();
      soldierTarget = null;
      showMessage('SQUAD: HUNTING FREELY', 700);
    };
    $('minimap').onclick = (e) => {
      const rect = $('miniCanvas').getBoundingClientRect();
      const mx = (e.clientX - rect.left) / rect.width;
      const my = (e.clientY - rect.top) / rect.height;
      soldierTarget = new THREE.Vector3((mx - 0.5) * (228 / 2.05), 0, (my - 0.5) * (166 / 2.05));
      showMessage('SQUAD MOVING', 700);
    };
  }

  /* ---------------- waves ---------------- */
  function openPaths() {
    const n = Math.min(paths.length, waveNumber <= 1 ? 3 : waveNumber <= 3 ? 5 : paths.length);
    const order = paths.slice();
    for (let i = order.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      const t = order[i]; order[i] = order[j]; order[j] = t;
    }
    return order.slice(0, n);
  }

  function spawnOne(type, path) {
    const ei = createUnit(type);
    const start = mapToWorld(path[0].x, path[0].y);
    ei.position.set(start.x + (Math.random() - 0.5) * 2.2, 0, start.z + (Math.random() - 0.5) * 2.2);
    ei.userData.path = path.map((p) => mapToWorld(p.x, p.y));
    ei.userData.pathIndex = 0;
    ei.userData.biteT = 1.1;
    scene.add(ei);
    eiList.push(ei);
    updateHUD();
  }

  function spillBeans(from, n) {
    if (!from || !from.userData.path) return;
    const count = n || 3;
    from.userData.spilled = (from.userData.spilled || 0) + count;
    for (let i = 0; i < count; i++) {
      const bean = createUnit('bean');
      const ang = (i / count) * Math.PI * 2 + Math.random() * 0.4;
      bean.position.set(
        from.position.x + Math.cos(ang) * 1.6,
        0,
        from.position.z + Math.sin(ang) * 1.6
      );
      bean.userData.path = from.userData.path;
      bean.userData.pathIndex = from.userData.pathIndex || 0;
      bean.userData.biteT = 1.1;
      scene.add(bean);
      eiList.push(bean);
    }
    shake = 0.18;
    burst(from.position.clone().setY(1.2), 0x111111, 18);
    showMessage('BOSS SPILLED BEANS', 900);
    feed(count + ' BEANS ON THE ROAD');
    updateHUD();
  }

  function spawnWave() {
    eiList.forEach((e) => scene.remove(e));
    eiList = [];
    pickups.forEach((p) => scene.remove(p));
    pickups = [];
    spawnQueue = [];
    spawnTimer = 0;
    resetHouses();
    const bosses = currentWaveSize < 10 ? 0 : Math.min(4, Math.floor(currentWaveSize / 10));
    const used = openPaths();
    for (let i = 0; i < currentWaveSize; i++) {
      let type = 'regular';
      const r = Math.random();
      if (waveNumber > 1 && r < 0.12) type = 'sprinty';
      else if (waveNumber > 2 && r < 0.24) type = 'tanky';
      if (i < bosses) type = 'boss';
      spawnQueue.push({ type, path: used[i % used.length] });
    }
    updateHUD();
    const bossMsg = bosses > 1 ? `${bosses} BOSSES INCOMING` : (bosses === 1 ? 'BOSS INCOMING' : `${currentWaveSize} INVADERS`);
    showMessage(`WAVE ${waveNumber}  ·  ${bossMsg}`, 1100);
    radio(bosses ? (bosses > 1 ? 'RADIO: Multiple hats. Multiple noses.' : 'RADIO: Big hat, bigger nose. Drop him.') : radioLine());
    cancelAirstrike();
    if (pendingAir) {
      pendingAir = 0;
      airTimer = setTimeout(() => {
        airTimer = 0;
        if (!gameRunning) return;
        eiList.forEach((e) => {
          if (e.userData.hp > 0) applyDamage(e, 4, false, false, e.position.clone().setY(1.4));
        });
        showMessage('AIRSTRIKE INBOUND', 800);
        shake = 0.35;
      }, 1400);
    }
  }

  function cancelAirstrike() {
    if (airTimer) { clearTimeout(airTimer); airTimer = 0; }
  }

  function clearMines() {
    mines.forEach((m) => scene.remove(m));
    mines = [];
  }

  function tickSpawn(dt) {
    if (!gameRunning || !spawnQueue.length) return;
    spawnTimer -= dt;
    if (spawnTimer > 0) return;
    const next = spawnQueue.shift();
    spawnOne(next.type, next.path);
    spawnTimer = waveNumber <= 2 ? 2.4 : Math.max(1.15, 2.1 - waveNumber * 0.08);
  }

  const RADIO = [
    'RADIO: Aim for the nose. Always the nose.',
    'SQUAD: Roads are live. Call the shots.',
    'RADIO: Hold the square. The bakers are counting on you.',
    'SQUAD: Request fewer sideburns, more bullets.',
    'RADIO: Charged glass is for the thick ones.',
    'SQUAD: They zig. We zag. We shoot.',
    'RADIO: If it sparkles, it is a crate. Steal it.',
    'SQUAD: Click the map if you want us elsewhere.'
  ];
  function radioLine() { return RADIO[(Math.random() * RADIO.length) | 0]; }
  function radio(msg) { showMessage(msg, 1400); }

  /* ---------------- combat ---------------- */
  function onMouseMove(e) {
    if (!isPointerLocked) return;
    const sens = isCharging ? 0.0009 : 0.0018;
    player.yaw -= e.movementX * sens;
    player.pitch -= e.movementY * sens;
    player.pitch = Math.max(-1.25, Math.min(1.25, player.pitch));
  }
  function onMouseDown(e) {
    if (!gameRunning) return;
    if (e.target.closest && (e.target.closest('#minimap') || e.target.closest('.overlay') || e.target.closest('button'))) return;
    if (e.button === 2) {
      e.preventDefault();
      if (!isPointerLocked) renderer.domElement.requestPointerLock();
      isCharging = true;
      chargeStart = clock.getElapsedTime();
      $('crosshair').classList.add('charged');
      $('scope').style.display = 'block';
      $('rifle').classList.add('hidden');
    }
    if (e.button === 0) {
      if (!isPointerLocked) renderer.domElement.requestPointerLock();
      tryShoot();
    }
  }
  function onMouseUp(e) {
    if (e.button === 2) {
      isCharging = false;
      $('crosshair').classList.remove('charged');
      $('scope').style.display = 'none';
      $('rifle').classList.remove('hidden');
      $('chargeFill').style.width = '0%';
    }
  }

  function fitRenderer() {
    if (!renderer || !camera) return;
    const host = $('game');
    const w = Math.max(1, host.clientWidth || innerWidth);
    const h = Math.max(1, host.clientHeight || innerHeight);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
  }

  function viewSize() {
    if (renderer && renderer.domElement) {
      const r = renderer.domElement.getBoundingClientRect();
      if (r.width > 1 && r.height > 1) return { w: r.width, h: r.height };
    }
    return { w: innerWidth, h: innerHeight };
  }

  function syncCamera() {
    camera.rotation.order = 'YXZ';
    camera.rotation.y = player.yaw;
    camera.rotation.x = player.pitch - recoil;
    camera.updateMatrixWorld();
  }

  function unitFromHit(obj) {
    let o = obj;
    while (o) {
      if (o.userData && o.userData.hp != null) return o;
      o = o.parent;
    }
    return null;
  }

  function rangeAimScale(obj) {
    const d = camera.position.distanceTo(obj.position);
    if (d <= AIM_NEAR) return 1;
    if (d >= AIM_FAR) return 0.22;
    return 1 - ((d - AIM_NEAR) / (AIM_FAR - AIM_NEAR)) * 0.78;
  }

  function aimSlackPx(obj, friendly) {
    const base = isCharging ? AIM_SCOPE_PX : AIM_PX;
    return base * (friendly ? 0.55 : 1) * rangeAimScale(obj);
  }

  function screenAim(obj, maxPx) {
    const spr = obj.userData.sprite;
    const p = new THREE.Vector3();
    if (spr) spr.getWorldPosition(p);
    else p.copy(obj.position).setY(obj.position.y + (obj.userData.hitH || 2) * 0.5);
    const view = p.clone().applyMatrix4(camera.matrixWorldInverse);
    if (view.z > -0.05) return null;
    p.project(camera);
    const vs = viewSize();
    const dx = p.x * vs.w * 0.5;
    const dy = -p.y * vs.h * 0.5;
    const dist = Math.hypot(dx, dy);
    if (dist > maxPx) return null;
    const h = obj.userData.hitH || 2;
    const headCut = Math.max(7, 13 * rangeAimScale(obj));
    const head = dy < -headCut;
    const point = obj.position.clone();
    point.y = h * (head ? 0.8 : 0.45);
    return { dist, head, point };
  }

  function aimTarget() {
    syncCamera();
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(0, 0), camera);
    ray.near = 0.05;
    ray.far = 200;

    // Honest hit: the body capsule, not the padded billboard quad.
    const proxies = [];
    eiList.forEach((ei) => {
      if (ei.userData.hp <= 0 || !ei.userData.hitProxy) return;
      ei.updateMatrixWorld(true);
      proxies.push(ei.userData.hitProxy);
    });
    const hits = proxies.length ? ray.intersectObjects(proxies, false) : [];
    if (hits.length) {
      const unit = unitFromHit(hits[0].object);
      if (unit && unit.userData.hp > 0) {
        const h = unit.userData.hitH || 2.2;
        return { ei: unit, head: hits[0].point.y > unit.position.y + h * 0.62, point: hits[0].point };
      }
    }

    // Closest on-crosshair candidate wins — enemy or friend — so a
    // distant EI does not steal a shot aimed at a villager, and vice versa.
    let best = null;
    let bestD = Infinity;
    eiList.forEach((ei) => {
      if (ei.userData.hp <= 0) return;
      const hit = screenAim(ei, aimSlackPx(ei, false));
      if (!hit || hit.dist >= bestD) return;
      best = { ei, head: hit.head, point: hit.point };
      bestD = hit.dist;
    });
    const folks = [];
    soldierMeshes.forEach((s) => { if (s && s.userData.hp > 0) folks.push(s); });
    villagerMeshes.forEach((v) => { if (v) folks.push(v); });
    folks.forEach((f) => {
      const hit = screenAim(f, aimSlackPx(f, true));
      if (!hit || hit.dist >= bestD) return;
      best = { friendly: true, kind: f.userData.kind, unit: f, point: hit.point };
      bestD = hit.dist;
    });
    return best;
  }

  function tryShoot() {
    const now = clock.getElapsedTime();
    const charged = isCharging && charges > 0 && (now - chargeStart) >= 0.7;
    const delay = charged ? 0.7 : 0.2;
    if (now - lastShot < delay) return;
    lastShot = now;
    const aim = aimTarget();
    recoil = charged ? 0.05 : 0.022;
    shake = charged ? 0.12 : 0.04;
    $('rifle').classList.add('kick');
    setTimeout(() => $('rifle').classList.remove('kick'), 80);
    Sfx.shoot(charged);
    const dir = camera.getWorldDirection(new THREE.Vector3());
    if (!aim) {
      spawnTracer(camera.position.clone(), dir.multiplyScalar(50).add(camera.position));
      showMessage('MISS', 280);
      return;
    }
    spawnTracer(camera.position.clone().addScaledVector(dir, 0.8), aim.point, 0xffeaa7);
    if (aim.friendly) {
      penalizeFriendly(aim.kind, aim.unit, aim.point);
      return;
    }
    const tough = aim.ei.userData.type === 'tanky' || aim.ei.userData.type === 'boss';
    let dmg = charged ? 99 : (1 + dmgBonus + (dmgBoostT > 0 ? 1 : 0));
    if (aim.head && !charged && !tough) dmg += 1;
    if (tough && !charged) dmg = 1;
    applyDamage(aim.ei, dmg, charged, aim.head, aim.point);
    if (charged) {
      charges--;
      isCharging = false;
      $('crosshair').classList.remove('charged');
      $('scope').style.display = 'none';
      $('rifle').classList.remove('hidden');
      $('chargeFill').style.width = '0%';
    }
  }

  function penalizeFriendly(kind, obj, point) {
    const loss = kind === 'soldier' ? 250 : 150;
    score = Math.max(0, score - loss);
    combo = 1;
    comboTimer = 0;
    if (obj && obj.userData) obj.userData.flash = 0.25;
    hitMarker(false);
    Sfx.hurt();
    floatNum('-' + loss, point || (obj && obj.position), false);
    if (kind === 'soldier') {
      feed('FRIENDLY FIRE  −' + loss);
      showMessage('YOU SHOT A SOLDIER  −' + loss, 1000);
    } else {
      feed('CIVILIAN HIT  −' + loss);
      showMessage('YOU SHOT A VILLAGER  −' + loss, 1000);
    }
    updateHUD();
  }

  function applyDamage(obj, dmg, charged, head, point) {
    obj.userData.hp -= dmg;
    obj.userData.flash = 0.15;
    hitMarker(head);
    Sfx.hit();
    Sfx.oyVey();
    if (head) Sfx.head();
    const hitPos = point || obj.position.clone().setY(1.3);
    splat(hitPos);
    floatNum('OY VEY', hitPos, true);
    floatNum((head ? 'HEAD ' : '') + (charged ? 'BOOM' : ('-' + dmg)), obj.position, head || charged);
    updateHpBar(obj);
    if (obj.userData.hp <= 0) killEI(obj, charged, head);
    else showMessage(head ? 'HEADSHOT — STILL UP' : 'HIT — STILL STANDING', 450);
  }

  function updateHpBar(obj) {
    if (!obj.userData.hpFill) return;
    const p = Math.max(0, obj.userData.hp / obj.userData.maxHp);
    obj.userData.hpFill.scale.x = p;
  }

  function killEI(obj, charged, head) {
    obj.userData.hp = 0;
    comboTimer = 2.4;
    combo = Math.min(8, combo + 1);
    const pts = Math.round(obj.userData.score * combo * (head ? 1.4 : 1) * (charged ? 1.15 : 1));
    score += pts;
    if (score > highScore) {
      highScore = score;
      localStorage.setItem(HS_KEY, String(highScore));
    }
    floatNum('+' + pts, obj.position, true);
    feed((obj.userData.type === 'boss' ? 'BOSS DOWN' : obj.userData.type.toUpperCase() + ' DOWN') + '  +' + pts);
    burst(obj.position.clone().setY(1.2), obj.userData.type === 'boss' ? 0xe74c3c : 0x9b59b6, 22);
    if (obj.userData.type === 'boss') { Sfx.boss(); slowMo = 0.55; showMessage('BOSS DOWN', 1200); }
    else { Sfx.kill(); showMessage(obj.userData.type === 'tanky' ? 'TANK DOWN' : obj.userData.type === 'bean' ? 'BEAN DOWN' : 'TARGET DOWN', 500); }
    if (combo >= 3) {
      $('comboPop').style.display = 'block';
      $('comboPop').textContent = combo + 'x  STREAK';
      setTimeout(() => { $('comboPop').style.display = 'none'; }, 500);
    }
    maybeDrop(obj.position);
    scene.remove(obj);
    eiList = eiList.filter((e) => e !== obj);
    updateHUD();
    checkWaveEnd();
  }

  function maybeDrop(pos) {
    if (Math.random() > 0.16) return;
    const kinds = ['repair', 'charge', 'boost'];
    const kind = kinds[(Math.random() * kinds.length) | 0];
    const spr = spriteOf(tex.crate, 0.9, 0.75) || new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.5, 0.6),
      new THREE.MeshLambertMaterial({ color: 0xd4a017 })
    );
    const g = new THREE.Group();
    g.add(spr);
    g.position.copy(pos);
    g.position.y = 0;
    g.userData.kind = kind;
    g.userData.bob = Math.random() * 10;
    scene.add(g);
    pickups.push(g);
    feed('CRATE DROPPED');
  }

  function plantMine() {
    if (mineCount <= 0) { showMessage('NO MINES', 500); return; }
    mineCount--;
    const g = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.45, 0.12, 10),
      new THREE.MeshLambertMaterial({ color: 0x222222 })
    );
    g.position.set(camera.position.x, 0.08, camera.position.z);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.5, 0.04, 6, 16),
      new THREE.MeshBasicMaterial({ color: 0xe74c3c })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.08;
    g.add(ring);
    scene.add(g);
    mines.push(g);
    updateHUD();
    showMessage('MINE PLANTED', 600);
  }

  /* ---------------- loop ---------------- */
  function startLoop() {
    if (looping) return;
    looping = true;
    animate();
  }
  function animate() {
    requestAnimationFrame(animate);
    if (!clock) return;
    let dt = Math.min(clock.getDelta(), 0.05);
    if (slowMo > 0) { slowMo -= dt; dt *= 0.35; }
    const now = clock.getElapsedTime();
    Sfx.tickMusic(dt);

    if (comboTimer > 0) {
      comboTimer -= dt;
      if (comboTimer <= 0) combo = 1;
    }
    if ($('multVal')) $('multVal').textContent = combo;
    if (dmgBoostT > 0) dmgBoostT -= dt;
    if (recoil > 0) recoil = Math.max(0, recoil - dt * 0.5);
    if (shake > 0) shake = Math.max(0, shake - dt);

    if (isCharging && charges > 0) {
      const p = Math.min(1, (now - chargeStart) / 0.7);
      $('chargeFill').style.width = (p * 100) + '%';
    }

    // look
    syncCamera();
    if (shake > 0) {
      camera.rotation.x += (Math.random() - 0.5) * shake * 0.08;
      camera.rotation.y += (Math.random() - 0.5) * shake * 0.06;
    }

    const sprinting = (keys['ShiftLeft'] || keys['ShiftRight']) && !isCharging;
    const wantFov = isCharging ? 28 : (sprinting ? 76 : 68);
    camera.fov += (wantFov - camera.fov) * Math.min(1, 8 * dt);
    camera.updateProjectionMatrix();

    if (gameRunning) {
      const speed = sprinting ? 11.5 : 7.6;
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion); forward.y = 0; forward.normalize();
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion); right.y = 0; right.normalize();
      if (keys['KeyW']) camera.position.addScaledVector(forward, speed * dt);
      if (keys['KeyS']) camera.position.addScaledVector(forward, -speed * dt);
      if (keys['KeyA']) camera.position.addScaledVector(right, -speed * dt);
      if (keys['KeyD']) camera.position.addScaledVector(right, speed * dt);
      camera.position.y = 3.1;
      camera.position.x = THREE.MathUtils.clamp(camera.position.x, -78, 78);
      camera.position.z = THREE.MathUtils.clamp(camera.position.z, -78, 78);

      tickSpawn(dt);
      tickEI(dt, now);
      tickSoldiers(dt, now);
      tickVillagers(now);
      tickPickups(dt);
      tickMines();
    }
    tickParticles(dt);
    drawMinimap();
    renderer.render(scene, camera);
  }

  function tickEI(dt, now) {
    eiList.forEach((ei) => {
      if (ei.userData.hp <= 0) return;
      if (ei.userData.flash > 0) {
        ei.userData.flash -= dt;
        if (ei.userData.sprite) ei.userData.sprite.material.color.set(ei.userData.flash > 0 ? 0xff6666 : 0xffffff);
      }
      if (ei.userData.sprite) {
        const rate = (ei.userData.type === 'sprinty' || ei.userData.type === 'bean') ? 16 : 8;
        const base = ei.userData.sprite.userData.baseY || 0;
        ei.userData.sprite.position.y = base + Math.abs(Math.sin(now * rate + ei.userData.walkT)) * 0.1;
      }
      if (ei.userData.hpBg) {
        ei.userData.hpBg.lookAt(camera.position);
        ei.userData.hpFill.lookAt(camera.position);
      }

      const path = ei.userData.path || [];
      const wellDist = Math.hypot(ei.position.x, ei.position.z);
      const atVillage = ei.userData.pathIndex >= Math.max(0, path.length - 2) || wellDist < 8.5;
      const house = atVillage ? nearestStandingHouse(ei.position, 3.4) : null;
      if (house) {
        const toH = new THREE.Vector3(house.x - ei.position.x, 0, house.z - ei.position.z);
        if (toH.length() > 1.8) {
          toH.normalize();
          ei.position.addScaledVector(toH, ei.userData.speed * dt);
        }
        ei.userData.biteT = (ei.userData.biteT || 0) - dt;
        if (ei.userData.biteT <= 0) {
          ei.userData.biteT = ei.userData.type === 'boss' ? 1.8 : 1.3;
          smashHouse(house, 4);
          hurtVillage(ei.userData.type === 'boss' ? 6 : 3);
          shake = 0.14;
        }
      } else if (ei.userData.pathIndex >= path.length) {
        ei.userData.biteT = (ei.userData.biteT || 0) - dt;
        if (ei.userData.biteT <= 0) {
          ei.userData.biteT = ei.userData.type === 'boss' ? 2.0 : 1.5;
          hurtVillage(ei.userData.type === 'boss' ? 6 : 3);
        }
      } else {
        const target = path[ei.userData.pathIndex];
        const dir = target.clone().sub(ei.position); dir.y = 0;
        if (dir.length() < 0.7) ei.userData.pathIndex++;
        else {
          dir.normalize();
          if (ei.userData.type === 'sprinty' || ei.userData.type === 'bean') {
            ei.userData.zig += dt * 9;
            const side = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(Math.sin(ei.userData.zig) * 1.6);
            dir.add(side).normalize();
          }
          ei.position.addScaledVector(dir, ei.userData.speed * dt);
        }
      }
      if (ei.userData.type === 'boss') {
        ei.userData.spillT -= dt;
        if (ei.userData.spillT <= 0 && ei.userData.spilled < 8) {
          ei.userData.spillT = 11;
          spillBeans(ei, 3 + ((Math.random() * 2) | 0));
        }
        ei.userData.slamT -= dt;
        if (ei.userData.slamT <= 0) {
          ei.userData.slamT = 16;
          hurtVillage(4);
          shake = 0.28;
          showMessage('BOSS SLAM — VILLAGE HIT', 800);
          Sfx.hurt();
        }
      }
      // melee soldiers
      soldierMeshes.forEach((sol) => {
        if (!sol || sol.userData.hp <= 0) return;
        if (sol.position.distanceTo(ei.position) < 1.8) {
          sol.userData.hp -= dt * (ei.userData.type === 'tanky' ? 0.55 : 0.28);
          sol.userData.flash = 0.1;
          if (sol.userData.hp <= 0) {
            sol.userData.hp = 0;
            scene.remove(sol);
            showMessage('SOLDIER DOWN', 900);
            Sfx.hurt();
            updateHUD();
          }
        }
      });
    });
  }

  function tickVillagers(now) {
    villagerMeshes.forEach((v) => {
      if (!v.userData.sprite) return;
      const base = v.userData.sprite.userData.baseY || 0;
      v.userData.sprite.position.y = base + Math.abs(Math.sin(now * 2.2 + v.userData.walkT)) * 0.04;
      if (v.userData.flash > 0) {
        v.userData.flash -= 0.016;
        v.userData.sprite.material.color.set(v.userData.flash > 0 ? 0xff6666 : 0xffffff);
      }
    });
  }

  function tickSoldiers(dt, now) {
    soldierMeshes.forEach((sol) => {
      if (!sol || sol.userData.hp <= 0) return;
      if (sol.userData.sprite) {
        sol.userData.sprite.material.color.set(sol.userData.flash > 0 ? 0xff8888 : 0xffffff);
        if (sol.userData.flash > 0) sol.userData.flash -= dt;
        sol.userData.sprite.scale.y = 2.05 * (1 + Math.sin(now * 6) * 0.02);
      }
      let moveTo = soldierTarget;
      let nearest = null, nd = 999;
      eiList.forEach((ei) => {
        if (ei.userData.hp <= 0) return;
        const d = sol.position.distanceTo(ei.position);
        if (d < nd) { nd = d; nearest = ei; }
      });
      if (!moveTo && nearest) moveTo = nearest.position;
      if (moveTo) {
        const dir = moveTo.clone().sub(sol.position); dir.y = 0;
        if (dir.length() > 2.0) {
          dir.normalize();
          sol.position.addScaledVector(dir, 1.9 * dt);
        }
      }
      if (nearest && nd < 6.5 && now - sol.userData.lastShot > 1.8) {
        sol.userData.lastShot = now;
        nearest.userData.hp -= 1;
        updateHpBar(nearest);
        spawnTracer(sol.position.clone().setY(1.4), nearest.position.clone().setY(1.3), 0x7bed9f);
        splat(nearest.position.clone().setY(1.3));
        Sfx.oyVey();
        if (nearest.userData.hp <= 0) {
          killEI(nearest, false, false);
          feed('SQUAD: TARGET DOWN');
        }
      }
    });
  }

  function tickPickups(dt) {
    const pc = camera.position;
    pickups = pickups.filter((p) => {
      p.userData.bob += dt * 3;
      if (p.children[0] && p.children[0].isSprite) p.children[0].position.y = 0.35 + Math.sin(p.userData.bob) * 0.12;
      if (p.position.distanceTo(new THREE.Vector3(pc.x, 0, pc.z)) < 2.2) {
        grab(p.userData.kind);
        scene.remove(p);
        return false;
      }
      return true;
    });
  }

  function grab(kind) {
    Sfx.pickup();
    if (kind === 'repair') { villageHP = Math.min(100, villageHP + 18); showMessage('VILLAGE PATCHED +18', 800); }
    if (kind === 'charge') { charges++; showMessage('EXTRA CHARGE', 800); }
    if (kind === 'boost') { dmgBoostT = 10; showMessage('DAMAGE UP 10s', 800); }
    updateHUD();
  }

  function tickMines() {
    mines = mines.filter((m) => {
      let boom = false;
      eiList.forEach((ei) => {
        if (ei.userData.hp <= 0) return;
        if (ei.position.distanceTo(m.position) < 1.6) {
          applyDamage(ei, 5, false, false, ei.position.clone().setY(1));
          boom = true;
        }
      });
      if (boom) {
        burst(m.position.clone().setY(0.6), 0xe67e22, 28);
        shake = 0.3;
        scene.remove(m);
        return false;
      }
      return true;
    });
  }

  function hurtVillage(amount) {
    villageHP = Math.max(0, villageHP - amount);
    $('villageHP').textContent = Math.floor(villageHP);
    $('villageBarFill').style.width = villageHP + '%';
    $('villageBar').classList.toggle('hot', villageHP < 35);
    const now = clock ? clock.getElapsedTime() : 0;
    if (amount >= 1 && now - lastVillageFlash > 0.25) {
      lastVillageFlash = now;
      $('dmgFlash').style.background = 'rgba(180,20,0,0.22)';
      setTimeout(() => { $('dmgFlash').style.background = 'rgba(180,20,0,0)'; }, 120);
    }
    if (villageHP <= 0) endGame(false);
  }

  /* ---------------- fx ---------------- */
  function splat(pos) {
    const colors = [0x8e2f6b, 0xc0392b, 0x6c1a4a, 0xf5b7ce, 0x7b241c];
    for (let i = 0; i < 16; i++) {
      const col = colors[(Math.random() * colors.length) | 0];
      const s = 0.07 + Math.random() * 0.16;
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(s, 5, 4),
        new THREE.MeshBasicMaterial({ color: col, transparent: true })
      );
      m.position.copy(pos);
      m.userData.v = new THREE.Vector3((Math.random() - 0.5) * 7, 2 + Math.random() * 5, (Math.random() - 0.5) * 7);
      m.userData.life = 0.5 + Math.random() * 0.35;
      scene.add(m);
      particles.push(m);
    }
    const puddle = new THREE.Mesh(
      new THREE.CircleGeometry(0.28 + Math.random() * 0.22, 8),
      new THREE.MeshBasicMaterial({ color: 0x6c1a4a, transparent: true, opacity: 0.72, depthWrite: false })
    );
    puddle.rotation.x = -Math.PI / 2;
    puddle.position.set(pos.x + (Math.random() - 0.5) * 0.5, 0.05, pos.z + (Math.random() - 0.5) * 0.5);
    puddle.userData.v = new THREE.Vector3(0, 0, 0);
    puddle.userData.life = 2.4;
    scene.add(puddle);
    particles.push(puddle);
  }

  function burst(pos, color, n) {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.08, 0.08),
        new THREE.MeshBasicMaterial({ color, transparent: true })
      );
      m.position.copy(pos);
      m.userData.v = new THREE.Vector3((Math.random() - 0.5) * 6, 2 + Math.random() * 4, (Math.random() - 0.5) * 6);
      m.userData.life = 0.45 + Math.random() * 0.3;
      scene.add(m);
      particles.push(m);
    }
  }
  function spawnTracer(from, to, color = 0xffeaa7) {
    const dir = to.clone().sub(from);
    const len = dir.length();
    const geom = new THREE.BoxGeometry(0.04, 0.04, len);
    const m = new THREE.Mesh(geom, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 }));
    m.position.copy(from).add(dir.multiplyScalar(0.5));
    m.lookAt(to);
    m.userData.v = new THREE.Vector3(0, 0, 0);
    m.userData.life = 0.08;
    scene.add(m);
    particles.push(m);
  }
  function tickParticles(dt) {
    particles = particles.filter((p) => {
      p.userData.life -= dt;
      if (p.userData.v) {
        p.position.addScaledVector(p.userData.v, dt);
        p.userData.v.y -= 12 * dt;
      }
      if (p.material && p.material.opacity != null) p.material.opacity = Math.max(0, p.userData.life * 2);
      if (p.userData.life <= 0) { scene.remove(p); return false; }
      return true;
    });
  }
  function hitMarker(head) {
    const el = $('hitmarker');
    el.classList.toggle('head', !!head);
    el.style.opacity = '1';
    setTimeout(() => { el.style.opacity = '0'; }, 140);
  }
  function floatNum(text, world, gold) {
    const el = document.createElement('div');
    el.className = 'floater' + (gold ? ' gold' : '');
    el.textContent = text;
    const v = world.clone();
    v.project(camera);
    el.style.left = ((v.x * 0.5 + 0.5) * innerWidth) + 'px';
    el.style.top = ((-v.y * 0.5 + 0.5) * innerHeight) + 'px';
    $('floatLayer').appendChild(el);
    setTimeout(() => el.remove(), 800);
  }
  function feed(txt) {
    const row = document.createElement('div');
    row.textContent = txt;
    $('killfeed').prepend(row);
    while ($('killfeed').children.length > 5) $('killfeed').lastChild.remove();
    setTimeout(() => row.remove(), 2800);
  }
  let msgTimer = 0;
  function showMessage(txt, ms) {
    const el = $('message');
    el.textContent = txt;
    el.style.display = 'block';
    clearTimeout(msgTimer);
    msgTimer = setTimeout(() => { el.style.display = 'none'; }, ms);
  }

  function drawMinimap() {
    const m = $('miniCanvas');
    const g = m.getContext('2d');
    g.fillStyle = '#16301a';
    g.fillRect(0, 0, m.width, m.height);
    // roads
    g.strokeStyle = '#7a5a32';
    g.lineWidth = 3;
    paths.forEach((p) => {
      g.beginPath();
      p.forEach((pt, i) => {
        const w = mapToWorld(pt.x, pt.y);
        const x = 114 + w.x * 2.05, y = 83 + w.z * 2.05;
        if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
      });
      g.stroke();
    });
    g.fillStyle = '#e1b12c';
    g.fillRect(100, 70, 28, 22);
    const plot = (obj, color, r) => {
      g.fillStyle = color;
      g.beginPath();
      g.arc(114 + obj.position.x * 2.05, 83 + obj.position.z * 2.05, r, 0, Math.PI * 2);
      g.fill();
    };
    plot(camera, '#3498db', 5);
    // facing
    g.strokeStyle = '#fff';
    g.beginPath();
    const fx = 114 + camera.position.x * 2.05;
    const fy = 83 + camera.position.z * 2.05;
    g.moveTo(fx, fy);
    g.lineTo(fx - Math.sin(player.yaw) * 10, fy - Math.cos(player.yaw) * 10);
    g.stroke();
    soldierMeshes.forEach((s) => { if (s && s.userData.hp > 0) plot(s, '#2ecc71', 4); });
    eiList.forEach((e) => {
      if (e.userData.hp <= 0) return;
      plot(e, e.userData.type === 'boss' ? '#ff3030' : e.userData.type === 'sprinty' ? '#ff79c6' : e.userData.type === 'bean' ? '#111111' : '#9b59b6', e.userData.type === 'boss' ? 6 : 3);
    });
    pickups.forEach((p) => plot(p, '#f1c40f', 3));
    mines.forEach((p) => plot(p, '#e74c3c', 3));
    if (soldierTarget) {
      g.strokeStyle = '#fff';
      g.beginPath();
      g.arc(114 + soldierTarget.x * 2.05, 83 + soldierTarget.z * 2.05, 8, 0, Math.PI * 2);
      g.stroke();
    }
  }

  function updateHUD() {
    $('waveNum').textContent = waveNumber;
    $('eiLeft').textContent = eiList.filter((e) => e.userData.hp > 0).length + spawnQueue.length;
    $('villageHP').textContent = Math.floor(villageHP);
    $('villageBarFill').style.width = villageHP + '%';
    $('villageBar').classList.toggle('hot', villageHP < 35);
    $('charges').textContent = charges;
    const cap = Math.min(squadCap(), Math.max(1, soldiers.length));
    const alive = soldierMeshes.filter((s) => s && s.userData.hp > 0).length;
    $('soldiersAlive').textContent = alive + '/' + cap;
    $('mines').textContent = mineCount;
    $('scoreVal').textContent = score;
    $('multVal').textContent = combo;
    $('buffLine').textContent = dmgBoostT > 0 ? 'DMG UP' : (dmgBonus ? ('+' + dmgBonus + ' DMG') : '');
    const extra = $('extraHud');
    if (extra) extra.style.display = (mineCount || dmgBoostT > 0 || dmgBonus) ? 'flex' : 'none';
  }

  function checkWaveEnd() {
    updateHUD();
    if (waveClearPending) return;
    if (spawnQueue.length === 0 && eiList.filter((e) => e.userData.hp > 0).length === 0 && villageHP > 0 && gameRunning) {
      waveClearPending = true;
      villageHP = Math.min(100, villageHP + 20);
      charges = Math.max(charges, 3);
      updateHUD();
      const el = $('waveClearHint');
      const stats = $('waveClearStats');
      if (stats) stats.textContent = `Score ${score}   ·   Village ${Math.floor(villageHP)}%   ·   Best ${highScore}`;
      if (el) el.style.display = 'block';
      showMessage('WAVE CLEAR — look around, then press ENTER', 2200);
    }
  }

  function confirmWaveClear() {
    if (!waveClearPending) return;
    waveClearPending = false;
    const el = $('waveClearHint');
    if (el) el.style.display = 'none';
    gameRunning = false;
    document.exitPointerLock();
    openShop();
  }

  /* ---------------- shop ---------------- */
  const SHOP = [
    { id: 'repair', name: 'Repair crews', desc: 'Village +30 HP', cost: 380, fn: () => { villageHP = Math.min(100, villageHP + 30); } },
    { id: 'charge', name: 'Extra charge', desc: '+1 precision shot', cost: 240, fn: () => { charges++; } },
    { id: 'heal', name: 'Field medic', desc: 'Revive / heal squad', cost: 280, fn: healSoldiers },
    { id: 'dmg', name: 'Hotter ammo', desc: '+1 damage forever', cost: 560, fn: () => { dmgBonus++; } },
    { id: 'mine', name: 'Land mine', desc: 'Press F to plant', cost: 180, fn: () => { mineCount++; } },
    { id: 'air', name: 'Airstrike', desc: 'Next wave opens with a 4-dmg strike', cost: 820, fn: () => { pendingAir = 1; } }
  ];

  function healSoldiers() {
    const cap = Math.min(squadCap(), soldiers.length);
    for (let i = 0; i < cap; i++) {
      const s = soldierMeshes[i];
      if (!s || s.userData.hp <= 0) {
        if (s) scene.remove(s);
        const m = createSoldierMesh();
        const src = soldiers[i] || soldiers[0];
        const w = mapToWorld(src.x, src.y);
        m.position.set(w.x, 0, w.z);
        scene.add(m);
        soldierMeshes[i] = m;
      } else s.userData.hp = s.userData.maxHp;
    }
  }


  function openShop() {
    $('shopSummary').textContent = `Score ${score}   ·   Village ${Math.floor(villageHP)}%   ·   Best ${highScore}`;
    const grid = $('shopGrid');
    grid.innerHTML = '';
    SHOP.forEach((item) => {
      const b = document.createElement('button');
      b.className = 'shop-item';
      b.innerHTML = `<h3>${item.name}</h3><p>${item.desc}</p><span class="cost">${item.cost} pts</span>`;
      b.onclick = () => {
        if (score < item.cost) { showMessage('NOT ENOUGH LOOT', 700); return; }
        score -= item.cost;
        item.fn();
        Sfx.shop();
        updateHUD();
        $('shopSummary').textContent = `Score ${score}   ·   Village ${Math.floor(villageHP)}%   ·   Best ${highScore}`;
      };
      grid.appendChild(b);
    });
    $('shopOverlay').style.display = 'flex';
  }

  function recordBest() {
    if (score > highScore) {
      highScore = score;
      localStorage.setItem(HS_KEY, String(highScore));
    }
  }

  function updateTitleScores() {
    const el = $('highScoreLine');
    if (!el) return;
    el.textContent = lastRunScore != null
      ? ('LAST RUN: ' + lastRunScore + '   ·   BEST: ' + highScore)
      : ('BEST: ' + highScore);
  }

  function finishRun() {
    recordBest();
    lastRunScore = score;
    gameRunning = false;
    waveClearPending = false;
    cancelAirstrike();
    try { document.exitPointerLock(); } catch (err) { /* ignore */ }
    ['shopOverlay', 'defeatOverlay', 'waveClearHint', 'game', 'planning'].forEach((id) => {
      const n = $(id);
      if (n) n.style.display = 'none';
    });
    $('title').style.display = 'flex';
    updateTitleScores();
  }

  function nextWave() {
    $('shopOverlay').style.display = 'none';
    const before = Math.min(squadCap(), soldiers.length);
    waveNumber++;
    currentWaveSize = 4 + (waveNumber - 1) * 2;
    waveClearPending = false;
    const hint = $('waveClearHint');
    if (hint) hint.style.display = 'none';
    const joined = deploySquad(false);
    gameRunning = true;
    updateHUD();
    spawnWave();
    startLoop();
    renderer.domElement.requestPointerLock();
    const nowCap = Math.min(squadCap(), soldiers.length);
    if (nowCap > before && joined) {
      showMessage(nowCap === 2 ? 'REINFORCEMENT: SECOND RIFLE ON THE ROAD' : 'REINFORCEMENT: FULL SQUAD', 1200);
    }
  }

  function endGame(won) {
    if (!gameRunning && !won) return;
    gameRunning = false;
    document.exitPointerLock();
    if (!won) {
      recordBest();
      $('defeatText').textContent = `Wave ${waveNumber}  ·  Score ${score}  ·  Best ${highScore}`;
      $('defeatOverlay').style.display = 'flex';
      Sfx.hurt();
    }
  }

  function retryWave() {
    $('defeatOverlay').style.display = 'none';
    villageHP = 100;
    charges = 3;
    combo = 1;
    waveClearPending = false;
    clearMines();
    cancelAirstrike();
    if ($('waveClearHint')) $('waveClearHint').style.display = 'none';
    healSoldiers();
    gameRunning = true;
    spawnWave();
    startLoop();
    renderer.domElement.requestPointerLock();
    updateHUD();
  }

  /* ---------------- ui hooks ---------------- */
  $('btnPlay').onclick = () => {
    Sfx.ensure();
    $('title').style.display = 'none';
    $('planning').style.display = 'flex';
    drawMap();
  };
  $('btnStart').onclick = startMission;
  $('btnNextWave').onclick = nextWave;
  $('btnFinishRun').onclick = finishRun;
  $('btnRetry').onclick = retryWave;
  $('btnNewGame').onclick = finishRun;
  if ($('btnClearBest')) {
    $('btnClearBest').onclick = () => {
      highScore = 0;
      lastRunScore = null;
      localStorage.removeItem(HS_KEY);
      updateTitleScores();
    };
  }
  document.addEventListener('contextmenu', (e) => e.preventDefault());

  loadAll();
})();
