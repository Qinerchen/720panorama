# 我的全景漫游 · 个人版 720云

纯静态（零构建、零后端）的多场景全景漫游网站，风格类似 720云。

- **在线访问**：<https://qinerchen.github.io/720panorama/>（访问密码见下方"密码门"）
- **查看器** index.html：等距圆柱全景渲染、热点跳转切换场景、底部缩略图切换条、URL 深链、自动旋转、手机陀螺仪
- **编辑器** editor.html（仅 PC）：添加/重命名/删除场景、标注热点、设置初始视角、导出或直接推送 `project.json` 到 GitHub

技术栈：[Photo Sphere Viewer 5.15.1](https://photo-sphere-viewer.js.org/) + three.js，全部依赖已下载到 `vendor/`，通过 importmap 引用，**不需要 npm / 打包**。

## 零、密码门

全站（含编辑器）有访问密码，输入一次后该设备永久记住，之后无需再登录：

- 当前密码：`714225`
- 手机端、电脑端通用；换设备/清浏览器数据后需重新输一次
- 密码在 `js/auth.js` 里以 SHA-256 哈希存放（源码无明文）。**要改密码**：浏览器控制台执行
  `crypto.subtle.digest('SHA-256', new TextEncoder().encode('新密码')).then(b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2,'0')).join(''))`
  把输出的哈希替换掉 `js/auth.js` 里的 `PASSWORD_SHA256` 即可
- 注意：纯静态网站没有服务端，这是"防路人"级别的门禁，懂技术的人仍可能绕过；介意的话需要换成带后端的方案

## 仓库说明

本项目同时放在两个 GitHub 仓库：

| 仓库 | 可见性 | 用途 |
|---|---|---|
| [Qinerchen/720panorama](https://github.com/Qinerchen/720panorama) | 公开 | GitHub Pages 发布，改动推送后 1~2 分钟自动上线 |
| [Qinerchen/720panorama-src](https://github.com/Qinerchen/720panorama-src) | 私有 | 项目源码备份，以后修改用 |

本地目录已配置好两个远端，日常改完代码后一次同步两个仓库：

```bash
git add .
git commit -m "说明改动"
git push origin main   # 推到 Pages 仓库（自动重新部署）
git push src main      # 推到源码备份仓库
```

---

## 一、本地预览

ESM 模块和 `fetch` 都不能在 `file://` 协议下工作，**必须走 HTTP 服务**。

**最简单：双击项目里的 `启动.bat`** —— 自动起服务并打开浏览器，关掉窗口即停止。

或者手动执行（需要 Python 3）：

```bash
# 在项目根目录执行
python -m http.server 8000
```

浏览器打开 <http://localhost:8000> 查看漫游，<http://localhost:8000/editor.html> 打开编辑器。

## 二、部署到 GitHub Pages

### 方法 A：网页上传（无需命令行）

1. 登录 GitHub，新建一个仓库（公开仓库才能免费用 Pages）。
2. 仓库页 → **Add file → Upload files**，把本项目全部内容拖进去（`.gitignore` 里列的目录除外，见下）→ Commit。
3. 仓库 → **Settings → Pages** → Branch 选 `main` / `/ (root)` → Save。
4. 等 1~2 分钟，访问 `https://你的用户名.github.io/仓库名/`。

注意上传时包含 `.nojekyll` 这个空文件（GitHub 用它跳过 Jekyll 处理，否则下划线开头的目录会被忽略）。

### 方法 B：git 命令

```bash
cd 本项目目录
git init
git add .
git commit -m "init: 个人全景漫游"
git branch -M main
git remote add origin https://github.com/你的用户名/仓库名.git
git push -u origin main
```

然后同样去 **Settings → Pages** 开启 Pages（`main` / root）。

之后每次修改（包括编辑器推送的 `project.json`）推上去即可自动更新。手机陀螺仪功能**必须 HTTPS**（GitHub Pages 自带），本地 `http://localhost` 上陀螺仪不可用属正常现象。

提示：在线版使用时，编辑器"☁ 保存到 GitHub"里填 `Qinerchen/720panorama`、分支 `main`，即可在手机/其他电脑上改完热点直接推送上线。

## 三、编辑器用法

1. 打开 `editor.html`（电脑浏览器）。
2. **左上场景列表**：点名称可直接改名；`☆/★` 设为默认场景（打开首页先看哪间）；`✕` 删除场景（指向它的热点会一并删除）。
3. **添加场景**：`＋ 添加场景`，下拉框列出 `panoramas/` 里还没用过的图；填中文名称和英文 ID。
4. **添加热点**：先在左侧点选一个场景 → 点 `🎯 添加热点模式` → 在全景上点击门口位置 → 弹窗里选目标场景、填标签 → 保存。热点是双向的：记得去对面场景也放一个指回来的。
5. **编辑热点**：直接点全景上的热点（或左侧热点列表），弹窗里可改目标/标签、`📍 重新定位`（保存后点击全景新位置）、`🗑 删除`。
6. **初始视角**：把视角转到想让人一进场景就看到的方向（一般是门口），点 `🧭 设为初始视角`。
7. **保存**：
   - `⬇ 下载 project.json`：手动替换项目里的同名文件（本地预览时把它覆盖到根目录即可生效）；
   - `☁ 保存到 GitHub`：填 `用户名/仓库`、分支、GitHub Token（需要 repo 权限，仅存本机 localStorage），一键推送，Pages 稍后自动更新。
8. 所有修改先存在内存里，`● 有未保存的修改` 提示未导出时关页面会丢。

## 四、加一张新全景图

1. 把新的 2:1 等距圆柱全景 JPG 放进 `全景图/`。
2. 运行压缩脚本（生成 4096×2048 的 `panoramas/` 版本和 `thumbnails/` 缩略图）：

   ```bash
   python tools/图片优化.py
   ```

3. 打开 `editor.html` → `＋ 添加场景`，下拉框里会自动出现新图，选中、命名、保存。
4. 给相邻场景互相加热点，导出 `project.json`。

## 五、目录结构

```
├── index.html          查看器
├── editor.html         编辑器（仅 PC）
├── 启动.bat            双击启动本地服务并打开浏览器
├── js/
│   ├── common.js       共享：加载配置、度/弧转换、PSV 工厂
│   ├── viewer.js       查看器逻辑
│   └── editor.js       编辑器逻辑
├── style.css           暗色主题
├── project.json        漫游配置（场景、热点、初始视角；角度存"度"）
├── panoramas/          压缩后的全景图（4096×2048）+ index.json 文件清单
├── thumbnails/         场景切换条缩略图（384×192）
├── vendor/             PSV 5.15.1 + three 0.185.1 本地依赖（importmap 映射）
├── tools/图片优化.py   原图压缩脚本
├── 全景图/             原始 8000×4000 素材（约 41MB，不进仓库）
└── .nojekyll           GitHub Pages 必需的空文件
```

## 六、URL 深链

- `index.html#scene=living-room` 直接打开客厅；热点/切换条跳转时会自动更新 hash，可复制链接分享。

## 七、常见问题

- **页面黑屏 / 控制台报 `fetch` 错误**：没有用 HTTP 服务打开（直接双击 html 了），回到"本地预览"一节。
- **手机上陀螺仪按钮没反应**：需要 HTTPS；iOS 还会弹授权框，允许即可。
- **热点位置不对**：编辑器里选中热点 → `📍 重新定位` → 点击正确位置。
- **改了 project.json 不生效**：浏览器缓存，强制刷新（Ctrl+F5）。
