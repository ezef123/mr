/* =========================================================================
   МОЯ РЕСПУБЛИКА — основная логика: авторизация, состояние,
   рендер, обработчики, публикация.
   ========================================================================= */

/* ------------------------- Состояние ------------------------- */
const SESSION_KEY = 'morep.uid';
let meUid = localStorage.getItem(SESSION_KEY) || null;

const state = {
  me: null,
  users: {},
  posts: {},
  view: 'feed',
  profileUid: null,
  editing: false,
  feedTab: 'all',
  openComments: {},
  commentDrafts: {},
  search: ''
};

/* ------------------------- Авторизация ------------------------- */
function authError(msg){
  $('#authError').textContent = msg || '';
}

document.querySelectorAll('[data-authtab]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-authtab]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const isLogin = btn.dataset.authtab === 'login';
    $('#loginForm').classList.toggle('hidden', !isLogin);
    $('#registerForm').classList.toggle('hidden', isLogin);
    authError('');
  });
});

$('#loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  authError('');
  const username = $('#loginUser').value.trim().toLowerCase();
  const pass = $('#loginPass').value;
  if (!username || !pass) return authError('Заполните все поля');

  try {
    const nameSnap = await db.ref('usernames/' + username).get();
    if (!nameSnap.exists()) return authError('Пользователь не найден');

    const uid = nameSnap.val();
    const secSnap = await db.ref('secrets/' + uid).get();
    if (!secSnap.exists() || secSnap.val().pass !== hashPass(pass))
      return authError('Неверный пароль');

    meUid = uid;
    localStorage.setItem(SESSION_KEY, uid);
    await startApp();
  } catch (err){
    console.error(err);
    authError('Ошибка соединения с Республикой: ' + (err.message || err));
  }
});

$('#registerForm').addEventListener('submit', async e => {
  e.preventDefault();
  authError('');
  const displayName = $('#regName').value.trim();
  const usernameRaw = $('#regUser').value.trim();
  const pass = $('#regPass').value;

  if (displayName.length < 2) return authError('Слишком короткое имя');
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(usernameRaw))
    return authError('Никнейм: 3–20 символов, латиница/цифры/подчёркивание');
  if (pass.length < 4) return authError('Пароль минимум 4 символа');

  const username = usernameRaw.toLowerCase();

  try {
    const nameSnap = await db.ref('usernames/' + username).get();
    if (nameSnap.exists()) return authError('Этот никнейм уже занят');

    const uid = db.ref('users').push().key;
    const updates = {};
    updates['users/' + uid] = {
      uid,
      username: usernameRaw,
      usernameLower: username,
      displayName,
      bio: '',
      avatar: '',
      createdAt: Date.now(),
      following: null
    };
    updates['secrets/' + uid] = { pass: hashPass(pass) };
    updates['usernames/' + username] = uid;

    await db.ref().update(updates);

    meUid = uid;
    localStorage.setItem(SESSION_KEY, uid);
    await startApp();
    toast('Добро пожаловать в Республику Жакид! 🏛');
  } catch (err){
    console.error(err);
    authError('Ошибка соединения с Республикой: ' + (err.message || err));
  }
});

/* ------------------------- Запуск ------------------------- */
let listenersAttached = false;

async function startApp(){
  $('#authScreen').classList.add('hidden');
  $('#app').classList.remove('hidden');

  const snap = await db.ref('users/' + meUid).get();
  if (!snap.exists()){ logout(); return; }

  state.me = snap.val();
  state.users[meUid] = state.me;
  if (!state.profileUid) state.profileUid = meUid;

  attachListeners();
  render();
}

function attachListeners(){
  if (listenersAttached) return;
  listenersAttached = true;

  db.ref('users').on('value',
    s => { state.users = s.val() || {}; render(); },
    err => { console.error(err); toast('Нет доступа к базе. Проверьте правила Firebase.'); }
  );

  db.ref('posts').limitToLast(200).on('value',
    s => { state.posts = s.val() || {}; render(); },
    err => { console.error(err); toast('Не удалось загрузить ленту'); }
  );
}

function logout(){
  localStorage.removeItem(SESSION_KEY);
  location.reload();
}

/* ------------------------- Рендер ------------------------- */
function render(){
  if (!meUid) return;
  const me = state.users[meUid];
  if (!me) return;
  state.me = me;

  $('#userCard').innerHTML = `
    <div class="user-card-inner" data-action="open-profile" data-uid="${esc(meUid)}">
      ${avatarHtml(me, 'avatar-sm')}
      <div style="min-width:0">
        <div class="name" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(me.displayName)}</div>
        <div class="handle">@${esc(me.username)}</div>
      </div>
    </div>`;

  const ca = $('#composerAvatar');
  if (ca) ca.innerHTML = avatarHtml(me, 'avatar-md');

  document.querySelectorAll('.nav-item').forEach(a =>
    a.classList.toggle('active', a.dataset.view === state.view)
  );

  const views = { feed: '#viewFeed', profile: '#viewProfile', people: '#viewPeople', notifications: '#viewNotifications' };
  Object.entries(views).forEach(([k, sel]) =>
    $(sel).classList.toggle('hidden', state.view !== k)
  );

  if (state.view === 'feed') renderFeedList();
  if (state.view === 'profile') renderProfile();
  if (state.view === 'people') renderPeople();
  if (state.view === 'notifications') renderNotifications();

  renderRight();
}

/* ---------- Лента ---------- */
function sortedPosts(){
  return Object.values(state.posts).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

function isFollowing(uid){
  const me = myUser();
  return !!(me.following && me.following[uid]);
}

function renderFeedList(){
  const list = $('#feedList');
  if (!list) return;

  document.querySelectorAll('[data-action="feed-tab"]').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === state.feedTab)
  );

  let posts = sortedPosts();
  if (state.feedTab === 'following'){
    posts = posts.filter(p => p.author === meUid || isFollowing(p.author));
  }

  if (!posts.length){
    list.innerHTML = `<div class="empty panel">Пока пусто. Опубликуйте первую запись Республики! 🏛</div>`;
    return;
  }
  list.innerHTML = posts.map(postCardHTML).join('');
}

function postCardHTML(p){
  const author = state.users[p.author] || {
    uid: p.author, displayName: 'Гражданин', username: 'unknown'
  };
  const likes = p.likes || {};
  const likeCount = Object.keys(likes).length;
  const liked = !!likes[meUid];
  const comments = p.comments ? Object.values(p.comments).sort((a, b) => a.createdAt - b.createdAt) : [];
  const open = !!state.openComments[p.id];
  const mine = p.author === meUid;

  return `
  <article class="post panel">
    <div class="post-head">
      <div class="clickable" data-action="open-profile" data-uid="${esc(p.author)}">${avatarHtml(author, 'avatar-md')}</div>
      <div class="post-meta">
        <div class="name clickable" data-action="open-profile" data-uid="${esc(p.author)}">${esc(author.displayName)}</div>
        <div class="handle">@${esc(author.username)} · ${timeAgo(p.createdAt)}</div>
      </div>
      ${mine ? `<button class="icon-btn" data-action="delete-post" data-id="${esc(p.id)}" title="Удалить запись">🗑</button>` : ''}
    </div>

    ${p.text ? `<div class="post-text">${linkify(esc(p.text))}</div>` : ''}
    ${p.image ? `<img class="post-image" src="${esc(p.image)}" alt="" loading="lazy" onerror="this.style.display='none'">` : ''}

    <div class="post-actions">
      <button class="act ${liked ? 'liked' : ''}" data-action="like" data-id="${esc(p.id)}">
        ${liked ? '❤️' : '🤍'} ${likeCount}
      </button>
      <button class="act" data-action="toggle-comments" data-id="${esc(p.id)}">💬 ${comments.length}</button>
      <button class="act" data-action="copy-link" data-id="${esc(p.id)}">🔗</button>
    </div>

    ${open ? commentsHTML(p, comments) : ''}
  </article>`;
}

function commentsHTML(p, comments){
  const rows = comments.map(c => {
    const a = state.users[c.author] || { displayName: 'Гражданин', username: 'unknown' };
    return `
      <div class="comment">
        ${avatarHtml(a, 'avatar-xs')}
        <div class="comment-body">
          <div class="comment-head">
            <b class="clickable" data-action="open-profile" data-uid="${esc(c.author)}">${esc(a.displayName)}</b>
            <span>@${esc(a.username)} · ${timeAgo(c.createdAt)}</span>
          </div>
          <div>${linkify(esc(c.text))}</div>
        </div>
      </div>`;
  }).join('') || `<div class="muted small">Пока нет комментариев</div>`;

  return `
  <div class="comments">
    ${rows}
    <div class="comment-form">
      <input id="comment-${esc(p.id)}" data-draft="${esc(p.id)}"
             placeholder="Написать комментарий..." maxlength="500"
             value="${esc(state.commentDrafts[p.id] || '')}">
      <button class="btn primary sm" data-action="send-comment" data-id="${esc(p.id)}">→</button>
    </div>
  </div>`;
}

/* ---------- Профиль ---------- */
function renderProfile(){
  const wrap = $('#viewProfile');
  const uid = state.profileUid || meUid;
  const u = state.users[uid];

  if (!u){
    wrap.innerHTML = `<div class="empty panel">Гражданин не найден</div>`;
    return;
  }

  const isMe = uid === meUid;
  const followers = Object.values(state.users).filter(x => x.following && x.following[uid]).length;
  const posts = sortedPosts().filter(p => p.author === uid);

  if (isMe && state.editing){
    wrap.innerHTML = `
      <div class="panel">
        <h2>Редактировать профиль</h2>
        <div class="field"><label>Имя</label>
          <input id="editName" maxlength="40" value="${esc(u.displayName)}"></div>
        <div class="field"><label>О себе</label>
          <textarea id="editBio" maxlength="300" placeholder="Расскажите о себе...">${esc(u.bio || '')}</textarea></div>
        <div class="field"><label>Ссылка на аватар</label>
          <input id="editAvatar" placeholder="https://..." value="${esc(u.avatar || '')}"></div>
        <div style="display:flex;gap:8px">
          <button class="btn primary" data-action="save-profile">Сохранить</button>
          <button class="btn ghost" data-action="cancel-edit">Отмена</button>
        </div>
      </div>`;
    return;
  }

  const followBtn = isMe ? '' : `
    <button class="btn ${isFollowing(uid) ? 'ghost' : 'primary'}"
            data-action="follow" data-uid="${esc(uid)}">
      ${isFollowing(uid) ? 'Отписаться' : 'Подписаться'}
    </button>`;

  wrap.innerHTML = `
    <div class="profile-head panel">
      <div class="profile-cover"></div>
      <div class="profile-body">
        ${avatarHtml(u, 'avatar-xl')}
        <div class="profile-info">
          <h2>${esc(u.displayName)}</h2>
          <div class="handle">@${esc(u.username)}${isMe ? ' · это вы' : ''}</div>
          <div class="bio">${u.bio ? esc(u.bio) : '<span class="muted">Без описания</span>'}</div>
          <div class="stats">
            <div><b>${posts.length}</b> записей</div>
            <div><b>${followers}</b> подписчиков</div>
            <div><b>${Object.keys(u.following || {}).length}</b> подписок</div>
          </div>
        </div>
        <div class="profile-actions">
          ${isMe ? '<button class="btn ghost" data-action="edit-profile">Редактировать</button>' : followBtn}
        </div>
      </div>
    </div>
    <div>${posts.length
      ? posts.map(postCardHTML).join('')
      : '<div class="empty panel">Здесь пока нет записей</div>'}</div>`;
}

/* ---------- Люди ---------- */
function renderPeople(){
  const wrap = $('#viewPeople');
  wrap.innerHTML = `
    <div class="panel">
      <h2>Граждане Республики</h2>
      <input id="peopleSearch" class="search" placeholder="Поиск по имени или никнейму"
             value="${esc(state.search)}">
    </div>
    <div id="peopleList" class="people-list"></div>`;
  renderPeopleList();
}

function renderPeopleList(){
  const box = $('#peopleList');
  if (!box) return;
  const q = state.search.trim().toLowerCase();

  const users = Object.values(state.users)
    .filter(u => u.uid !== meUid)
    .filter(u => !q
      || (u.displayName || '').toLowerCase().includes(q)
      || (u.username || '').toLowerCase().includes(q))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  if (!users.length){
    box.innerHTML = `<div class="empty panel">Никого не найдено</div>`;
    return;
  }

  box.innerHTML = users.map(u => {
    const f = isFollowing(u.uid);
    return `
      <div class="people-row">
        ${avatarHtml(u, 'avatar-md')}
        <div class="info" data-action="open-profile" data-uid="${esc(u.uid)}">
          <div class="name">${esc(u.displayName)}</div>
          <div class="handle">@${esc(u.username)}${u.bio ? ' · ' + esc(u.bio.slice(0, 50)) : ''}</div>
        </div>
        <button class="btn sm ${f ? 'ghost' : 'primary'}" data-action="follow" data-uid="${esc(u.uid)}">
          ${f ? 'Отписаться' : 'Читать'}
        </button>
      </div>`;
  }).join('');
}

/* ---------- Уведомления ---------- */
function renderNotifications(){
  const items = [];

  Object.values(state.posts).forEach(p => {
    if (p.author !== meUid) return;

    Object.entries(p.likes || {}).forEach(([uid, ts]) => {
      if (uid !== meUid) items.push({ type: 'like', from: uid, post: p, time: ts || 0 });
    });

    Object.values(p.comments || {}).forEach(c => {
      if (c.author !== meUid) items.push({ type: 'comment', from: c.author, post: p, time: c.createdAt || 0, text: c.text });
    });
  });

  items.sort((a, b) => b.time - a.time);

  const wrap = $('#viewNotifications');
  if (!items.length){
    wrap.innerHTML = `<div class="empty panel">Пока тихо. Лайки и комментарии появятся здесь 🔔</div>`;
    return;
  }

  wrap.innerHTML = `<div class="panel"><h2>Уведомления</h2></div>` +
    items.slice(0, 60).map(it => {
      const u = state.users[it.from] || { displayName: 'Гражданин', username: 'unknown' };
      const action = it.type === 'like' ? 'оценил вашу запись' : 'прокомментировал вашу запись';
      return `
        <div class="notif">
          <div class="ico">${it.type === 'like' ? '❤️' : '💬'}</div>
          <div style="flex:1;min-width:0">
            <div>
              <b class="clickable" data-action="open-profile" data-uid="${esc(it.from)}">${esc(u.displayName)}</b>
              <span class="muted"> ${action} · ${timeAgo(it.time)}</span>
            </div>
            <div class="muted small" style="margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
              ${esc((it.text || it.post.text || '').slice(0, 90))}
            </div>
          </div>
        </div>`;
    }).join('');
}

/* ---------- Правая панель ---------- */
function renderRight(){
  const me = myUser();
  const following = me.following || {};

  const suggestions = Object.values(state.users)
    .filter(u => u.uid !== meUid && !following[u.uid])
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, 5);

  $('#suggestions').innerHTML = suggestions.map(miniUserHTML).join('')
    || '<div class="muted small">Вы уже читаете всех 🎉</div>';

  renderSearchResults($('#globalSearch').value);
}

function renderSearchResults(q){
  q = (q || '').trim().toLowerCase();
  const box = $('#searchResults');
  if (!q){ box.innerHTML = ''; return; }

  const res = Object.values(state.users)
    .filter(u => u.uid !== meUid)
    .filter(u => (u.displayName || '').toLowerCase().includes(q)
              || (u.username || '').toLowerCase().includes(q))
    .slice(0, 6);

  box.innerHTML = res.map(miniUserHTML).join('')
    || '<div class="muted small">Никого не найдено</div>';
}

function miniUserHTML(u){
  const f = isFollowing(u.uid);
  return `
    <div class="mini-user">
      <div class="clickable" data-action="open-profile" data-uid="${esc(u.uid)}">${avatarHtml(u, 'avatar-sm')}</div>
      <div class="mini-info" data-action="open-profile" data-uid="${esc(u.uid)}">
        <div class="name">${esc(u.displayName)}</div>
        <div class="handle">@${esc(u.username)}</div>
      </div>
      <button class="btn sm ${f ? 'ghost' : 'primary'}" data-action="follow" data-uid="${esc(u.uid)}">
        ${f ? 'Отписаться' : 'Читать'}
      </button>
    </div>`;
}

/* ------------------------- Действия ------------------------- */
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const action = el.dataset.action;

  try {
    switch (action){

      case 'nav': {
        e.preventDefault();
        state.view = el.dataset.view;
        state.editing = false;
        if (state.view === 'profile') state.profileUid = meUid;
        render();
        break;
      }

      case 'open-profile': {
        e.preventDefault();
        state.view = 'profile';
        state.profileUid = el.dataset.uid;
        state.editing = false;
        render();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        break;
      }

      case 'open-username': {
        e.preventDefault();
        const snap = await db.ref('usernames/' + el.dataset.username.toLowerCase()).get();
        if (snap.exists()){
          state.view = 'profile';
          state.profileUid = snap.val();
          state.editing = false;
          render();
        } else {
          toast('Гражданин с таким ником не найден');
        }
        break;
      }

      case 'feed-tab': {
        state.feedTab = el.dataset.tab;
        renderFeedList();
        break;
      }

      case 'publish': await publish(); break;

      case 'like': {
        const id = el.dataset.id;
        const p = state.posts[id];
        if (!p) break;
        const ref = db.ref(`posts/${id}/likes/${meUid}`);
        if (p.likes && p.likes[meUid]) await ref.remove();
        else await ref.set(Date.now());
        break;
      }

      case 'toggle-comments': {
        const id = el.dataset.id;
        state.openComments[id] = !state.openComments[id];
        render();
        if (state.openComments[id]){
          const inp = document.getElementById('comment-' + id);
          if (inp) inp.focus();
        }
        break;
      }

      case 'send-comment': {
        const id = el.dataset.id;
        const input = document.getElementById('comment-' + id);
        const text = (input ? input.value : '').trim();
        if (!text) return;
        const ref = db.ref(`posts/${id}/comments`).push();
        state.commentDrafts[id] = '';
        await ref.set({ id: ref.key, author: meUid, text, createdAt: Date.now() });
        break;
      }

      case 'delete-post': {
        const id = el.dataset.id;
        if (!confirm('Удалить эту запись?')) return;
        await db.ref('posts/' + id).remove();
        toast('Запись удалена');
        break;
      }

      case 'copy-link': {
        const url = location.origin + location.pathname + '#post-' + el.dataset.id;
        try { await navigator.clipboard.writeText(url); toast('Ссылка скопирована'); }
        catch { toast(url); }
        break;
      }

      case 'follow': {
        const uid = el.dataset.uid;
        const ref = db.ref(`users/${meUid}/following/${uid}`);
        if (isFollowing(uid)) await ref.remove();
        else await ref.set(true);
        break;
      }

      case 'edit-profile': state.editing = true; render(); break;
      case 'cancel-edit': state.editing = false; render(); break;

      case 'save-profile': {
        const displayName = $('#editName').value.trim();
        const bio = $('#editBio').value.trim();
        const avatar = $('#editAvatar').value.trim();
        if (displayName.length < 2) return toast('Слишком короткое имя');
        await db.ref('users/' + meUid).update({ displayName, bio, avatar });
        state.editing = false;
        toast('Профиль обновлён ✅');
        break;
      }

      case 'logout': logout(); break;
    }
  } catch (err){
    console.error(err);
    toast('Ошибка: ' + (err.message || err));
  }
});

async function publish(){
  const text = $('#postText').value.trim();
  const image = $('#postImage').value.trim();
  if (!text && !image) return toast('Напишите что-нибудь');

  const ref = db.ref('posts').push();
  await ref.set({
    id: ref.key,
    author: meUid,
    text,
    image,
    createdAt: Date.now()
  });

  $('#postText').value = '';
  $('#postImage').value = '';
  $('#postCounter').textContent = '0 / 1000';
  toast('Опубликовано 🏛');
}

/* ------------------------- Ввод ------------------------- */
document.addEventListener('input', e => {
  const t = e.target;

  if (t.id === 'postText'){
    const c = $('#postCounter');
    if (c) c.textContent = t.value.length + ' / 1000';
  }

  if (t.dataset && t.dataset.draft){
    state.commentDrafts[t.dataset.draft] = t.value;
  }

  if (t.id === 'peopleSearch'){
    state.search = t.value;
    renderPeopleList();
  }

  if (t.id === 'globalSearch'){
    renderSearchResults(t.value);
  }
});

document.addEventListener('keydown', e => {
  if (e.ctrlKey && e.key === 'Enter'
      && document.activeElement && document.activeElement.id === 'postText'){
    publish();
  }
});

/* ------------------------- Старт ------------------------- */
(async function boot(){
  if (!meUid){
    $('#authScreen').classList.remove('hidden');
    return;
  }
  try {
    const snap = await db.ref('users/' + meUid).get();
    if (!snap.exists()){
      localStorage.removeItem(SESSION_KEY);
      meUid = null;
      $('#authScreen').classList.remove('hidden');
      return;
    }
    await startApp();
  } catch (err){
    console.error(err);
    $('#authScreen').classList.remove('hidden');
    authError('Не удалось подключиться к базе: ' + (err.message || err));
  }
})();
