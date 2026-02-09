<?php
// m1_project/api/upload_textlog.php
header('Content-Type: application/json; charset=UTF-8');
date_default_timezone_set('Asia/Tokyo');

/**
 * ===== (任意) CORS: ローカル開発するなら =====
 * 本番で不要なら、このブロックごと消してOK
 */
$allowedOrigins = [
  'https://YOUR_DOMAIN.example',
];

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin && in_array($origin, $allowedOrigins, true)) {
  header("Access-Control-Allow-Origin: {$origin}");
  header("Vary: Origin");
  header("Access-Control-Allow-Credentials: true");
  header("Access-Control-Allow-Methods: POST, OPTIONS");
  header("Access-Control-Allow-Headers: Content-Type");
}

// preflight
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
  http_response_code(204);
  exit;
}

// ===== Helpers =====
function json_fail($code, $error, $extra = []) {
  http_response_code($code);
  echo json_encode(array_merge(['ok' => false, 'error' => $error], $extra), JSON_UNESCAPED_UNICODE);
  exit;
}

/**
 * ===== 日本語OKなファイル名サニタイズ =====
 * - ファイル名に「使えない文字」だけ除去/置換する
 * - 日本語(UTF-8)は残す
 *
 * 使えない例: / \ : * ? " < > | (Windows系) + 制御文字
 * そして先頭末尾の空白・ドットは避ける
 */
function sanitize_filename_unicode(string $s, int $maxLen = 80): string {
  // 制御文字を除去（改行・タブ等）
  $s = preg_replace('/[\x00-\x1F\x7F]/u', '', $s);

  // パス区切りや危険文字を "_" に
  $s = str_replace(['/', '\\', ':', '*', '?', '"', '<', '>', '|'], '_', $s);

  // 連続空白を1つにして、前後トリム
  $s = preg_replace('/\s+/u', ' ', $s);
  $s = trim($s);

  // 末尾のドット/空白は避ける（環境によって問題になる）
  $s = rtrim($s, " .");

  // 連続 "_" を縮める（見た目）
  $s = preg_replace('/_+/u', '_', $s);

  // 長さ制限（日本語を壊さないため mb_substr）
  if (function_exists('mb_substr')) {
    $s = mb_substr($s, 0, $maxLen, 'UTF-8');
  } else {
    $s = substr($s, 0, $maxLen);
  }

  if ($s === '') $s = 'unknown';
  return $s;
}

// ===== Method check =====
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
  json_fail(405, 'Method not allowed', ['method' => $_SERVER['REQUEST_METHOD'] ?? '']);
}

// ===== Meta (FormData の meta：ファイル名作り等に使う) =====
$metaJson = $_POST['meta'] ?? '{}';
$meta = json_decode($metaJson, true);
if (!is_array($meta)) $meta = [];

$participantRaw = (string)($meta['participant'] ?? 'unknown');
$participant = sanitize_filename_unicode($participantRaw, 80);

// trialNo (1-based only)
$trialNo = intval($meta['trialNo'] ?? 1);
if ($trialNo < 1) $trialNo = 1;

// status
$statusRaw = (string)($meta['status'] ?? '');
$isAborted = ($statusRaw === 'aborted');
$suffix = $isAborted ? '_ab' : '';

// start time (JS から startTs(ms epoch) をもらえるならそれを優先)
$startTs = $meta['startTs'] ?? null;
if (is_numeric($startTs)) {
  $startTs = (int)$startTs; // ms
  $dt = date('Ymd_His', (int)floor($startTs / 1000));
} else {
  // 無ければサーバ時刻で代替（保存時刻）
  $dt = date('Ymd_His');
}

// ===== File check =====
if (!isset($_FILES['log'])) {
  json_fail(400, 'No log file', [
    'content_length' => $_SERVER['CONTENT_LENGTH'] ?? null,
    'post_max_size' => ini_get('post_max_size'),
    'upload_max_filesize' => ini_get('upload_max_filesize'),
  ]);
}

$f = $_FILES['log'];
$err = $f['error'] ?? UPLOAD_ERR_OK;

if ($err !== UPLOAD_ERR_OK) {
  $map = [
    UPLOAD_ERR_INI_SIZE   => 'UPLOAD_ERR_INI_SIZE',
    UPLOAD_ERR_FORM_SIZE  => 'UPLOAD_ERR_FORM_SIZE',
    UPLOAD_ERR_PARTIAL    => 'UPLOAD_ERR_PARTIAL',
    UPLOAD_ERR_NO_FILE    => 'UPLOAD_ERR_NO_FILE',
    UPLOAD_ERR_NO_TMP_DIR => 'UPLOAD_ERR_NO_TMP_DIR',
    UPLOAD_ERR_CANT_WRITE => 'UPLOAD_ERR_CANT_WRITE',
    UPLOAD_ERR_EXTENSION  => 'UPLOAD_ERR_EXTENSION',
  ];
  json_fail(400, 'Upload error', [
    'code' => $err,
    'php_error' => $map[$err] ?? (string)$err,
    'size' => $f['size'] ?? null,
  ]);
}

$tmpPath = $f['tmp_name'] ?? '';
if (!$tmpPath || !is_uploaded_file($tmpPath)) {
  json_fail(400, 'Invalid upload', ['tmpPath' => $tmpPath]);
}

// ===== Save dir: m1_project/data/textlog =====
$saveDir = __DIR__ . '/../data/textlog';

if (!is_dir($saveDir)) {
  if (!mkdir($saveDir, 0775, true)) {
    json_fail(500, 'Failed to create dir', ['saveDir' => $saveDir]);
  }
}

if (!is_writable($saveDir)) {
  json_fail(500, 'Upload dir not writable', [
    'saveDir' => $saveDir,
    'perms' => substr(sprintf('%o', fileperms($saveDir)), -4),
  ]);
}

// ===== base filename =====
// 例: 山田太郎_ab_trial1_20260115_091750_textLog.json
$baseName = "{$participant}{$suffix}_trial{$trialNo}_{$dt}_textLog";

// ===== Collision handling: -2, -3 ... =====
$filename = "{$baseName}.json";
$path = $saveDir . '/' . $filename;

$k = 2;
while (file_exists($path)) {
  $filename = "{$baseName}-{$k}.json";
  $path = $saveDir . '/' . $filename;
  $k++;
  if ($k > 9999) {
    json_fail(500, 'Too many name collisions');
  }
}

// ===== move =====
if (!move_uploaded_file($tmpPath, $path)) {
  json_fail(500, 'Failed to save', ['target' => $path]);
}

// (任意) 念のため読み取り可能に（不要なら消してOK）
@chmod($path, 0666);

// ===== OK =====
echo json_encode([
  'ok' => true,
  'filename' => $filename,
], JSON_UNESCAPED_UNICODE);
