// src/Clock/stimulusPlan.js

/**
 * triggerIndex(0-based) -> stimulus を1本で定義
 * Task側が送る triggerIndex と一致させる
 */
// export const STIMULUS_PLAN = [
//   { index: 0, left: "10", right: "47", type: "time",     emphasize: "normal" },
//   { index: 1, left: "62", right: "19", type: "number",   emphasize: "left" },
//   { index: 2, left: "QF", right: "RX", type: "alphabet", emphasize: "right" },
//   { index: 3, left: "39", right: "68", type: "number",   emphasize: "normal" },
//   { index: 4, left: "09", right: "32", type: "time",     emphasize: "normal" },
// ];


// export const STIMULUS_PLAN = [
//   // 0-4
//   { index: 0,  left: "GH", right: "JN", type: "alphabet", emphasize: "normal", Question: "question" }, // M time normal
//   { index: 1,  left: "MX", right: "GK", type: "alphabet", emphasize: "normal", Question: "27-8"     }, // C normal
//   { index: 2,  left: "57", right: "12", type: "number",   emphasize: "normal", Question: "question" }, // M number normal
//   { index: 3,  left: "QF", right: "RX", type: "alphabet", emphasize: "left",   Question: "ank1"     }, // A left
//   { index: 4,  left: "13", right: "58", type: "time",     emphasize: "normal", Question: "question" }, // M alpha normal
//   // 5-9
//   { index: 5,  left: "09", right: "32", type: "time",     emphasize: "left",   Question: "question" }, // M time left
//   { index: 6,  left: "73", right: "40", type: "number",   emphasize: "right",  Question: "18+17"    }, // C right (≠18,17)
//   { index: 7,  left: "28", right: "13", type: "number",   emphasize: "left",   Question: "question" }, // M number left
//   { index: 8,  left: "15", right: "27", type: "time",     emphasize: "normal", Question: "ank2"     }, // A normal
//   { index: 9,  left: "SO", right: "QM", type: "alphabet", emphasize: "left",   Question: "question" }, // M alpha left
//   // 10-14
//   { index: 10, left: "12", right: "55", type: "time",     emphasize: "right",  Question: "32-9"     }, // C right (≠32,09)
//   { index: 11, left: "07", right: "41", type: "time",     emphasize: "right",  Question: "question" }, // M time right
//   { index: 12, left: "SA", right: "TN", type: "alphabet", emphasize: "right",  Question: "question" }, // M alpha right
//   { index: 13, left: "62", right: "19", type: "number",   emphasize: "normal", Question: "ank3"     }, // A normal
//   { index: 14, left: "39", right: "68", type: "number",   emphasize: "right",  Question: "question" }, // M number right
//   // 15-19
//   { index: 15, left: "RJ", right: "QS", type: "alphabet", emphasize: "left",   Question: "16+19"    }, // C left
//   { index: 16, left: "15", right: "27", type: "time",     emphasize: "normal", Question: "question" }, // M time normal
//   { index: 17, left: "KL", right: "WF", type: "alphabet", emphasize: "right",  Question: "ank1"     }, // A right
//   { index: 18, left: "ZR", right: "HX", type: "alphabet", emphasize: "normal", Question: "question" }, // M alpha normal
//   { index: 19, left: "23", right: "19", type: "number",   emphasize: "normal", Question: "question" }, // M number normal
//   // 20-24
//   { index: 20, left: "07", right: "41", type: "time",     emphasize: "left",   Question: "29-14"    }, // C left (≠29,14)
//   { index: 21, left: "11", right: "06", type: "time",     emphasize: "left",   Question: "question" }, // M time left
//   { index: 22, left: "42", right: "75", type: "number",   emphasize: "right",  Question: "ank2"     }, // A right
//   { index: 23, left: "TA", right: "CG", type: "alphabet", emphasize: "left",   Question: "question" }, // M alpha left
//   { index: 24, left: "QJ", right: "LM", type: "alphabet", emphasize: "normal", Question: "24+18"    }, // C normal
//   // 25-29
//   { index: 25, left: "31", right: "16", type: "number",   emphasize: "left",   Question: "question" }, // M number left
//   { index: 26, left: "18", right: "44", type: "time",     emphasize: "normal", Question: "question" }, // M time normal
//   { index: 27, left: "21", right: "15", type: "time",     emphasize: "right",  Question: "ank3"     }, // A right
//   { index: 28, left: "LX", right: "BZ", type: "alphabet", emphasize: "normal", Question: "question" }, // M alpha normal
//   { index: 29, left: "62", right: "19", type: "number",   emphasize: "left",   Question: "31-16"    }, // C left (≠31,16)
//   // 30-34
//   { index: 30, left: "65", right: "30", type: "number",   emphasize: "normal", Question: "question" }, // M number normal
//   { index: 31, left: "ND", right: "JW", type: "alphabet", emphasize: "normal", Question: "ank1"     }, // A normal
//   { index: 32, left: "16", right: "19", type: "time",     emphasize: "right",  Question: "question" }, // M time right
//   { index: 33, left: "YT", right: "NI", type: "alphabet", emphasize: "right",  Question: "question" }, // M alpha right
//   { index: 34, left: "14", right: "08", type: "time",     emphasize: "normal", Question: "17+26"    }, // C normal (≠17,26)
//   // 35-39
//   { index: 35, left: "45", right: "72", type: "number",   emphasize: "right",  Question: "question" }, // M number right
//   { index: 36, left: "10", right: "47", type: "time",     emphasize: "left",   Question: "ank2"     }, // A left
//   { index: 37, left: "KC", right: "BR", type: "alphabet", emphasize: "right",  Question: "question" }, // M alpha right
//   { index: 38, left: "HU", right: "NJ", type: "alphabet", emphasize: "right",  Question: "28-13"    }, // C right (≠28,13)
//   { index: 39, left: "10", right: "47", type: "time",     emphasize: "left",   Question: "question" }, // M time left
//   // 40-44
//   { index: 40, left: "34", right: "17", type: "number",   emphasize: "left",   Question: "question" }, // M number left
//   { index: 41, left: "DI", right: "PT", type: "alphabet", emphasize: "left",   Question: "ank3"     }, // A left
//   { index: 42, left: "57", right: "12", type: "number",   emphasize: "normal", Question: "19+24"    }, // C normal (≠19,24)
//   { index: 43, left: "21", right: "15", type: "time",     emphasize: "right",  Question: "question" }, // M time right
//   { index: 44, left: "LP", right: "DZ", type: "alphabet", emphasize: "normal", Question: "34-17"    }, // C normal
//   // 45-49
//   { index: 45, left: "FO", right: "UZ", type: "alphabet", emphasize: "left",   Question: "question" }, // M alpha left
//   { index: 46, left: "17", right: "43", type: "time",     emphasize: "left",   Question: "23+19"    }, // C left (≠23,19)
//   { index: 47, left: "42", right: "75", type: "number",   emphasize: "right",  Question: "question" }, // M number right
//   { index: 48, left: "PY", right: "MD", type: "alphabet", emphasize: "right",  Question: "26-18"    }, // C right
//   { index: 49, left: "20", right: "04", type: "time",     emphasize: "left",   Question: "21+27"    }, // C left (≠21,27)
// ];


export const STIMULUS_PLAN = [
  { index: 0,  left: "18", right: "74", type: "number", emphasize: "normal", Question: "22+29" }, // Calc
  { index: 1,  left: "01", right: "10", type: "time",   emphasize: "right",  Question: "35-18" }, // Calc
  { index: 2,  left: "02", right: "45", type: "time",   emphasize: "normal", Question: "question" }, // CN

//   { index: 3,  left: "45", right: "87", type: "number", emphasize: "left",   Question: "ank2" }, // Ank2
//   { index: 4,  left: "05", right: "21", type: "time",   emphasize: "right",  Question: "14+27" }, // Calc
//   { index: 5,  left: "63", right: "29", type: "number", emphasize: "normal", Question: "question" }, // NN

//   { index: 6,  left: "09", right: "12", type: "time",   emphasize: "normal", Question: "33-15" }, // Calc
//   { index: 7,  left: "70", right: "19", type: "number", emphasize: "right",  Question: "18+17" }, // Calc
//   { index: 8,  left: "13", right: "30", type: "time",   emphasize: "left",   Question: "question" }, // CM (L)

//   { index: 9,  left: "32", right: "56", type: "number", emphasize: "left",   Question: "ank1" }, // Ank1
//   { index: 10, left: "18", right: "28", type: "time",   emphasize: "normal", Question: "41-23" }, // Calc
//   { index: 11, left: "79", right: "21", type: "number", emphasize: "left",   Question: "question" }, // NE (L)

//   { index: 12, left: "68", right: "41", type: "number", emphasize: "left",   Question: "ank3" }, // Ank3
//   { index: 13, left: "23", right: "12", type: "time",   emphasize: "right",  Question: "question" }, // CS
//   { index: 14, left: "25", right: "90", type: "number", emphasize: "normal", Question: "19+28" }, // Calc

//   { index: 15, left: "27", right: "52", type: "time",   emphasize: "right",  Question: "30-14" }, // Calc
//   { index: 16, left: "52", right: "16", type: "number", emphasize: "normal", Question: "question" }, // NN

//   { index: 17, left: "33", right: "40", type: "time",   emphasize: "left",   Question: "ank2" }, // Ank2
//   { index: 18, left: "84", right: "37", type: "number", emphasize: "left",   Question: "24+16" }, // Calc
//   { index: 19, left: "59", right: "73", type: "number", emphasize: "normal", Question: "28-13" }, // Calc

//   { index: 20, left: "38", right: "15", type: "time",   emphasize: "normal", Question: "question" }, // CN
//   { index: 21, left: "26", right: "65", type: "number", emphasize: "right",  Question: "19+24" }, // Calc
//   { index: 22, left: "44", right: "32", type: "time",   emphasize: "left",   Question: "ank1" }, // Ank1

//   { index: 23, left: "46", right: "21", type: "time",   emphasize: "normal", Question: "34-17" }, // Calc
//   { index: 24, left: "91", right: "48", type: "number", emphasize: "right",  Question: "question" }, // NE (R)
//   { index: 25, left: "51", right: "36", type: "time",   emphasize: "right",  Question: "question" }, // CM (R)

//   { index: 26, left: "34", right: "80", type: "number", emphasize: "left",   Question: "23+19" }, // Calc
//   { index: 27, left: "53", right: "10", type: "time",   emphasize: "right",  Question: "question" }, // CS
//   { index: 28, left: "57", right: "82", type: "number", emphasize: "left",   Question: "26-18" }, // Calc
//   { index: 29, left: "58", right: "25", type: "time",   emphasize: "right",  Question: "ank3" }, // Ank3
];
