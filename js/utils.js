/* =========================================================================
   Утилиты: DOM, экранирование, хеши (цвета), время, тосты, аватары, бейджи.
   ========================================================================= */

const $ = (s) => document.querySelector(s);

function esc(v){
  return String(v == null ? '' : v).replace(/[&<>"']/g, c => (
    { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]
  ));
}

function hashHue(str){
  let h = 0;
  for (let i = 0; i < String(str).length; i++) h = (h * 31 + String(str).charCodeAt(i)) >>> 0;
  return h % 360;
}

function timeAgo(ts){
  if (!ts) return '';
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 5) return 'только что';
  if (s < 60) return s + ' сек назад';
  const m = Math.floor(s / 60);
  if (m < 60) return m + ' мин назад';
  const h = Math.floor(m / 60);
  if (h < 24) return h + ' ч назад';
  const d = Math.floor(h / 24);
  if (d < 7) return d + ' дн назад';
  return new Date(ts).toLocaleDateString('ru-RU');
}

function linkify(escapedText){
  return escapedText
    .replace(/(https?:\/\/[^\s]+)/g,
      '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/(^|\s)@([a-zA-Z0-9_]{3,20})/g,
      '$1<a href="#" data-action="open-username" data-username="$2">@$2</a>');
}

let toastTimer = null;
function toast(msg){
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}

function avatarHtml(user, cls){
  const name = (user && (user.displayName || user.username)) || '?';
  if (user && user.avatar){
    return `<img class="avatar ${cls}" src="${esc(user.avatar)}" alt="" onerror="this.style.display='none'">`;
  }
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  const hue = hashHue((user && (user.uid || user.username)) || name);
  return `<div class="avatar ${cls}" style="background:hsl(${hue} 58% 40%)">${esc(initial)}</div>`;
}

function myUser(){
  return (typeof state !== 'undefined' && (state.users[meUid] || state.me)) || {};
}

function firebaseErrorRu(err){
  const code = (err && err.code) || '';
  const map = {
    'auth/invalid-email':          'Некорректный email',
    'auth/user-disabled':          'Аккаунт заблокирован',
    'auth/user-not-found':         'Пользователь с таким email не найден',
    'auth/wrong-password':         'Неверный пароль',
    'auth/invalid-credential':     'Неверный email или пароль',
    'auth/invalid-login-credentials': 'Неверный email или пароль',
    'auth/email-already-in-use':   'Этот email уже используется',
    'auth/weak-password':          'Пароль слишком слабый (минимум 6 символов)',
    'auth/too-many-requests':      'Слишком много попыток, попробуйте позже',
    'auth/network-request-failed': 'Нет соединения с Firebase',
    'auth/operation-not-allowed':  'Включите вход по Email/Password в Firebase Console',
    'auth/requires-recent-login':  'Требуется повторный вход'
  };
  return map[code] || (err && err.message) || 'Неизвестная ошибка';
}

/** SVG-галочка для подтверждённых аккаунтов */
function verifiedBadge(user){
  if (!user || user.verified !== true) return '';
  return `<svg class="verified-badge" viewBox="0 0 24 24" aria-label="Подтверждённый аккаунт">
    <path fill="#1d9bf0" d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81C14.67 2.63 13.43 1.75 12 1.75s-2.67.88-3.34 2.19c-1.39-.46-2.9-.2-3.91.81s-1.27 2.52-.81 3.91C2.63 9.33 1.75 10.57 1.75 12s.88 2.67 2.19 3.34c-.46 1.39-.2 2.9.81 3.91s2.52 1.27 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.67-.88 3.34-2.19c1.39.46 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34zm-11.71 4.2L6.8 12.46l1.41-1.42 2.26 2.26 4.8-5.23 1.47 1.36-6.2 6.77z"/>
  </svg>`;
}

/** Детерминированный ID чата: uidA__uidB (по алфавиту) */
function chatIdFor(a, b){
  return [a, b].sort().join('__');
}
