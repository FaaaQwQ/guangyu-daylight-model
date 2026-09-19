/* 光域 · 内外双层自适应采光系统的情境交互模型
   单位 mm；x 向室内，y 沿窗，z 向上。
   外层智能玻璃 (x≈-25) 负责整体光线与热量调节；
   内层微型百叶 (x≈95) 负责快速局部防眩光。两层间为 120 mm 空气间隙。 */

const defaults = {
  width: 1800, height: 1600, sill: 800, depth: 900,
  eye: 1200, desk: 740, tilt: 30, alt: 25, az: 0,
  split1: 1100, split2: 1550
};

/* ---- 情境模式定义 ---- */
const sceneModes = {
  normal: {
    name: '正常办公',
    glass: [
      { r: 96, g: 130, b: 120, a: 0.10 },
      { r: 96, g: 130, b: 120, a: 0.10 },
      { r: 96, g: 130, b: 120, a: 0.10 }
    ],
    blindAngle: 30,
    sunBlocked: false,
    outdoorLux: 78000,
    indoorLux: 6200,
    occupied: true,
    lampOn: false,
    desc: '外层玻璃透光，百叶开启，自然采光充足'
  },
  antiGlare: {
    name: '西晒防眩光',
    glass: [
      { r: 55, g: 82, b: 74, a: 0.68 },
      { r: 62, g: 88, b: 80, a: 0.52 },
      { r: 96, g: 130, b: 120, a: 0.12 }
    ],
    blindAngle: 75,
    sunBlocked: true,
    outdoorLux: 96000,
    indoorLux: 3100,
    occupied: true,
    lampOn: false,
    desc: '中下区玻璃变深，百叶阻断屏幕方向直射光'
  },
  projection: {
    name: '投影会议',
    glass: [
      { r: 42, g: 62, b: 56, a: 0.82 },
      { r: 42, g: 62, b: 56, a: 0.82 },
      { r: 42, g: 62, b: 56, a: 0.82 }
    ],
    blindAngle: 85,
    sunBlocked: true,
    outdoorLux: 32000,
    indoorLux: 750,
    occupied: true,
    lampOn: true,
    desc: '玻璃整体变暗，百叶关闭，台灯补光'
  },
  evening: {
    name: '傍晚节能',
    glass: [
      { r: 112, g: 126, b: 92, a: 0.06 },
      { r: 112, g: 126, b: 92, a: 0.06 },
      { r: 112, g: 126, b: 92, a: 0.06 }
    ],
    blindAngle: 20,
    sunBlocked: false,
    outdoorLux: 4800,
    indoorLux: 1100,
    occupied: true,
    lampOn: true,
    desc: '玻璃恢复透明，百叶打开，台灯补光'
  }
};

/* ---- 场景动画状态（当前值，会向模式目标值渐变） ---- */
const sceneState = {
  mode: 'normal',
  glass: sceneModes.normal.glass.map(g => ({ ...g })),
  blindAngle: 30,
  autoMode: true,
  manualTimer: 0,
  manualDuration: 30,
  explode: 0,
  explodeTarget: 0
};

/* ---- 几何构建 ---- */
function build(p, st) {
  st = st || sceneState;
  const ex = (st && st.explode) || 0;
  /* 爆炸图分层偏移（沿 X 轴，室外→室内方向展开） */
  const offGlass = -100 * ex;
  const offBlind = 220 * ex;
  const offSlat = 300 * ex;
  const offFurn = 420 * ex;
  const objects = [];

  function box(name, c, s, color, angle, transparent) {
    if (angle === undefined) angle = 0;
    if (transparent === undefined) transparent = false;
    let v = [];
    for (let z of [-1, 1]) for (let y of [-1, 1]) for (let x of [-1, 1]) {
      let a = x * s[0] / 2, b = z * s[2] / 2;
      v.push([c[0] + a * Math.cos(angle) - b * Math.sin(angle), c[1] + y * s[1] / 2, c[2] + a * Math.sin(angle) + b * Math.cos(angle)]);
    }
    objects.push({ name, v, f: [[0,2,3,1],[4,5,7,6],[0,1,5,4],[2,6,7,3],[0,4,6,2],[1,3,7,5]], color, transparent });
  }

  // 地面（不移动）
  box('Floor', [1100, 0, -30], [2600, 2800, 40], '#dce2dd');

  const top = p.sill + p.height, w = p.width;

  // 窗框（不移动）
  for (let y of [-w / 2, w / 2]) box('Frame_side', [0, y, (p.sill + top) / 2], [100, 45, p.height + 45], '#405653');
  for (let z of [p.sill, p.split1, p.split2, top]) box('Frame_cross', [0, 0, z], [100, w, 35], '#405653');

  // 外层智能玻璃 + 空气间隙 + 内层微型百叶
  const zs = [p.sill, p.split1, p.split2, top];
  for (let i = 0; i < 3; i++) {
    const g = st.glass[i];
    const glassColor = 'rgba(' + Math.round(g.r) + ',' + Math.round(g.g) + ',' + Math.round(g.b) + ',' + g.a.toFixed(3) + ')';
    // 外层智能玻璃 (x = -25 + offGlass)
    box('EC_glass_' + i, [-25 + offGlass, 0, (zs[i] + zs[i + 1]) / 2], [12, w - 45, zs[i + 1] - zs[i] - 35], glassColor, 0, true);
    // 内层百叶盒 (x = 95 + offBlind)
    box('Blind_cassette_' + i, [95 + offBlind, 0, zs[i + 1] - 35], [95, w - 60, 35], '#566d65');
    // 百叶叶片 (x = 95 + offSlat)
    for (let z = zs[i] + 45; z < zs[i + 1] - 45; z += 40)
      box('Slat_' + i + '_' + Math.round(z), [95 + offSlat, 0, z], [50, w - 80, 2], '#c4c7b0', st.blindAngle * Math.PI / 180);
  }

  // 智能台灯（根据模式显示，随工位移动）
  if (sceneModes[st.mode] && sceneModes[st.mode].lampOn) {
    box('Lamp_base', [p.depth + 380 + offFurn, -60, p.desk + 8], [70, 70, 16], '#485a55');
    box('Lamp_arm', [p.depth + 380 + offFurn, -60, p.desk + 90], [16, 16, 130], '#5a6e60');
    box('Lamp_head', [p.depth + 380 + offFurn, -60, p.desk + 230], [55, 55, 28], '#b0c0b4');
  }

  // 桌面、桌腿（随工位移动）
  box('Desktop', [p.depth + 250 + offFurn, -170, p.desk - 15], [1400, 800, 30], '#bca584');
  for (let x of [p.depth - 370, p.depth + 870]) for (let y of [-490, 150]) box('Desk_leg', [x + offFurn, y, (p.desk - 30) / 2], [35, 35, p.desk - 30], '#52605b');

  // 显示器（随工位移动）
  box('Monitor', [p.depth + offFurn, -230, p.desk + 330], [540, 30, 320], '#263f3a');
  box('Screen', [p.depth + offFurn, -211, p.desk + 330], [510, 8, 290], '#88afa6');
  box('Monitor_stand', [p.depth + offFurn, -230, p.desk + 80], [35, 40, 150], '#485a55');
  box('Monitor_base', [p.depth + offFurn, -230, p.desk + 8], [240, 170, 16], '#485a55');

  // 键盘、控制器（随工位移动）
  box('Keyboard', [p.depth + offFurn, 50, p.desk + 12], [430, 150, 20], '#e2e3d8');
  box('Controller', [p.depth + 230 + offFurn, 130, p.desk + 18], [100, 75, 36], '#d1844f');

  // 椅子（随工位移动）
  box('Chair_seat', [p.depth + offFurn, 510, 450], [470, 450, 70], '#586f64');
  box('Chair_back', [p.depth + offFurn, 725, 720], [470, 65, 480], '#586f64');
  box('Chair_stem', [p.depth + offFurn, 510, 220], [65, 65, 400], '#4b5651');
  box('Chair_foot', [p.depth + offFurn, 510, 50], [560, 500, 35], '#4b5651');

  // 人体（随工位移动）
  box('Torso', [p.depth + offFurn, 520, (p.eye - 170 + 520) / 2], [340, 200, p.eye - 170 - 520], '#d2ad8d');
  box('Head', [p.depth + offFurn, 500, p.eye - 10], [165, 175, 220], '#e0b99a');
  for (let x of [-115, 115]) {
    box('Thigh', [p.depth + x + offFurn, 330, 520], [120, 380, 110], '#7d8c82');
    box('Shin', [p.depth + x + offFurn, 150, 270], [100, 105, 440], '#7d8c82');
    box('Foot', [p.depth + x + offFurn, 80, 65], [115, 230, 80], '#535f59');
    box('Upper_arm', [p.depth + x * 1.65 + offFurn, 500, p.eye - 300], [90, 100, 260], '#d2ad8d');
    box('Forearm', [p.depth + x * 1.65 + offFurn, 335, p.desk + 45], [85, 310, 85], '#d2ad8d');
  }

  return objects;
}

/* ---- 阳光射线计算 ---- */
function sunRays(p, st) {
  st = st || sceneState;
  const rad = Math.PI / 180;
  const alt = Math.max(0.1, p.alt);
  const k = Math.tan(alt * rad) / Math.cos(p.az * rad || 0.001);
  const tanAz = Math.tan(p.az * rad);
  const w = p.width;
  const sill = p.sill;
  const top = sill + p.height;
  const zs = [sill, p.split1, p.split2, top];
  const t = st.blindAngle * rad;
  const mode = sceneModes[st.mode];

  const rays = [];
  const ySamples = [-w / 4, 0, w / 4];
  const zSamples = [sill + (p.split1 - sill) * 0.6, p.split1 + (p.split2 - p.split1) * 0.5];

  for (let y_w of ySamples) {
    for (let z_w of zSamples) {
      if (z_w < sill + 30 || z_w > top - 30) continue;
      // 阳光从窗外射入：x 增大、z 降低
      const zAtBlind = z_w - 95 * k;
      const yAtBlind = y_w + 95 * tanAz;
      const zAtScreen = z_w - p.depth * k;
      const yAtScreen = y_w + p.depth * tanAz;

      // 检查百叶是否阻断（仅在百叶角度 > 45° 时进行几何检测）
      let blocked = false;
      if (st.blindAngle > 45) {
        for (let zone = 0; zone < 3 && !blocked; zone++) {
          for (let z = zs[zone] + 45; z < zs[zone + 1] - 45; z += 40) {
            const slatHalfZ = 25 * Math.cos(t) + 1.5;
            if (Math.abs(zAtBlind - z) < slatHalfZ && Math.abs(yAtBlind) < w / 2 - 40) {
              blocked = true;
              break;
            }
          }
        }
      }
      // 模式级阻断（百叶接近关闭时强制阻断）
      if (mode.sunBlocked && st.blindAngle > 60) blocked = true;

      const screenZ = p.desk + 330;
      const reachesScreen = !blocked &&
        zAtScreen > p.desk && zAtScreen < p.desk + 660 &&
        Math.abs(yAtScreen + 207) < 280;

      rays.push({
        start: [-350, y_w + 350 * tanAz, z_w + 350 * k],
        windowPt: [0, y_w, z_w],
        blindPt: [95, yAtBlind, zAtBlind],
        screenPt: [p.depth, yAtScreen, zAtScreen],
        blocked: blocked,
        reachesScreen: reachesScreen
      });
    }
  }
  return rays;
}

/* ---- IoT 感知状态 ---- */
function iotState(p, st) {
  st = st || sceneState;
  const mode = sceneModes[st.mode];
  const avgOpacity = (st.glass[0].a + st.glass[1].a + st.glass[2].a) / 3;
  const transmittance = Math.round((1 - avgOpacity) * 100);
  const indoorLux = Math.round(mode.indoorLux * (1 - avgOpacity * 0.55));
  const glare = !mode.sunBlocked && st.blindAngle < 40 && p.alt > 18 && avgOpacity < 0.35;

  return {
    outdoorLux: mode.outdoorLux,
    indoorLux: indoorLux,
    occupied: mode.occupied,
    glare: glare,
    transmittance: transmittance,
    blindAngle: Math.round(st.blindAngle),
    lampOn: mode.lampOn,
    modeName: mode.name,
    desc: mode.desc
  };
}

/* ---- 分析（保留原有视距/视角/可达性分析） ---- */
function analysis(p, st) {
  st = st || sceneState;
  const stA = Object.assign({}, st, { explode: 0 });
  const tilt = st.blindAngle;
  const rad = Math.PI / 180;
  const alt = Math.max(0.1, p.alt);
  const k = Math.tan(alt * rad) / Math.cos(p.az * rad || 0.001);
  const eye = [p.depth, 410, p.eye];
  const windowHit = [0, eye[1] - p.depth * Math.tan(p.az * rad), p.eye + p.depth * k];

  const aperture = Math.abs(windowHit[1]) < p.width / 2 - 22.5 && windowHit[2] > p.sill + 17.5 && windowHit[2] < p.sill + p.height - 17.5;

  let blocked = false;
  const t = tilt * rad;
  for (let o of build(p, stA).filter(function (o) { return o.name.startsWith('Slat'); })) {
    const z = o.v.reduce(function (a, v) { return a + v[2]; }, 0) / 8;
    const x = (p.eye + p.depth * k - z + 95 * Math.tan(t)) / (k + Math.tan(t));
    const y = eye[1] - (p.depth - x) * Math.tan(p.az * rad);
    if (Math.abs(x - 95) <= 25 * Math.cos(t) && Math.abs(y) < p.width / 2 - 40) blocked = true;
  }

  for (const o of build(p, stA).filter(function (o) { return o.name.startsWith('Frame') || o.name.startsWith('Blind_cassette'); })) {
    let lo = 0, hi = 1;
    for (let j = 0; j < 3; j++) {
      let mn = Math.min.apply(null, o.v.map(function (v) { return v[j]; }));
      let mx = Math.max.apply(null, o.v.map(function (v) { return v[j]; }));
      let d = windowHit[j] - eye[j];
      if (Math.abs(d) < 1e-9) { if (eye[j] < mn || eye[j] > mx) hi = -1; }
      else { let a = (mn - eye[j]) / d, b = (mx - eye[j]) / d; lo = Math.max(lo, Math.min(a, b)); hi = Math.min(hi, Math.max(a, b)); }
    }
    if (lo <= hi) blocked = true;
  }

  const monitor = [p.depth, -207, p.desk + 330];
  const view = Math.hypot(617, p.eye - monitor[2]);
  const down = Math.atan2(p.eye - monitor[2], 617) / rad;
  const reach = Math.hypot(230, 390, p.desk + 36 - (p.eye - 170));
  const zone = p.eye < p.split1 ? '下区' : p.eye < p.split2 ? '中区' : '上区';
  const upper = Math.atan2(p.sill + p.height - p.eye, p.depth) / rad;
  const boundary = Math.atan2(p.split2 - p.eye, p.depth) / rad;

  return { eye, windowHit, aperture, blocked, direct: aperture && !blocked, view, down, reach, zone, upper, boundary };
}

/* ---- OBJ 导出 ---- */
function objText(p, st) {
  st = st || sceneState;
  let out = ['# Guangyu dual-layer conceptual mesh; units millimetres; not fabrication CAD'];
  let n = 1;
  for (let o of build(p, st)) {
    out.push('o ' + o.name);
    for (let v of o.v) out.push('v ' + v.map(function (x) { return x.toFixed(3); }).join(' '));
    for (let f of o.f) out.push('f ' + f.map(function (i) { return i + n; }).join(' '));
    n += o.v.length;
  }
  return out.join('\n');
}

if (typeof module !== 'undefined') module.exports = { defaults, sceneModes, sceneState, build, sunRays, iotState, analysis, objText };
