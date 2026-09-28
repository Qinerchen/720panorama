// 访问密码门：输入正确密码后本机记住，之后无需再登录
// 说明：纯静态网站没有服务端，这是"防路人"级别的门禁——
// 密码以 SHA-256 哈希存放，源码中不含明文；懂技术的人仍可能绕过。

const AUTH_KEY = 'pano_auth_v1';
// SHA-256('714225')，改密码时替换此值（可用浏览器控制台算：
// crypto.subtle.digest('SHA-256', new TextEncoder().encode('新密码')) 后转 hex）
const PASSWORD_SHA256 = '2590ba60e16a0e09b0ad25352f515cfcef09963aa531a24b59f035ecc5cc0f83';

export function isAuthed() {
  try {
    return localStorage.getItem(AUTH_KEY) === 'ok';
  } catch {
    return false; // 隐私模式下 localStorage 可能不可用，则每次都需登录
  }
}

export function markAuthed() {
  try {
    localStorage.setItem(AUTH_KEY, 'ok');
  } catch { /* 忽略 */ }
}

// 页面守卫：未登录则跳到登录页（带回跳地址）
export function requireAuth() {
  if (isAuthed()) return true;
  const next = encodeURIComponent(location.pathname.split('/').pop() || 'index.html');
  location.replace(`login.html?next=${next}`);
  return false;
}

export async function checkPassword(input) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  const hex = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return hex === PASSWORD_SHA256;
}
