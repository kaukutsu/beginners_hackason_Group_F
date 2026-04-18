"""
モノ管理アプリ — メインファイル
起動方法: python app.py
"""

import tkinter as tk
from tkinter import ttk, messagebox, filedialog
import json
import os
import shutil
from PIL import Image, ImageTk  # pip install pillow

# ──────────────────────────────────────────────
#  定数・設定
# ──────────────────────────────────────────────
DATA_FILE = "data.json"        # データ保存ファイル
IMAGE_DIR = "images"           # 画像保存フォルダ
WINDOW_TITLE = "モノ管理アプリ"
WINDOW_SIZE = "1100x680"

# カラーパレット
BG_MAIN = "#F8F7F4"
BG_SIDE = "#F1EFE8"
BG_CARD = "#FFFFFF"
BG_DETAIL = "#F8F7F4"
COLOR_ACCENT = "#1D9E75"       # アクセント（緑）
COLOR_BORDER = "#E0DED6"
COLOR_TEXT_P = "#2C2C2A"       # 主テキスト
COLOR_TEXT_S = "#888780"       # 副テキスト
COLOR_TAG = {
    "電子機器": ("#E1F5EE", "#0F6E56"),
    "ケーブル": ("#E6F1FB", "#185FA5"),
    "季節モノ": ("#FAEEDA", "#854F0B"),
    "書籍":    ("#EEEDFE", "#534AB7"),
    "工具":    ("#FAECE7", "#993C1D"),
    "書類":    ("#E6F1FB", "#185FA5"),
    "日用品":  ("#EAF3DE", "#3B6D11"),
    "その他":  ("#F1EFE8", "#5F5E5A"),
}
DEFAULT_TAG_COLOR = ("#F1EFE8", "#5F5E5A")


# ──────────────────────────────────────────────
#  データ管理クラス
# ──────────────────────────────────────────────
class DataManager:
    """
    JSON ファイルにデータを保存・読み込みするクラス。
    データ構造:
      {
        "locations": {
          "リビング": {
            "shelves": {
              "テレビ台下段": {
                "number": "棚 #1",
                "items": [
                  {"name": "ゲームコントローラー", "tags": ["電子機器"], "memo": "", "image": ""}
                ]
              }
            }
          }
        }
      }
    """

    def __init__(self):
        os.makedirs(IMAGE_DIR, exist_ok=True)
        self.data = self._load()

    def _load(self):
        if os.path.exists(DATA_FILE):
            with open(DATA_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        # 初回起動時のサンプルデータ
        return {
            "locations": {
                "リビング": {
                    "shelves": {
                        "テレビ台下段": {
                            "number": "棚 #1",
                            "items": [
                                {"name": "ゲームコントローラー", "tags": ["電子機器"], "memo": "", "image": ""},
                                {"name": "HDMIケーブル", "tags": ["ケーブル"], "memo": "2本あり", "image": ""},
                            ]
                        }
                    }
                }
            }
        }

    def save(self):
        with open(DATA_FILE, "w", encoding="utf-8") as f:
            json.dump(self.data, f, ensure_ascii=False, indent=2)

    # ── 場所 ──────────────────────────────────
    def get_locations(self):
        return list(self.data["locations"].keys())

    def add_location(self, name):
        if name and name not in self.data["locations"]:
            self.data["locations"][name] = {"shelves": {}}
            self.save()
            return True
        return False

    def delete_location(self, name):
        if name in self.data["locations"]:
            del self.data["locations"][name]
            self.save()

    # ── 棚/ケース ─────────────────────────────
    def get_shelves(self, location):
        return self.data["locations"].get(location, {}).get("shelves", {})

    def add_shelf(self, location, shelf_name, number=""):
        shelves = self.data["locations"][location]["shelves"]
        if shelf_name and shelf_name not in shelves:
            shelves[shelf_name] = {"number": number, "items": []}
            self.save()
            return True
        return False

    def delete_shelf(self, location, shelf_name):
        shelves = self.data["locations"][location]["shelves"]
        if shelf_name in shelves:
            del shelves[shelf_name]
            self.save()

    # ── アイテム ──────────────────────────────
    def get_items(self, location, shelf):
        return self.data["locations"][location]["shelves"][shelf]["items"]

    def add_item(self, location, shelf, name, tags, memo, image_path=""):
        items = self.data["locations"][location]["shelves"][shelf]["items"]
        items.append({"name": name, "tags": tags, "memo": memo, "image": image_path})
        self.save()

    def update_item(self, location, shelf, index, name, tags, memo, image_path):
        item = self.data["locations"][location]["shelves"][shelf]["items"][index]
        item.update({"name": name, "tags": tags, "memo": memo, "image": image_path})
        self.save()

    def delete_item(self, location, shelf, index):
        items = self.data["locations"][location]["shelves"][shelf]["items"]
        items.pop(index)
        self.save()

    # ── 検索 ──────────────────────────────────
    def search(self, query):
        """
        query に一致するアイテムを全場所・全棚から検索。
        戻り値: [(location, shelf, item_dict), ...]
        """
        results = []
        q = query.lower()
        for loc, loc_data in self.data["locations"].items():
            for shelf_name, shelf_data in loc_data["shelves"].items():
                for item in shelf_data["items"]:
                    hit = (
                        q in item["name"].lower()
                        or q in item["memo"].lower()
                        or any(q in t.lower() for t in item["tags"])
                    )
                    if hit:
                        results.append((loc, shelf_name, item))
        return results

    # ── 画像コピー ────────────────────────────
    def copy_image(self, src_path):
        """画像を IMAGE_DIR にコピーして保存パスを返す"""
        ext = os.path.splitext(src_path)[1]
        filename = f"img_{len(os.listdir(IMAGE_DIR)):04d}{ext}"
        dst = os.path.join(IMAGE_DIR, filename)
        shutil.copy2(src_path, dst)
        return dst


# ──────────────────────────────────────────────
#  ダイアログ: 棚・アイテム追加/編集
# ──────────────────────────────────────────────
class ShelfDialog(tk.Toplevel):
    """棚を追加するダイアログ"""

    def __init__(self, parent, title="棚を追加"):
        super().__init__(parent)
        self.title(title)
        self.resizable(False, False)
        self.result = None
        self._build()
        self.grab_set()          # モーダル
        self.wait_window()       # 閉じるまで待機

    def _build(self):
        frame = tk.Frame(self, bg=BG_MAIN, padx=24, pady=20)
        frame.pack(fill="both", expand=True)

        tk.Label(frame, text="棚・ケースの名前", bg=BG_MAIN, fg=COLOR_TEXT_P,
                 font=("", 11)).grid(row=0, column=0, sticky="w", pady=(0, 4))
        self.name_var = tk.StringVar()
        tk.Entry(frame, textvariable=self.name_var, width=28,
                 font=("", 11)).grid(row=1, column=0, sticky="ew", pady=(0, 12))

        tk.Label(frame, text="番号（任意）例: 棚 #1", bg=BG_MAIN, fg=COLOR_TEXT_S,
                 font=("", 10)).grid(row=2, column=0, sticky="w", pady=(0, 4))
        self.num_var = tk.StringVar()
        tk.Entry(frame, textvariable=self.num_var, width=28,
                 font=("", 11)).grid(row=3, column=0, sticky="ew", pady=(0, 16))

        btn_frame = tk.Frame(frame, bg=BG_MAIN)
        btn_frame.grid(row=4, column=0, sticky="e")
        tk.Button(btn_frame, text="キャンセル", command=self.destroy,
                  bg=BG_MAIN, relief="flat", bd=1).pack(side="left", padx=(0, 8))
        tk.Button(btn_frame, text="追加", command=self._ok,
                  bg=COLOR_ACCENT, fg="white", relief="flat", padx=12).pack(side="left")

    def _ok(self):
        name = self.name_var.get().strip()
        if not name:
            messagebox.showwarning("入力エラー", "名前を入力してください", parent=self)
            return
        self.result = (name, self.num_var.get().strip())
        self.destroy()


class ItemDialog(tk.Toplevel):
    """アイテムを追加・編集するダイアログ"""

    def __init__(self, parent, dm: DataManager, item=None):
        super().__init__(parent)
        self.title("アイテムを編集" if item else "アイテムを追加")
        self.dm = dm
        self.item = item or {}
        self.image_path = tk.StringVar(value=item.get("image", "") if item else "")
        self.result = None
        self._build()
        self.grab_set()
        self.wait_window()

    def _build(self):
        frame = tk.Frame(self, bg=BG_MAIN, padx=24, pady=20)
        frame.pack(fill="both", expand=True)

        # アイテム名
        tk.Label(frame, text="アイテム名 *", bg=BG_MAIN, fg=COLOR_TEXT_P,
                 font=("", 11)).grid(row=0, column=0, columnspan=2, sticky="w", pady=(0, 4))
        self.name_var = tk.StringVar(value=self.item.get("name", ""))
        tk.Entry(frame, textvariable=self.name_var, width=32,
                 font=("", 11)).grid(row=1, column=0, columnspan=2, sticky="ew", pady=(0, 12))

        # タグ
        tk.Label(frame, text="タグ（カンマ区切り）", bg=BG_MAIN, fg=COLOR_TEXT_P,
                 font=("", 11)).grid(row=2, column=0, columnspan=2, sticky="w", pady=(0, 4))
        self.tags_var = tk.StringVar(value=", ".join(self.item.get("tags", [])))
        tk.Entry(frame, textvariable=self.tags_var, width=32,
                 font=("", 11)).grid(row=3, column=0, columnspan=2, sticky="ew", pady=(0, 12))
        tk.Label(frame, text="例: 電子機器, ケーブル, 季節モノ", bg=BG_MAIN,
                 fg=COLOR_TEXT_S, font=("", 9)).grid(row=4, column=0, columnspan=2, sticky="w", pady=(0, 12))

        # メモ
        tk.Label(frame, text="メモ", bg=BG_MAIN, fg=COLOR_TEXT_P,
                 font=("", 11)).grid(row=5, column=0, columnspan=2, sticky="w", pady=(0, 4))
        self.memo_text = tk.Text(frame, width=32, height=3, font=("", 11))
        self.memo_text.insert("1.0", self.item.get("memo", ""))
        self.memo_text.grid(row=6, column=0, columnspan=2, sticky="ew", pady=(0, 12))

        # 画像
        tk.Label(frame, text="写真", bg=BG_MAIN, fg=COLOR_TEXT_P,
                 font=("", 11)).grid(row=7, column=0, sticky="w", pady=(0, 4))
        tk.Button(frame, text="画像を選択...", command=self._pick_image,
                  bg=BG_SIDE, relief="flat", bd=1).grid(row=7, column=1, sticky="e")
        self.img_label = tk.Label(frame, textvariable=self.image_path,
                                  bg=BG_MAIN, fg=COLOR_TEXT_S, font=("", 9),
                                  wraplength=280, anchor="w")
        self.img_label.grid(row=8, column=0, columnspan=2, sticky="w", pady=(0, 16))

        # ボタン
        btn_frame = tk.Frame(frame, bg=BG_MAIN)
        btn_frame.grid(row=9, column=0, columnspan=2, sticky="e")
        tk.Button(btn_frame, text="キャンセル", command=self.destroy,
                  bg=BG_MAIN, relief="flat", bd=1).pack(side="left", padx=(0, 8))
        tk.Button(btn_frame, text="保存", command=self._ok,
                  bg=COLOR_ACCENT, fg="white", relief="flat", padx=12).pack(side="left")

    def _pick_image(self):
        path = filedialog.askopenfilename(
            parent=self,
            title="画像を選択",
            filetypes=[("画像ファイル", "*.png *.jpg *.jpeg *.gif *.bmp *.webp")]
        )
        if path:
            saved = self.dm.copy_image(path)
            self.image_path.set(saved)

    def _ok(self):
        name = self.name_var.get().strip()
        if not name:
            messagebox.showwarning("入力エラー", "アイテム名を入力してください", parent=self)
            return
        tags = [t.strip() for t in self.tags_var.get().split(",") if t.strip()]
        memo = self.memo_text.get("1.0", "end-1c").strip()
        self.result = (name, tags, memo, self.image_path.get())
        self.destroy()


# ──────────────────────────────────────────────
#  メインアプリ
# ──────────────────────────────────────────────
class MonoKanriApp(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title(WINDOW_TITLE)
        self.geometry(WINDOW_SIZE)
        self.configure(bg=BG_MAIN)
        self.dm = DataManager()

        # 状態変数
        self.selected_location = tk.StringVar()
        self.selected_shelf = None
        self.search_var = tk.StringVar()
        self.search_var.trace_add("write", self._on_search)

        self._build_ui()
        self._refresh_locations()

    # ── UI 構築 ─────────────────────────────
    def _build_ui(self):
        """3ペインレイアウトを作る"""
        # ── サイドバー（場所リスト）
        self.sidebar = tk.Frame(self, bg=BG_SIDE, width=200)
        self.sidebar.pack(side="left", fill="y")
        self.sidebar.pack_propagate(False)

        tk.Label(self.sidebar, text="モノ管理", bg=BG_SIDE, fg=COLOR_TEXT_P,
                 font=("", 14, "bold")).pack(padx=16, pady=(16, 2), anchor="w")
        tk.Label(self.sidebar, text="持ちモノを整理する", bg=BG_SIDE,
                 fg=COLOR_TEXT_S, font=("", 9)).pack(padx=16, anchor="w")

        ttk.Separator(self.sidebar, orient="horizontal").pack(fill="x", pady=10)

        tk.Label(self.sidebar, text="場所", bg=BG_SIDE, fg=COLOR_TEXT_S,
                 font=("", 9)).pack(padx=16, anchor="w", pady=(0, 4))

        self.loc_frame = tk.Frame(self.sidebar, bg=BG_SIDE)
        self.loc_frame.pack(fill="x", padx=4)

        tk.Button(self.sidebar, text="＋ 場所を追加", command=self._add_location,
                  bg=BG_SIDE, relief="flat", bd=1, fg=COLOR_TEXT_S,
                  font=("", 10)).pack(side="bottom", fill="x", padx=8, pady=8)

        # ── メインエリア（棚グリッド + 検索）
        self.main_area = tk.Frame(self, bg=BG_MAIN)
        self.main_area.pack(side="left", fill="both", expand=True)

        # 検索バー
        search_bar = tk.Frame(self.main_area, bg=BG_MAIN, pady=8)
        search_bar.pack(fill="x", padx=16)
        tk.Label(search_bar, text="🔍", bg=BG_MAIN, font=("", 12)).pack(side="left", padx=(0, 4))
        tk.Entry(search_bar, textvariable=self.search_var, font=("", 11),
                 relief="flat", bg=BG_SIDE).pack(side="left", fill="x", expand=True, ipady=4)

        ttk.Separator(self.main_area, orient="horizontal").pack(fill="x")

        # 棚グリッド（スクロール付き）
        canvas_frame = tk.Frame(self.main_area, bg=BG_MAIN)
        canvas_frame.pack(fill="both", expand=True)
        self.canvas = tk.Canvas(canvas_frame, bg=BG_MAIN, highlightthickness=0)
        scrollbar = ttk.Scrollbar(canvas_frame, orient="vertical", command=self.canvas.yview)
        self.canvas.configure(yscrollcommand=scrollbar.set)
        scrollbar.pack(side="right", fill="y")
        self.canvas.pack(side="left", fill="both", expand=True)
        self.shelf_frame = tk.Frame(self.canvas, bg=BG_MAIN)
        self.canvas_window = self.canvas.create_window((0, 0), window=self.shelf_frame, anchor="nw")
        self.shelf_frame.bind("<Configure>", lambda e: self.canvas.configure(
            scrollregion=self.canvas.bbox("all")))
        self.canvas.bind("<Configure>", lambda e: self.canvas.itemconfig(
            self.canvas_window, width=e.width))

        # ── 右パネル（アイテム詳細）
        self.detail_panel = tk.Frame(self, bg=BG_DETAIL, width=240,
                                     relief="flat", bd=0)
        self.detail_panel.pack(side="right", fill="y")
        self.detail_panel.pack_propagate(False)
        tk.Label(self.detail_panel, text="棚を選択してください",
                 bg=BG_DETAIL, fg=COLOR_TEXT_S, font=("", 10)).pack(pady=32)

    # ── 場所リスト ───────────────────────────
    def _refresh_locations(self):
        for w in self.loc_frame.winfo_children():
            w.destroy()
        for loc in self.dm.get_locations():
            btn = tk.Button(
                self.loc_frame, text=f"  {loc}",
                bg=BG_SIDE, fg=COLOR_TEXT_P, font=("", 11),
                relief="flat", bd=0, anchor="w",
                command=lambda l=loc: self._select_location(l)
            )
            btn.pack(fill="x", padx=4, pady=1, ipady=5)
        if self.dm.get_locations():
            self._select_location(self.dm.get_locations()[0])

    def _select_location(self, location):
        self.selected_location.set(location)
        self.selected_shelf = None
        self._refresh_shelves()

    def _add_location(self):
        name = tk.simpledialog.askstring("場所を追加", "場所の名前を入力:", parent=self)
        if name and self.dm.add_location(name.strip()):
            self._refresh_locations()

    # ── 棚グリッド ───────────────────────────
    def _refresh_shelves(self):
        for w in self.shelf_frame.winfo_children():
            w.destroy()
        loc = self.selected_location.get()
        if not loc:
            return
        shelves = self.dm.get_shelves(loc)

        tk.Label(self.shelf_frame, text=f"{loc} の棚・ケース",
                 bg=BG_MAIN, fg=COLOR_TEXT_P, font=("", 12, "bold")).grid(
            row=0, column=0, columnspan=3, sticky="w", padx=16, pady=(12, 8))

        for i, (shelf_name, shelf_data) in enumerate(shelves.items()):
            row, col = divmod(i, 3)
            self._make_shelf_card(shelf_name, shelf_data, row + 1, col)

        # 「棚を追加」カード
        add_row, add_col = divmod(len(shelves), 3)
        add_card = tk.Frame(self.shelf_frame, bg=BG_CARD, relief="flat",
                            bd=0, width=180, height=140,
                            highlightthickness=1, highlightbackground=COLOR_BORDER)
        add_card.grid(row=add_row + 1, column=add_col, padx=8, pady=8, sticky="nsew")
        add_card.grid_propagate(False)
        tk.Label(add_card, text="＋", bg=BG_CARD, fg=COLOR_TEXT_S,
                 font=("", 20)).place(relx=0.5, rely=0.4, anchor="center")
        tk.Label(add_card, text="棚を追加", bg=BG_CARD, fg=COLOR_TEXT_S,
                 font=("", 10)).place(relx=0.5, rely=0.65, anchor="center")
        add_card.bind("<Button-1>", lambda e: self._add_shelf())
        for child in add_card.winfo_children():
            child.bind("<Button-1>", lambda e: self._add_shelf())

    def _make_shelf_card(self, name, data, row, col):
        items = data.get("items", [])
        num = data.get("number", "")

        card = tk.Frame(self.shelf_frame, bg=BG_CARD, relief="flat",
                        bd=0, width=180, height=150,
                        highlightthickness=1, highlightbackground=COLOR_BORDER)
        card.grid(row=row, column=col, padx=8, pady=8, sticky="nsew")
        card.grid_propagate(False)

        if num:
            tk.Label(card, text=num, bg=BG_CARD, fg=COLOR_TEXT_S,
                     font=("", 8)).pack(anchor="w", padx=10, pady=(8, 0))
        tk.Label(card, text=name, bg=BG_CARD, fg=COLOR_TEXT_P,
                 font=("", 11, "bold"), wraplength=160).pack(anchor="w", padx=10)

        # タグ
        if items:
            all_tags = list({t for item in items for t in item.get("tags", [])})
            tag_frame = tk.Frame(card, bg=BG_CARD)
            tag_frame.pack(anchor="w", padx=8, pady=2)
            for tag in all_tags[:3]:
                bg, fg = COLOR_TAG.get(tag, DEFAULT_TAG_COLOR)
                tk.Label(tag_frame, text=tag, bg=bg, fg=fg,
                         font=("", 8), padx=4, pady=1).pack(side="left", padx=2)

        tk.Label(card, text=f"{len(items)} 点を収納",
                 bg=BG_CARD, fg=COLOR_TEXT_S, font=("", 9)).pack(anchor="w", padx=10, pady=2)

        # クリックで詳細パネルを開く
        def on_click(e, n=name):
            self.selected_shelf = n
            self._refresh_detail()

        card.bind("<Button-1>", on_click)
        for child in card.winfo_children():
            child.bind("<Button-1>", on_click)

        # 右クリックで削除
        def on_right_click(e, n=name):
            if messagebox.askyesno("棚を削除", f"「{n}」を削除しますか？\n（中のアイテムも削除されます）"):
                self.dm.delete_shelf(self.selected_location.get(), n)
                self.selected_shelf = None
                self._refresh_shelves()
                self._clear_detail()
        card.bind("<Button-3>", on_right_click)

    def _add_shelf(self):
        dialog = ShelfDialog(self)
        if dialog.result:
            name, number = dialog.result
            loc = self.selected_location.get()
            if self.dm.add_shelf(loc, name, number):
                self._refresh_shelves()
            else:
                messagebox.showwarning("エラー", "その名前の棚は既に存在します")

    # ── 詳細パネル ───────────────────────────
    def _clear_detail(self):
        for w in self.detail_panel.winfo_children():
            w.destroy()
        tk.Label(self.detail_panel, text="棚を選択してください",
                 bg=BG_DETAIL, fg=COLOR_TEXT_S, font=("", 10)).pack(pady=32)

    def _refresh_detail(self):
        for w in self.detail_panel.winfo_children():
            w.destroy()
        loc = self.selected_location.get()
        shelf = self.selected_shelf
        if not shelf:
            return

        shelf_data = self.dm.get_shelves(loc).get(shelf, {})
        items = shelf_data.get("items", [])

        # ヘッダ
        hdr = tk.Frame(self.detail_panel, bg=BG_DETAIL)
        hdr.pack(fill="x", padx=12, pady=(12, 4))
        tk.Label(hdr, text=shelf, bg=BG_DETAIL, fg=COLOR_TEXT_P,
                 font=("", 12, "bold")).pack(anchor="w")
        tk.Label(hdr, text=f"{shelf_data.get('number', '')}  ·  {len(items)} 点",
                 bg=BG_DETAIL, fg=COLOR_TEXT_S, font=("", 9)).pack(anchor="w")
        ttk.Separator(self.detail_panel).pack(fill="x", pady=6)

        # アイテムリスト（スクロール付き）
        list_canvas = tk.Canvas(self.detail_panel, bg=BG_DETAIL, highlightthickness=0)
        sb = ttk.Scrollbar(self.detail_panel, orient="vertical", command=list_canvas.yview)
        list_canvas.configure(yscrollcommand=sb.set)
        sb.pack(side="right", fill="y")
        list_canvas.pack(fill="both", expand=True)
        list_inner = tk.Frame(list_canvas, bg=BG_DETAIL)
        list_canvas.create_window((0, 0), window=list_inner, anchor="nw")
        list_inner.bind("<Configure>", lambda e: list_canvas.configure(
            scrollregion=list_canvas.bbox("all")))

        for idx, item in enumerate(items):
            self._make_item_row(list_inner, idx, item, loc, shelf)

        # 「追加」ボタン
        tk.Button(self.detail_panel, text="＋ アイテムを追加",
                  command=lambda: self._add_item(loc, shelf),
                  bg=BG_DETAIL, fg=COLOR_ACCENT, relief="flat",
                  font=("", 10), bd=1).pack(fill="x", padx=12, pady=8)

    def _make_item_row(self, parent, idx, item, loc, shelf):
        row = tk.Frame(parent, bg=BG_DETAIL)
        row.pack(fill="x", padx=8, pady=2)

        # サムネイル（画像あれば表示）
        thumb_frame = tk.Frame(row, bg="#E8E6E0", width=36, height=36)
        thumb_frame.pack(side="left", padx=(0, 8))
        thumb_frame.pack_propagate(False)
        img_path = item.get("image", "")
        if img_path and os.path.exists(img_path):
            try:
                img = Image.open(img_path).resize((36, 36))
                photo = ImageTk.PhotoImage(img)
                lbl = tk.Label(thumb_frame, image=photo, bg="#E8E6E0")
                lbl.image = photo  # 参照保持
                lbl.pack()
            except Exception:
                tk.Label(thumb_frame, text="📦", bg="#E8E6E0", font=("", 16)).pack(expand=True)
        else:
            tk.Label(thumb_frame, text="📦", bg="#E8E6E0", font=("", 16)).pack(expand=True)

        # 情報
        info = tk.Frame(row, bg=BG_DETAIL)
        info.pack(side="left", fill="x", expand=True)
        tk.Label(info, text=item["name"], bg=BG_DETAIL, fg=COLOR_TEXT_P,
                 font=("", 10, "bold"), anchor="w").pack(fill="x")
        tags_str = ", ".join(item.get("tags", []))
        if tags_str:
            tk.Label(info, text=tags_str, bg=BG_DETAIL, fg=COLOR_TEXT_S,
                     font=("", 8), anchor="w").pack(fill="x")

        # 編集・削除
        btn_frame = tk.Frame(row, bg=BG_DETAIL)
        btn_frame.pack(side="right")
        tk.Button(btn_frame, text="✏", command=lambda i=idx: self._edit_item(loc, shelf, i),
                  bg=BG_DETAIL, relief="flat", font=("", 10)).pack()
        tk.Button(btn_frame, text="✕", command=lambda i=idx: self._delete_item(loc, shelf, i),
                  bg=BG_DETAIL, fg="red", relief="flat", font=("", 10)).pack()

        ttk.Separator(parent).pack(fill="x", padx=8)

    def _add_item(self, loc, shelf):
        dialog = ItemDialog(self, self.dm)
        if dialog.result:
            name, tags, memo, img = dialog.result
            self.dm.add_item(loc, shelf, name, tags, memo, img)
            self._refresh_detail()

    def _edit_item(self, loc, shelf, idx):
        item = self.dm.get_items(loc, shelf)[idx]
        dialog = ItemDialog(self, self.dm, item=item)
        if dialog.result:
            name, tags, memo, img = dialog.result
            self.dm.update_item(loc, shelf, idx, name, tags, memo, img)
            self._refresh_detail()

    def _delete_item(self, loc, shelf, idx):
        name = self.dm.get_items(loc, shelf)[idx]["name"]
        if messagebox.askyesno("削除確認", f"「{name}」を削除しますか？"):
            self.dm.delete_item(loc, shelf, idx)
            self._refresh_detail()

    # ── 検索 ─────────────────────────────────
    def _on_search(self, *_):
        query = self.search_var.get().strip()
        if not query:
            # 検索語がなければ通常表示に戻す
            self._refresh_shelves()
            self._clear_detail()
            return
        self._show_search_results(query)

    def _show_search_results(self, query):
        for w in self.shelf_frame.winfo_children():
            w.destroy()
        results = self.dm.search(query)

        tk.Label(self.shelf_frame, text=f"🔍 「{query}」の検索結果  {len(results)} 件",
                 bg=BG_MAIN, fg=COLOR_TEXT_P, font=("", 12, "bold")).grid(
            row=0, column=0, columnspan=3, sticky="w", padx=16, pady=(12, 8))

        if not results:
            tk.Label(self.shelf_frame, text="見つかりませんでした",
                     bg=BG_MAIN, fg=COLOR_TEXT_S, font=("", 11)).grid(
                row=1, column=0, padx=16, pady=16)
            return

        for i, (loc, shelf, item) in enumerate(results):
            row, col = divmod(i, 3)
            card = tk.Frame(self.shelf_frame, bg=BG_CARD, relief="flat",
                            bd=0, width=180, height=110,
                            highlightthickness=1, highlightbackground=COLOR_BORDER)
            card.grid(row=row + 1, column=col, padx=8, pady=8, sticky="nsew")
            card.grid_propagate(False)
            tk.Label(card, text=f"{loc}  ▸  {shelf}", bg=BG_CARD,
                     fg=COLOR_TEXT_S, font=("", 8)).pack(anchor="w", padx=10, pady=(8, 0))
            tk.Label(card, text=item["name"], bg=BG_CARD,
                     fg=COLOR_TEXT_P, font=("", 11, "bold"), wraplength=160).pack(anchor="w", padx=10)
            tags_str = ", ".join(item.get("tags", []))
            if tags_str:
                tk.Label(card, text=tags_str, bg=BG_CARD,
                         fg=COLOR_TEXT_S, font=("", 9)).pack(anchor="w", padx=10)
            if item.get("memo"):
                tk.Label(card, text=item["memo"], bg=BG_CARD,
                         fg=COLOR_TEXT_S, font=("", 9), wraplength=160).pack(anchor="w", padx=10)


# ──────────────────────────────────────────────
#  エントリポイント
# ──────────────────────────────────────────────
if __name__ == "__main__":
    import tkinter.simpledialog
    app = MonoKanriApp()
    app.mainloop()
