// 共享工具：加载 project.json、度/弧转换、Photo Sphere Viewer 工厂函数
// 项目约定：project.json 里所有角度一律存"度"，传入 PSV 前转弧度。

export const PSV_LANG = {
  zoom: '缩放',
  zoomOut: '缩小',
  zoomIn: '放大',
  moveUp: '向上移动',
  moveDown: '向下移动',
  moveLeft: '向左移动',
  moveRight: '向右移动',
  fullscreen: '全屏',
  fullscreenExit: '退出全屏',
  loading: '加载中…',
  menu: '菜单',
  close: '关闭',
  twoFingers: '请用双指操作',
  ctrlZoom: '按住 Ctrl + 滚轮缩放',
  loadError: '全景图加载失败',
  webglError: '当前浏览器不支持 WebGL',
  gyroscope: '陀螺仪',
};

export function deg2rad(d) {
  return (Number(d) || 0) * Math.PI / 180;
}

export function rad2deg(r) {
  return (Number(r) || 0) * 180 / Math.PI;
}

export function round2(n) {
  return Math.round(n * 100) / 100;
}

// 带缓存穿透的 JSON 加载（编辑器改完导出后重载需要）
export async function loadJSON(url, bust = false) {
  const full = bust ? `${url}?_=${Date.now()}` : url;
  const res = await fetch(full, { cache: 'no-store' });
  if (!res.ok) throw new Error(`加载 ${url} 失败：HTTP ${res.status}`);
  return res.json();
}

// project.json 场景 -> VirtualTourPlugin 节点
export function buildNodes(project) {
  return project.scenes.map((s) => ({
    id: s.id,
    name: s.name,
    caption: s.name,
    panorama: encodeURI(s.panorama),
    thumbnail: s.thumbnail ? encodeURI(s.thumbnail) : undefined,
  }));
}

/**
 * 创建查看器（index 与 editor 共用）。
 * 不传 panorama：由 VirtualTourPlugin 通过 nodes + startNodeId 起始。
 * 返回 { viewer, tour, markers, autorotate }。
 */
export async function createPSV(container, project, {
  startNodeId,
  autorotate = true,
  gyroscope = true,
  navbar = null,
} = {}) {
  const [
    { Viewer },
    { VirtualTourPlugin },
    { MarkersPlugin },
    { AutorotatePlugin },
    { GyroscopePlugin },
  ] = await Promise.all([
    import('@photo-sphere-viewer/core'),
    import('@photo-sphere-viewer/virtual-tour'),
    import('@photo-sphere-viewer/markers'),
    import('@photo-sphere-viewer/autorotate'),
    import('@photo-sphere-viewer/gyroscope'),
  ]);

  const plugins = [
    [VirtualTourPlugin, {
      // 手动布点模式：节点间不靠 GPS 定位，热点位置完全由编辑器标注决定
      positionMode: 'manual',
      startNodeId: startNodeId || project.defaultScene || (project.scenes[0] && project.scenes[0].id),
    }],
    [MarkersPlugin, {}],
  ];
  if (autorotate) plugins.push([AutorotatePlugin, { autostartDelay: 3000, autostartOnIdle: true, autorotateSpeed: '0.5rpm' }]);
  if (gyroscope) plugins.push([GyroscopePlugin, {}]);

  const viewer = new Viewer({
    container,
    panorama: null,
    caption: project.title || '',
    navbar: navbar || ['zoom', 'move', 'gyroscope', 'fullscreen', 'caption'],
    lang: { ...PSV_LANG },
    // 单指滑动旋转视角，双指捏合缩放（720云手感）
    touchmoveTwoFingers: false,
    moveSpeed: 1.2,
    plugins,
  });

  const tour = viewer.getPlugin(VirtualTourPlugin);
  const markers = viewer.getPlugin(MarkersPlugin);
  const autorotatePlugin = autorotate ? viewer.getPlugin(AutorotatePlugin) : null;
  // 喂入节点：VirtualTourPlugin 依据 startNodeId 自动加载起始场景
  tour.setNodes(buildNodes(project));
  return { viewer, tour, markers, autorotatePlugin };
}

// 把某个场景的热点转成 PSV markers（箭头跳转热点，样式在 style.css）
export function hotspotsToMarkers(project, scene) {
  const byId = new Map(project.scenes.map((s) => [s.id, s]));
  return (scene.hotspots || []).map((h) => {
    const target = byId.get(h.target);
    const label = h.label || (target ? target.name : h.target);
    return {
      id: hotspotMarkerId(h.id),
      position: { yaw: deg2rad(h.yaw), pitch: deg2rad(h.pitch) },
      html: `<div class="hotspot-dot"><span class="hotspot-arrow"></span></div>`,
      size: { width: 56, height: 56 },
      anchor: 'center center',
      tooltip: { content: `${label} · 点击进入`, position: 'top' },
    };
  });
}

export function hotspotMarkerId(hotspotId) {
  return `hs-${hotspotId}`;
}

export function download(filename, text) {
  const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
