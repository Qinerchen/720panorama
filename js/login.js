// 登录页逻辑：校验密码 -> 记住本机 -> 回跳目标页
import { checkPassword, markAuthed } from './auth.js';

const form = document.getElementById('login-form');
const pwd = document.getElementById('pwd');
const err = document.getElementById('login-err');
const btn = document.getElementById('login-btn');

// 已登录过直接进
if (localStorage.getItem('pano_auth_v1') === 'ok') {
  location.replace(safeNext());
}

function safeNext() {
  const next = new URLSearchParams(location.search).get('next') || 'index.html';
  // 只允许站内页面，防开放跳转
  return /^[a-z0-9_-]+\.html$/i.test(next) ? next : 'index.html';
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  btn.disabled = true;
  btn.textContent = '验证中…';
  const ok = await checkPassword(pwd.value.trim());
  if (ok) {
    markAuthed();
    location.replace(safeNext());
  } else {
    err.textContent = '密码不对，再试试';
    err.hidden = false;
    pwd.value = '';
    pwd.focus();
    btn.disabled = false;
    btn.textContent = '进 入';
  }
});
