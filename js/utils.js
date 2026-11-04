/* =========================================================================
   Утилиты: DOM, экранирование, хеши (цвета), время, тосты, аватары.
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

/* Перевод ошибок Firebase Auth на русский */
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
