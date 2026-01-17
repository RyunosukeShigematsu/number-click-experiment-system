// src/TaskPractice/practiceTriggerPlan.js

/**
 * Practice用ビープ計画
 * 次のトリガーまでの間隔（秒）を並べた配列
 * 例: [3, 7, 3, 7] なら
 *  - 開始 +3秒 で trigger0
 *  - さらに +7秒 で trigger1（開始+10秒）
 *  - さらに +3秒 で trigger2（開始+13秒）
 *  - さらに +7秒 で trigger3（開始+20秒）
 *  ...
 *  この配列をループさせる
 */
export const PRACTICE_TRIGGER_PLAN = [10, 15, 12, 13];

/**
 * intervals(秒) → 「開始からの累積発火時刻(ms)」へ変換
 * return例: [4000, 10000, 15000, ...]
 */
export function intervalsToScheduleMs(intervalsSec = PRACTICE_TRIGGER_PLAN) {
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
 * ループするので、累積インデックスを返す
 * -1: まだ発火なし
 *  0: trigger0 まで発火済み
 *  1: trigger1 まで発火済み ...
 */
export function getFiredTriggerIndex(elapsedMs, intervalsSec = PRACTICE_TRIGGER_PLAN) {
  const schedule = intervalsToScheduleMs(intervalsSec);
  const cycleLengthMs = schedule[schedule.length - 1];

  // 何サイクル目か、そしてサイクル内でのoffset
  const cycleCount = Math.floor(elapsedMs / cycleLengthMs);
  const offsetInCycleMs = elapsedMs % cycleLengthMs;

  let fired = -1;
  for (let i = 0; i < schedule.length; i++) {
    if (offsetInCycleMs >= schedule[i]) {
      fired = cycleCount * schedule.length + i;
    } else {
      break;
    }
  }
  return fired;
}

/**
 * 次に発火すべき triggerIndex を返す
 * getFiredTriggerIndex の +1 版
 */
export function getNextTriggerIndex(elapsedMs, intervalsSec = PRACTICE_TRIGGER_PLAN) {
  return getFiredTriggerIndex(elapsedMs, intervalsSec) + 1;
}

/**
 * 次発火までの残り時間（ms）を返す
 */
export function getTimeUntilNextTriggerMs(elapsedMs, intervalsSec = PRACTICE_TRIGGER_PLAN) {
  const schedule = intervalsToScheduleMs(intervalsSec);
  const cycleLengthMs = schedule[schedule.length - 1];

  // 何サイクル目か、そしてサイクル内でのoffset
  const cycleCount = Math.floor(elapsedMs / cycleLengthMs);
  const offsetInCycleMs = elapsedMs % cycleLengthMs;

  for (let i = 0; i < schedule.length; i++) {
    if (offsetInCycleMs < schedule[i]) {
      return schedule[i] - offsetInCycleMs;
    }
  }

  // 1サイクル完了 → 次サイクルの最初へ
  return cycleLengthMs - offsetInCycleMs + schedule[0];
}
