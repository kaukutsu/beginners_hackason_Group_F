// ── A. 定数・初期データ ──────────────────────────────────────────────────

// 収納場所アイコンの選択肢
const ICONS = ['📦','🗃️','🗄️','🧺','🚪','🧸','👗','🔧','📚','🍱','🧹','💊'];

// タグに使用する CSS クラス名の一覧（タグ名のハッシュ値で色を自動決定する）
const TAG_COLORS = ['tag-teal','tag-purple','tag-amber','tag-coral','tag-blue','tag-green'];

// アプリの全データと UI 状態を管理するオブジェクト（データベースの代わり）
let state = {
  // 収納場所リスト
  storages: [
    { id: 1, icon: '🗃️', name: 'リビング棚',  num: 'A-1' },
    { id: 2, icon: '📦', name: '押し入れ上段', num: 'B-1' },
    { id: 3, icon: '👗', name: 'クローゼット', num: 'C-1' },
  ],
  // モノ（アイテム）リスト
  items: [
    { id: 1, name: '冬用コート',  storageId: 3, note: 'グレー色',     tags: ['衣類','冬'],          createdAt: Date.now() },
    { id: 2, name: '電池（単3）', storageId: 1, note: '予備10本',    tags: ['電気','消耗品'],       createdAt: Date.now() },
    { id: 3, name: '工具セット',  storageId: 2, note: 'ドライバー等', tags: ['工具','DIY'],          createdAt: Date.now() },
    { id: 4, name: '季節の飾り',  storageId: 2, note: 'クリスマス用', tags: ['季節','インテリア'],   createdAt: Date.now() },
    { id: 5, name: 'お薬セット',  storageId: 1, note: '常備薬一式',  tags: ['医療','常備'],         createdAt: Date.now() },
  ],
  nextStorageId: 4,        // 次の収納場所に割り当てる ID
  nextItemId: 6,           // 次のアイテムに割り当てる ID
  editingStorageId: null,  // 編集中の収納場所 ID（null = 新規追加）
  editingItemId: null,     // 編集中のアイテム ID（null = 新規追加）
  currentShelfId: null,    // 棚詳細ビューで表示中の収納場所 ID
  currentView: 'shelves',  // 現在表示中のビュー名
  pendingTags: [],         // モノ追加・編集フォームで入力中のタグ一時保存
  selectedIcon: '📦',     // 収納場所フォームで選択中のアイコン
};


// ── B. ユーティリティ関数 ────────────────────────────────────────────────

// タグ名からハッシュ値を計算して CSS クラス名を返す
// → 同じタグ名は常に同じ色になる
function tagColor(tag) {
  let h = 0;
  for (let c of tag) h = (h * 31 + c.charCodeAt(0)) & 0xff;
  return TAG_COLORS[h % TAG_COLORS.length];
}

// タグの HTML 文字列を生成して返す
// removable = true のとき、✕ ボタン付きで描画する（フォーム内で使用）
function renderTag(t, removable) {
  const cls = tagColor(t);
  if (removable) {
    return `<span class="tag ${cls} tag-removable">${t}<button type="button" onclick="removeTag('${t}')">✕</button></span>`;
  }
  return `<span class="tag ${cls}">${t}</span>`;
}


// ── C. ビュー切り替え ────────────────────────────────────────────────────

// 指定したビューをアクティブにし、対応するコンテンツを描画する
function switchView(v, btn) {
  // タブボタンのアクティブ状態を切り替える
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');

  // すべてのビューを非表示にしてから対象ビューだけ表示する
  ['shelves','search','all-items','shelf-detail'].forEach(n =>
    document.getElementById('view-' + n).classList.remove('active')
  );
  state.currentView = v;
  document.getElementById('view-' + v).classList.add('active');

  // 棚詳細ビューでは追加ボタンを非表示にする
  document.getElementById('addBtn').style.display = v === 'shelf-detail' ? 'none' : '';

  // ビューに対応した描画関数を呼び出す
  if (v === 'shelves')   renderShelves();
  if (v === 'search')    renderSearch();
  if (v === 'all-items') renderAllItems();
}


// ── D. 棚一覧ビューの描画 ────────────────────────────────────────────────

// 収納場所をカードグリッドで一覧表示する
function renderShelves() {
  const el = document.getElementById('view-shelves');

  // データが空のときは案内メッセージを表示する
  if (!state.storages.length) {
    el.innerHTML = `<div class="empty-state"><div class="icon">📦</div><p>収納場所がまだありません<br>「＋ 追加」から棚やケースを登録してください</p></div>`;
    return;
  }

  // 収納場所ごとにカード HTML を生成してグリッドに並べる
  el.innerHTML = `<div class="grid">${state.storages.map(s => {
    const items = state.items.filter(i => i.storageId === s.id);
    const allTags = [...new Set(items.flatMap(i => i.tags))].slice(0, 4); // タグは最大4件表示

    return `<div class="storage-card" onclick="openShelf(${s.id})">
      <div class="card-icon">${s.icon}</div>
      <div class="card-name">${s.name}</div>
      ${s.num ? `<div class="card-count" style="margin-bottom:4px">${s.num}</div>` : ''}
      <div class="card-count">${items.length}点</div>
      <div class="card-tags">${allTags.map(t => renderTag(t)).join('')}</div>
      <div style="position:absolute;top:10px;right:10px;display:flex;gap:4px">
        <button class="icon-btn" onclick="event.stopPropagation();editStorage(${s.id})">✏️</button>
        <button class="icon-btn" onclick="event.stopPropagation();deleteStorage(${s.id})">🗑️</button>
      </div>
    </div>`;
  }).join('')}</div>`;
}


// ── E. 棚詳細ビューの描画 ────────────────────────────────────────────────

// 指定した収納場所の詳細ビューを開く
function openShelf(id) {
  state.currentShelfId = id;

  // タブナビのアクティブ状態を解除し、詳細ビューを表示する
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  ['shelves','search','all-items','shelf-detail'].forEach(n =>
    document.getElementById('view-' + n).classList.remove('active')
  );
  document.getElementById('view-shelf-detail').classList.add('active');
  document.getElementById('addBtn').style.display = 'none';
  state.currentView = 'shelf-detail';

  renderShelfDetail();
}

// 棚詳細ビューのコンテンツを描画する
function renderShelfDetail() {
  const s = state.storages.find(x => x.id === state.currentShelfId);
  if (!s) return;

  const items = state.items.filter(i => i.storageId === s.id);
  const el = document.getElementById('view-shelf-detail');

  el.innerHTML = `
    <div class="detail-header">
      <button class="detail-back" onclick="switchView('shelves', null); document.querySelectorAll('.nav-btn')[0].classList.add('active')">←</button>
      <span style="font-size:24px">${s.icon}</span>
      <div>
        <div style="font-size:15px;font-weight:500;color:var(--color-text-primary)">${s.name}</div>
        ${s.num ? `<div style="font-size:12px;color:var(--color-text-secondary)">${s.num}</div>` : ''}
      </div>
      <button class="btn primary" style="margin-left:auto" onclick="openItemModal(null, ${s.id})">＋ モノを追加</button>
    </div>
    ${items.length === 0
      ? `<div class="empty-state"><div class="icon">🔍</div><p>この収納場所にはまだモノが登録されていません</p></div>`
      : `<div class="item-list">${items.map(item => `
          <div class="item-row">
            <div style="flex:1">
              <div class="item-name">${item.name}</div>
              ${item.note ? `<div class="item-meta">${item.note}</div>` : ''}
              <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:6px">${item.tags.map(t => renderTag(t)).join('')}</div>
            </div>
            <div class="item-actions">
              <button class="icon-btn" onclick="editItem(${item.id})">✏️</button>
              <button class="icon-btn" onclick="deleteItem(${item.id})">🗑️</button>
            </div>
          </div>`).join('')}</div>`
    }`;
}


// ── F. 検索ビューの描画・検索ロジック ───────────────────────────────────

// 現在選択中のタグフィルター（複数選択可）
let activeTagFilters = new Set();

// 検索ビューの UI を構築する（検索欄・タグフィルター・結果エリア）
function renderSearch() {
  const el = document.getElementById('view-search');
  const allTags = [...new Set(state.items.flatMap(i => i.tags))]; // 全アイテムのタグを重複なしで取得

  el.innerHTML = `
    <div class="search-bar">
      <input type="text" id="searchInput" placeholder="名前・タグで検索..." oninput="doSearch()" />
    </div>
    <div class="tag-filter" id="tagFilter">
      ${allTags.map(t => `<button class="tag-filter-btn" onclick="toggleTagFilter('${t}', this)">${t}</button>`).join('')}
    </div>
    <div id="searchResults"></div>`;

  doSearch(); // 初期状態（全件）を表示する
}

// タグフィルターボタンのオン・オフを切り替えて再検索する
function toggleTagFilter(tag, btn) {
  if (activeTagFilters.has(tag)) {
    activeTagFilters.delete(tag);
    btn.classList.remove('active');
  } else {
    activeTagFilters.add(tag);
    btn.classList.add('active');
  }
  doSearch();
}

// キーワード検索＋タグフィルターを組み合わせてアイテムを絞り込み、結果を描画する
function doSearch() {
  const q = (document.getElementById('searchInput')?.value || '').toLowerCase();

  const results = state.items.filter(item => {
    // キーワードが名前・タグ・メモのいずれかに含まれるか
    const matchQ = !q || item.name.toLowerCase().includes(q)
      || item.tags.some(t => t.toLowerCase().includes(q))
      || item.note?.toLowerCase().includes(q);
    // 選択したタグをすべて持っているか
    const matchTag = activeTagFilters.size === 0
      || [...activeTagFilters].every(t => item.tags.includes(t));
    return matchQ && matchTag;
  });

  const el = document.getElementById('searchResults');
  if (!el) return;

  el.innerHTML = `<div class="search-results-info">${results.length}件見つかりました</div>` +
    (results.length === 0
      ? `<div class="empty-state"><div class="icon">🔍</div><p>該当するモノが見つかりません</p></div>`
      : `<div class="item-list">${results.map(item => {
          const s = state.storages.find(x => x.id === item.storageId);
          return `<div class="item-row">
            <div style="flex:1">
              <div class="item-name">${item.name}</div>
              ${s ? `<span class="location-badge">${s.icon} ${s.name}${s.num ? ' · ' + s.num : ''}</span>` : ''}
              ${item.note ? `<div class="item-meta" style="margin-top:4px">${item.note}</div>` : ''}
              <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:6px">${item.tags.map(t => renderTag(t)).join('')}</div>
            </div>
            <div class="item-actions">
              <button class="icon-btn" onclick="editItem(${item.id})">✏️</button>
              <button class="icon-btn" onclick="deleteItem(${item.id})">🗑️</button>
            </div>
          </div>`;
        }).join('')}</div>`
    );
}


// ── G. 全アイテムビューの描画 ────────────────────────────────────────────

// すべてのモノを収納場所情報つきで一覧表示する
function renderAllItems() {
  const el = document.getElementById('view-all-items');
  el.innerHTML = `<div class="item-list">${state.items.map(item => {
    const s = state.storages.find(x => x.id === item.storageId);
    return `<div class="item-row">
      <div style="flex:1">
        <div class="item-name">${item.name}</div>
        ${s ? `<span class="location-badge">${s.icon} ${s.name}${s.num ? ' · ' + s.num : ''}</span>` : ''}
        ${item.note ? `<div class="item-meta" style="margin-top:4px">${item.note}</div>` : ''}
        <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:6px">${item.tags.map(t => renderTag(t)).join('')}</div>
      </div>
      <div class="item-actions">
        <button class="icon-btn" onclick="editItem(${item.id})">✏️</button>
        <button class="icon-btn" onclick="deleteItem(${item.id})">🗑️</button>
      </div>
    </div>`;
  }).join('')}</div>`;
}


// ── H. 追加ボタンの振り分け ──────────────────────────────────────────────

// トップバーの「＋ 追加」ボタンが押されたとき、
// 現在のビューに応じて収納場所追加 or モノ追加を呼び分ける
function handleAdd() {
  if (state.currentView === 'shelves' || state.currentView === 'all-items') {
    openStorageModal(); // 棚一覧・全アイテムビューでは収納場所を追加
  } else {
    openItemModal(null, null); // 検索ビューではモノを追加
  }
}


// ── I. 収納場所の追加・編集・削除 ───────────────────────────────────────

// 収納場所モーダルを開く（id あり = 編集、なし = 新規追加）
function openStorageModal(id) {
  state.editingStorageId = id || null;
  const s = id ? state.storages.find(x => x.id === id) : null;

  // モーダルタイトルと各フィールドの初期値をセットする
  document.getElementById('storageModalTitle').textContent = id ? '収納場所を編集' : '収納場所を追加';
  document.getElementById('storageName').value = s?.name || '';
  document.getElementById('storageNum').value  = s?.num  || '';
  state.selectedIcon = s?.icon || '📦';

  // アイコン選択グリッドを描画する
  document.getElementById('iconSelect').innerHTML = ICONS.map(ic =>
    `<div class="icon-opt${ic === state.selectedIcon ? ' selected' : ''}" onclick="selectIcon('${ic}', this)">${ic}</div>`
  ).join('');

  document.getElementById('storageModal').classList.add('open');
}

// アイコン選択グリッドで選択されたアイコンをハイライトする
function selectIcon(ic, el) {
  state.selectedIcon = ic;
  document.querySelectorAll('.icon-opt').forEach(e => e.classList.remove('selected'));
  el.classList.add('selected');
}

// 収納場所の編集モーダルを開く（renderShelves から呼ばれる）
function editStorage(id) { openStorageModal(id); }

// 収納場所を削除する（中のモノも一緒に削除する）
function deleteStorage(id) {
  if (!confirm('この収納場所を削除しますか？（中のモノも削除されます）')) return;
  state.storages = state.storages.filter(s => s.id !== id);
  state.items    = state.items.filter(i => i.storageId !== id);
  renderShelves();
}

// 収納場所フォームの内容を state に保存する（新規追加 or 上書き更新）
function saveStorage() {
  const name = document.getElementById('storageName').value.trim();
  if (!name) { alert('名前を入力してください'); return; }
  const num = document.getElementById('storageNum').value.trim();

  if (state.editingStorageId) {
    // 既存レコードを更新する
    const s = state.storages.find(x => x.id === state.editingStorageId);
    Object.assign(s, { name, num, icon: state.selectedIcon });
  } else {
    // 新しいレコードを追加する
    state.storages.push({ id: state.nextStorageId++, icon: state.selectedIcon, name, num });
  }

  closeModal('storageModal');
  renderShelves();
}


// ── J. モノの追加・編集・削除 ───────────────────────────────────────────

// モノ追加・編集モーダルを開く
// id あり = 編集、defaultStorageId = 棚詳細から開いたときに収納場所を初期選択する
function openItemModal(id, defaultStorageId) {
  state.editingItemId = id || null;
  state.pendingTags   = [];
  const item = id ? state.items.find(x => x.id === id) : null;
  if (item) state.pendingTags = [...item.tags]; // 編集時は既存タグをコピーする

  // フォームの各フィールドに初期値をセットする
  document.getElementById('itemModalTitle').textContent = id ? 'モノを編集' : 'モノを追加';
  document.getElementById('itemName').value = item?.name || '';
  document.getElementById('itemNote').value = item?.note || '';

  // 収納場所のセレクトボックスを描画する
  const sel = document.getElementById('itemStorage');
  sel.innerHTML = state.storages.map(s =>
    `<option value="${s.id}" ${(item?.storageId || defaultStorageId) === s.id ? 'selected' : ''}>${s.icon} ${s.name}${s.num ? ' (' + s.num + ')' : ''}</option>`
  ).join('');

  renderTagInput();
  document.getElementById('itemModal').classList.add('open');
}

// タグ入力欄を再描画する（タグ追加・削除のたびに呼ばれる）
function renderTagInput() {
  const wrap  = document.getElementById('tagInputWrap');
  const input = document.createElement('input');
  input.type        = 'text';
  input.id          = 'tagInput';
  input.placeholder = 'タグを入力...';
  input.onkeydown   = handleTagKey;

  // 既存タグをバッジとして描画し、入力欄を末尾に追加する
  wrap.innerHTML = state.pendingTags.map(t => renderTag(t, true)).join('');
  wrap.appendChild(input);
}

// タグ入力欄で Enter または , が押されたときにタグを確定する
function handleTagKey(e) {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault();
    const v = e.target.value.trim().replace(/,/g, '');
    if (v && !state.pendingTags.includes(v)) {
      state.pendingTags.push(v);
      renderTagInput();
    } else {
      e.target.value = '';
    }
  }
}

// タグバッジの ✕ ボタンで該当タグを削除する
function removeTag(t) {
  state.pendingTags = state.pendingTags.filter(x => x !== t);
  renderTagInput();
}

// モノの編集モーダルを開く
function editItem(id) { openItemModal(id, null); }

// モノを削除する
function deleteItem(id) {
  if (!confirm('このモノを削除しますか？')) return;
  state.items = state.items.filter(i => i.id !== id);

  // 削除後、現在のビューを再描画する
  if      (state.currentView === 'shelf-detail') renderShelfDetail();
  else if (state.currentView === 'all-items')    renderAllItems();
  else                                            doSearch();
}

// モノフォームの内容を state に保存する（新規追加 or 上書き更新）
function saveItem() {
  const name = document.getElementById('itemName').value.trim();
  if (!name) { alert('名前を入力してください'); return; }

  const storageId = parseInt(document.getElementById('itemStorage').value);
  const note      = document.getElementById('itemNote').value.trim();

  // 入力途中のタグも確定させる
  const extra = document.getElementById('tagInput')?.value.trim();
  if (extra && !state.pendingTags.includes(extra)) state.pendingTags.push(extra);

  if (state.editingItemId) {
    // 既存レコードを更新する
    const item = state.items.find(x => x.id === state.editingItemId);
    Object.assign(item, { name, storageId, note, tags: state.pendingTags });
  } else {
    // 新しいレコードを追加する
    state.items.push({ id: state.nextItemId++, name, storageId, note, tags: state.pendingTags, createdAt: Date.now() });
  }

  closeModal('itemModal');
  activeTagFilters = new Set(); // タグフィルターをリセットする

  // 保存後、現在のビューを再描画する
  if      (state.currentView === 'shelf-detail') renderShelfDetail();
  else if (state.currentView === 'all-items')    renderAllItems();
  else if (state.currentView === 'search')       doSearch();
  else                                            renderShelves();
}


// ── K. モーダルの開閉 ────────────────────────────────────────────────────

// モーダルを閉じる（.open クラスを外すだけで CSS が display: none にする）
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

// モーダルの背景（オーバーレイ）をクリックしたときも閉じる
document.querySelectorAll('.modal-overlay').forEach(el =>
  el.addEventListener('click', e => { if (e.target === el) el.classList.remove('open'); })
);


// ── L. 初期表示 ──────────────────────────────────────────────────────────

// ページ読み込み時に棚一覧ビューを描画する
renderShelves();