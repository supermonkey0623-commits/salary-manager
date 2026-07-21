// =============================================
// 自動再ログインの無限ループ防止ガード
// sessionStorage に試行時刻を記録し、時間窓内の試行回数が
// 上限を超えた場合は false を返して自動ログインを止める
// =============================================
export function recordAutoLoginAttempt(
  key: string,
  maxAttempts: number,
  windowMs: number
): boolean {
  try {
    const now = Date.now();
    const stored: number[] = JSON.parse(sessionStorage.getItem(key) ?? "[]");
    // 時間窓内の試行のみ残す
    const recent = stored.filter((t) => now - t < windowMs);
    if (recent.length >= maxAttempts) {
      return false;
    }
    recent.push(now);
    sessionStorage.setItem(key, JSON.stringify(recent));
    return true;
  } catch {
    // sessionStorage が使えない環境ではガードなしで許可
    return true;
  }
}
