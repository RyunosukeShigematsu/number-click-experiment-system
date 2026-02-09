<?php
// upload_question_clip.php
// Receives: multipart/form-data
//  - audio: Blob (webm/mp4 etc)
//  - meta: JSON string { participant, index, question, ... }
date_default_timezone_set('Asia/Tokyo');
header('Content-Type: application/json; charset=utf-8');

// ===== CORS =====
$allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://shigematsu.nkmr.io',
];

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin && in_array($origin, $allowedOrigins, true)) {
  header("Access-Control-Allow-Origin: $origin");
  header("Vary: Origin");
  header("Access-Control-Allow-Credentials: true");
}
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

// Preflight
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
  http_response_code(204);
  exit;
}

// Method guard
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
  http_response_code(405);
  echo json_encode(['ok' => false, 'error' => 'Method not allowed'], JSON_UNESCAPED_UNICODE);
  exit;
}

// ===== Logging =====
$LOG = sys_get_temp_dir() . '/upload_question_clip_error.log';
function logline($msg) {
  global $LOG;
  @file_put_contents($LOG, '['.date('c').'] '.$msg."\n", FILE_APPEND);
}

function bad($code, $msg, $extra = []) {
  logline("ERROR($code): $msg | extra=" . json_encode($extra, JSON_UNESCAPED_UNICODE));
  http_response_code($code);
  echo json_encode(['ok' => false, 'error' => $msg, 'extra' => $extra], JSON_UNESCAPED_UNICODE);
  exit;
}

logline("HIT POST begin");

// ===== Read meta =====
$metaRaw = $_POST['meta'] ?? '';
if ($metaRaw === '') bad(400, 'Missing meta');

$meta = json_decode($metaRaw, true);
if (!is_array($meta)) {
  bad(400, 'Invalid meta JSON', ['metaRawHead' => substr($metaRaw, 0, 200)]);
}

$participant = $meta['participant'] ?? 'unknown';
$index = $meta['index'] ?? null;
$question = $meta['question'] ?? null;

// participant名をフォルダ名にできるように安全化
function safe_name($s) {
  $s = (string)$s;
  $s = trim($s);
  if ($s === '') return 'unknown';

  // Windows/一般的にNGな文字を潰す（日本語はOK）
  // NG: \ / : * ? " < > |  + 制御文字
  $s = preg_replace('/[\\\\\\/:\*\?"<>\|\x00-\x1F]/u', '_', $s);

  // 末尾のドットやスペースは危険なので削る（Windows対策）
  $s = preg_replace('/[\. ]+$/u', '', $s);

  // 連続 _ を整理（任意）
  $s = preg_replace('/_+/u', '_', $s);

  return $s !== '' ? $s : 'unknown';
}

$participantSafe = safe_name($participant);
$questionSafe = ($question === null || $question === '')
  ? 'qNA'
  : safe_name($question);


// ===== File =====
if (!isset($_FILES['audio'])) {
  bad(400, 'Missing file field: audio', ['files_keys' => array_keys($_FILES)]);
}
$f = $_FILES['audio'];

if (!is_array($f) || ($f['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
  bad(400, 'Upload failed', [
    'error' => $f['error'] ?? null,
    'name' => $f['name'] ?? null,
    'size' => $f['size'] ?? null,
  ]);
}

$tmpPath = $f['tmp_name'] ?? '';
if ($tmpPath === '' || !is_uploaded_file($tmpPath)) {
  bad(400, 'Invalid tmp upload file', ['tmp' => $tmpPath]);
}

// ===== Save directory =====
// これが「m1_project/api」から見た保存先
$baseDir = realpath(__DIR__ . '/../data');
if ($baseDir === false) {
  bad(500, 'Base data dir not found', ['expected' => __DIR__ . '/../data']);
}

$clipsDir = $baseDir . '/question_clips';
$participantDir = $clipsDir . '/' . $participantSafe;

// フォルダ作成（新しい参加者でも勝手に作られる）
if (!is_dir($clipsDir)) {
  if (!@mkdir($clipsDir, 0775, true)) {
    bad(500, 'Failed to mkdir clipsDir', ['clipsDir' => $clipsDir]);
  }
}
if (!is_dir($participantDir)) {
  if (!@mkdir($participantDir, 0775, true)) {
    bad(500, 'Failed to mkdir participantDir', ['participantDir' => $participantDir]);
  }
}

// ===== Determine extension =====
$mime = $f['type'] ?? '';
$ext = 'webm';
if (strpos($mime, 'mp4') !== false) $ext = 'mp4';
if (strpos($mime, 'ogg') !== false) $ext = 'ogg';

// ===== Unique filename (NO overwrite) =====
// 同名参加者・翌日でも絶対上書きしない命名
$ts = date('Ymd_His'); // ymd_his
$idxPart = ($index === null) ? 'idxNA' : ('idx' . (string)$index);

$base = $participantSafe . "_{$idxPart}_{$questionSafe}_{$ts}";
$fname = $base . ".{$ext}";

// 同名衝突したら後ろに乱数を付けて回避
$dstPath = $participantDir . '/' . $fname;
if (file_exists($dstPath)) {
  $rand = bin2hex(random_bytes(3));
  $fname = $base . "_" . $rand . ".{$ext}";
  $dstPath = $participantDir . '/' . $fname;
}


// move uploaded file
if (!@move_uploaded_file($tmpPath, $dstPath)) {
  bad(500, 'move_uploaded_file failed', [
    'dstPath' => $dstPath,
    'participantDirWritable' => is_writable($participantDir),
    'clipsDirWritable' => is_writable($clipsDir),
    'baseDirWritable' => is_writable($baseDir),
  ]);
}

// permission (任意)
@chmod($dstPath, 0664);

logline("SAVED ok path=$dstPath size=" . ($f['size'] ?? 'NA'));

echo json_encode([
  'ok' => true,
  'saved' => [
    'participant' => $participantSafe,
    'file' => $fname,
    'path' => $dstPath,
    'size' => $f['size'] ?? null,
    'mime' => $mime,
  ],
], JSON_UNESCAPED_UNICODE);
