// Switch from gstatic CDN URLs to local npm dependencies
import { initializeApp } from "firebase/app";
import { 
  getDatabase, ref, push, onChildAdded, onValue, set, remove, serverTimestamp, query, limitToLast, orderByChild, onDisconnect, get 
} from "firebase/database";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL
};

// ── Bootstrap ──────────────────────────────────────────────
const app = initializeApp(firebaseConfig);
const db  = getDatabase(app);

const AVLIST   = ['🦊','🐉','🐙','🤖','👾'];
const AVCOLORS = ['#f0a732','#5865f2','#57c7e3','#e74c6b','#23a559'];
const QUICK    = ['👍','❤️','😂','🔥','😮'];
const MAX_MSGS = 150;

let me = null;

// ── DOM helpers ────────────────────────────────────────────
const $ = id => document.getElementById(id);

// ── Mobile Sidebar Drawer Toggle ───────────────────────────
$('menu-toggle').onclick = (e) => {
  e.stopPropagation();
  $('sidebar').classList.toggle('open');
  $('sidebar-overlay').classList.toggle('active');
};

$('sidebar-overlay').onclick = () => {
  $('sidebar').classList.remove('open');
  $('sidebar-overlay').classList.remove('active');
};

// ── Avatar picker ──────────────────────────────────────────
let selAv = null;
AVLIST.forEach((em, i) => {
  const b = document.createElement('button');
  b.className = 'av-btn'; b.textContent = em; b.type = 'button';
  b.onclick = () => {
    document.querySelectorAll('.av-btn').forEach(x => x.classList.remove('sel'));
    b.classList.add('sel'); selAv = i; checkJoin();
  };
  $('av-grid').appendChild(b);
});

$('uname').addEventListener('input', checkJoin);
$('uname').addEventListener('keydown', e => { if (e.key === 'Enter') $('join-btn').click(); });

function checkJoin() {
  $('join-btn').disabled = !($('uname').value.trim().length >= 2 && selAv !== null);
}

// ── Join ───────────────────────────────────────────────────
$('join-btn').onclick = async () => {
  const name = $('uname').value.trim();
  if (!name || selAv === null) return;

  me = {
    id:      'u_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    name,
    avIdx:  selAv,
    color:  AVCOLORS[selAv],
    joined: Date.now()
  };

  $('setup-screen').style.display = 'none';
  const cs = $('chat-screen');
  cs.style.display = 'flex'; cs.style.flexDirection = 'column';
  cs.style.flex = '1'; cs.style.overflow = 'hidden';
  $('my-av-sm').textContent  = AVLIST[me.avIdx];
  $('my-name-sm').textContent = me.name;
  $('msg-in').disabled = false;
  
  if (!('ontouchstart' in window)) {
    $('msg-in').focus();
  }

  setupPresence();
  listenMessages();
  listenPresence();

  await sendSystem(`${AVLIST[me.avIdx]} ${name} joined the chat`);
};

// ── Presence ───────────────────────────────────────────────
function setupPresence() {
  const presRef  = ref(db, `presence/${me.id}`);
  const connRef  = ref(db, '.info/connected');

  onValue(connRef, snap => {
    if (!snap.val()) return;
    set(presRef, {
      id:    me.id, name: me.name,
      avIdx: me.avIdx, color: me.color,
      online: true, typing: false,
      ts: serverTimestamp()
    });
    onDisconnect(presRef).remove();
  });

  setInterval(() => {
    if (!me) return;
    set(presRef, {
      id:    me.id, name: me.name,
      avIdx: me.avIdx, color: me.color,
      online: true, typing: me._typing || false,
      ts: serverTimestamp()
    });
  }, 10000);
}

async function setTyping(active) {
  if (!me) return;
  me._typing = active;
  await set(ref(db, `presence/${me.id}/typing`), active);
}

// ── Messages ───────────────────────────────────────────────
function listenMessages() {
  const msgsRef = query(
    ref(db, 'messages'),
    orderByChild('ts'),
    limitToLast(MAX_MSGS)
  );
  const seen = new Set();
  onChildAdded(msgsRef, snap => {
    const msg = { ...snap.val(), _key: snap.key };
    if (seen.has(snap.key)) return;
    seen.add(snap.key);
    appendMessage(msg);
  });
}

async function sendMessage(text) {
  await push(ref(db, 'messages'), {
    uid:   me.id, name: me.name,
    avIdx: me.avIdx, color: me.color,
    text, ts: serverTimestamp(), type: 'msg'
  });
}

async function sendSystem(text) {
  await push(ref(db, 'messages'), {
    uid: 'sys', text, ts: serverTimestamp(), type: 'sys'
  });
}

// ── Presence listener ─────────────────────────────────────
function listenPresence() {
  onValue(ref(db, 'presence'), snap => {
    const data = snap.val() || {};
    const members = Object.values(data).filter(u => u.online);
    renderMembers(members);
    const typers = members.filter(u => u.id !== me.id && u.typing);
    renderTyping(typers);
  });
}

// ── Reactions ─────────────────────────────────────────────
window.doReact = async (msgKey, emoji) => {
  if (!me) return;
  const rRef = ref(db, `reactions/${msgKey}/${emoji}/${me.id}`);
  const snap = await get(rRef);
  if (snap.exists()) await remove(rRef);
  else await set(rRef, true);
};

onValue(ref(db, 'reactions'), snap => {
  const all = snap.val() || {};
  document.querySelectorAll('[data-msgkey]').forEach(el => {
    const key = el.dataset.msgkey;
    const reactions = all[key] || {};
    const bar = el.querySelector('.reactions-bar');
    if (bar) bar.innerHTML = buildReactionsHTML(key, reactions);
  });
});

function buildReactionsHTML(msgKey, reactions) {
  return Object.entries(reactions)
    .map(([em, users]) => {
      const count = Object.keys(users).length;
      if (!count) return '';
      const mine = me && users[me.id];
      return `<button class="react-chip${mine ? ' mine' : ''}" onclick="doReact('${msgKey}','${em}')">${em}<span class="rc">${count}</span></button>`;
    }).join('');
}

// ── Render: append single message ─────────────────────────
let prevAuthor = null, prevTime = 0, prevDate = null;

function appendMessage(msg) {
  const msgsEl = $('msgs');
  const atBottom = msgsEl.scrollHeight - msgsEl.scrollTop - msgsEl.clientHeight < 120;

  const d = fmtDate(msg.ts);
  if (d !== prevDate) {
    const div = document.createElement('div');
    div.className = 'date-divider'; div.textContent = d;
    msgsEl.appendChild(div); prevDate = d; prevAuthor = null;
  }

  if (msg.type === 'sys') {
    const el = document.createElement('div');
    el.className = 'sys'; el.textContent = msg.text;
    msgsEl.appendChild(el); prevAuthor = null; prevTime = 0;
    if (atBottom) msgsEl.scrollTop = msgsEl.scrollHeight;
    return;
  }

  const grouped = msg.uid === prevAuthor && msg.ts && prevTime && (msg.ts - prevTime) < 420000;
  const wrap = document.createElement('div');
  wrap.dataset.msgkey = msg._key;

  const qr = `<div class="quick-reacts">${QUICK.map(e => `<button class="qr" onclick="doReact('${msg._key}','${e}')">${e}</button>`).join('')}</div>`;

  if (!grouped) {
    wrap.className = 'msg-wrap';
    wrap.innerHTML = `
      <div class="msg-av">${AVLIST[msg.avIdx] || '?'}</div>
      <div class="msg-body">
        <div class="msg-head">
          <span class="msg-author" style="color:${msg.color}">${esc(msg.name)}</span>
          <span class="msg-ts">${fmt(msg.ts)}</span>
        </div>
        <div class="msg-text">${esc(msg.text)}</div>
        <div class="reactions-bar"></div>${qr}
      </div>`;
  } else {
    wrap.className = 'msg-cont';
    wrap.innerHTML = `
      <div class="msg-cont-inner">
        <div class="msg-text">${esc(msg.text)}</div>
        <div class="reactions-bar"></div>${qr}
      </div>`;
  }

  wrap.addEventListener('click', () => {
    document.querySelectorAll('.msg-wrap, .msg-cont').forEach(el => {
      if(el !== wrap) el.classList.remove('touch-active');
    });
    wrap.classList.toggle('touch-active');
  });

  msgsEl.appendChild(wrap);
  prevAuthor = msg.uid;
  prevTime   = msg.ts || Date.now();

  if (atBottom) msgsEl.scrollTop = msgsEl.scrollHeight;
}

// ── Render: members sidebar ────────────────────────────────
function renderMembers(members) {
  const mbList = $('mb-list');
  mbList.innerHTML = '';
  const sorted = [...members].sort((a, b) => {
    if (a.id === me?.id) return -1;
    if (b.id === me?.id) return 1;
    return a.name.localeCompare(b.name);
  });
  $('mc').textContent = sorted.length;
  $('online-pill').textContent = sorted.length + ' online';

  sorted.forEach(u => {
    const isMe = u.id === me?.id;
    const row = document.createElement('div');
    row.className = 'member-row';
    row.innerHTML = `
      <div class="av">${AVLIST[u.avIdx] || '?'}<div class="dot"></div></div>
      <div class="mb-info">
        <div class="mb-name${isMe ? ' me' : ''}">${esc(u.name)}${isMe ? '<span class="mb-tag">you</span>' : ''}</div>
        <div class="mb-status">${u.typing && !isMe ? '<span style="color:#57c7e3">typing…</span>' : 'Online'}</div>
      </div>`;
    mbList.appendChild(row);
  });
}

// ── Render: typing indicator ───────────────────────────────
function renderTyping(typers) {
  const row = $('typing-row');
  if (!typers.length) { row.innerHTML = ''; return; }
  const names = typers.map(u => `<b>${esc(u.name)}</b>`).join(', ');
  const verb  = typers.length === 1 ? 'is' : 'are';
  row.innerHTML = `<div class="typing-text">${names} ${verb} typing<span class="bounce"><span>.</span><span>.</span><span>.</span></span></div>`;
}

// ── Send flow ──────────────────────────────────────────────
let typTimer = null;

async function send() {
  const text = $('msg-in').value.trim();
  if (!text || !me) return;
  $('msg-in').value = '';
  $('send-btn').className = 'send-btn';
  clearTimeout(typTimer);
  await setTyping(false);
  await sendMessage(text);
  $('msgs').scrollTop = $('msgs').scrollHeight;
}

$('msg-in').addEventListener('input', () => {
  $('send-btn').className = 'send-btn' + ($('msg-in').value.trim() ? ' active' : '');
  if (!me) return;
  clearTimeout(typTimer);
  if ($('msg-in').value.trim()) setTyping(true);
  typTimer = setTimeout(() => setTyping(false), 3000);
});

$('msg-in').addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
});
$('send-btn').addEventListener('click', send);

// ── Helpers ────────────────────────────────────────────────
function fmt(t) {
  if (!t) return '';
  return new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function fmtDate(t) {
  if (!t) return 'Today';
  const d = new Date(t), n = new Date();
  if (d.toDateString() === n.toDateString()) return 'Today';
  const y = new Date(n); y.setDate(y.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });
}
function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
