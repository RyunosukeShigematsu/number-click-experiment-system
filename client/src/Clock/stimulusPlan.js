// src/Clock/stimulusPlan.js

/**
 * triggerIndex(0-based) -> stimulus を1本で定義
 * Task側が送る triggerIndex と一致させる
 */
export const STIMULUS_PLAN = [
  { index: 0, left: "10", right: "47", type: "time",     emphasize: "normal" },
  { index: 1, left: "62", right: "19", type: "number",   emphasize: "left" },
  { index: 2, left: "QF", right: "RX", type: "alphabet", emphasize: "right" },
  { index: 3, left: "39", right: "68", type: "number",   emphasize: "normal" },
  { index: 4, left: "09", right: "32", type: "time",     emphasize: "normal" },
];
