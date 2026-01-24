// src/Task/Task.jsx
import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import "./Task.css";
import { TRIGGER_PLAN } from "./triggerPlan";
import { useLocation, useNavigate } from "react-router-dom";

const ROOM_ID = "dev-room";
const EVENTS_URL = "https://shigematsu.nkmr.io/m1_project/api/events.php";
const AUDIO_UPLOAD_URL = "https://shigematsu.nkmr.io/m1_project/api/upload_audio.php";
const TASKLOG_UPLOAD_URL = "https://shigematsu.nkmr.io/m1_project/api/upload_tasklog.php";
const TEXTLOG_UPLOAD_URL = "https://shigematsu.nkmr.io/m1_project/api/upload_textlog.php";
const QUESTION_CLIP_UPLOAD_URL = "https://shigematsu.nkmr.io/m1_project/api/upload_question_clip.php";





async function postTrigger({ roomId, trialIndex, triggerIndex, count }) {
  try {
    await fetch(EVENTS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomId,
        type: "TRIGGER",
        from: "task",
        // 研究用に必要な2つ（これが本命）
        trialIndex,     // 0-based
        triggerIndex,   // 0-based（trial内の何回目か）

        // デバッグに便利なので残してOK（要らなければ後で消せる）
        count,          // 押した番号
        trialNo: trialIndex + 1,       // 1-based（読みやすさ用）
        triggerNo: triggerIndex + 1,   // 1-based（読みやすさ用）
        clientTs: Date.now(),
      }),
    });
  } catch (e) {
    // 実験中は落ちないのが大事：失敗してもUIは止めない
    console.warn("postTrigger failed", e);
  }
}


// ===== Beep (WebAudio) =====
let _audioCtx = null;

function ensureAudio() {
  if (_audioCtx) return _audioCtx;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  _audioCtx = new Ctx();
  return _audioCtx;
}

// ユーザー操作のタイミングで呼んで音を許可（重要）
async function unlockAudio() {
  const ctx = ensureAudio();
  if (!ctx) return;
  if (ctx.state === "suspended") {
    try { await ctx.resume(); } catch { }
  }
}

function beep({ durationMs = 120, freq = 880, gain = 0.12, toMix = null } = {}) {
  const ctx = ensureAudio();
  if (!ctx) return;

  if (ctx.state === "suspended") ctx.resume().catch(() => { });

  const t0 = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();

  osc.type = "sine";
  osc.frequency.value = freq;

  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + durationMs / 1000);

  osc.connect(g);

  // ① いつも通りスピーカーへ
  g.connect(ctx.destination);

  // ② 追加：録音ミックスへ（あれば）
  if (toMix) {
    try { g.connect(toMix); } catch { }
  }

  osc.start(t0);
  osc.stop(t0 + durationMs / 1000 + 0.02);

  osc.onended = () => {
    try { osc.disconnect(); g.disconnect(); } catch { }
  };
}



// ===== Fullscreen =====
function getFsEl() {
  return (
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    document.mozFullScreenElement ||
    document.msFullscreenElement ||
    null
  );
}

async function requestFs(el) {
  try {
    if (el.requestFullscreen) return await el.requestFullscreen();
    if (el.webkitRequestFullscreen) return await el.webkitRequestFullscreen(); // Safari
    if (el.mozRequestFullScreen) return await el.mozRequestFullScreen();
    if (el.msRequestFullscreen) return await el.msRequestFullscreen();
  } catch (e) {
    console.warn("requestFullscreen failed", e);
  }
}

async function exitFs() {
  try {
    if (document.exitFullscreen) return await document.exitFullscreen();
    if (document.webkitExitFullscreen) return await document.webkitExitFullscreen(); // Safari
    if (document.mozCancelFullScreen) return await document.mozCancelFullScreen();
    if (document.msExitFullscreen) return await document.msExitFullscreen();
  } catch (e) {
    console.warn("exitFullscreen failed", e);
  }
}


function makeNumbers(n) {
  return Array.from({ length: n }, (_, i) => i + 1);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickAudioMimeType() {
  const cands = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",     // Safari系
    "audio/ogg;codecs=opus",
    "audio/ogg",
  ];
  for (const t of cands) {
    if (window.MediaRecorder?.isTypeSupported?.(t)) return t;
  }
  return ""; // 指定なしでも動くブラウザが多い
}

// ===== SpeechRecognition (Web Speech API) =====
function getSpeechRecognition() {
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}


export default function Task() {
  const TOTAL = 50;
  const COLS = 10;
  const GAP = 10;
  // const CARRY_MARGIN = 10; // ★終わりの何個前から持ち越しにするか（後で調整）

  const navigate = useNavigate();

  const [isFullscreen, setIsFullscreen] = useState(false);

  const rows = Math.ceil(TOTAL / COLS);

  const [trialIndex, setTrialIndex] = useState(0); // 0-based（何トライアル目か）

  const suppressMediaStopRef = useRef(false); // ★次トライアルへ等では止めない

  // グローバルに秒数を消費するポインタ（0-based）
  const [globalTrigPtr, setGlobalTrigPtr] = useState(0);

  // ★グリッドの“箱”を測る
  const gridBoxRef = useRef(null);
  const [cellPx, setCellPx] = useState(80); // 初期値は適当でOK


  const mediaStreamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);


  // ===== Internal Mix (mic + app sounds) =====
  const mixDestRef = useRef(null);        // MediaStreamDestination
  const micSourceRef = useRef(null);      // MediaStreamSource
  const sysGainRef = useRef(null);        // app sounds gain（beep/question）
  const micGainRef = useRef(null);        // mic gain（必要なら）
  const questionBufRef = useRef(new Map()); // (optional) decoded AudioBuffer cache



  const recordStartTsRef = useRef(null);

  const [endUnlocked, setEndUnlocked] = useState(false);
  const endUnlockTimerRef = useRef(null);

  // ===== Task click log (per trial) =====
  // const taskLogRef = useRef([]);          // click events
  const taskZeroTsRef = useRef(null);     // "0ms" 기준 = start button time (epoch ms)
  const taskLogUploadedRef = useRef(false); // trialごとの二重upload防止

  const isLeavingRef = useRef(false);

  const hasStartedRef = useRef(false);

  // ★即時に止めたいので ref でも持つ（setState反映待ちの隙間を潰す）
  // const carryPendingRef = useRef(false);

  const allTriggersConsumed = globalTrigPtr >= TRIGGER_PLAN.length;

  const recordStatusRef = useRef("recording"); // ★追加

  const { state } = useLocation();

  const participant =
    state?.participant ??
    sessionStorage.getItem("participant") ??
    "unknown";


  const [allHistory, setAllHistory] = useState(() => {
    try {
      const raw = sessionStorage.getItem(`allHistory:${participant}`);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  // ===== TaskLog: events を貯める =====
  const taskEventsRef = useRef([]);
  // ===== Beep回数カウンタ（trialごとにリセット） =====
  const beepCountRef = useRef(0);

  // ===== Beep: TRIGGER_PLAN.index を記録（meta用） =====
  const beepIndicesRef = useRef([]); // 例: [1,2,5,...]

  // ===== Text events（eventsは text のみ） =====
  const textEventsRef = useRef([]);  // events に入れる配列（textのみ）
  const textCountRef = useRef(0);    // meta用
  const textSeqRef = useRef(0);      // textId用

  // ===== Speech recognition refs =====
  const speechRecRef = useRef(null);
  const speechActiveRef = useRef(false);


  // 1イベント追加（trialをまたいでもOK。trialNoも入れる）
  const addTaskEvent = useCallback((type, payload = {}) => {
    taskEventsRef.current.push({
      type,
      ...payload,
      participant,
      trialNo: trialIndex + 1, // 1-basedで保存
      ts: Date.now(),
    });
  }, [participant, trialIndex]);

  const recordStopPromiseRef = useRef(null);

  const pushTextEvent = useCallback((text) => {
    const z = taskZeroTsRef.current;
    if (z == null) return;

    const now = Date.now();
    const tRelMs = Math.max(0, now - z);

    textSeqRef.current += 1;
    textCountRef.current += 1;

    textEventsRef.current.push({
      type: "text",
      tRelMs,
      textId: textSeqRef.current,
      text,
    });

    // ★ コンソールに表示（送信されていることを確認）
    console.log("TEXT_DETECTED", { textId: textSeqRef.current, text, tRelMs });
  }, []);


  useEffect(() => {
    if (state?.participant) {
      sessionStorage.setItem("participant", state.participant);
    }
  }, [state?.participant]);

  useEffect(() => {
    try {
      sessionStorage.setItem(`allHistory:${participant}`, JSON.stringify(allHistory));
    } catch { }
  }, [participant, allHistory]);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(`allHistory:${participant}`);
      setAllHistory(raw ? JSON.parse(raw) : []);
    } catch {
      setAllHistory([]);
    }
  }, [participant]);


  // ---- Task() 内に置く（participant 定義の後あたり）----

  const uploadAudioBlob = useCallback(async (blob, meta) => {
    try {
      const fd = new FormData();
      fd.append("audio", blob, "audio.webm");
      fd.append("meta", JSON.stringify(meta));

      const res = await fetch(AUDIO_UPLOAD_URL, { method: "POST", body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) console.warn("uploadAudioBlob not ok", res.status, json);
    } catch (e) {
      console.warn("uploadAudioBlob failed", e);
    }
  }, []);



  // ===== TaskLog: まとめてアップロード =====
  const uploadTaskLog = useCallback(async ({ meta, events }) => {
    try {
      const obj = {
        meta,
        events,
      };

      const blob = new Blob([JSON.stringify(obj, null, 2)], {
        type: "application/json",
      });

      const fd = new FormData();
      fd.append("meta", JSON.stringify(meta)); // ★PHPのファイル名用
      fd.append("log", blob, "taskLog.json");

      const res = await fetch(TASKLOG_UPLOAD_URL, { method: "POST", body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) console.warn("uploadTaskLog not ok", res.status, json);
    } catch (e) {
      console.warn("uploadTaskLog failed", e);
    }
  }, []);


  const uploadTextLog = useCallback(async ({ meta, events }) => {
    try {
      const blob = new Blob([JSON.stringify({ meta, events }, null, 2)], {
        type: "application/json",
      });

      const fd = new FormData();
      fd.append("meta", JSON.stringify(meta));
      fd.append("log", blob, "textLog.json");

      const res = await fetch(TEXTLOG_UPLOAD_URL, { method: "POST", body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) console.warn("uploadTextLog not ok", res.status, json);
    } catch (e) {
      console.warn("uploadTextLog failed", e);
    }
  }, []);

  const playQuestionAudio = useCallback(async (url) => {
    const ctx = ensureAudio();
    if (!ctx) throw new Error("AudioContext not available");
    if (ctx.state === "suspended") await ctx.resume().catch(() => { });

    // 既存再生があれば止める
    if (questionAudioRef.current) {
      try { questionAudioRef.current.stop?.(); } catch { }
      questionAudioRef.current = null;
    }

    // fetch → decode（キャッシュすると軽い）
    let buf = questionBufRef.current.get(url);
    if (!buf) {
      const res = await fetch(url);
      const arr = await res.arrayBuffer();
      buf = await ctx.decodeAudioData(arr);
      questionBufRef.current.set(url, buf);
    }

    const src = ctx.createBufferSource();
    src.buffer = buf;

    // 録音ミックスにも出す（あれば）
    const sysGain = sysGainRef.current;
    if (sysGain) src.connect(sysGain);

    src.start();
    questionNodeRef.current = src;

    src.onended = () => {
      if (questionNodeRef.current === src) questionNodeRef.current = null;
    };

  }, []);

  const uploadQuestionClipBlob = useCallback(async (blob, meta) => {
    try {
      const fd = new FormData();
      fd.append("audio", blob, "question_clip.webm");
      fd.append("meta", JSON.stringify(meta));

      const res = await fetch(QUESTION_CLIP_UPLOAD_URL, { method: "POST", body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) console.warn("uploadQuestionClipBlob not ok", res.status, json);
    } catch (e) {
      console.warn("uploadQuestionClipBlob failed", e);
    }
  }, []);

  const clipRecRef = useRef(null);
  const clipChunksRef = useRef([]);
  const clipBusyRef = useRef(false);

  const recordQuestionClip = useCallback(async ({
    participant,
    triggerIndex,        // globalTrigPtr（0-based）
    questionName,
    windowStartRelMs = -1000,
    windowEndRelMs = 20000,
  }) => {
    // 二重起動防止
    if (clipBusyRef.current) return;
    clipBusyRef.current = true;

    try {
      const ctx = ensureAudio();
      if (!ctx) throw new Error("AudioContext not available");
      if (ctx.state === "suspended") await ctx.resume().catch(() => { });

      const dest = mixDestRef.current;
      if (!dest?.stream) {
        console.warn("recordQuestionClip: mixDest not ready");
        return;
      }

      const mimeType = pickAudioMimeType();
      const rec = new MediaRecorder(dest.stream, mimeType ? { mimeType } : undefined);

      clipRecRef.current = rec;
      clipChunksRef.current = [];

      const clipStartTs = Date.now();

      const stopPromise = new Promise((resolve) => {
        rec.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) clipChunksRef.current.push(e.data);
        };
        rec.onstop = async () => {
          try {
            const clipEndTs = Date.now();
            const blob = new Blob(clipChunksRef.current, { type: rec.mimeType || "audio/webm" });
            clipChunksRef.current = [];

            await uploadQuestionClipBlob(blob, {
              participant,
              index: triggerIndex,          // ★ PHPが読むのは index
              question: questionName,       // ★ PHPが読むのは question
              clipStartTs,
              clipEndTs,
              durationMs: Math.max(0, clipEndTs - clipStartTs),
              windowStartRelMs,
              windowEndRelMs,
            });
          } catch (e) {
            console.warn("clip rec.onstop failed", e);
          } finally {
            clipRecRef.current = null;
            resolve();
          }
        };
      });
 
      rec.start(); // timeslice不要（短いので）
      const clipLenMs = (windowEndRelMs - windowStartRelMs); // 16000ms想定
      window.setTimeout(() => {
        try {
          if (rec.state !== "inactive") rec.stop();
        } catch { }
      }, clipLenMs);

      await stopPromise;
    } catch (e) {
      console.warn("recordQuestionClip failed", e);
    } finally {
      clipBusyRef.current = false;
    }
  }, [uploadQuestionClipBlob]);

const ensureAudioGraph = useCallback(async () => {
  const ctx = ensureAudio();
  if (!ctx) throw new Error("AudioContext not available");
  if (ctx.state === "suspended") await ctx.resume().catch(() => {});

  // もうdestがあるなら再利用（ここが命）
  if (mixDestRef.current?.stream && sysGainRef.current && micSourceRef.current) return;

  // まだマイク取ってなければ取る（1回だけ）
  if (!mediaStreamRef.current) {
    const micStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
    });
    mediaStreamRef.current = micStream;
  }

  // destination（録音用ミックス）を作って保持
  const dest = ctx.createMediaStreamDestination();
  mixDestRef.current = dest;

  // mic → micGain → dest
  const micSrc = ctx.createMediaStreamSource(mediaStreamRef.current);
  micSourceRef.current = micSrc;

  const micGain = ctx.createGain();
  micGain.gain.value = 1.0;
  micGainRef.current = micGain;

  micSrc.connect(micGain);
  micGain.connect(dest);

  // app sounds → sysGain → dest
  const sysGain = ctx.createGain();
  sysGain.gain.value = 0.5;
  sysGainRef.current = sysGain;
  sysGain.connect(dest);
}, []);


  const startRecording = useCallback(async ({ participant, trialIndex }) => {
  try {
    const cur = recorderRef.current;
    if (cur && cur.state !== "inactive") return;

    await ensureAudioGraph(); // ★ここが重要

    const dest = mixDestRef.current;
    if (!dest?.stream) {
      console.warn("startRecording: mixDest not ready");
      return;
    }

    chunksRef.current = [];
    const mimeType = pickAudioMimeType();
    const rec = new MediaRecorder(dest.stream, mimeType ? { mimeType } : undefined);
    recorderRef.current = rec;

    recordStartTsRef.current = Date.now();

    rec.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };

    recordStopPromiseRef.current = new Promise((resolve) => {
      rec.onstop = async () => {
        try {
          const endTs = Date.now();
          const startTs = recordStartTsRef.current;
          const durationMs = typeof startTs === "number" ? Math.max(0, endTs - startTs) : null;

          const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
          chunksRef.current = [];

          await uploadAudioBlob(blob, {
            participant,
            trialNo: trialIndex + 1,
            status: recordStatusRef.current,
            startTs: startTs ?? null,
            endTs,
            durationMs,
          });
        } catch (e) {
          console.warn("rec.onstop failed", e);
        } finally {
          recorderRef.current = null;
          recordStopPromiseRef.current = null;
          resolve();
        }
      };
    });

    rec.start(1000);
  } catch (e) {
    console.warn("startRecording failed", e);
  }
}, [ensureAudioGraph, uploadAudioBlob]);




  const startSpeech = useCallback(() => {
    const SR = getSpeechRecognition();
    if (!SR) {
      console.warn("SpeechRecognition not supported");
      return;
    }
    if (speechActiveRef.current) return;

    const rec = new SR();
    speechRecRef.current = rec;

    rec.lang = "ja-JP";
    rec.interimResults = false; // ★eventsはtextだけなのでfinalだけでOK
    rec.continuous = true;

    rec.onresult = (e) => {
      try {
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (!r.isFinal) continue;
          const text = (r?.[0]?.transcript ?? "").trim();
          if (!text) continue;
          console.log("SPEECH_RECOGNIZED", { text }); // ★ 検知時にもログ
          pushTextEvent(text);
        }
      } catch (err) {
        console.warn("speech onresult error", err);
      }
    };

    rec.onerror = (e) => console.warn("speech error", e);

    rec.onend = () => {
      // 勝手に止まるブラウザ対策：開始中なら再開
      if (speechActiveRef.current) {
        try { rec.start(); } catch { }
      }
    };

    try {
      rec.start();
      speechActiveRef.current = true;
    } catch (e) {
      console.warn("speech start failed", e);
    }
  }, [pushTextEvent]);

    const hardStopAudioGraph = useCallback(() => {
    try { mediaStreamRef.current?.getTracks()?.forEach((t) => t.stop()); } catch { }
    mediaStreamRef.current = null;

    try { micSourceRef.current?.disconnect(); } catch { }
    try { micGainRef.current?.disconnect(); } catch { }
    try { sysGainRef.current?.disconnect(); } catch { }

    micSourceRef.current = null;
    micGainRef.current = null;
    sysGainRef.current = null;
    mixDestRef.current = null;
  }, []);

  const stopSpeech = useCallback(() => {
    speechActiveRef.current = false;
    const rec = speechRecRef.current;
    if (!rec) return;
    try { rec.onend = null; } catch { }
    try { rec.stop(); } catch { }
    speechRecRef.current = null;
  }, []);

  const stopRecording = useCallback(async ({ hard = false } = {}) => {
    try {
      const rec = recorderRef.current;
      if (!rec) {
        if (hard) hardStopAudioGraph();
        return;
      }
      const p = recordStopPromiseRef.current;
      if (rec.state !== "inactive") rec.stop();
      if (p) await p;

      // ★ここでだけ“完全停止”
      if (hard) hardStopAudioGraph();
    } catch (e) {
      console.warn("stopRecording failed", e);
    }
  }, [hardStopAudioGraph]);


  useEffect(() => {
    const onBeforeUnload = () => {
      isLeavingRef.current = true;
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);



  useEffect(() => {
    const el = gridBoxRef.current;
    if (!el) return;

    const ro = new ResizeObserver(() => {
      const boxW = el.clientWidth;
      const boxH = el.clientHeight;

      // gap 分を引いた上で 1セルの最大サイズを決める
      const maxByW = (boxW - GAP * (COLS - 1)) / COLS;
      const maxByH = (boxH - GAP * (rows - 1)) / rows;

      // 小さすぎると押しにくいので下限・上限を付ける（好みで調整）
      const next = Math.floor(Math.max(34, Math.min(maxByW, maxByH, 220)));

      setCellPx(next);
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, [COLS, rows, GAP]);

  // ===== スクロール完全禁止（Task表示中だけ） =====
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;

    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    const prevBodyPosition = body.style.position;
    const prevBodyWidth = body.style.width;

    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.width = "100%";

    const prevent = (e) => e.preventDefault();
    window.addEventListener("wheel", prevent, { passive: false });
    window.addEventListener("touchmove", prevent, { passive: false });

    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
      body.style.position = prevBodyPosition;
      body.style.width = prevBodyWidth;
      window.removeEventListener("wheel", prevent);
      window.removeEventListener("touchmove", prevent);
    };
  }, []);

  const TRIGGER_DELAY_MS = 1000;      // ★ここで遅延量を調整
  const triggerTimerRef = useRef(null); // ★遅延タイマー（溜まり防止）

  // ===== 質問音声再生 =====
  const questionAudioRef = useRef(null);
  const questionNodeRef = useRef(null);
  const questionTimerRef = useRef(null);
  const QUESTION_DELAY_MS = 5000; // ★ beep から 6秒後に質問音声再生


  // ===== 配置（シャッフル） =====
  const [shuffleKey, setShuffleKey] = useState(0);

  const numbers = useMemo(() => {
    return shuffle(makeNumbers(TOTAL));
  }, [shuffleKey]);

  // ===== NEXT（次に押す番号） =====
  const [nextNumber, setNextNumber] = useState(1);

  // ===== 開始状態 =====
  const [isStarted, setIsStarted] = useState(false);

  // ===== 完了状態 =====
  const [isCompleted, setIsCompleted] = useState(false);

  // ★ 追加：正解／ミスの一時フィードバック
  const [feedback, setFeedback] = useState(null);

  // ===== 計測（今回の記録）=====
  const [trialStartAt, setTrialStartAt] = useState(null); // 開始時刻(ms)
  const [elapsedMs, setElapsedMs] = useState(null);       // 経過(ms) 完了時に確定
  const [missCount, setMissCount] = useState(0);          // ミス回数

  const nextNumberRef = useRef(1);
  useEffect(() => { nextNumberRef.current = nextNumber; }, [nextNumber]);

  const missCountRef = useRef(0);
  useEffect(() => { missCountRef.current = missCount; }, [missCount]);

  const trialIndexRef = useRef(0);
  useEffect(() => { trialIndexRef.current = trialIndex; }, [trialIndex]);

  const trialStartAtRef = useRef(null);
  useEffect(() => { trialStartAtRef.current = trialStartAt; }, [trialStartAt]);

  const participantRef = useRef(participant);
  useEffect(() => { participantRef.current = participant; }, [participant]);


  useEffect(() => {
    return () => {
      // ★中断（離脱）するときだけ止める
      if (isLeavingRef.current) {
        if (triggerTimerRef.current) {
          window.clearTimeout(triggerTimerRef.current);
          triggerTimerRef.current = null;
        }

        if (questionTimerRef.current) {
          window.clearTimeout(questionTimerRef.current);
          questionTimerRef.current = null;
        }
        // ★既存WebAudio再生があれば止める
        if (questionNodeRef.current) {
          try { questionNodeRef.current.stop(); } catch { }
          questionNodeRef.current = null;
        }


      }


      // ★本当に離脱する時だけ aborted 扱いにする
      if (!isLeavingRef.current) return;
      recordStatusRef.current = "aborted";

      // ★task log も（まだ送ってなければ）中断として送る
      // Start押してないなら絶対送らない
      if (!hasStartedRef.current) return;

      // zeroTs がない（開始が確定してない）なら送らない
      if (taskZeroTsRef.current == null) return;

      if (!taskLogUploadedRef.current) {
        taskLogUploadedRef.current = true;

        const end = Date.now();
        const z = taskZeroTsRef.current;

        const progress = Math.max(0, nextNumberRef.current - 1);
        uploadTaskLog({
          meta: {
            participant: participantRef.current,
            trialNo: trialIndexRef.current + 1,
            status: "aborted",
            total: TOTAL,
            progress,
            missClicks: missCountRef.current,
            beepCount: beepCountRef.current,
            elapsedMs: end - (trialStartAtRef.current ?? z),
          },
          events: taskEventsRef.current.filter(e => e.type === "click" || e.type === "beep"),
        });

        // ★ 全履歴に aborted を追加（離脱ケース）
        setAllHistory((prev) => [
          ...prev,
          {
            timeMs: end - (trialStartAtRef.current ?? z),
            miss: missCountRef.current,
            status: "aborted",
            trialNo: trialIndexRef.current + 1,
            progress,
          },
        ]);


        uploadTextLog({
          meta: {
            participant: participantRef.current,
            trialNo: trialIndexRef.current + 1,
            status: "aborted",
            elapsedMs: Date.now() - (trialStartAtRef.current ?? taskZeroTsRef.current),
            beepCount: beepCountRef.current,
            beepIndices: beepIndicesRef.current,
            textCount: textCountRef.current,
          },
          events: textEventsRef.current,
        });

        // speech停止（可能なら）
        stopSpeech();



      }


      // stopRecording();
      (async () => {
        await stopRecording({ hard: true });
      })();

    };
  }, []);


  // ★「次のトリガー間隔」を測る基準時刻（trial開始 or 前回ビープ）
  const [triggerBaseAt, setTriggerBaseAt] = useState(null);

  // ===== 履歴（直近5回分）=====
  const [history, setHistory] = useState([]);


  // リセット：NEXTを1に戻して、配置もランダムにし直す
  const resetTrial = useCallback(async () => {
    hasStartedRef.current = false;
    stopSpeech();          // ★追加（保険）
    await stopRecording(); // 既にあるならそのままでOK
    // ★ 完了済みなら、今回の記録を履歴の先頭へ（最大5件）
    if (isCompleted && elapsedMs != null) {
      setHistory((prev) => {
        const next = [{ timeMs: elapsedMs, miss: missCount }, ...prev];
        return next.slice(0, 5);
      });
    }

    // 次の trialIndex を決める
    const nextTrial = trialIndex + 1;


    setIsCompleted(false);
    setNextNumber(1);
    setShuffleKey((k) => k + 1);
    setTrialIndex(nextTrial);

    // ★計測リセット
    setTrialStartAt(null);  // 次のuseEffectでスタート時刻が入る
    setElapsedMs(null);
    setMissCount(0);

    // ★最後のトリガー後は endUnlocked 待ちを維持したいので、ここで消さない
    if (!allTriggersConsumed) {
      setEndUnlocked(false);
      if (endUnlockTimerRef.current) {
        window.clearTimeout(endUnlockTimerRef.current);
        endUnlockTimerRef.current = null;
      }
    }


    // 念のためまだ録音中なら止める（通常は既に止まってる）
    // recordStatusRef.current は触らない（completed/aborted の意味が崩れる）
    await stopRecording();

    recordStartTsRef.current = null;


    // ===== task log reset (次トライアルへ向けて) =====
    taskZeroTsRef.current = null;
    // taskLogRef.current = [];
    taskLogUploadedRef.current = false;

    taskEventsRef.current = [];

    // ★ text log も（ただしtrialごとにリセット） =====
    textEventsRef.current = [];
    textCountRef.current = 0;
    textSeqRef.current = 0;
    beepIndicesRef.current = [];

    setIsStarted(false);

  }, [isCompleted, elapsedMs, missCount, trialIndex, stopRecording, allTriggersConsumed]);

  // ===== トライアル開始（この画面になった瞬間）=====
  useEffect(() => {
    if (!isStarted) return;          // ★開始ボタン押すまで開始しない
    if (trialStartAt != null) return;
    if (nextNumber !== 1) return;

    const t = Date.now();
    setTrialStartAt(t);


  }, [isStarted, trialStartAt, nextNumber]);

  useEffect(() => {
    if (triggerBaseAt == null) return;


    // 全部使い切ったら何もしない（＝この後は鳴らない）
    if (globalTrigPtr >= TRIGGER_PLAN.length) return;

    const timer = window.setInterval(() => {
      const trigger = TRIGGER_PLAN[globalTrigPtr];
      if (!trigger) return;

      const sec = trigger.intervalSec;
      const triggerNo = trigger.index; // 表示やログ用（1-based）


      const beepIndex = trigger.index; // ★metaに入れたい ID（TRIGGER_PLANのindex）


      const elapsedMs = Date.now() - triggerBaseAt;
      if (elapsedMs < sec * 1000) return;

      // ===== 表示（TRIGGER送信）→ 遅れてビープ（前コードと同じ思想）=====
      unlockAudio();

      const isLastTrigger = globalTrigPtr === TRIGGER_PLAN.length - 1;
      if (isLastTrigger) {
        console.log("[LAST TRIGGER FIRED]", {
          triggerIndex: globalTrigPtr,
          at: Date.now(),
        });
      }

      if (isLastTrigger) {
        // 既存タイマーがあれば消す
        if (endUnlockTimerRef.current) {
          window.clearTimeout(endUnlockTimerRef.current);
          endUnlockTimerRef.current = null;
        }

        // ★希望どおり：トリガー発火から QUESTION_DELAY_MS + 30秒
        const WAIT_MS = QUESTION_DELAY_MS + 30_000;

        // ※もし「質問音声が鳴ってから30秒」にしたいなら ↓ に変える
        // const WAIT_MS = TRIGGER_DELAY_MS + QUESTION_DELAY_MS + 30_000;

        endUnlockTimerRef.current = window.setTimeout(() => {
          console.log("[END UNLOCKED AFTER QUESTION + 30s]", {
            at: Date.now(),
          });

          setEndUnlocked(true);
          endUnlockTimerRef.current = null;
        }, WAIT_MS);


      }


      // ① まず送る（= Screen側はこの瞬間に表示開始）
      postTrigger({
        roomId: ROOM_ID,
        trialIndex,
        triggerIndex: globalTrigPtr,
        count: nextNumber - 1,
      });

      addTaskEvent("TRIGGER_SENT", {
        triggerIndex: globalTrigPtr,
        count: nextNumber - 1,
      });


      // ② ビープだけ遅らせる（溜まり防止で直前予約は消す）
      if (triggerTimerRef.current) {
        window.clearTimeout(triggerTimerRef.current);
        triggerTimerRef.current = null;
      }

      triggerTimerRef.current = window.setTimeout(() => {
        beep({ durationMs: 220, freq: 1000, gain: 0.35, toMix: sysGainRef.current, });
        // ★beep回数
        beepCountRef.current += 1;

        // ★beepIndices（TRIGGER_PLAN.index）を保存
        beepIndicesRef.current.push(beepIndex);

        // === beepイベント追加 ===
        const z = taskZeroTsRef.current;
        if (z != null) {
          const tRelMs = Date.now() - z;
          taskEventsRef.current.push({
            type: "beep",
            tRelMs,
          });
          console.log("BEEP", { beepCount: beepCountRef.current, tRelMs });
        }
        triggerTimerRef.current = null;

        // ★ 質問音声を 6秒後に再生
        if (questionTimerRef.current) {
          window.clearTimeout(questionTimerRef.current);
          questionTimerRef.current = null;
        }

        const trigger = TRIGGER_PLAN[globalTrigPtr];
        const questionName = trigger?.Question ?? null;

        if (questionName) {
          // ★ クリップ録音：質問の直前1秒〜15秒後
          const CLIP_START_DELAY = Math.max(0, QUESTION_DELAY_MS - 1000); // 直前1秒
          window.setTimeout(() => {
            recordQuestionClip({
              participant,
              triggerIndex: globalTrigPtr, // このトリガーのID（0-based）
              questionName,
              windowStartRelMs: -1000,
              windowEndRelMs: 20000,
            });
          }, CLIP_START_DELAY);

          // ★ 質問音声自体は既存どおり QUESTION_DELAY_MS で再生
          questionTimerRef.current = window.setTimeout(() => {
            // 質問音声ファイルを再生
            const audioUrl = `/m1_project/app/public/questionAudio/${questionName}.mp3`;

            playQuestionAudio(audioUrl).catch((e) => {
              console.warn("Failed to play question audio (WebAudio)", { questionName, url: audioUrl, error: e });
            });

            if (questionAudioRef.current) {
              try { questionAudioRef.current.pause?.(); } catch { }
              questionAudioRef.current = null;
            }


            const audio = new Audio(audioUrl);
            questionAudioRef.current = audio;

            audio.onplay = () => {
              console.log("[LAST QUESTION PLAYED]", {
                questionName,
                at: Date.now(),
              });
            };

            audio.play().catch((e) => {
              console.warn("Failed to play question audio", { questionName, url: audioUrl, error: e });
            });

            questionTimerRef.current = null;
          }, QUESTION_DELAY_MS);
        }
      }, TRIGGER_DELAY_MS);



      setGlobalTrigPtr((p) => p + 1);

      // 次の間隔は「今」から数える
      const now = Date.now();
      setTriggerBaseAt(now);
    }, 50);

    return () => window.clearInterval(timer);
  }, [
    triggerBaseAt,
    globalTrigPtr,
    nextNumber,
    trialIndex,
    TOTAL,
  ]);




  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(!!getFsEl());
    };

    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("webkitfullscreenchange", onFsChange); // Safari

    // 初期反映
    onFsChange();

    return () => {
      document.removeEventListener("fullscreenchange", onFsChange);
      document.removeEventListener("webkitfullscreenchange", onFsChange);
    };
  }, []);

  const toggleFullscreen = useCallback(async () => {
    // ★音と同じで「ユーザー操作の瞬間」にやるのが重要
    unlockAudio();

    const fsEl = getFsEl();
    if (fsEl) {
      await exitFs();
      return;
    }

    // どこをフルスクリーンにするか：
    // - document.documentElement: 画面全体
    // - task-rootのdivだけ: Task領域だけ
    await requestFs(document.documentElement);
  }, []);

  // クリック処理：正解のときだけ進める／全部押し終えたらリセット
  const handleClick = useCallback(
    async (num, pos) => {
      console.log("CLICK", { isStarted, num, nextNumber, len: taskEventsRef.current.length });
      if (!isStarted) return; // ★開始前は押せない

      // ===== click event (Start button ms) =====
      const z = taskZeroTsRef.current;
      if (z != null) {
        const tRelMs = Date.now() - z;

        // num, nextNumber, pos(x,y) を events に積む
        taskEventsRef.current.push({
          type: "click",
          tRelMs,
          pressed: num,
          expected: nextNumber,
          isCorrect: num === nextNumber,
          x: pos?.x ?? null,
          y: pos?.y ?? null,
        });
      }

      if (num === nextNumber) {
        // 正解フィードバック
        setFeedback({ num, type: "correct" });

        addTaskEvent("CLICK_CORRECT", { num });


        // 50達成したら「完了」にする（次へはボタン）
        if (nextNumber >= TOTAL) {
          setIsCompleted(true);
          const end = Date.now();
          const z = taskZeroTsRef.current ?? end;
          const start = trialStartAt ?? z;
          const progress = TOTAL; // 完了なので確定

          const meta = {
            participant,
            trialNo: trialIndex + 1,
            status: "completed",
            total: TOTAL,
            progress,
            missClicks: missCount,
            beepCount: beepCountRef.current,
            elapsedMs: end - start,

          };

          setElapsedMs(end - start);

          setAllHistory((prev) => [
            ...prev,
            {
              timeMs: end - start,
              miss: missCount,
              status: "completed",
              trialNo: trialIndex + 1,
              progress: TOTAL,
            },
          ]);


          recordStatusRef.current = "completed";

          if (!taskLogUploadedRef.current) {
            taskLogUploadedRef.current = true;

            await uploadTaskLog({
              meta,
              events: taskEventsRef.current.filter(e => e.type === "click" || e.type === "beep"),
            });

            await uploadTextLog({
              meta: {
                participant,
                trialNo: trialIndex + 1,
                status: "completed",
                elapsedMs: end - start,
                beepCount: beepCountRef.current,
                beepIndices: beepIndicesRef.current,
                textCount: textCountRef.current,
              },
              events: textEventsRef.current, // ★textのみ
            });

            // stopSpeech();
            // await stopRecording();


          }

        } else {
          setNextNumber((n) => n + 1);
        }
      } else {
        // ミスフィードバック
        setFeedback({ num, type: "wrong" });
        addTaskEvent("CLICK_WRONG", { num, expected: nextNumber });

        // ★ミス回数加算
        setMissCount((m) => m + 1);
      }

      window.setTimeout(() => setFeedback(null), 220);
    },
    [
      nextNumber,
      TOTAL,
      trialStartAt,
      trialIndex,
      participant,
      missCount,
      COLS,
      uploadTaskLog,
      stopRecording,
      uploadTextLog,
      stopSpeech,
    ]
  );

  // ===== ベスト記録（最速）=====
  // ※ completed のみで最速を取る（aborted を入れると途中離脱が最速扱いになる）
  const best = useMemo(() => {
    const candidates = allHistory.filter((r) => r.status === "completed");
    if (candidates.length === 0) return null;

    return candidates.reduce((bestSoFar, cur) => {
      return cur.timeMs < bestSoFar.timeMs ? cur : bestSoFar;
    });
  }, [allHistory]);



  return (
    <div className="task-root">
      {!isFullscreen && (
        <button
          type="button"
          className="fs-btn"
          onClick={toggleFullscreen}
          aria-label="Fullscreen"
          title="フルスクリーン"
        >
          ⛶
        </button>
      )}

      {!isFullscreen && (
        <button
          type="button"
          className="menu-btn"
          onClick={async () => {
            if (!window.confirm("ホームに戻りますか？（実験は中断されます）")) return;

            isLeavingRef.current = true;

            // 中断扱いで止める
            recordStatusRef.current = "aborted";
            await stopRecording({ hard: true });

            // ===== task log upload (aborted) =====
            if (!taskLogUploadedRef.current) {
              // ★ Startしてないなら送らない
              if (!hasStartedRef.current) {
                // 何もしない（ログ無しで戻る）
              } else if (taskZeroTsRef.current == null) {
                // 何もしない（開始時刻が無いなら送らない）
              } else {
                taskLogUploadedRef.current = true;

                const end = Date.now();
                const z = taskZeroTsRef.current;
                const start = trialStartAt ?? z;

                const progress = Math.max(0, nextNumberRef.current - 1);

                // ★ 全履歴に aborted を追加（時間は「開始→中断」）
                setAllHistory((prev) => [
                  ...prev,
                  {
                    timeMs: end - start,
                    miss: missCountRef.current,
                    status: "aborted",
                    trialNo: trialIndexRef.current + 1,
                    progress,
                  },
                ]);

                await uploadTaskLog({
                  meta: {
                    participant: participantRef.current,
                    trialNo: trialIndexRef.current + 1,
                    status: "aborted",
                    total: TOTAL,
                    progress,
                    missClicks: missCountRef.current,
                    beepCount: beepCountRef.current,
                    elapsedMs: Date.now() - (trialStartAtRef.current ?? taskZeroTsRef.current),
                  },
                  events: taskEventsRef.current.filter(e => e.type === "click" || e.type === "beep"),
                });

                await uploadTextLog({
                  meta: {
                    participant: participantRef.current,
                    trialNo: trialIndexRef.current + 1,
                    status: "aborted",
                    elapsedMs: Date.now() - (trialStartAtRef.current ?? taskZeroTsRef.current),
                    beepCount: beepCountRef.current,
                    beepIndices: beepIndicesRef.current,
                    textCount: textCountRef.current,
                  },
                  events: textEventsRef.current,
                });

                // 中断なので speech は止める
                stopSpeech();



              }
            }


            // アップロードの猶予（短くてOK）
            await new Promise((r) => setTimeout(r, 800));

            window.location.href = "/m1_project/app/";
          }}

          aria-label="Menu"
          title="メニュー"
        >
          ⋯
        </button>
      )}



      <div className="layout">
        <div className="grid-wrap">
          {/* 上部：NEXT表示（控えめ） */}


          <div className="next-indicator">
            {!isStarted ? (
              <button
                type="button"
                className="start-on-next"
                onClick={() => {
                  unlockAudio(); // ★これがないと1秒後の音が鳴らないことがある

                  // ===== まずrefを確定（ここが超重要）=====
                  const t0 = Date.now();
                  taskZeroTsRef.current = t0;
                  hasStartedRef.current = true;

                  // ===== task log init =====
                  // taskLogRef.current = [];
                  taskLogUploadedRef.current = false;
                  taskEventsRef.current = [];   // ★これを追加（clickログを必ず新規に）
                  beepCountRef.current = 0;    // ★beep回数もリセット

                  // ===== text / beep index をtrialごとにリセット =====
                  textEventsRef.current = [];
                  textCountRef.current = 0;
                  textSeqRef.current = 0;
                  beepIndicesRef.current = [];

                  // ===== Speech start =====
                  startSpeech();

                  // ===== 状態初期化 =====
                  setIsCompleted(false);
                  setFeedback(null);
                  setNextNumber(1);

                  setTrialStartAt(t0);
                  setTriggerBaseAt(prev => (prev == null ? t0 : prev));

                  setElapsedMs(null);
                  setMissCount(0);

                  // ===== 録音 =====
                  recordStatusRef.current = "recording";

                  startRecording({ participant, trialIndex });

                  // ===== 最後に開始（再レンダーを最後に）=====
                  setIsStarted(true);
                }}

              >
                開始
              </button>
            ) : (
              <>
                NEXT:
                <span className="next-number">
                  {isCompleted ? "Done" : nextNumber}
                </span>
              </>
            )}
          </div>




          <div ref={gridBoxRef} className="grid-box">
            <div
              className="number-grid"
              style={{
                gridTemplateColumns: `repeat(${COLS}, ${cellPx}px)`,
                gridTemplateRows: `repeat(${rows}, ${cellPx}px)`,
                gap: `${GAP}px`,
              }}
            >
              {numbers.map((num, i) => {
                const r = Math.floor(i / COLS);
                const c = i % COLS;
                const d = r + c;

                const isCorrect = feedback?.num === num && feedback?.type === "correct";
                const isWrong = feedback?.num === num && feedback?.type === "wrong";

                const y = Math.floor(i / COLS);
                const x = i % COLS;

                return (
                  <button
                    key={`${shuffleKey}-${num}`}
                    type="button"
                    style={{ "--d": d }}
                    className={[
                      "cell",
                      isCompleted ? "cell--wave" : "",
                      isCorrect ? "cell--correct" : "",
                      isWrong ? "cell--wrong" : "",
                    ].filter(Boolean).join(" ")}
                    disabled={!isStarted || isCompleted}
                    onClick={() => handleClick(num, { x, y })}
                  >
                    {isStarted ? num : ""}
                  </button>
                );
              })}

            </div>
          </div>

          <div className="next-trial-slot">
            {isCompleted && (
              <button
                type="button"
                className="next-trial-button"
                onClick={async () => {
                  suppressMediaStopRef.current = true; // ★次へでは止めない
                  recordStatusRef.current = "completed";
                  stopSpeech();
                  await stopRecording();

                  // ★ここが重要：
                  // 終了できるのは「全トリガー消費」かつ「質問+30秒経過」の時だけ
                  if (allTriggersConsumed && endUnlocked) {
                    await stopRecording({ hard: true });
                    await new Promise((r) => setTimeout(r, 800));
                    navigate("/Completed", { replace: true });
                    return;
                  }

                  // ★それ以外（質問前 / 質問+30秒前 / そもそも未消費）は次トライアルへ
                  await resetTrial();
                  suppressMediaStopRef.current = false;
                }}
              >
                {(allTriggersConsumed && endUnlocked) ? "終了" : "次のトライアルへ"}
              </button>
            )}

          </div>
        </div>

        <div className="right-reserve">

          <div className="metrics-block metrics-current">
            <div className="metrics-title">今回の記録</div>

            <div className="metrics-row metrics-current-time">
              <span className="metrics-label">時間：</span>
              <span className="metrics-value">
                {elapsedMs == null ? "--.-" : (elapsedMs / 1000).toFixed(1)}
              </span>
              <span className="metrics-unit">秒</span>
            </div>

            <div className="metrics-row metrics-current-miss">
              <span className="metrics-label">ミス：</span>
              <span className="metrics-value">
                {isCompleted ? missCount : "--"}
              </span>
              <span className="metrics-unit">回</span>
            </div>
          </div>


          <div className="metrics-block metrics-best">
            <div className="metrics-title">ベスト記録</div>

            <div className="metrics-row metrics-row--time metrics-bestTimeRow">
              <span className="metrics-label metrics-bestTimeLabel">時間：</span>

              <span className="metrics-time metrics-bestTimeValue">
                {best ? (best.timeMs / 1000).toFixed(1) : "--.-"}
              </span>

              <span className="metrics-unit metrics-bestTimeUnit">秒</span>
            </div>

            <div className="metrics-row metrics-row--miss metrics-bestMiss">
              ミス：
              <span className="metrics-bestMissValue">
                {best ? best.miss : "--"}
              </span>
              回
            </div>
          </div>

          <div className="metrics-block">
            <div className="metrics-title">直近5回の履歴</div>
            <div className="metrics-history">
              {Array.from({ length: 5 }, (_, i) => {
                const h = history[i]; // 0が一番新しい
                return (
                  <div key={i}>
                    {i + 1}.{" "}
                    {h
                      ? `${(h.timeMs / 1000).toFixed(1)} 秒 / ${h.miss} 回`
                      : `--.- 秒 / -- 回`}
                  </div>
                );
              })}
            </div>
          </div>


        </div>

      </div>
    </div>
  );
}
