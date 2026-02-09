<?php
// m1_project/api/events.php
declare(strict_types=1);

header('Content-Type: application/json; charset=UTF-8');

// ===== CORS =====
$allowedOrigins = [
  'https://YOUR_DOMAIN.example',
];

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin && in_array($origin, $allowedOrigins, true)) {
  header("Access-Control-Allow-Origin: {$origin}");
  header("Vary: Origin");
  header("Access-Control-Allow-Credentials: true");
  header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
  header("Access-Control-Allow-Headers: Content-Type");
}

// preflight
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
  http_response_code(204);
  exit;
}

// ===== utils =====
function json_response(array $obj, int $code = 200): void {
  http_response_code($code);
  echo json_encode($obj, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  exit;
}

function safe_room_id(string $roomId): string {
  $roomId = preg_replace('/[^a-zA-Z0-9\-_]/', '_', $roomId);
  return $roomId ?: 'default';
}

function ensure_dir(string $dir): void {
  if (is_dir($dir)) return;
  if (!@mkdir($dir, 0777, true) && !is_dir($dir)) {
    $err = error_get_last();
    json_response([
      'ok' => false,
      'error' => 'cannot create events dir',
      'dir' => $dir,
      'detail' => $err['message'] ?? '',
    ], 500);
  }
}

function ensure_writable(string $dir): void {
  // Webサーバ権限で書けるかを本当に試す
  $testFile = $dir . '/.__write_test';
  $w = @file_put_contents($testFile, "ok\n", FILE_APPEND);
  if ($w === false) {
    $err = error_get_last();
    json_response([
      'ok' => false,
      'error' => 'events dir not writable (by web server)',
      'dir' => $dir,
      'detail' => $err['message'] ?? '',
    ], 500);
  }
  @unlink($testFile);
}

function read_json_body(): array {
  $raw = file_get_contents('php://input');
  if ($raw === false || $raw === '') return [];
  $data = json_decode($raw, true);
  return is_array($data) ? $data : [];
}

// ===== storage dir (★ここが重要：data/_eventsに固定) =====
$baseDir = realpath(__DIR__ . '/../data') . '/_events';
ensure_dir($baseDir);
ensure_writable($baseDir);

// ===== debug (動作確認用) =====
// https://shigematsu.nkmr.io/m1_project/api/events.php?debug=1
if (isset($_GET['debug'])) {
  json_response([
    'ok' => true,
    'baseDir' => $baseDir,
    'is_dir' => is_dir($baseDir),
    'is_writable' => is_writable($baseDir),
    'php_sapi' => PHP_SAPI,
  ]);
}

// ===== routing =====
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

// ===== POST: add event =====
if ($method === 'POST') {
  $body = read_json_body();

  $roomId = safe_room_id((string)($body['roomId'] ?? ''));
  $type = (string)($body['type'] ?? '');
  if ($type === '') json_response(['ok' => false, 'error' => 'type is required'], 400);

  // ===== RESET: eventsを空にする =====
  if ($type === 'RESET') {
    $file = "{$baseDir}/events_{$roomId}.jsonl";
    $idFile = "{$baseDir}/events_{$roomId}.id";

    // eventsファイルを空に（なければ作る）
    $w1 = @file_put_contents($file, "", LOCK_EX);
    if ($w1 === false) {
      $err = error_get_last();
      json_response(['ok' => false, 'error' => 'cannot reset events file', 'detail' => $err['message'] ?? ''], 500);
    }

    // idファイルも0に
    $w2 = @file_put_contents($idFile, "0", LOCK_EX);
    if ($w2 === false) {
      $err = error_get_last();
      json_response(['ok' => false, 'error' => 'cannot reset id file', 'detail' => $err['message'] ?? ''], 500);
    }

    json_response(['ok' => true, 'reset' => true, 'roomId' => $roomId]);
  }

  $event = $body;
  $event['roomId'] = $roomId;
  $event['serverTs'] = (int)floor(microtime(true) * 1000);

  $file = "{$baseDir}/events_{$roomId}.jsonl";
  $idFile = "{$baseDir}/events_{$roomId}.id";

  // ---- id採番（排他）----
  $fp = @fopen($idFile, 'c+');
  if (!$fp) {
    $err = error_get_last();
    json_response(['ok' => false, 'error' => 'cannot open id file', 'detail' => $err['message'] ?? ''], 500);
  }
  if (!flock($fp, LOCK_EX)) {
    fclose($fp);
    json_response(['ok' => false, 'error' => 'cannot lock id file'], 500);
  }

  $cur = 0;
  $idRaw = stream_get_contents($fp);
  if ($idRaw !== false && trim($idRaw) !== '') $cur = (int)trim($idRaw);
  $nextId = $cur + 1;

  ftruncate($fp, 0);
  rewind($fp);
  fwrite($fp, (string)$nextId);
  fflush($fp);
  flock($fp, LOCK_UN);
  fclose($fp);

  $event['id'] = $nextId;

  // ---- append jsonl ----
  $line = json_encode($event, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n";
  $efp = @fopen($file, 'ab');
  if (!$efp) {
    $err = error_get_last();
    json_response(['ok' => false, 'error' => 'cannot open events file', 'detail' => $err['message'] ?? ''], 500);
  }
  if (flock($efp, LOCK_EX)) {
    fwrite($efp, $line);
    fflush($efp);
    flock($efp, LOCK_UN);
  } else {
    fwrite($efp, $line);
    fflush($efp);
  }
  fclose($efp);

  json_response(['ok' => true, 'id' => $nextId, 'serverTs' => $event['serverTs']]);
}

// ===== GET: since以降 =====
if ($method === 'GET') {
  $roomId = safe_room_id((string)($_GET['roomId'] ?? 'default'));
  $since = (int)($_GET['since'] ?? 0);
  if ($since < 0) $since = 0;

  $file = "{$baseDir}/events_{$roomId}.jsonl";
  if (!file_exists($file)) json_response(['ok' => true, 'events' => []]);

  $events = [];
  $fh = @fopen($file, 'rb');
  if (!$fh) {
    $err = error_get_last();
    json_response(['ok' => false, 'error' => 'cannot read events file', 'detail' => $err['message'] ?? ''], 500);
  }

  $max = (int)($_GET['limit'] ?? 200);
  if ($max <= 0) $max = 200;
  if ($max > 1000) $max = 1000;

  while (!feof($fh)) {
    $line = fgets($fh);
    if ($line === false) break;
    $line = trim($line);
    if ($line === '') continue;

    $obj = json_decode($line, true);
    if (!is_array($obj)) continue;

    $id = (int)($obj['id'] ?? 0);
    if ($id > $since) {
      $events[] = $obj;
      if (count($events) >= $max) break;
    }
  }
  fclose($fh);

  json_response(['ok' => true, 'events' => $events]);
}

json_response(['ok' => false, 'error' => 'method not allowed'], 405);
