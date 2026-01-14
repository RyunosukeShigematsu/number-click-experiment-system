// src/experiment/triggerPlan.js

/**
 * trialIndex (0-based) ごとに
 * 「何番を押したときにトリガーを出すか」を定義
 */
export const TRIGGER_PLAN = [
  [5, 10, 15],
  [4, 7, 18],
];

export function getTriggerNumbers(trialIndex) {
  return TRIGGER_PLAN[trialIndex] ?? [];
}

/**
 * trialIndex と押した数字 num から
 * 「その trial 内で何回目のトリガーか」を返す
 * 該当しなければ null
 */
export function getTriggerIndex(trialIndex, num) {
  const arr = getTriggerNumbers(trialIndex);
  const idx = arr.indexOf(num);
  return idx === -1 ? null : idx;
}
