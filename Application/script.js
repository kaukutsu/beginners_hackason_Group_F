const ICONS = ['📦','🗃️','🗄️','🧺','🚪','🧸','👗','🔧','📚','🍱','🧹','💊'];
const TAG_COLORS = ['tag-teal','tag-purple','tag-amber','tag-coral','tag-blue','tag-green'];

let currentImageData = null; 
let activeTagFilters = new Set(); 
let fileHandle = null; // ファイル保存先を保持する変数

// 初期状態のデータ
let state = {
  storages: [
    { id: 1, icon: '🗃️', name: 'リビング棚', num: 'A-1' },
    { id: 2, icon: '📦', name: '押し入れ上段', num: 'B-1' }
  ],
  items: [],
  nextStorageId: 3, nextItemId: 1,
  editingStorageId: null, editingItemId: null,
  currentShelfId: null, currentView: 'shelves',
  pendingTags: [], selectedIcon: '📦',
};

// --- ファイル読み込み・保存機能 ---

// ファイルを読み込んで復元する
async function loadDataFromFile() {
  try {
    if (!window.showOpenFilePicker) {
      alert("お使いのブラウザはローカルファイルの直接読み書きに対応していません。PC版のChromeやEdgeをご利用ください。");
      return;
    }

    const [handle] = await window.showOpenFilePicker({
      types: [{ description: 'JSON Files', accept: { 'application/json': ['.json'] } }],
      multiple: false
    });
    
    fileHandle = handle;
    const file = await fileHandle.getFile();
    const contents = await file.text();
    const parsed = JSON.parse(contents);
    
    state = { ...state, ...parsed };
    
    state.currentView = 'shelves';
    state.editingStorageId = null;
    state.editingItemId = null;
    state.currentShelfId = null;
    state.pendingTags = [];
    
    switchView('shelves', document.querySelectorAll('.nav-btn')[0]);
    alert("データを読み込みました。以降の変更はこのファイルに上書き保存されます。");
  } catch (e) {
    if (e.name !== 'AbortError') {
      console.error("読み込みエラー:", e);
      alert("ファイルの読み込みに失敗しました。");
    }
  }
}

// 変更をファイルに保存する
async function saveData() {
  try {
    if (!window.showSaveFilePicker) {
      console.warn("File System Access API非対応ブラウザです");
      return;
    }

    if (!fileHandle) {
      fileHandle = await window.showSaveFilePicker({
        suggestedName: 'mono_management_data.json',
        types: [{ description: 'JSON Files', accept: { 'application/json': ['.json'] } }]
      });
    }

    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(state));
    await writable.close();
    
    console.log("上書き保存完了");
  } catch (e) {
    if (e.name !== 'AbortError') {
      console.error("保存エラー:", e);
      alert("保存に失敗しました。");
    } else {
      fileHandle = null; 
    }
  }
}

function tagColor(tag) {
  let h = 0;
  for (let c of tag) h = (h * 31 + c.charCodeAt(0)) & 0xff;
  return TAG_COLORS[h % TAG_COLORS.length];
}

function renderTag(t, removable) {
  const cls = tagColor(t);
  if (removable) {
    return `<span class="tag ${cls} tag-removable" style="display:inline-flex; align-items:center; gap:4px; padding:2px 8px; border-radius:20px; font-size:11px; margin-top:4px;">${t}<button type="button" onclick="removeTag('${t}')" style="background:none; border:none; cursor:pointer; opacity:0.6;">✕</button></span>`;
  }
  return `<span class="tag ${cls}" style="display:inline-flex; padding:2px 8px; border-radius:20px; font-size:11px; margin-top:4px; margin-right:4px;">${t}</span>`;
}

function createItemRowHtml(item, showLocation) {
  const s = state.storages.find(x => x.id === item.storageId);
  const imgHtml = item.image 
    ? `<img src="${item.image}" class="item-img-thumb" />` 
    : `<div class="item-img-thumb" style="display:flex; align-items:center; justify-content:center; font-size:20px;">${s ? s.icon : '📦'}</div>`;

  const locationHtml = (showLocation && s) ? `<span class="location-badge" style="margin-bottom:4px;">${s.icon} ${s.name}${s.num ? ' · ' + s.num : ''}</span><br>` : '';

  return `
    <div class="item-row" ondblclick="openLargePreview(${item.id})" title="ダブルクリックで拡大">
      ${imgHtml}
      <div style="flex:1">
        <div class="item-name">${item.name}</div>
        ${locationHtml}
        ${item.note ? `<div class="item-meta">${item.note}</div>` : ''}
        <div style="display:flex; flex-wrap:wrap; gap:4px; margin-top:2px;">${item.tags.map(t => renderTag(t)).join('')}</div>
      </div>
      <div class="item-actions" style="display:flex; gap:6px;">
        <button class="icon-btn" onclick="event.stopPropagation(); editItem(${item.id})">✏️</button>
        <button class="icon-btn" onclick="event.stopPropagation(); deleteItem(${item.id})">🗑️</button>
      </div>
    </div>`;
}

function switchView(v, btn) {
  if (btn) {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }
  ['shelves','search','all-items','shelf-detail'].forEach(n =>
    document.getElementById('view-' + n).classList.remove('active')
  );
  state.currentView = v;
  document.getElementById('view-' + v).classList.add('active');
  document.getElementById('addBtn').style.display = v === 'shelf-detail' ? 'none' : '';
  
  if (v === 'shelves') renderShelves();
  if (v === 'search') renderSearch();
  if (v === 'all-items') renderAllItems();
}

/* --- 棚・収納ビュー --- */
function renderShelves() {
  const el = document.getElementById('view-shelves');
  if (!state.storages.length) {
    el.innerHTML = `<div style="text-align:center; padding:48px 24px; color:var(--color-text-secondary);">📦<br>収納場所がまだありません</div>`;
    return;
  }
  el.innerHTML = `<div class="grid">${state.storages.map(s => {
    const items = state.items.filter(i => i.storageId === s.id);
    const allTags = [...new Set(items.flatMap(i => i.tags))].slice(0, 4);
    return `<div class="storage-card" onclick="openShelf(${s.id})">
      <div style="font-size:28px; margin-bottom:8px;">${s.icon}</div>
      <div class="card-name">${s.name}</div>
      ${s.num ? `<div style="font-size:12px; color:var(--color-text-secondary); margin-bottom:4px;">${s.num}</div>` : ''}
      <div class="card-count">${items.length}点</div>
      <div style="display:flex; flex-wrap:wrap; gap:4px; margin-top:8px;">${allTags.map(t => renderTag(t)).join('')}</div>
      <div style="position:absolute; top:10px; right:10px; display:flex; gap:4px;">
        <button class="icon-btn" onclick="event.stopPropagation(); editStorage(${s.id})">✏️</button>
        <button class="icon-btn" onclick="event.stopPropagation(); deleteStorage(${s.id})">🗑️</button>
      </div>
    </div>`;
  }).join('')}</div>`;
}

function openShelf(id) {
  state.currentShelfId = id;
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  ['shelves','search','all-items'].forEach(n => document.getElementById('view-' + n).classList.remove('active'));
  document.getElementById('view-shelf-detail').classList.add('active');
  document.getElementById('addBtn').style.display = 'none';
  state.currentView = 'shelf-detail';
  renderShelfDetail();
}

function renderShelfDetail() {
  const s = state.storages.find(x => x.id === state.currentShelfId);
  if (!s) return;
  const items = state.items.filter(i => i.storageId === s.id);
  const el = document.getElementById('view-shelf-detail');
  el.innerHTML = `
    <div style="display:flex; align-items:center; gap:12px; margin-bottom:20px;">
      <button onclick="switchView('shelves', document.querySelectorAll('.nav-btn')[0])" style="background:none; border:none; cursor:pointer; font-size:18px;">←</button>
      <span style="font-size:24px">${s.icon}</span>
      <div>
        <div style="font-size:15px; font-weight:500;">${s.name}</div>
        ${s.num ? `<div style="font-size:12px; color:gray;">${s.num}</div>` : ''}
      </div>
      <button class="btn primary" style="margin-left:auto;" onclick="openItemModal(null, ${s.id})">＋ モノを追加</button>
    </div>
    <div class="item-list">${items.map(item => createItemRowHtml(item, false)).join('')}</div>
  `;
}

/* --- 検索ビュー --- */
function renderSearch() {
  const el = document.getElementById('view-search');
  const allTags = [...new Set(state.items.flatMap(i => i.tags))];
  el.innerHTML = `
    <div class="search-bar">
      <input type="text" id="searchInput" placeholder="名前・タグ・メモで検索..." oninput="doSearch()" />
    </div>
    <div id="tagFilter" style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:16px;">
      ${allTags.map(t => {
        const isActive = activeTagFilters.has(t);
        return `<button onclick="toggleTagFilter('${t}')" style="padding:4px 12px; border-radius:20px; font-size:12px; border:1px solid #ccc; cursor:pointer; ${isActive ? 'background:var(--c-teal-600); color:white;' : 'background:white;'}">${t}</button>`;
      }).join('')}
    </div>
    <div id="searchResults"></div>`;
  doSearch();
}

function toggleTagFilter(tag) {
  if (activeTagFilters.has(tag)) activeTagFilters.delete(tag);
  else activeTagFilters.add(tag);
  renderSearch(); 
}

function doSearch() {
  const q = (document.getElementById('searchInput')?.value || '').toLowerCase();
  const results = state.items.filter(item => {
    const matchQ = !q || item.name.toLowerCase().includes(q)
      || item.tags.some(t => t.toLowerCase().includes(q))
      || item.note?.toLowerCase().includes(q);
    const matchTag = activeTagFilters.size === 0
      || [...activeTagFilters].every(t => item.tags.includes(t));
    return matchQ && matchTag;
  });
  
  const el = document.getElementById('searchResults');
  if (!el) return;
  el.innerHTML = `<div style="font-size:12px; color:gray; margin-bottom:12px;">${results.length}件見つかりました</div>` +
    `<div class="item-list">${results.map(item => createItemRowHtml(item, true)).join('')}</div>`;
}

/* --- すべてのモノビュー --- */
function renderAllItems() {
  const el = document.getElementById('view-all-items');
  el.innerHTML = `<div class="item-list">${state.items.map(item => createItemRowHtml(item, true)).join('')}</div>`;
}

/* --- データ操作・モーダル管理 --- */
function handleAdd() {
  if (state.currentView === 'shelves' || state.currentView === 'all-items') openStorageModal();
  else openItemModal(null, state.currentShelfId);
}

function openStorageModal(id) {
  state.editingStorageId = id || null;
  const s = id ? state.storages.find(x => x.id === id) : null;
  document.getElementById('storageModalTitle').textContent = id ? '収納場所を編集' : '収納場所を追加';
  document.getElementById('storageName').value = s?.name || '';
  document.getElementById('storageNum').value = s?.num || '';
  state.selectedIcon = s?.icon || '📦';
  
  document.getElementById('iconSelect').innerHTML = ICONS.map(ic =>
    `<div onclick="selectIcon('${ic}', this)" style="font-size:24px; width:40px; height:40px; display:flex; align-items:center; justify-content:center; border:1px solid ${ic === state.selectedIcon ? 'var(--c-teal-600)' : '#ccc'}; border-radius:8px; cursor:pointer; background:${ic === state.selectedIcon ? 'var(--c-teal-50)' : 'transparent'};">${ic}</div>`
  ).join('');
  document.getElementById('storageModal').classList.add('open');
}

function selectIcon(ic, el) {
  state.selectedIcon = ic;
  Array.from(el.parentNode.children).forEach(e => {
    e.style.borderColor = '#ccc'; e.style.background = 'transparent';
  });
  el.style.borderColor = 'var(--c-teal-600)'; el.style.background = 'var(--c-teal-50)';
}

function editStorage(id) { openStorageModal(id); }

async function deleteStorage(id) {
  if (!confirm('この収納場所を削除しますか？（中のモノも削除されます）')) return;
  state.storages = state.storages.filter(s => s.id !== id);
  state.items = state.items.filter(i => i.storageId !== id);
  await saveData(); 
  renderShelves();
}

async function saveStorage() {
  const name = document.getElementById('storageName').value.trim();
  if (!name) return alert('名前を入力してください');
  const num = document.getElementById('storageNum').value.trim();
  if (state.editingStorageId) {
    const s = state.storages.find(x => x.id === state.editingStorageId);
    Object.assign(s, { name, num, icon: state.selectedIcon });
  } else {
    state.storages.push({ id: state.nextStorageId++, icon: state.selectedIcon, name, num });
  }
  
  await saveData(); 
  closeModal('storageModal');
  renderShelves();
}

function openItemModal(id, defaultStorageId) {
  state.editingItemId = id || null;
  state.pendingTags = [];
  const item = id ? state.items.find(x => x.id === id) : null;
  if (item) state.pendingTags = [...item.tags];
  
  document.getElementById('itemModalTitle').textContent = id ? 'モノを編集' : 'モノを追加';
  document.getElementById('itemName').value = item?.name || '';
  document.getElementById('itemNote').value = item?.note || '';
  
  const sel = document.getElementById('itemStorage');
  sel.innerHTML = state.storages.map(s =>
    `<option value="${s.id}" ${(item?.storageId || defaultStorageId) === s.id ? 'selected' : ''}>${s.icon} ${s.name}${s.num ? ' (' + s.num + ')' : ''}</option>`
  ).join('');

  const preview = document.getElementById('imgPreview');
  const fileInput = document.getElementById('itemImageFile');
  fileInput.value = ''; 
  currentImageData = item?.image || null;
  
  if (currentImageData) {
    preview.src = currentImageData;
    preview.style.display = 'block';
  } else {
    preview.style.display = 'none';
  }

  renderTagInput();
  document.getElementById('itemModal').classList.add('open');
}

function previewImage(input) {
  const file = input.files[0];
  const preview = document.getElementById('imgPreview');
  if (file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      currentImageData = e.target.result;
      preview.src = currentImageData;
      preview.style.display = 'block';
    }
    reader.readAsDataURL(file);
  } else {
    currentImageData = null;
    preview.style.display = 'none';
  }
}

function openLargePreview(id) {
  const item = state.items.find(x => x.id === id);
  if (!item) return;

  const storage = state.storages.find(x => x.id === item.storageId);

  document.getElementById('previewModalTitle').textContent = item.name;
  document.getElementById('previewModalLocation').textContent = storage ? `${storage.icon} ${storage.name}` : '';

  const container = document.getElementById('previewModalImageContainer');
  if (item.image) {
    container.innerHTML = `<img src="${item.image}" alt="${item.name}" />`;
  } else {
    container.innerHTML = `<span class="preview-no-image">No image</span>`;
  }

  document.getElementById('imagePreviewModal').classList.add('open');
}

function renderTagInput() {
  const wrap = document.getElementById('tagInputWrap');
  const inputHtml = `<input type="text" id="tagInput" placeholder="タグを入力..." onkeydown="handleTagKey(event)" style="border:none; outline:none; background:transparent; width:100%; margin-top:4px;" />`;
  wrap.innerHTML = state.pendingTags.map(t => renderTag(t, true)).join('') + inputHtml;
}

function handleTagKey(e) {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault();
    const v = e.target.value.trim().replace(/,/g, '');
    if (v && !state.pendingTags.includes(v)) {
      state.pendingTags.push(v);
      renderTagInput();
      document.getElementById('tagInput').focus();
    } else {
      e.target.value = '';
    }
  }
}

function removeTag(t) {
  state.pendingTags = state.pendingTags.filter(x => x !== t);
  renderTagInput();
}

function editItem(id) { openItemModal(id, null); }

async function deleteItem(id) {
  if (!confirm('このモノを削除しますか？')) return;
  state.items = state.items.filter(i => i.id !== id);
  
  await saveData(); 

  if (state.currentView === 'shelf-detail') renderShelfDetail();
  else if (state.currentView === 'all-items') renderAllItems();
  else doSearch();
}

async function saveItem() {
  const name = document.getElementById('itemName').value.trim();
  if (!name) return alert('名前を入力してください');
  const storageId = parseInt(document.getElementById('itemStorage').value);
  const note = document.getElementById('itemNote').value.trim();
  const extra = document.getElementById('tagInput')?.value.trim();
  if (extra && !state.pendingTags.includes(extra)) state.pendingTags.push(extra);
  
  if (state.editingItemId) {
    const item = state.items.find(x => x.id === state.editingItemId);
    Object.assign(item, { name, storageId, note, tags: state.pendingTags, image: currentImageData });
  } else {
    state.items.push({ id: state.nextItemId++, name, storageId, note, tags: state.pendingTags, image: currentImageData, createdAt: Date.now() });
  }
  
  await saveData(); 
  
  closeModal('itemModal');
  activeTagFilters = new Set(); 
  
  if (state.currentView === 'shelf-detail') renderShelfDetail();
  else if (state.currentView === 'all-items') renderAllItems();
  else if (state.currentView === 'search') doSearch();
  else renderShelves();
}

function closeModal(id) { document.getElementById(id).classList.remove('open'); }

document.querySelectorAll('.modal-overlay').forEach(el =>
  el.addEventListener('click', e => { if (e.target === el) el.classList.remove('open'); })
);

// 初期表示
renderShelves();