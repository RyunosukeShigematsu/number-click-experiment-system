// src/experiment/triggerPlan.js

/**
 * 次のトリガーまでの間隔（秒）を並べた配列（1本だけ）
 * 例: [6, 9, 5] なら
 *  - 開始 +6秒 で trigger0
 *  - さらに +9秒 で trigger1（開始+15秒）
 *  - さらに +5秒 で trigger2（開始+20秒）
 */
export const TRIGGER_PLAN = [
  { index: 1, intervalSec: 6 },
  { index: 2, intervalSec: 9 },
  { index: 3, intervalSec: 5 },
  { index: 4, intervalSec: 8 },
  { index: 5, intervalSec: 7 },
];

/**
 * intervals(秒) → 「開始からの累積発火時刻(ms)」へ変換
 * return例: [6000, 15000, 20000, ...]
 */
export function intervalsToScheduleMs(intervalsSec = TRIGGER_INTERVALS_SEC) {
  const schedule = [];
  let acc = 0;
  for (const s of intervalsSec) {
    acc += s * 1000;
    schedule.push(acc);
  }
  return schedule;
}

/**
 * 経過時間 elapsedMs から「発火済み triggerIndex」を返す。
 * -1: まだ発火なし
 *  0: trigger0 まで発火済み
 *  1: trigger1 まで発火済み ...
 */
export function getFiredTriggerIndex(elapsedMs, intervalsSec = TRIGGER_INTERVALS_SEC) {
  const schedule = intervalsToScheduleMs(intervalsSec);

  let fired = -1;
  for (let i = 0; i < schedule.length; i++) {
    if (elapsedMs >= schedule[i]) fired = i;
    else break;
  }
  return fired;
}

/**
 * 次に発火すべき triggerIndex を返す（実装側で扱いやすい）
 * 0,1,2,... / null(全部発火済み)
 */
export function getNextTriggerIndex(elapsedMs, lastFiredIndex = -1, intervalsSec = TRIGGER_INTERVALS_SEC) {
  const fired = getFiredTriggerIndex(elapsedMs, intervalsSec);
  const next = Math.max(fired, lastFiredIndex) + 1;
  return next >= intervalsSec.length ? null : next;
}