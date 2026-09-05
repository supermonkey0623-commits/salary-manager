// =============================================
// アプリの初期表示準備が整ったことをスプラッシュ画面へ伝える仕組み
//
// ページ側は初回のデータ取得が終わった時点で markAppReady() を呼ぶ。
// スプラッシュはその通知を受けてから消えるため、
// 「スプラッシュが消えた直後に読み込み中が出る」状態を防げる。
// =============================================

const READY_EVENT = "app-ready";

// 一度準備完了になったら以降は常に完了扱い（再訪時に再表示しない）
let ready = false;

// 初期表示の準備完了を通知する（何度呼んでも安全）
export function markAppReady(): void {
  if (ready) return;
  ready = true;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(READY_EVENT));
  }
}

// 準備完了を待ち受ける。戻り値は購読解除用の関数
export function onAppReady(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  // すでに完了している場合は即座に呼ぶ
  if (ready) {
    callback();
    return () => {};
  }
  window.addEventListener(READY_EVENT, callback, { once: true });
  return () => window.removeEventListener(READY_EVENT, callback);
}
