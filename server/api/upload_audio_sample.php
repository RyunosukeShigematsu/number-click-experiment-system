<?php
// m1_project/api/upload_audio.php
header('Content-Type: application/json; charset=UTF-8');
// ★これを追加
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
  header("Access-Control-Allow-Methods: POST, OPTIONS");
  header("Access-Control-Allow-Headers: Content-Type");
}
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

// ===== Method check =====
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
  json_fail(405, 'Method not allowed', ['method' => $_SERVER['REQUEST_METHOD'] ?? '']);
}

// ===== File check =====
if (!isset($_FILES['audio'])) {
  json_fail(400, 'No audio file', [
    'content_length' => $_SERVER['CONTENT_LENGTH'] ?? null,
    'post_max_size' => ini_get('post_max_size'),
    'upload_max_filesize' => ini_get('upload_max_filesize'),
  ]);
}

$f = $_FILES['audio'];
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

// ===== Meta (ファイル名作りにだけ使う。保存はしない) =====
$metaJson = $_POST['meta'] ?? '{}';
$meta = json_decode($metaJson, true);
if (!is_array($meta)) $meta = [];

// ===== Save dir: m1_project/data/audio =====
$baseDir = __DIR__ . '/../data/audio';

if (!is_dir($baseDir)) {
  if (!mkdir($baseDir, 0775, true)) {
    json_fail(500, 'Failed to create dir', ['baseDir' => $baseDir]);
  }
}

if (!is_writable($baseDir)) {
  json_fail(500, 'Upload dir not writable', [
    'baseDir' => $baseDir,
    'perms' => substr(sprintf('%o', fileperms($baseDir)), -4),
  ]);
}

// ===== participant (日本語OK、危険文字だけ潰す) =====
$raw = (string)($meta['participant'] ?? 'unknown');
$participant = preg_replace('/[\/\\\\:\*\?"<>\|\x00-\x1F]/u', '_', $raw);
$participant = trim($participant);
$participant = preg_replace('/\s+/u', ' ', $participant);
if ($participant === '') $participant = 'unknown';

// ===== trialNo (1-based only) =====
$trialNo = intval($meta['trialNo'] ?? 1);
if ($trialNo < 1) $trialNo = 1;

// ===== status (aborted なら _ab を付ける) =====
$status = (string)($meta['status'] ?? '');
$isAborted = ($status === 'aborted');

// ===== start time (録音開始 HHMMSS) =====
// JS から startTs (ms epoch) をもらうのがベスト。
// 無ければサーバ時刻で代替（ただし stop 時刻寄りになる）
$startTs = $meta['startTs'] ?? null;
if (is_numeric($startTs)) {
  $startTs = (int)$startTs; // ms
  $dt = date('Ymd_His', (int)floor($startTs / 1000));
} else {
  $dt = date('Ymd_His');
}

// ===== duration (xx.xs をファイル名に付ける) =====
$durationMs = $meta['durationMs'] ?? null;
$durTag = '';
if (is_numeric($durationMs)) {
  $sec = max(0, ((int)$durationMs) / 1000.0);
  // "〇〇.◯s" にしたい → 小数1桁
  $durTag = '_' . number_format($sec, 1, '.', '') . 's';
}

// ===== ext (Chrome運用で常に webm) =====
$ext = 'webm';

// ===== base filename =====
// 例: 山田太郎_ab_trial1_20260115_091750.webm
$suffix = $isAborted ? '_ab' : '';
$baseName = "{$participant}{$suffix}_trial{$trialNo}_{$dt}{$durTag}";

// ===== Collision handling: -2, -3 ... =====
$saveName = "{$baseName}.{$ext}";
$savePath = $baseDir . '/' . $saveName;

$k = 2;
while (file_exists($savePath)) {
  $saveName = "{$baseName}-{$k}.{$ext}";
  $savePath = $baseDir . '/' . $saveName;
  $k++;
  if ($k > 9999) {
    json_fail(500, 'Too many name collisions');
  }
}

// ===== move =====
if (!move_uploaded_file($tmpPath, $savePath)) {
  json_fail(500, 'Failed to save', [
    'target' => $savePath,
  ]);
}

// ===== OK =====
echo json_encode([
  'ok' => true,
  'file' => $saveName,
], JSON_UNESCAPED_UNICODE);
