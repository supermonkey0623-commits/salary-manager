/**
 * 日本語OCRデータをjsDelivrCDNから事前ダウンロードするスクリプト
 * 初回のみ実行が必要。以降はキャッシュから即座に読み込まれる。
 * 実行方法: node scripts/download-tessdata.js
 */

'use strict';

const https = require('https');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const CACHE_DIR = path.join(__dirname, '..', '.cache', 'tesseract');
const OUT_FILE = path.join(CACHE_DIR, 'jpn.traineddata');
// tesseract.js v7 が使うjsDelivr CDN（LSTM最適化済み）
const DOWNLOAD_URL = 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/jpn/4.0.0_best_int/jpn.traineddata.gz';

// キャッシュディレクトリ作成
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  console.log(`ディレクトリを作成: ${CACHE_DIR}`);
}

// すでにダウンロード済みならスキップ
if (fs.existsSync(OUT_FILE)) {
  const stat = fs.statSync(OUT_FILE);
  console.log(`✓ 既にダウンロード済みです (${(stat.size / 1024 / 1024).toFixed(1)} MB)`);
  console.log(`  パス: ${OUT_FILE}`);
  process.exit(0);
}

console.log('日本語OCRデータをダウンロード中...');
console.log(`URL: ${DOWNLOAD_URL}`);
console.log('（約35MB、しばらくお待ちください）\n');

/**
 * リダイレクト対応のHTTPSダウンロード
 */
function download(url, redirectCount = 0) {
  if (redirectCount > 5) {
    console.error('エラー: リダイレクト回数が多すぎます');
    process.exit(1);
  }

  https.get(url, (res) => {
    // リダイレクト処理
    if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) {
      const location = res.headers.location;
      if (!location) {
        console.error('エラー: リダイレクト先URLが取得できません');
        process.exit(1);
      }
      console.log(`リダイレクト → ${location}`);
      res.resume();
      download(location, redirectCount + 1);
      return;
    }

    if (res.statusCode !== 200) {
      console.error(`エラー: HTTPステータス ${res.statusCode}`);
      process.exit(1);
    }

    const total = parseInt(res.headers['content-length'] || '0', 10);
    let downloaded = 0;
    let lastPct = -1;

    // gzip解凍しながらファイル書き込み
    const gunzip = zlib.createGunzip();
    const outStream = fs.createWriteStream(OUT_FILE);

    res.on('data', (chunk) => {
      downloaded += chunk.length;
      if (total > 0) {
        const pct = Math.floor((downloaded / total) * 100);
        if (pct !== lastPct && pct % 10 === 0) {
          process.stdout.write(`\r  進捗: ${pct}% (${(downloaded / 1024 / 1024).toFixed(1)} MB / ${(total / 1024 / 1024).toFixed(1)} MB)`);
          lastPct = pct;
        }
      }
    });

    res.pipe(gunzip).pipe(outStream);

    outStream.on('finish', () => {
      const stat = fs.statSync(OUT_FILE);
      console.log(`\n\n✓ ダウンロード完了！`);
      console.log(`  保存先: ${OUT_FILE}`);
      console.log(`  サイズ: ${(stat.size / 1024 / 1024).toFixed(1)} MB`);
      console.log('\n次回からOCRが高速に動作します。');
    });

    gunzip.on('error', (err) => {
      console.error(`\ngunzipエラー: ${err.message}`);
      // gzip形式でない場合はそのまま書き込みを試みる
      console.log('gzip非圧縮として再試行します...');
      fs.unlinkSync(OUT_FILE);

      const outStream2 = fs.createWriteStream(OUT_FILE);
      res.pipe(outStream2);
      outStream2.on('finish', () => {
        const stat = fs.statSync(OUT_FILE);
        console.log(`✓ ダウンロード完了 (${(stat.size / 1024 / 1024).toFixed(1)} MB)`);
      });
    });

    outStream.on('error', (err) => {
      console.error(`\nファイル書き込みエラー: ${err.message}`);
      process.exit(1);
    });
  }).on('error', (err) => {
    console.error(`\nダウンロードエラー: ${err.message}`);
    process.exit(1);
  });
}

download(DOWNLOAD_URL);
