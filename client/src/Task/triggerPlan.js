// src/experiment/triggerPlan.js

/**
 * 次のトリガーまでの間隔（秒）を並べた配列（1本だけ）
 * 例: [6, 9, 5] なら
 *  - 開始 +6秒 で trigger0
 *  - さらに +9秒 で trigger1（開始+15秒）
 *  - さらに +5秒 で trigger2（開始+20秒）
 */
// export const TRIGGER_PLAN = [
//   { index: 1, intervalSec: 6 },
//   { index: 2, intervalSec: 9 },
//   { index: 3, intervalSec: 5 },
//   { index: 4, intervalSec: 8 },
//   { index: 5, intervalSec: 7 },
// ];

  // { index: 1,  intervalSec: 28, Question: "question" },
  // { index: 2,  intervalSec: 32, Question: "ank1" },
  // { index: 3,  intervalSec: 26, Question: "question" },
  // { index: 4,  intervalSec: 35, Question: "23+19" },
  // { index: 5,  intervalSec: 29, Question: "question" },

  // { index: 6,  intervalSec: 31, Question: "ank2" },
  // { index: 7,  intervalSec: 27, Question: "31-16" },
  // { index: 8,  intervalSec: 34, Question: "question" },
  // { index: 9,  intervalSec: 30, Question: "28-13" },
  // { index: 10, intervalSec: 33, Question: "question" },

export const TRIGGER_PLAN = [
  { index: 0,  intervalSec: 28, Question: "question" },
  { index: 1,  intervalSec: 32, Question: "27-8" },
  { index: 2,  intervalSec: 26, Question: "question" },
  { index: 3,  intervalSec: 35, Question: "ank1" },
  { index: 4,  intervalSec: 29, Question: "question" },

  { index: 5,  intervalSec: 31, Question: "question" },
  { index: 6,  intervalSec: 27, Question: "18+17" },
  { index: 7,  intervalSec: 34, Question: "question" },
  { index: 8,  intervalSec: 30, Question: "ank2" },
  { index: 9,  intervalSec: 33, Question: "question" },

  { index: 10, intervalSec: 25, Question: "32-9" },
  { index: 11, intervalSec: 29, Question: "question" },
  { index: 12, intervalSec: 35, Question: "question" },
  { index: 13, intervalSec: 28, Question: "ank3" },
  { index: 14, intervalSec: 32, Question: "question" },

  { index: 15, intervalSec: 26, Question: "16+19" },
  { index: 16, intervalSec: 34, Question: "question" },
  { index: 17, intervalSec: 30, Question: "ank1" },
  { index: 18, intervalSec: 31, Question: "question" },
  { index: 19, intervalSec: 27, Question: "question" },

  { index: 20, intervalSec: 33, Question: "29-14" },
  { index: 21, intervalSec: 29, Question: "question" },
  { index: 22, intervalSec: 35, Question: "ank2" },
  { index: 23, intervalSec: 28, Question: "question" },
  { index: 24, intervalSec: 30, Question: "24+18" },

  { index: 25, intervalSec: 26, Question: "question" },
  { index: 26, intervalSec: 34, Question: "question" },
  { index: 27, intervalSec: 31, Question: "ank3" },
  { index: 28, intervalSec: 27, Question: "question" },
  { index: 29, intervalSec: 32, Question: "31-16" },

  { index: 30, intervalSec: 29, Question: "question" },
  { index: 31, intervalSec: 35, Question: "ank1" },
  { index: 32, intervalSec: 28, Question: "question" },
  { index: 33, intervalSec: 30, Question: "question" },
  { index: 34, intervalSec: 26, Question: "17+26" },

  { index: 35, intervalSec: 33, Question: "question" },
  { index: 36, intervalSec: 27, Question: "ank2" },
  { index: 37, intervalSec: 34, Question: "question" },
  { index: 38, intervalSec: 31, Question: "28-13" },
  { index: 39, intervalSec: 29, Question: "question" },

  { index: 40, intervalSec: 35, Question: "question" },
  { index: 41, intervalSec: 28, Question: "ank3" },
  { index: 42, intervalSec: 32, Question: "19+24" },
  { index: 43, intervalSec: 26, Question: "question" },
  { index: 44, intervalSec: 30, Question: "34-17" },

  { index: 45, intervalSec: 33, Question: "question" },
  { index: 46, intervalSec: 27, Question: "23+19" },
  { index: 47, intervalSec: 34, Question: "question" },
  { index: 48, intervalSec: 29, Question: "26-18" },
  { index: 49, intervalSec: 31, Question: "21+27" },
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