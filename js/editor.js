// 编辑器（仅 PC）：场景管理 + 热点标注 + 初始视角 + 导出/推送到 GitHub
import { requireAuth } from './auth.js';
import {
  createPSV, hotspotsToMarkers, hotspotMarkerId,
  deg2rad, rad2deg, round2, loadJSON, download,
} from './common.js';

// 密码门：未登录跳转登录页
if (!requireAuth()) {
  throw new Error('need login');
}

const $ = (sel) => document.querySelector(sel);

const state = {
  project: null,       // 内存中的 project.json 数据，所有编辑直接改它
  panoIndex: [],       // panoramas/index.json：可用图文件名
  psv: null,           // { viewer, tour, markers }
  currentId: null,     // 当前编辑的场景 id
  addMode: false,      // 添加热点模式
  pendingPos: null,    // 添加模式下点击到的 {yaw, pitch}（度）
  relocatingId: null,  // 正在重新定位的热点 id
  editingHsId: null,   // 弹窗正在编辑的热点 id（null = 新增）
};

const sceneById = (id) => state.project.scenes.find((s) => s.id === id) || null;
const currentScene = () => sceneById(state.currentId);

/* ================= 场景列表 ================= */
function renderSceneList() {
  const ul = $('#scene-list');
  ul.innerHTML = '';
  for (const s of state.project.scenes) {
    const li = document.createElement('li');
    li.className = 'scene-item' + (s.id === state.currentId ? ' active' : '');
    li.innerHTML = `
      <img class="scene-thumb" src="${encodeURI(s.thumbnail || s.panorama)}" alt="">
      <div class="scene-meta">
        <input class="scene-name-input" type="text" value="">
        <span class="scene-id"></span>
      </div>
      <div class="scene-btns">
        <button type="button" class="mini-btn btn-default" title="设为默认场景"></button>
        <button type="button" class="mini-btn btn-del" title="删除场景">✕</button>
      </div>`;
    li.querySelector('.scene-name-input').value = s.name;
    li.querySelector('.scene-id').textContent = s.id;
    const defBtn = li.querySelector('.btn-default');
    defBtn.textContent = state.project.defaultScene === s.id ? '★' : '☆';
    defBtn.classList.toggle('on', state.project.defaultScene === s.id);

    li.addEventListener('click', (e) => {
      if (e.target.closest('input, button')) return;
      switchScene(s.id);
    });
    li.querySelector('.scene-name-input').addEventListener('change', (e) => {
      s.name = e.target.value.trim() || s.name;
      markDirty();
      renderHotspotList(); // 热点标签引用了场景名
    });
    defBtn.addEventListener('click', () => {
      state.project.defaultScene = s.id;
      markDirty();
      renderSceneList();
    });
    li.querySelector('.btn-del').addEventListener('click', () => deleteScene(s.id));
    ul.appendChild(li);
  }
}

async function switchScene(id) {
  if (!sceneById(id) || id === state.currentId) return;
  cancelModes();
  await state.psv.tour.setCurrentNode(id);
}

function deleteScene(id) {
  const s = sceneById(id);
  if (!s) return;
  if (!confirm(`确定删除场景「${s.name}」？其他场景中指向它的热点也会一并删除。`)) return;

  state.project.scenes = state.project.scenes.filter((x) => x.id !== id);
  for (const other of state.project.scenes) {
    other.hotspots = (other.hotspots || []).filter((h) => h.target !== id);
  }
  if (state.project.defaultScene === id) {
    state.project.defaultScene = state.project.scenes[0]?.id || '';
  }
  if (state.currentId === id) {
    state.currentId = null;
    const next = state.project.scenes[0];
    if (next) {
      switchScene(next.id).then(refreshMarkers).catch(() => {});
    } else {
      state.psv.markers.clearMarkers();
    }
  }
  markDirty();
  renderAll();
}

/* ================= 热点 ================= */
function refreshMarkers() {
  const s = currentScene();
  if (!s) return;
  state.psv.markers.setMarkers(hotspotsToMarkers(state.project, s));
}

function renderHotspotList() {
  const ul = $('#hotspot-list');
  const s = currentScene();
  ul.innerHTML = '';
  if (!s) return;
  const list = s.hotspots || [];
  if (!list.length) {
    ul.innerHTML = '<li class="empty">暂无热点，用「添加热点模式」在全景上点击添加。</li>';
    return;
  }
  for (const h of list) {
    const target = sceneById(h.target);
    const li = document.createElement('li');
    li.className = 'hotspot-item' + (h.id === state.editingHsId ? ' active' : '');
    li.innerHTML = `
      <span class="hs-arrow">➜</span>
      <span class="hs-text"><b class="hs-target"></b><small class="hs-label"></small></span>
      <button type="button" class="mini-btn btn-hs-edit" title="编辑">✎</button>
      <button type="button" class="mini-btn btn-hs-del" title="删除">✕</button>`;
    li.querySelector('.hs-target').textContent = target ? target.name : `${h.target}（已删除）`;
    li.querySelector('.hs-label').textContent = h.label || '';
    li.querySelector('.btn-hs-edit').addEventListener('click', () => openHotspotDialog(h.id));
    li.querySelector('.btn-hs-del').addEventListener('click', () => deleteHotspot(h.id));
    li.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      openHotspotDialog(h.id);
    });
    ul.appendChild(li);
  }
}

function deleteHotspot(hsId) {
  const s = currentScene();
  if (!s) return;
  s.hotspots = (s.hotspots || []).filter((h) => h.id !== hsId);
  markDirty();
  refreshMarkers();
  renderHotspotList();
  closeDialog('#hotspot-dialog');
}

/* ================= 模式控制 ================= */
function cancelModes() {
  state.addMode = false;
  state.relocatingId = null;
  $('#mode-banner').hidden = true;
  $('#btn-add-mode').classList.remove('active');
  $('#btn-add-mode').textContent = '🎯 添加热点模式';
  $('#hs-relocate').hidden = true;
}

function toggleAddMode() {
  if (state.addMode) {
    cancelModes();
    return;
  }
  state.addMode = true;
  state.pendingPos = null;
  $('#mode-banner').hidden = false;
  $('#btn-add-mode').classList.add('active');
  $('#btn-add-mode').textContent = '✕ 退出添加模式';
}

/* ================= 热点弹窗 ================= */
function fillTargetSelect(selected) {
  const sel = $('#hs-target');
  sel.innerHTML = '';
  for (const s of state.project.scenes) {
    if (s.id === state.currentId) continue;
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = s.name;
    if (s.id === selected) opt.selected = true;
    sel.appendChild(opt);
  }
}

function openHotspotDialog(hsId) {
  const s = currentScene();
  if (!s) return;
  state.editingHsId = hsId || null;
  if (hsId) state.pendingPos = null; // 编辑已有热点时清掉残留坐标；新增时保留点击到的位置
  const hs = hsId ? (s.hotspots || []).find((h) => h.id === hsId) : null;

  $('#hotspot-dialog-title').textContent = hs ? '编辑热点' : '添加热点';
  $('#hs-label').value = hs ? (hs.label || '') : '';
  $('#hs-relocate').hidden = !hs;
  $('#hotspot-dialog').querySelector('.btn-danger')?.classList.toggle('hidden', !hs);
  fillTargetSelect(hs ? hs.target : null);
  renderHotspotList();
  $('#hotspot-dialog').hidden = false;
}

function saveHotspotForm(e) {
  e.preventDefault();
  const s = currentScene();
  const target = $('#hs-target').value;
  if (!s || !target) { alert('请选择目标场景'); return; }
  if (!state.project.scenes.some((x) => x.id === target)) { alert('目标场景不存在'); return; }
  if (state.relocatingId) { alert('请先在全景上点击新位置完成重新定位'); return; }

  const label = $('#hs-label').value.trim();
  s.hotspots = s.hotspots || [];
  const hs = s.hotspots.find((h) => h.id === state.editingHsId);
  if (hs) {
    hs.target = target;
    hs.label = label;
  } else {
    if (!state.pendingPos) { alert('请先在全景上点击要放置热点的位置'); return; }
    s.hotspots.push({
      id: `hs${Date.now().toString(36)}`,
      yaw: state.pendingPos.yaw,
      pitch: state.pendingPos.pitch,
      target,
      label,
    });
  }
  markDirty();
  refreshMarkers();
  renderHotspotList();
  closeDialog('#hotspot-dialog');
}

/* ================= 场景弹窗 ================= */
function openSceneDialog() {
  const used = new Set(state.project.scenes.map((s) => s.panorama));
  const free = state.panoIndex.filter((f) => !used.has(`panoramas/${f}`));
  const pick = $('#scene-pick');
  pick.innerHTML = '';
  $('#scene-dialog-empty').hidden = free.length > 0;
  pick.disabled = free.length === 0;
  for (const f of free) {
    const opt = document.createElement('option');
    opt.value = f;
    opt.textContent = f;
    pick.appendChild(opt);
  }
  pick.onchange = () => autofillSceneFields();
  if (free.length) autofillSceneFields();
  $('#scene-name').value = '';
  $('#scene-id').value = '';
  $('#scene-dialog').hidden = false;
}

function autofillSceneFields() {
  const f = $('#scene-pick').value;
  if (!f) return;
  const base = f.replace(/\.[^.]+$/, '');
  if (!$('#scene-name').value) $('#scene-name').value = base;
  if (!$('#scene-id').value) $('#scene-id').value = slugify(base);
}

function slugify(text) {
  const ascii = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  let id = ascii || 'scene';
  let n = 2;
  while (state.project.scenes.some((s) => s.id === id)) id = `${ascii || 'scene'}-${n++}`;
  return id;
}

function saveSceneForm(e) {
  e.preventDefault();
  const file = $('#scene-pick').value;
  if (!file) return;
  const name = $('#scene-name').value.trim() || file.replace(/\.[^.]+$/, '');
  let id = $('#scene-id').value.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
  if (!id) id = slugify(name);
  if (state.project.scenes.some((s) => s.id === id)) { alert(`场景 ID「${id}」已存在`); return; }

  state.project.scenes.push({
    id,
    name,
    panorama: `panoramas/${file}`,
    thumbnail: `thumbnails/${file}`,
    initialView: { yaw: 0, pitch: 0 },
    hotspots: [],
  });
  markDirty();
  renderSceneList();
  closeDialog('#scene-dialog');
  switchScene(id);
}

/* ================= 初始视角 / 导出 ================= */
function setInitialView() {
  const s = currentScene();
  if (!s) return;
  const { yaw, pitch } = state.psv.viewer.getPosition();
  s.initialView = { yaw: round2(rad2deg(yaw)), pitch: round2(rad2deg(pitch)) };
  markDirty();
  setStatus(`已把「${s.name}」的初始视角设为 yaw=${s.initialView.yaw}° pitch=${s.initialView.pitch}°`);
}

function exportProject() {
  const text = JSON.stringify(state.project, null, 2);
  download('project.json', text);
  setStatus('已下载 project.json，替换仓库里的同名文件后生效（页面刷新即可）。');
}

/* ================= GitHub 保存 ================= */
function ghConfig() {
  return {
    repo: $('#gh-repo').value.trim(),
    branch: $('#gh-branch').value.trim() || 'main',
    token: $('#gh-token').value.trim(),
  };
}

function base64Utf8(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

async function saveToGitHub() {
  const { repo, branch, token } = ghConfig();
  if (!repo || !token) { setStatus('请填写仓库和 Token', true); return; }
  setStatus('正在推送到 GitHub…');
  try {
    const api = `https://api.github.com/repos/${repo}/contents/project.json?ref=${encodeURIComponent(branch)}`;
    const head = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
    };
    let sha;
    const getRes = await fetch(api, { headers: head });
    if (getRes.ok) sha = (await getRes.json()).sha;
    else if (getRes.status !== 404) throw new Error(`读取失败：HTTP ${getRes.status}（检查仓库名/分支/Token 权限）`);

    const putRes = await fetch(`https://api.github.com/repos/${repo}/contents/project.json`, {
      method: 'PUT',
      headers: { ...head, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `chore: 更新全景配置 ${new Date().toLocaleString('zh-CN')}`,
        content: base64Utf8(JSON.stringify(state.project, null, 2)),
        branch,
        ...(sha ? { sha } : {}),
      }),
    });
    if (!putRes.ok) throw new Error(`推送失败：HTTP ${putRes.status} ${(await putRes.text()).slice(0, 200)}`);
    setStatus('✅ 已推送到 GitHub，Pages 稍后自动更新。');
  } catch (err) {
    setStatus(String(err.message || err), true);
  }
}

/* ================= UI 小件 ================= */
function setStatus(text, isErr = false) {
  const el = $('#save-status');
  el.textContent = text;
  el.classList.toggle('err', isErr);
}

function markDirty() {
  setStatus('● 有未保存的修改（导出或推送后生效）');
}

function closeDialog(sel) {
  $(sel).hidden = true;
  if (sel === '#hotspot-dialog') {
    state.editingHsId = null;
    state.pendingPos = null;
    state.relocatingId = null;
    $('#hs-relocate').textContent = '📍 重新定位';
    renderHotspotList();
  }
}

function renderAll() {
  renderSceneList();
  renderHotspotList();
}

/* ================= 启动 ================= */
async function boot() {
  if (matchMedia('(max-width: 900px)').matches) {
    document.body.classList.add('is-mobile');
  }

  try {
    [state.project, state.panoIndex] = await Promise.all([
      loadJSON('project.json'),
      loadJSON('panoramas/index.json'),
    ]);
  } catch (err) {
    setStatus(`加载 project.json 失败：${err.message}`, true);
    return;
  }

  const startId = sceneById(state.project.defaultScene) ? state.project.defaultScene : state.project.scenes[0]?.id;
  try {
    state.psv = await createPSV($('#editor-panorama'), state.project, {
      startNodeId: startId,
      autorotate: false,
      gyroscope: false,
      navbar: ['zoom', 'fullscreen'],
    });
  } catch (err) {
    setStatus(`创建查看器失败：${err.message}`, true);
    return;
  }

  state.currentId = startId;
  renderAll();

  state.psv.viewer.addEventListener('ready', refreshMarkers, { once: true });

  // 点击全景：添加模式取坐标；重新定位模式更新坐标
  // PSV5 的 click 事件坐标在 e.data.yaw / e.data.pitch（弧度）
  state.psv.viewer.addEventListener('click', (e) => {
    const d = e.data || {};
    if (typeof d.yaw !== 'number' || d.rightclick) return;
    const pos = { yaw: round2(rad2deg(d.yaw)), pitch: round2(rad2deg(d.pitch)) };

    if (state.relocatingId) {
      const s = currentScene();
      const hs = s && (s.hotspots || []).find((h) => h.id === state.relocatingId);
      if (hs) {
        hs.yaw = pos.yaw;
        hs.pitch = pos.pitch;
        markDirty();
        refreshMarkers();
      }
      state.relocatingId = null;
      $('#hs-relocate').textContent = '📍 重新定位';
      $('#mode-banner').hidden = true;
      return;
    }
    if (state.addMode) {
      state.pendingPos = pos;
      openHotspotDialog(null);
    }
  });

  // 点击已有热点（点在 marker 上时 click 事件不带 position，单独处理 select-marker）
  state.psv.markers.addEventListener('select-marker', (e) => {
    const hsId = markerToHsId(e.marker.id);
    if (hsId) openHotspotDialog(hsId);
  });

  state.psv.tour.addEventListener('node-changed', (e) => {
    if (!sceneById(e.node.id)) return;
    state.currentId = e.node.id;
    renderAll();
    refreshMarkers();
    const s = currentScene();
    const v = s.initialView || { yaw: 0, pitch: 0 };
    Promise.resolve(state.psv.viewer.animate({ yaw: deg2rad(v.yaw), pitch: deg2rad(v.pitch), speed: 900 })).catch(() => {});
  });

  wireUI();
}

function markerToHsId(markerId) {
  return markerId && markerId.startsWith('hs-') ? markerId.slice(3) : null;
}

function wireUI() {
  $('#btn-add-scene').addEventListener('click', openSceneDialog);
  $('#btn-add-mode').addEventListener('click', toggleAddMode);
  $('#btn-set-view').addEventListener('click', setInitialView);
  $('#btn-export').addEventListener('click', exportProject);
  $('#btn-gh-toggle').addEventListener('click', () => {
    const box = $('#gh-box');
    box.hidden = !box.hidden;
    if (!box.hidden) {
      $('#gh-repo').value = localStorage.getItem('pano_gh_repo') || '';
      $('#gh-branch').value = localStorage.getItem('pano_gh_branch') || 'main';
      $('#gh-token').value = localStorage.getItem('pano_gh_token') || '';
    }
  });
  ['gh-repo', 'gh-branch', 'gh-token'].forEach((id) => {
    $(`#${id}`).addEventListener('change', (e) => {
      localStorage.setItem(`pano_gh_${id.replace('gh-', '')}`, e.target.value);
    });
  });
  $('#btn-gh-save').addEventListener('click', saveToGitHub);

  $('#hotspot-form').addEventListener('submit', saveHotspotForm);
  $('#scene-form').addEventListener('submit', saveSceneForm);
  $('#hs-relocate').addEventListener('click', () => {
    if (state.relocatingId) return;
    const hsId = state.editingHsId;
    if (hsId) {
      closeDialog('#hotspot-dialog');
      state.relocatingId = hsId; // closeDialog 会重置 relocatingId，须在其后赋值
      $('#mode-banner').textContent = '重新定位：在全景上点击热点的新位置';
      $('#mode-banner').hidden = false;
      setTimeout(() => {
        if (state.relocatingId) {
          $('#mode-banner').textContent = '添加热点模式：点击全景图上要放热点的位置';
        }
      }, 6000);
    }
  });
  $('#hotspot-dialog').querySelector('.btn-danger')?.addEventListener('click', () => deleteHotspot(state.editingHsId));

  document.querySelectorAll('[data-close]').forEach((btn) => {
    btn.addEventListener('click', () => closeDialog(`#${btn.closest('.dialog-mask').id}`));
  });
  document.querySelectorAll('.dialog-mask').forEach((mask) => {
    mask.addEventListener('click', (e) => {
      if (e.target === mask) closeDialog(`#${mask.id}`);
    });
  });
}

boot();
