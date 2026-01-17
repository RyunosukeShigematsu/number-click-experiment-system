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

// export const STIMULUS_PLAN = [
//   // 0-49 (50 trials): memory 27, survey 9 (1/2/3 x3), calc 14
//   { index: 0,  left: "16", right: "19", type: "time",     emphasize: "right",  Question: "question" },
//   { index: 1,  left: "62", right: "19", type: "number",   emphasize: "left",   Question: "ank1" },
//   { index: 2,  left: "QF", right: "RX", type: "alphabet", emphasize: "normal", Question: "question" },
//   { index: 3,  left: "23", right: "19", type: "time",     emphasize: "left",   Question: "23+19" },
//   { index: 4,  left: "57", right: "12", type: "number",   emphasize: "normal", Question: "question" },

//   { index: 5,  left: "14", right: "08", type: "time",     emphasize: "normal", Question: "ank2" },
//   { index: 6,  left: "31", right: "16", type: "number",   emphasize: "right",  Question: "31-16" },
//   { index: 7,  left: "HU", right: "NJ", type: "alphabet", emphasize: "left",   Question: "question" },
//   { index: 8,  left: "28", right: "13", type: "number",   emphasize: "normal", Question: "28-13" },
//   { index: 9,  left: "09", right: "32", type: "time",     emphasize: "left",   Question: "question" },

//   { index: 10, left: "19", right: "24", type: "number",   emphasize: "left",   Question: "19+24" },
//   { index: 11, left: "DK", right: "PT", type: "alphabet", emphasize: "right",  Question: "ank3" },
//   { index: 12, left: "10", right: "47", type: "time",     emphasize: "normal", Question: "question" },
//   { index: 13, left: "34", right: "17", type: "number",   emphasize: "left",   Question: "34-17" },
//   { index: 14, left: "73", right: "40", type: "number",   emphasize: "right",  Question: "question" },

//   { index: 15, left: "21", right: "27", type: "number",   emphasize: "normal", Question: "21+27" },
//   { index: 16, left: "18", right: "44", type: "time",     emphasize: "right",  Question: "ank1" },
//   { index: 17, left: "17", right: "26", type: "number",   emphasize: "right",  Question: "17+26" },
//   { index: 18, left: "MX", right: "GT", type: "alphabet", emphasize: "normal", Question: "question" },
//   { index: 19, left: "29", right: "14", type: "number",   emphasize: "left",   Question: "29-14" },

//   { index: 20, left: "39", right: "68", type: "number",   emphasize: "normal", Question: "ank2" },
//   { index: 21, left: "12", right: "55", type: "time",     emphasize: "left",   Question: "question" },
//   { index: 22, left: "18", right: "17", type: "number",   emphasize: "normal", Question: "18+17" },
//   { index: 23, left: "RJ", right: "QS", type: "alphabet", emphasize: "right",  Question: "question" },
//   { index: 24, left: "27", right: "08", type: "number",   emphasize: "normal", Question: "27-8" },

//   { index: 25, left: "74", right: "26", type: "number",   emphasize: "left",   Question: "question" },
//   { index: 26, left: "20", right: "04", type: "time",     emphasize: "normal", Question: "ank3" },
//   { index: 27, left: "32", right: "09", type: "number",   emphasize: "right",  Question: "32-9" },
//   { index: 28, left: "LP", right: "DZ", type: "alphabet", emphasize: "left",   Question: "question" },
//   { index: 29, left: "24", right: "18", type: "number",   emphasize: "left",   Question: "24+18" },

//   { index: 30, left: "07", right: "41", type: "time",     emphasize: "right",  Question: "question" },
//   { index: 31, left: "16", right: "19", type: "number",   emphasize: "normal", Question: "16+19" },
//   { index: 32, left: "KT", right: "WF", type: "alphabet", emphasize: "normal", Question: "ank1" },
//   { index: 33, left: "53", right: "87", type: "number",   emphasize: "normal", Question: "question" },
//   { index: 34, left: "15", right: "27", type: "time",     emphasize: "normal", Question: "question" },

//   { index: 35, left: "26", right: "18", type: "number",   emphasize: "right",  Question: "26-18" },
//   { index: 36, left: "11", right: "06", type: "time",     emphasize: "left",   Question: "ank2" },
//   { index: 37, left: "ZP", right: "HX", type: "alphabet", emphasize: "left",   Question: "question" },
//   { index: 38, left: "68", right: "25", type: "number",   emphasize: "left",   Question: "question" },
//   { index: 39, left: "31", right: "16", type: "number",   emphasize: "left",   Question: "question" },

//   { index: 40, left: "23", right: "19", type: "number",   emphasize: "normal", Question: "question" },
//   { index: 41, left: "13", right: "58", type: "time",     emphasize: "right",  Question: "question" },
//   { index: 42, left: "24", right: "47", type: "time",     emphasize: "left",   Question: "question" },
//   { index: 43, left: "PY", right: "ND", type: "alphabet", emphasize: "right",  Question: "ank3" },
//   { index: 44, left: "19", right: "24", type: "number",   emphasize: "right",  Question: "question" },

//   { index: 45, left: "17", right: "43", type: "time",     emphasize: "normal", Question: "question" },
//   { index: 46, left: "42", right: "75", type: "number",   emphasize: "right",  Question: "question" },
//   { index: 47, left: "23", right: "19", type: "time",     emphasize: "right",  Question: "ank1" },
//   { index: 48, left: "VF", right: "KR", type: "alphabet", emphasize: "normal", Question: "ank2" },
//   { index: 49, left: "19", right: "24", type: "alphabet", emphasize: "left",   Question: "question" },
// ];
