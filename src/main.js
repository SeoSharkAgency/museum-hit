import gsap from "gsap";
import { benchNote, pedestals, pieces, sculptures } from "./gallery.js";

const X0 = -750;
const X1 = 750;
const CEIL = -460;
const FLOOR = 200;
const EYE = 52;
const DOOR = 145;
const PASS = 108;
const INSET = 70;
const FLOOR_RX = 90;

const rooms = [
  { id: "vest", name: "Вестибюль", kicker: "вхід", z0: 0, z1: 1560, floor: "court", mark: "01" },
  { id: "origin", name: "Зал витоків", kicker: "2006–2015", z0: 1560, z1: 3360, floor: "court", mark: "02" },
  { id: "gold", name: "Зал чемпіонів", kicker: "2022–2026", z0: 3360, z1: 5160, floor: "court", mark: "03" },
  { id: "fame", name: "Зал слави", kicker: "гравці", z0: 5160, z1: 6960, floor: "court", mark: "04" },
  { id: "arena", name: "Зал паркету", kicker: "клуб", z0: 6960, z1: 8720, floor: "court", window: true },
];

const tones = {
  vest: ["#123f8f", "#0d2c66", "#0b2557"],
  origin: ["#0f3478", "#0b2557", "#081d45"],
  gold: ["#143a86", "#0d2c66", "#081d45"],
  fame: ["#1a4a96", "#12356e", "#0b2557"],
  arena: ["#0e2e6e", "#0a214f", "#071838"],
};

const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
const dur = (seconds) => (calm ? Math.min(0.35, seconds) : seconds);

const viewport = document.querySelector("#viewport");
const stage = document.querySelector("#stage");
const world = document.querySelector("#world");
const mapStage = document.querySelector("#map-stage");
const roomLabel = document.querySelector("#room-label");
const sheet = document.querySelector("#sheet");
const hints = document.querySelector("#hints");

const cam = { x: 0, z: 860, yaw: 0, pitch: 0 };
let targetYaw = 0;
let targetPitch = 0;
let mode = "intro";
let aimYaw = null;
let glidePitch = false;
let tween = null;
let introTween = null;
let returnPose = null;
let viewing = null;
let roomId = "vest";
let fov = 980;
let wheel = 0;
const down = new Set();
const obstacles = [];
const walk = [];

const $= (sel) => document.querySelector(sel);

function make(tag, className, parent) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  parent.appendChild(el);
  return el;
}

function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (shift) => Math.max(0, Math.min(255, Math.round(((n >> shift) & 255) * amount)));
  return `rgb(${ch(16)}, ${ch(8)}, ${ch(0)})`;
}

function nearAngle(from, to) {
  return from + ((((to - from) % 360) + 540) % 360 - 180);
}

function dampAngle(current, target, dt, speed) {
  return current + (nearAngle(current, target) - current) * Math.min(1, dt * speed);
}

function setFov() {
  const width = window.visualViewport?.width || window.innerWidth;
  fov = Math.max(640, Math.min(1100, width * 0.7));
  const perspective = `${fov}px`;
  stage.style.perspective = perspective;
  stage.style.webkitPerspective = perspective;
}

function addPlane(parent, className, { x, y, z, w, h, rx = 0, ry = 0 }) {
  const el = make("div", className, parent);
  el.style.width = `${w}px`;
  el.style.height = `${h}px`;
  el.style.left = `${-w / 2}px`;
  el.style.top = `${-h / 2}px`;
  el.style.transform = `translate3d(${x}px, ${y}px, ${z}px) rotateX(${rx}deg) rotateY(${ry}deg)`;
  return el;
}

function paintWall(el, room) {
  const [top, mid, bot] = tones[room.id];
  el.style.setProperty("--plaster-top", top);
  el.style.setProperty("--plaster", mid);
  el.style.setProperty("--plaster-bot", bot);
  el.style.setProperty("--cornice", top);
  const ao = make("div", "ao", el);
  ao.setAttribute("aria-hidden", "true");
}

function addSpan(parent, room, { x0, x1, z, y0, y1, ry, cls = "wall plaster" }) {
  const w = Math.abs(x1 - x0);
  const h = Math.abs(y1 - y0);
  if (w < 4 || h < 4) return null;
  const el = addPlane(parent, cls, {
    x: (x0 + x1) / 2,
    y: (y0 + y1) / 2,
    z,
    w,
    h,
    ry,
  });
  if (cls.includes("plaster")) paintWall(el, room);
  return el;
}

function addSide(parent, room, { x, z0, z1, ry }) {
  const el = addPlane(parent, "wall plaster", {
    x,
    y: (CEIL + FLOOR) / 2,
    z: (z0 + z1) / 2,
    w: z1 - z0,
    h: FLOOR - CEIL,
    ry,
  });
  paintWall(el, room);
  return el;
}

function addJamb(wall, side) {
  const jamb = make("div", `jamb ${side}`, wall);
  jamb.setAttribute("aria-hidden", "true");
}

function addDoor(parent, room) {
  const z = room.z1;
  const left = addSpan(parent, room, { x0: X0, x1: -DOOR, z, y0: CEIL, y1: FLOOR, ry: 180 });
  const right = addSpan(parent, room, { x0: DOOR, x1: X1, z, y0: CEIL, y1: FLOOR, ry: 180 });
  const lintel = addSpan(parent, room, { x0: -DOOR, x1: DOOR, z, y0: CEIL, y1: -210, ry: 180 });
  if (left) addJamb(left, "right");
  if (right) addJamb(right, "left");
  if (lintel && room.mark) {
    const mark = make("div", "numeral", lintel);
    mark.textContent = room.mark;
  }
}

function addWindow(parent, room) {
  const z = room.z1;
  addSpan(parent, room, { x0: X0, x1: -280, z, y0: CEIL, y1: FLOOR, ry: 180 });
  addSpan(parent, room, { x0: 280, x1: X1, z, y0: CEIL, y1: FLOOR, ry: 180 });
  addSpan(parent, room, { x0: -280, x1: 280, z, y0: CEIL, y1: -300, ry: 180 });
  addSpan(parent, room, { x0: -280, x1: 280, z, y0: 40, y1: FLOOR, ry: 180 });
  const glass = addPlane(parent, "skylight", {
    x: 0,
    y: (-300 + 40) / 2,
    z: z - 6,
    w: 540,
    h: 340,
    ry: 180,
  });
  glass.innerHTML = `
    <div class="sky arena-view">
      <div class="seats"></div>
      <div class="court-strip"></div>
    </div>
    <div class="mullion v"></div>
    <div class="mullion h"></div>`;
  addPlane(parent, "blob day", {
    x: 0,
    y: FLOOR - 6,
    z: z - 220,
    w: 460,
    h: 280,
    rx: FLOOR_RX,
  });
}

function addRig(parent, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0 }) {
  const g = make("div", "box", parent);
  g.style.transform = `translate3d(${x}px, ${y}px, ${z}px) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg)`;
  return g;
}

function addBox(parent, { x, y, z, w, h, d, rx = 0, ry = 0, rz = 0, fill }) {
  const g = addRig(parent, { x, y, z, rx, ry, rz });
  const faces = [
    [w, h, `translateZ(${d / 2}px)`, 1],
    [w, h, `rotateY(180deg) translateZ(${d / 2}px)`, 0.72],
    [d, h, `rotateY(-90deg) translateZ(${w / 2}px)`, 0.86],
    [d, h, `rotateY(90deg) translateZ(${w / 2}px)`, 0.78],
    [w, d, `rotateX(90deg) translateZ(${h / 2}px)`, 1.12],
    [w, d, `rotateX(-90deg) translateZ(${h / 2}px)`, 0.62],
  ];
  for (const [fw, fh, tf, light] of faces) {
    const face = make("div", "face", g);
    face.style.width = `${fw}px`;
    face.style.height = `${fh}px`;
    face.style.left = `${-fw / 2}px`;
    face.style.top = `${-fh / 2}px`;
    face.style.transform = tf;
    face.style.background = shade(fill, light);
  }
  return g;
}

function bind(el, item) {
  el.classList.add("hot");
  el.addEventListener("pointerdown", (event) => event.stopPropagation());
  el.addEventListener("click", (event) => {
    event.stopPropagation();
    approach(item);
  });
}

function caption(item) {
  const meta = [item.artist, item.year].filter(Boolean).join(", ");
  return `<div class="cap"><b>${item.title}</b><span>${meta}</span></div>`;
}

function hangWork(wall, item, room) {
  const button = make("button", "work", wall);
  button.type = "button";
  button.dataset.id = item.id;
  button.setAttribute("aria-label", item.title);
  button.style.top = `${item.hang}%`;
  const depth = room.z1 - room.z0;
  const along = item.along;
  const local = item.wall === "west" ? 1 - along : along;
  button.style.left = `${local * 100}%`;
  const z = room.z0 + along * depth;
  const gap = 470;
  item.stand = {
    x: item.wall === "west" ? X0 + gap : X1 - gap,
    z,
    yaw: item.wall === "west" ? -90 : 90,
    pitch: 4,
  };
  item.roomName = room.kicker === "вхід" ? room.name : room.name;

  if (item.kind === "panel") {
    button.innerHTML = `
      <div class="wash"></div>
      <div class="sconce"></div>
      <div class="frame"><div class="slip">
        <div class="panel-face" style="width:${item.w}px;height:${item.h}px">
          <div class="tooth"></div>
          <small>${item.panel.kicker}</small>
          <h3>${item.panel.heading}</h3>
          <p>${item.panel.body}</p>
        </div>
      </div></div>
      ${caption(item)}`;
  } else {
    button.innerHTML = `
      <div class="wash"></div>
      <div class="sconce"></div>
      <div class="frame"><div class="slip">
        <div class="canvas${item.fit === "portrait" ? " portrait" : ""}" style="width:${item.w}px;height:${item.h}px">${item.image ? `<img src="${item.image}" alt="${item.title}">` : `${item.svg || ""}${item.fit === "portrait" ? `<span class="slot-mark">Місце для портрета</span>` : ""}<div class="tooth"></div>`}</div>
      </div></div>
      ${room.id === "fame" ? "" : caption(item)}`;
  }
  bind(button, item);
}

function addBench(parent, x, z) {
  const seatY = FLOOR - 46;
  addBox(parent, { x, y: seatY, z, w: 210, h: 16, d: 54, fill: "#0d2c66" });
  for (const sx of [-90, 90]) {
    for (const sz of [-18, 18]) {
      addBox(parent, { x: x + sx, y: FLOOR - 22, z: z + sz, w: 10, h: 40, d: 10, fill: "#e6b84c" });
    }
  }
  addPlane(parent, "blob", { x, y: FLOOR - 3, z, w: 230, h: 90, rx: FLOOR_RX });
  obstacles.push({ x0: x - 120, x1: x + 120, z0: z - 48, z1: z + 48 });
}

function addPedestal(parent, x, z) {
  addBox(parent, { x, y: FLOOR - 50, z, w: 116, h: 100, d: 116, fill: "#e6e2d6" });
  addPlane(parent, "blob", { x, y: FLOOR - 3, z, w: 180, h: 120, rx: FLOOR_RX });
  obstacles.push({ x0: x - 70, x1: x + 70, z0: z - 70, z1: z + 70 });
}

function addBall(parent, x, z) {
  const rig = addRig(parent, { x, y: FLOOR - 168, z });
  const ball = make("div", "sphere big", rig);
  ball.setAttribute("aria-hidden", "true");
}

function addGoal(parent, x, z) {
  const rig = addRig(parent, { x, y: FLOOR - 130, z, ry: 180 });
  addBox(rig, { x: -92, y: 10, z: 0, w: 10, h: 150, d: 10, fill: "#f3f0e7" });
  addBox(rig, { x: 92, y: 10, z: 0, w: 10, h: 150, d: 10, fill: "#f3f0e7" });
  addBox(rig, { x: 0, y: -70, z: 0, w: 194, h: 10, d: 10, fill: "#f3f0e7" });
  const net = addBox(rig, { x: 0, y: 10, z: 28, w: 176, h: 140, d: 4, fill: "#d5e2f7" });
  net.style.opacity = "0.38";
}

function addWallSpot(parent, x, z) {
  const west = x < 0;
  const wallX = west ? X0 + 14 : X1 - 14;
  const lampY = CEIL + 78;
  const endX = x - Math.sign(x - wallX) * 70;
  const endY = FLOOR - 112;
  const dx = endX - wallX;
  const dy = endY - lampY;
  const len = Math.hypot(dx, dy);
  const theta = (-Math.atan2(dx, dy) * 180) / Math.PI;
  const into = west ? 1 : -1;

  addBox(parent, { x: wallX, y: lampY, z, w: 28, h: 48, d: 64, fill: "#0a214f" });
  addBox(parent, { x: wallX + into * 10, y: lampY, z, w: 14, h: 30, d: 40, fill: "#101010" });
  addBox(parent, { x: wallX + into * 18, y: lampY, z, w: 6, h: 16, d: 22, fill: "#fff1c2" });
  addPlane(parent, "spot-wash", {
    x: wallX + into * 8,
    y: lampY + 10,
    z,
    w: 150,
    h: 180,
    ry: west ? 90 : -90,
  });

  const beam = make("div", "spot-beam", parent);
  beam.style.width = "110px";
  beam.style.height = `${len}px`;
  beam.style.left = "-55px";
  beam.style.top = `${-len / 2}px`;
  beam.style.transform = `translate3d(${(wallX + endX) / 2}px, ${(lampY + endY) / 2}px, ${z}px) rotateZ(${theta}deg)`;
  beam.setAttribute("aria-hidden", "true");

  const bulb = make("div", "bulb spot-bulb", parent);
  bulb.style.transform = `translate3d(${wallX + into * 20}px, ${lampY}px, ${z}px)`;
}

function addTrophyPedestal(parent, item) {
  const { x, z } = item;
  addBox(parent, { x, y: FLOOR - 48, z, w: 112, h: 96, d: 112, fill: "#e6e2d6" });
  addBox(parent, { x, y: FLOOR - 100, z, w: 132, h: 10, d: 132, fill: "#f7f4ea" });
  addBox(parent, { x, y: FLOOR - 108, z, w: 140, h: 6, d: 140, fill: "#e6b84c" });
  addPlane(parent, "cup-mark", {
    x,
    y: FLOOR - 112,
    z,
    w: 78,
    h: 78,
    rx: FLOOR_RX,
  });
  addPlane(parent, "spot-pool", {
    x,
    y: FLOOR - 114,
    z,
    w: 168,
    h: 168,
    rx: FLOOR_RX,
  });
  addWallSpot(parent, x, z);

  obstacles.push({ x0: x - 78, x1: x + 78, z0: z - 78, z1: z + 78 });
  item.roomName = rooms.find((room) => room.id === item.room)?.name || "";
  item.stand = { x, z: z - 300, yaw: 0, pitch: -8 };
  const plate = addPlane(parent, "plaque", {
    x,
    y: FLOOR - 70,
    z: z - 78,
    w: 168,
    h: 58,
    ry: 180,
  });
  plate.innerHTML = `<b>${item.title}</b><span>${item.artist}</span>`;
  plate.setAttribute("aria-label", item.title);
  bind(plate, item);
}

function addSculpture(parent, item) {
  const { x, z } = item;
  addPedestal(parent, x, z);
  if (item.form === "ball") addBall(parent, x, z);
  else addGoal(parent, x, z);

  item.roomName = rooms.find((room) => room.id === item.room)?.name || "";
  item.stand = { x, z: z - 340, yaw: 0, pitch: -1 };
  const plate = addPlane(parent, "plaque", {
    x,
    y: FLOOR - 78,
    z: z - 64,
    w: 150,
    h: 64,
    ry: 180,
  });
  plate.innerHTML = `<b>${item.title}</b><span>${item.artist}</span>`;
  plate.type = "button";
  plate.setAttribute("aria-label", item.title);
  bind(plate, item);
}

function addStand(parent, x, z) {
  addBox(parent, { x, y: FLOOR - 40, z, w: 72, h: 80, d: 72, fill: "#0b2557" });
  addBox(parent, { x, y: FLOOR - 86, z, w: 92, h: 12, d: 92, fill: "#e6b84c" });
  const rig = addRig(parent, { x, y: FLOOR - 142, z });
  const ball = make("div", "sphere", rig);
  ball.setAttribute("aria-hidden", "true");
  obstacles.push({ x0: x - 46, x1: x + 46, z0: z - 46, z1: z + 46 });
}

function addDesk(parent, x, z) {
  addBox(parent, { x, y: FLOOR - 36, z, w: 150, h: 70, d: 62, fill: "#0b2557" });
  addBox(parent, { x, y: FLOOR - 78, z, w: 190, h: 14, d: 84, fill: "#e6b84c" });
  obstacles.push({ x0: x - 100, x1: x + 100, z0: z - 48, z1: z + 48 });
}

function addLights(parent, room) {
  const z0 = room.z0 + 220;
  const z1 = room.z1 - 220;
  for (let z = z0; z <= z1; z += 420) {
    const bulb = make("div", "bulb", parent);
    bulb.style.left = "0px";
    bulb.style.top = "0px";
    bulb.style.transform = `translate3d(0px, ${CEIL + 28}px, ${z}px) rotateX(${FLOOR_RX}deg)`;
  }
}

function buildRoom(room) {
  const group = make("div", `room tone-${room.id}`, world);
  const depth = room.z1 - room.z0;
  const midZ = (room.z0 + room.z1) / 2;
  addPlane(group, `floor ${room.floor}`, {
    x: 0,
    y: FLOOR,
    z: midZ,
    w: X1 - X0,
    h: depth,
    rx: FLOOR_RX,
  });
  addPlane(group, "ceiling", {
    x: 0,
    y: CEIL,
    z: midZ,
    w: X1 - X0,
    h: depth,
    rx: FLOOR_RX,
  });
  if (room.z0 === 0) {
    const south = addSpan(group, room, { x0: X0, x1: X1, z: 0, y0: CEIL, y1: FLOOR, ry: 0 });
    const hero = make("div", "hero-type", south);
    hero.innerHTML = `
      <p class="eyebrow">футзальний клуб</p>
      <h2>ХІТ</h2>
      <div class="rule"></div>
      <p class="hours">Київ · з 2006 року</p>`;
  }
  if (room.window) addWindow(group, room);
  else addDoor(group, room);

  const west = addSide(group, room, { x: X0, z0: room.z0, z1: room.z1, ry: 90 });
  const east = addSide(group, room, { x: X1, z0: room.z0, z1: room.z1, ry: -90 });
  for (const item of pieces.filter((piece) => piece.room === room.id)) {
    hangWork(item.wall === "west" ? west : east, item, room);
  }
  addLights(group, room);

  const solidSouth = room.z0 === 0;
  const solidNorth = Boolean(room.window);
  walk.push({
    x0: X0 + INSET,
    x1: X1 - INSET,
    z0: room.z0 + (solidSouth ? INSET : 10),
    z1: room.z1 - (solidNorth ? INSET : 10),
  });
}

function buildMap() {
  const zMax = rooms.at(-1).z1;
  for (const room of rooms) {
    const btn = make("button", "m-room", mapStage);
    btn.type = "button";
    btn.dataset.room = room.id;
    btn.setAttribute("aria-label", `Перейти: ${room.name}`);
    const u0 = (X0 - X0) / (X1 - X0);
    const u1 = 1;
    const v0 = 1 - room.z1 / zMax;
    const v1 = 1 - room.z0 / zMax;
    btn.style.left = `calc(${u0 * 100}% + 8px)`;
    btn.style.top = `${v0 * 100}%`;
    btn.style.width = `calc(${(u1 - u0) * 100}% - 16px)`;
    btn.style.height = `${(v1 - v0) * 100}%`;
  }
  const you = make("div", "m-you", mapStage);
  you.id = "m-you";
  mapStage.addEventListener("click", (event) => {
    const btn = event.target.closest(".m-room");
    if (!btn || mode === "cinema" || mode === "intro") return;
    const room = rooms.find((item) => item.id === btn.dataset.room);
    const destZ = room.window ? room.z0 + 280 : (room.z0 + room.z1) / 2;
    if (mode === "view") closeSheet();
    glide(route({ x: 0, z: destZ }), { finalYaw: 0, finalPitch: 4, modeAfter: "free" });
  });
}

function canWalk(x, z) {
  const inside = walk.some((rect) => x >= rect.x0 && x <= rect.x1 && z >= rect.z0 && z <= rect.z1);
  if (!inside) return false;
  return !obstacles.some((rect) => x >= rect.x0 && x <= rect.x1 && z >= rect.z0 && z <= rect.z1);
}

function moveBy(dx, dz) {
  if (!dx && !dz) return;
  if (canWalk(cam.x + dx, cam.z + dz)) {
    cam.x += dx;
    cam.z += dz;
    return;
  }
  if (canWalk(cam.x + dx, cam.z)) cam.x += dx;
  else if (canWalk(cam.x, cam.z + dz)) cam.z += dz;
}

function route(to) {
  const points = [{ x: cam.x, z: cam.z }];
  const seams = rooms.slice(0, -1).map((room) => room.z1);
  const dir = Math.sign(to.z - cam.z);
  if (dir) {
    seams
      .filter((seam) => (dir > 0 ? seam > cam.z && seam < to.z : seam < cam.z && seam > to.z))
      .sort((a, b) => dir * (a - b))
      .forEach((seam) => points.push({ x: 0, z: seam }));
  }
  points.push({ x: to.x, z: to.z });
  return points.filter((point, index, list) => {
    if (index === 0) return true;
    const prev = list[index - 1];
    return Math.hypot(point.x - prev.x, point.z - prev.z) > 12;
  });
}

function glide(points, opts) {
  introTween?.kill();
  tween?.kill();
  mode = "cinema";
  glidePitch = true;
  aimYaw = cam.yaw;
  const lengths = [];
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    const length = Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z) || 1;
    lengths.push(length);
    total += length;
  }
  const proxy = { p: 0 };
  tween = gsap.to(proxy, {
    p: 1,
    duration: dur(Math.max(1.05, total / 540)),
    ease: "power2.inOut",
    onUpdate: () => {
      const dist = proxy.p * total;
      let acc = 0;
      let index = 0;
      for (; index < lengths.length - 1; index += 1) {
        if (acc + lengths[index] >= dist) break;
        acc += lengths[index];
      }
      const u = gsap.utils.clamp(0, 1, (dist - acc) / lengths[index]);
      const a = points[index];
      const b = points[index + 1];
      cam.x = gsap.utils.interpolate(a.x, b.x, u);
      cam.z = gsap.utils.interpolate(a.z, b.z, u);
      let face = (Math.atan2(b.x - a.x, b.z - a.z) * 180) / Math.PI;
      if (opts.finalYaw != null && proxy.p > 0.78) {
        const k = (proxy.p - 0.78) / 0.22;
        const end = nearAngle(face, opts.finalYaw);
        face += (end - face) * k;
      }
      aimYaw = nearAngle(cam.yaw, face);
      targetPitch = proxy.p > 0.8 ? (opts.finalPitch ?? 0) : 5;
    },
    onComplete: () => {
      aimYaw = null;
      glidePitch = false;
      if (opts.finalYaw != null) cam.yaw = nearAngle(cam.yaw, opts.finalYaw);
      cam.pitch = opts.finalPitch ?? cam.pitch;
      targetYaw = cam.yaw;
      targetPitch = cam.pitch;
      mode = opts.modeAfter || "free";
      tween = null;
      opts.onComplete?.();
    },
  });
}

function openSheet(item) {
  viewing = item;
  $("#sheet-kicker").textContent = item.roomName || "";
  $("#sheet-title").textContent = item.title;
  const meta = [item.artist, item.year, item.medium].filter(Boolean).join(" · ");
  $("#sheet-meta").textContent = meta;
  $("#sheet-text").textContent = item.text;
  sheet.setAttribute("aria-hidden", "false");
  gsap.to(hints, { autoAlpha: 0, duration: dur(0.25) });
  gsap.fromTo(sheet, { autoAlpha: 0, y: 26 }, { autoAlpha: 1, y: 0, duration: dur(0.55), ease: "power3.out" });
}

function closeSheet() {
  viewing = null;
  sheet.setAttribute("aria-hidden", "true");
  gsap.to(sheet, { autoAlpha: 0, y: 16, duration: dur(0.3), ease: "power2.inOut" });
  if (mode !== "intro") gsap.to(hints, { autoAlpha: 1, duration: dur(0.35) });
}

function approach(item) {
  if (!item?.stand || mode === "cinema" || mode === "intro") return;
  if (mode !== "view") {
    returnPose = { x: cam.x, z: cam.z, yaw: targetYaw, pitch: targetPitch };
  }
  glide(route(item.stand), {
    finalYaw: item.stand.yaw,
    finalPitch: item.stand.pitch ?? 0,
    modeAfter: "view",
    onComplete: () => openSheet(item),
  });
}

function retreat() {
  if (mode !== "view" || !returnPose) {
    closeSheet();
    mode = "free";
    return;
  }
  const pose = returnPose;
  closeSheet();
  glide(route(pose), {
    finalYaw: pose.yaw,
    finalPitch: pose.pitch,
    modeAfter: "free",
  });
}

function syncRoom(force = false) {
  const room = rooms.find((item) => cam.z >= item.z0 && cam.z < item.z1) || rooms.at(-1);
  document.querySelectorAll(".m-room").forEach((btn) => {
    if (btn.dataset.room === room.id) btn.setAttribute("aria-current", "true");
    else btn.removeAttribute("aria-current");
  });
  if (room.id === roomId && !force) return;
  roomId = room.id;
  roomLabel.querySelector("small").textContent = room.kicker;
  roomLabel.querySelector("strong").textContent = room.name;
  if (!force) {
    gsap.fromTo(roomLabel, { autoAlpha: 0.2, y: 8 }, { autoAlpha: 1, y: 0, duration: dur(0.45), ease: "power2.out" });
  }
}

function render() {
  const y = EYE;
  const pitch = cam.pitch;
  const snap = (value) => Math.round(value * 10) / 10;
  world.style.transform = `translateZ(${fov}px) rotateX(${snap(-pitch)}deg) rotateY(${snap(180 - cam.yaw)}deg) translate3d(${snap(-cam.x)}px, ${snap(-y)}px, ${snap(-cam.z)}px)`;

  const you = $("#m-you");
  if (you) {
    const zMax = rooms.at(-1).z1;
    const u = (cam.x - X0) / (X1 - X0);
    const v = 1 - cam.z / zMax;
    you.style.left = `${u * 100}%`;
    you.style.top = `${v * 100}%`;
    you.style.transform = `translate(-50%, -50%) rotate(${cam.yaw}deg)`;
  }
  syncRoom();
}

function movingIntent() {
  return ["w", "a", "s", "d", "arrowup", "arrowdown"].some((key) => down.has(key)) || Math.abs(wheel) > 30;
}

function update(dt) {
  if (aimYaw != null) cam.yaw = dampAngle(cam.yaw, aimYaw, dt, 4.5);
  if (glidePitch) cam.pitch = dampAngle(cam.pitch, targetPitch, dt, 4);
  else if (mode !== "cinema") {
    cam.yaw = dampAngle(cam.yaw, targetYaw, dt, 8);
    cam.pitch = dampAngle(cam.pitch, targetPitch, dt, 8);
  }

  if (mode === "view" && movingIntent()) {
    closeSheet();
    mode = "free";
  }

  if (mode === "free") {
    if (down.has("arrowleft") || down.has("q")) targetYaw += 78 * dt;
    if (down.has("arrowright") || down.has("e")) targetYaw -= 78 * dt;
    let ix = 0;
    let iz = 0;
    if (down.has("w") || down.has("arrowup")) iz += 1;
    if (down.has("s") || down.has("arrowdown")) iz -= 1;
    if (down.has("a")) ix -= 1;
    if (down.has("d")) ix += 1;
    const len = Math.hypot(ix, iz) || 1;
    const speed = (down.has("shift") ? 430 : 270) * dt;
    const yaw = (cam.yaw * Math.PI) / 180;
    const fwdX = Math.sin(yaw);
    const fwdZ = Math.cos(yaw);
    const rightX = -Math.cos(yaw);
    const rightZ = Math.sin(yaw);
    const boost = wheel * dt * 0.85;
    moveBy(
      (fwdX * (iz / len) + rightX * (ix / len)) * speed + fwdX * boost,
      (fwdZ * (iz / len) + rightZ * (ix / len)) * speed + fwdZ * boost,
    );
  }
  wheel *= Math.max(0, 1 - dt * 6);
}

function showHints() {
  gsap.to(hints, { opacity: 1, duration: dur(0.6), delay: 0.15 });
}

function enterMuseum() {
  if (mode !== "intro") return;
  gsap.to("#intro", { autoAlpha: 0, y: 12, duration: dur(0.45), ease: "power2.inOut", onComplete: () => $("#intro").remove() });
  introTween?.kill();
  tween?.kill();
  mode = "cinema";
  glidePitch = false;
  aimYaw = null;
  tween = gsap.to(cam, {
    z: 1180,
    pitch: 3,
    duration: dur(2.35),
    ease: "power2.inOut",
    onComplete: () => {
      targetYaw = cam.yaw;
      targetPitch = cam.pitch;
      mode = "free";
      tween = null;
      showHints();
    },
  });
}

let last = performance.now();
function frame() {
  const now = performance.now();
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);
  render();
}

function boot() {
  rooms.forEach(buildRoom);
  for (let i = 0; i < rooms.length - 1; i += 1) {
    const seam = rooms[i].z1;
    walk.push({ x0: -PASS, x1: PASS, z0: seam - 40, z1: seam + 40 });
  }
  const vest = world.querySelector(".tone-vest");
  addStand(vest, -520, 1080);
  addDesk(vest, 500, 980);
  const origin = world.querySelector(".tone-origin");
  addBench(origin, -560, 2460);
  const gold = world.querySelector(".tone-gold");
  addBench(gold, 560, 4500);
  const fame = world.querySelector(".tone-fame");
  addBench(fame, 540, 6060);
  pedestals.forEach((item) => {
    const room = world.querySelector(`.tone-${item.room}`);
    addTrophyPedestal(room, item);
  });
  const arena = world.querySelector(".tone-arena");
  sculptures.forEach((item) => addSculpture(arena, item));
  addBench(arena, 480, 7280);
  benchNote.roomName = rooms.find((room) => room.id === "arena").name;
  benchNote.stand = { x: 480, z: 7100, yaw: 0, pitch: 2 };
  const benchHit = addPlane(arena, "plaque", {
    x: 480,
    y: FLOOR - 70,
    z: 7220,
    w: 150,
    h: 52,
    ry: 180,
  });
  benchHit.innerHTML = "<b>Лавка</b><span>біля вікна</span>";
  benchHit.setAttribute("aria-label", benchNote.title);
  bind(benchHit, benchNote);

  addPlane(world, "runner", {
    x: 0,
    y: FLOOR - 16,
    z: 4360,
    w: 16,
    h: 8400,
    rx: FLOOR_RX,
  });

  buildMap();
  setFov();
  gsap.set(sheet, { autoAlpha: 0, y: 20 });
  syncRoom(true);
  render();
  gsap.to("#fade", { autoAlpha: 0, duration: dur(1.15), ease: "power2.out" });
  gsap.fromTo(
    "#intro .eyebrow, #intro h1, #intro .lead, #enter, #intro .fine",
    { y: 18, autoAlpha: 0 },
    { y: 0, autoAlpha: 1, stagger: 0.08, duration: dur(0.9), ease: "power3.out", delay: 0.15 },
  );
  introTween = gsap.to(cam, {
    z: cam.z + (calm ? 0 : 26),
    duration: 3.4,
    yoyo: true,
    repeat: -1,
    ease: "sine.inOut",
  });
  gsap.ticker.add(frame);
}

window.addEventListener("resize", setFov);
window.visualViewport?.addEventListener("resize", setFov);
$("#enter").addEventListener("click", enterMuseum);
$("#sheet-back").addEventListener("click", retreat);

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)) event.preventDefault();
  down.add(key);
  if (key === "escape") retreat();
  if (key === "enter" && mode === "intro") enterMuseum();
});
window.addEventListener("keyup", (event) => down.delete(event.key.toLowerCase()));
window.addEventListener("blur", () => down.clear());

window.addEventListener("wheel", (event) => {
  if (mode === "cinema" || mode === "intro") return;
  event.preventDefault();
  wheel = gsap.utils.clamp(-520, 520, wheel - event.deltaY * 0.55);
}, { passive: false });

let dragX = 0;
let dragY = 0;
let dragging = false;
viewport.addEventListener("pointerdown", (event) => {
  if (event.target.closest(".hot, .work, button")) return;
  dragging = true;
  dragX = event.clientX;
  dragY = event.clientY;
  document.body.classList.add("dragging");
  try {
    viewport.setPointerCapture(event.pointerId);
  } catch {
    /* iOS відпускає жест, якщо захват вказівника недоступний */
  }
});
window.addEventListener("pointerup", () => {
  dragging = false;
  document.body.classList.remove("dragging");
});
window.addEventListener("pointermove", (event) => {
  if (!dragging || mode === "cinema") return;
  const dx = event.clientX - dragX;
  const dy = event.clientY - dragY;
  dragX = event.clientX;
  dragY = event.clientY;
  targetYaw -= dx * 0.16;
  targetPitch = gsap.utils.clamp(-16, 18, targetPitch + dy * 0.1);
});

document.querySelectorAll("#pad button").forEach((button) => {
  const key = button.dataset.k;
  const press = (event) => {
    event.preventDefault();
    down.add(key);
  };
  const release = () => down.delete(key);
  button.addEventListener("pointerdown", press);
  button.addEventListener("pointerup", release);
  button.addEventListener("pointerleave", release);
  button.addEventListener("pointercancel", release);
});

boot();
