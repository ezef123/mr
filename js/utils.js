/* =========================================================================
   Утилиты: DOM, экранирование, хеши, время, тосты, аватары.
   ========================================================================= */

const $ = (s) => document.querySelector(s);

/** Экранирование HTML */
function esc(v){
  return String(v == null ? '' : v).replace(/[&<>"']/g, c => (
    { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]
  ));
}

/** Детерминированный цвет аватара из строки */
function hashHue(str){
  let h = 0;
  for (let i = 0; i < String(str).length; i++) h = (h * 31 + String(str).charCodeAt(i)) >>> 0;
  return h % 360;
}

/* ВНИМАНИЕ: это НЕ криптостойкий хеш. Только чтобы пароли не лежали
   в базе открытым текстом. Для продакшена используйте Firebase Auth. */
function hashPass(s){
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++){
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return 'fnv1a:' + h.toString(16) + ':' + s.length;
}

/** Относительное время ("5 мин назад") */
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

/** Превращает экранированный текст в кликабельные ссылки и @упоминания */
function linkify(escapedText){
  return escapedText
    .replace(/(https?:\/\/[^\s]+)/g,
      '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/(^|\s)@([a-zA-Z0-9_]{3,20})/g,
      '$1<a href="#" data-action="open-username" data-username="$2">@$2</a>');
}

/** Всплывающее сообщение */
let toastTimer = null;
function toast(msg){
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}

/** HTML аватара (картинка или буква в цветном круге) */
function avatarHtml(user, cls){
  const name = (user && (user.displayName || user.username)) || '?';
  if (user && user.avatar){
    return `<img class="avatar ${cls}" src="${esc(user.avatar)}" alt="" onerror="this.style.display='none'">`;
  }
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  const hue = hashHue((user && (user.uid || user.username)) || name);
  return `<div class="avatar ${cls}" style="background:hsl(${hue} 58% 40%)">${esc(initial)}</div>`;
}

/** Текущий пользователь из state (используется после загрузки) */
function myUser(){
  return (typeof state !== 'undefined' && (state.users[meUid] || state.me)) || {};
}
