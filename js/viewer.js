// 查看器：多场景漫游 + 热点跳转 + 场景切换条 + URL 深链
import { requireAuth } from './auth.js';
import {
  createPSV, buildNodes, hotspotsToMarkers, hotspotMarkerId,
  deg2rad, loadJSON,
} from './common.js';

// 密码门：未登录跳转登录页
if (!requireAuth()) {
  throw new Error('need login');
}

const app = {
  project: null,
  current: null,          // 当前场景对象
  psv: null,              // { viewer, tour, markers, autorotatePlugin }
};

function sceneById(id) {
  return app.project.scenes.find((s) => s.id === id) || null;
}

/* ---------- URL hash 深链：#scene=场景id ---------- */
function sceneFromHash() {
  const m = location.hash.match(/scene=([^&]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

function syncHash(id) {
  const want = `#scene=${encodeURIComponent(id)}`;
  if (location.hash !== want) history.replaceState(null, '', want);
}

/* ---------- 底部场景切换条 ---------- */
function buildSceneBar() {
  const bar = document.getElementById('scene-bar');
  bar.innerHTML = '';
  for (const s of app.project.scenes) {
    const btn = document.createElement('button');
    btn.className = 'scene-chip';
    btn.dataset.sceneId = s.id;
    btn.innerHTML = `
      <img src="${encodeURI(s.thumbnail || s.panorama)}" alt="" loading="lazy">
      <span class="scene-chip-name"></span>`;
    btn.querySelector('.scene-chip-name').textContent = s.name;
    btn.addEventListener('click', () => goToScene(s.id));
    bar.appendChild(btn);
  }
}

function highlightScene(id) {
  document.querySelectorAll('.scene-chip').forEach((el) => {
    el.classList.toggle('active', el.dataset.sceneId === id);
    if (el.dataset.sceneId === id) el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  });
}

/* ---------- 场景切换 ---------- */
let navigating = false;
async function goToScene(id) {
  const scene = sceneById(id);
  if (!scene || navigating || id === app.current?.id) return;
  navigating = true;
  try {
    await app.psv.tour.setCurrentNode(id);
    app.current = scene;
    applyInitialView(scene);
  } finally {
    navigating = false;
  }
}

// 切换后朝向该场景的初始视角（编辑器里标注的"门口方向"）
function applyInitialView(scene) {
  const v = scene.initialView || { yaw: 0, pitch: 0 };
  // animate 在 autorotate 打断等场景下可能不返回 Promise，统一包一层
  Promise.resolve(app.psv.viewer.animate({
    yaw: deg2rad(v.yaw),
    pitch: deg2rad(v.pitch),
    speed: 1200,
  })).catch(() => {});
}

/* ---------- 热点 ---------- */
function refreshMarkers() {
  const scene = app.current;
  if (!scene) return;
  app.psv.markers.setMarkers(hotspotsToMarkers(app.project, scene));
}

/* ---------- 启动 ---------- */
async function boot() {
  try {
    app.project = await loadJSON('project.json');
  } catch (err) {
    showBootError(err);
    return;
  }

  document.getElementById('app-title').textContent = app.project.title || '我的全景漫游';
  document.title = app.project.title || '我的全景漫游';
  buildSceneBar();

  // 起始节点：URL hash > 默认场景 > 第一个
  const wanted = sceneFromHash();
  const startId = sceneById(wanted) ? wanted
    : (sceneById(app.project.defaultScene) ? app.project.defaultScene : app.project.scenes[0]?.id);

  try {
    app.psv = await createPSV(document.getElementById('panorama'), app.project, { startNodeId: startId });
  } catch (err) {
    showBootError(err);
    return;
  }

  const { viewer, tour, markers } = app.psv;

  app.current = sceneById(startId);
  highlightScene(startId);
  syncHash(startId);

  viewer.addEventListener('ready', () => {
    refreshMarkers();
    applyInitialView(app.current);
  }, { once: true });

  // 热点点击 -> 跳转目标场景
  markers.addEventListener('select-marker', (e) => {
    const markerId = e.marker.id; // 形如 hs-xxx
    if (!markerId.startsWith('hs-')) return;
    const scene = app.current;
    const hs = (scene.hotspots || []).find((h) => hotspotMarkerId(h.id) === markerId);
    if (hs) goToScene(hs.target);
  });

  // 节点变化（包括陀螺仪等无关来源）统一同步 UI 与 hash
  tour.addEventListener('node-changed', (e) => {
    const scene = sceneById(e.node.id);
    if (!scene) return;
    app.current = scene;
    highlightScene(scene.id);
    syncHash(scene.id);
    refreshMarkers();
  });

  // 支持浏览器前进后退 / 手动改 hash
  window.addEventListener('hashchange', () => {
    const id = sceneFromHash();
    if (id && sceneById(id) && id !== app.current?.id) goToScene(id);
  });
}

function showBootError(err) {
  const box = document.getElementById('boot-error');
  box.hidden = false;
  box.querySelector('.boot-error-detail').textContent = String(err && err.message || err);
}

boot();
