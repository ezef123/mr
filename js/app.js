/* =========================================================================
   МОЯ РЕСПУБЛИКА — основная логика (Firebase Auth + Realtime DB)
   ========================================================================= */

let meUid = null;          // выставляется в onAuthStateChanged

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

/* ------------------------- Авторизация: UI ------------------------- */
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

/* ---------- ВХОД ---------- */
$('#loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  authError('');
  const email = $('#loginEmail').value.trim();
  const pass  = $('#loginPass').value;
  if (!email || !pass) return authError('Заполните все поля');

  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true; btn.textContent = 'Входим...';

  try {
    await auth.signInWithEmailAndPassword(email, pass);
    // Дальше сработает onAuthStateChanged и загрузит приложение.
  } catch (err){
    console.error(err);
    authError(firebaseErrorRu(err));
  } finally {
    btn.disabled = false; btn.textContent = 'Войти';
  }
});

/* ---------- РЕГИСТРАЦИЯ ---------- */
$('#registerForm').addEventListener('submit', async e => {
  e.preventDefault();
  authError('');

  const displayName = $('#regName').value.trim();
  const usernameRaw = $('#regUser').value.trim();
  const email       = $('#regEmail').value.trim();
  const pass        = $('#regPass').value;

  if (displayName.length < 2)   return authError('Слишком короткое имя');
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(usernameRaw))
    return authError('Никнейм: 3–20 символов, латиница/цифры/подчёркивание');
  if (!email)                   return authError('Введите email');
  if (pass.length < 6)          return authError('Пароль минимум 6 символов');

  const usernameLower = usernameRaw.toLowerCase();
  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true; btn.textContent = 'Создаём...';

  try {
    // Мягкая проверка занятости ника (окончательная — в транзакции)
    const nameSnap = await db.ref('usernames/' + usernameLower).get();
    if (nameSnap.exists()) {
      authError('Этот никнейм уже занят');
      return;
    }

    // 1. Создаём auth-пользователя
    const cred = await auth.createUserWithEmailAndPassword(email, pass);
    const uid = cred.user.uid;

    try {
      // 2. Резервируем никнейм атомарно
      const tx = await db.ref('usernames/' + usernameLower).transaction(cur => {
        if (cur === null) return uid;   // свободен — занимаем
        return;                          // уже занят — прерываем
      });
      if (!tx.committed) throw new Error('Этот никнейм только что заняли — выберите другой');

      // 3. Пишем профиль
      await db.ref('users/' + uid).set({
        uid,
        username: usernameRaw,
        usernameLower,
        displayName,
        bio: '',
        avatar: '',
        createdAt: Date.now(),
        following: null
      });

      // 4. Синхронизируем displayName в Auth (не обязательно, но красиво)
      try { await cred.user.updateProfile({ displayName }); } catch {}

      toast('Добро пожаловать в Республику Жакид! 🏛');
      // Дальше onAuthStateChanged сам переключит интерфейс
    } catch (err) {
      // Откат: снимаем резерв ника, удаляем профиль и auth-пользователя
      try { await db.ref('usernames/' + usernameLower).remove(); } catch {}
      try { await db.ref('users/' + uid).remove(); } catch {}
      try { await cred.user.delete(); } catch {}
      throw err;
    }
  } catch (err){
    console.error(err);
    authError(firebaseErrorRu(err));
  } finally {
    btn.disabled = false; btn.textContent = 'Создать аккаунт';
  }
});

/* ------------------------- Слушатель Auth ------------------------- */
auth.onAuthStateChanged(async user => {
  if (!user){
    meUid = null;
    $('#app').classList.add('hidden');
    $('#authScreen').classList.remove('hidden');
    return;
  }

  meUid = user.uid;

  try {
    const snap = await db.ref('users/' + meUid).get();

    if (!snap.exists()){
      // Крайне редкий случай: auth создан, но профиль не дописан.
      toast('Профиль не найден, попробуйте зарегистрироваться заново');
      await auth.signOut();
      return;
    }

    state.me = snap.val();
    state.users[meUid] = state.me;
    if (!state.profileUid) state.profileUid = meUid;

    attachListeners();
    $('#authScreen').classList.add('hidden');
    $('#app').classList.remove('hidden');
    render();
  } catch (err){
    console.error(err);
    authError('Ошибка загрузки профиля: ' + firebaseErrorRu(err));
  }
});

/* ------------------------- Слушатели базы ------------------------- */
let listenersAttached = false;

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

/* ------------------------- Выход ------------------------- */
async function logout(){
  listenersAttached = false;
  try { await auth.signOut(); }
  catch (err){ console.error(err); }
  location.reload();
}

/* ------------------------- Рендер ------------------------- */
/* Всё, что ниже — БЕЗ ИЗМЕНЕНИЙ по сравнению с прошлой версией.
   Только функция render() больше не вызывается до того, как
   onAuthStateChanged установит meUid и загрузит профиль. */

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

/* sortedPosts, isFollowing, renderFeedList, postCardHTML, commentsHTML,
   renderProfile, renderPeople, renderPeopleList, renderNotifications,
   renderRight, renderSearchResults, miniUserHTML — БЕЗ ИЗМЕНЕНИЙ.
   Скопируйте их из предыдущего app.js. */

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
        const p  = state.posts[id];
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
        const bio         = $('#editBio').value.trim();
        const avatar      = $('#editAvatar').value.trim();
        if (displayName.length < 2) return toast('Слишком короткое имя');
        await db.ref('users/' + meUid).update({ displayName, bio, avatar });
        state.editing = false;
        toast('Профиль обновлён ✅');
        break;
      }

      case 'logout': await logout(); break;
    }
  } catch (err){
    console.error(err);
    toast('Ошибка: ' + (err.message || err));
  }
});

async function publish(){
  const text  = $('#postText').value.trim();
  const image = $('#postImage').value.trim();
  if (!text && !image) return toast('Напишите что-нибудь');

  const ref = db.ref('posts').push();
  await ref.set({
    id: ref.key,
    author: meUid,      // ← author всегда текущий auth.uid
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

/* Старт приложения управляется auth.onAuthStateChanged выше.
   Никакой отдельной boot-функции больше не нужно. */
