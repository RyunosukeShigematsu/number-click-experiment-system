// src/Task/Task.jsx
import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import "./Task.css";
import { TRIGGER_PLAN } from "./triggerPlan";
import { useLocation, useNavigate } from "react-router-dom";

const ROOM_ID = "dev-room";
const EVENTS_URL = "https://shigematsu.nkmr.io/m1_project/api/events.php";
const AUDIO_UPLOAD_URL = "https://shigematsu.nkmr.io/m1_project/api/upload_audio.php";
const TASKLOG_UPLOAD_URL = "https://shigematsu.nkmr.io/m1_project/api/upload_tasklog.php";



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

function beep({ durationMs = 120, freq = 880, gain = 0.12 } = {}) {
  const ctx = ensureAudio();
  if (!ctx) return;

  // 念のため（環境によっては必要）
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
  g.connect(ctx.destination);

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


export default function Task() {
  const TOTAL = 10;
  const COLS = 5;
  const GAP = 10;
  const CARRY_MARGIN = 5; // ★終わりの何個前から持ち越しにするか（後で調整）

  const navigate = useNavigate();

  const [isFullscreen, setIsFullscreen] = useState(false);

  const rows = Math.ceil(TOTAL / COLS);

  const [trialIndex, setTrialIndex] = useState(0); // 0-based（何トライアル目か）

  // グローバルに秒数を消費するポインタ（0-based）
  const [globalTrigPtr, setGlobalTrigPtr] = useState(0);

  // ★グリッドの“箱”を測る
  const gridBoxRef = useRef(null);
  const [cellPx, setCellPx] = useState(80); // 初期値は適当でOK


  const mediaStreamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);

  const recordStartTsRef = useRef(null);

  // ===== Task click log (per trial) =====
  // const taskLogRef = useRef([]);          // click events
  const taskZeroTsRef = useRef(null);     // "0ms" 기준 = start button time (epoch ms)
  const taskLogUploadedRef = useRef(false); // trialごとの二重upload防止

  const isLeavingRef = useRef(false);

  // ★持ち越しが発生したら、このトライアル中はトリガー処理を止める
  const [carryPending, setCarryPending] = useState(false);

  const hasStartedRef = useRef(false);

  // ★即時に止めたいので ref でも持つ（setState反映待ちの隙間を潰す）
  const carryPendingRef = useRef(false);

  const allTriggersConsumed = globalTrigPtr >= TRIGGER_PLAN.length;

  const recordStatusRef = useRef("recording"); // ★追加

  const { state } = useLocation();

  const participant =
    state?.participant ??
    sessionStorage.getItem("participant") ??
    "unknown";

  // ===== TaskLog: events を貯める =====
  const taskEventsRef = useRef([]);
  // ===== Beep回数カウンタ（trialごとにリセット） =====
  const beepCountRef = useRef(0);

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



  useEffect(() => {
    if (state?.participant) {
      sessionStorage.setItem("participant", state.participant);
    }
  }, [state?.participant]);


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



  const startRecording = useCallback(async ({ participant, trialIndex }) => {
    try {
      const cur = recorderRef.current;
      if (cur && cur.state !== "inactive") return; // recording / paused は全部弾く


      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      chunksRef.current = [];
      const mimeType = pickAudioMimeType();

      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = rec;

      // ★追加：録音開始時刻（epoch ms）
      recordStartTsRef.current = Date.now();

      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      // ★ Promiseをセット（stopRecordingがawaitできるように）
      recordStopPromiseRef.current = new Promise((resolve) => {
        rec.onstop = async () => {
          try {
            // ① mic停止
            try { mediaStreamRef.current?.getTracks()?.forEach((t) => t.stop()); } catch { }
            mediaStreamRef.current = null;

            // ② 録音時間（ms → 秒）を計算（★ここで定義する）
            const endTs = Date.now();
            const startTs = recordStartTsRef.current;
            const durationMs =
              typeof startTs === "number" ? Math.max(0, endTs - startTs) : null;

            // ③ blob生成
            const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
            chunksRef.current = [];

            // ④ upload（aborted/completed を meta に）
            await uploadAudioBlob(blob, {
              participant,
              trialNo: trialIndex + 1,
              status: recordStatusRef.current,
              startTs: startTs ?? null,
              endTs,
              durationMs, // ★ファイル名に使う用
            });

            recorderRef.current = null;
          } catch (e) {
            console.warn("rec.onstop failed", e);
          } finally {
            resolve();                    // ★ここが命
            recordStopPromiseRef.current = null;
          }
        };
      });

      rec.start(1000);


    } catch (e) {
      console.warn("startRecording failed", e);
    }
  }, [uploadAudioBlob]);

  const stopRecording = useCallback(async () => {
    try {
      const rec = recorderRef.current;
      if (!rec) return;
      const p = recordStopPromiseRef.current;
      if (rec.state !== "inactive") rec.stop(); // recording / paused をまとめて止める
      if (p) await p; // ★ ここが重要
    } catch (e) {
      console.warn("stopRecording failed", e);
    }
  }, []);

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
      // ★遅延中のビープ/送信を止める
      if (triggerTimerRef.current) {
        window.clearTimeout(triggerTimerRef.current);
        triggerTimerRef.current = null;
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


      }


      // stopRecording();
      (async () => {
        await stopRecording();
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
    // ★ 完了済みなら、今回の記録を履歴の先頭へ（最大5件）
    if (isCompleted && elapsedMs != null) {
      setHistory((prev) => {
        const next = [{ timeMs: elapsedMs, miss: missCount }, ...prev];
        return next.slice(0, 5);
      });
    }

    // 次の trialIndex を決める
    const nextTrial = trialIndex + 1;


    setIsStarted(false); // ★次トライアルは開始待ちに戻す  
    setIsCompleted(false);
    setNextNumber(1);
    setShuffleKey((k) => k + 1);
    setTrialIndex(nextTrial);

    // ★計測リセット
    setTrialStartAt(null);  // 次のuseEffectでスタート時刻が入る
    setElapsedMs(null);
    setMissCount(0);

    // 念のためまだ録音中なら止める（通常は既に止まってる）
    // recordStatusRef.current は触らない（completed/aborted の意味が崩れる）
    await stopRecording();

    recordStartTsRef.current = null;
    setTriggerBaseAt(null); // ★次の開始でセットし直す
    setCarryPending(false); // ★追加（念のため）
    carryPendingRef.current = false; // ★追加

    // ★ 遅延中のビープ/送信が残ってたらキャンセル
    if (triggerTimerRef.current) {
      window.clearTimeout(triggerTimerRef.current);
      triggerTimerRef.current = null;
    }

    // ===== task log reset (次トライアルへ向けて) =====
    taskZeroTsRef.current = null;
    // taskLogRef.current = [];
    taskLogUploadedRef.current = false;

    taskEventsRef.current = [];

  }, [isCompleted, elapsedMs, missCount, trialIndex, stopRecording]);

  // ===== トライアル開始（この画面になった瞬間）=====
  useEffect(() => {
    if (!isStarted) return;          // ★開始ボタン押すまで開始しない
    if (trialStartAt != null) return;
    if (nextNumber !== 1) return;

    const t = Date.now();
    setTrialStartAt(t);
    setTriggerBaseAt(t); // ★トリガー間隔の基準もtrial開始に

    setCarryPending(false); // ★追加：次トライアル開始で carry解除
    carryPendingRef.current = false; // ★追加


  }, [isStarted, trialStartAt, nextNumber]);

  useEffect(() => {
    if (!isStarted) return;
    if (triggerBaseAt == null) return;
    if (isCompleted) return;

    // ★持ち越し中は、このトライアルでは鳴らさない（次トライアルで再開）
    if (carryPendingRef.current) return;


    // 全部使い切ったら何もしない（＝この後は鳴らない）
    if (globalTrigPtr >= TRIGGER_PLAN.length) return;

    const timer = window.setInterval(() => {
      const trigger = TRIGGER_PLAN[globalTrigPtr];
      if (!trigger) return;

      const sec = trigger.intervalSec;
      const triggerNo = trigger.index; // 表示やログ用（1-based）


      const elapsedMs = Date.now() - triggerBaseAt;
      if (elapsedMs < sec * 1000) return;

      // ===== 持ち越し判定（終わりのCARRY_MARGIN個前に入ってたら carry）=====
      const shouldCarry = nextNumber > (TOTAL - CARRY_MARGIN);

      if (shouldCarry) {
        carryPendingRef.current = true; // ★まずrefで即止め
        setCarryPending(true);          // ★UI側も止め状態に
        return;
      }

      // ===== 表示（TRIGGER送信）→ 遅れてビープ（前コードと同じ思想）=====
      unlockAudio();

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
        beep({ durationMs: 220, freq: 1000, gain: 0.35 });
        // === beepイベント追加 ===
        beepCountRef.current += 1;
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
      }, TRIGGER_DELAY_MS);



      setGlobalTrigPtr((p) => p + 1);

      // 次の間隔は「今」から数える
      const now = Date.now();
      setTriggerBaseAt(now);
    }, 50);

    return () => window.clearInterval(timer);
  }, [
    isStarted,
    triggerBaseAt,
    isCompleted,
    globalTrigPtr,
    nextNumber,
    trialIndex,
    TOTAL,
    CARRY_MARGIN,
    carryPending, // ★追加
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


      // 完了後は押せない（進行しない）
      if (isCompleted) return;

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

          recordStatusRef.current = "completed";

          if (!taskLogUploadedRef.current) {
            taskLogUploadedRef.current = true;

            await uploadTaskLog({
              meta,
              events: taskEventsRef.current.filter(e => e.type === "click" || e.type === "beep"),
            });
          }

          await stopRecording();

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
      isStarted,
      isCompleted,
      nextNumber,
      TOTAL,
      trialStartAt,
      trialIndex,
      participant,
      missCount,
      COLS,
      uploadTaskLog,
      stopRecording,
    ]
  );

  // ===== ベスト記録（最速）=====
  const best = useMemo(() => {
    // 候補：履歴（過去）
    const candidates = [...history];

    // 候補：今回（完了してるなら追加）
    if (isCompleted && elapsedMs != null) {
      candidates.push({ timeMs: elapsedMs, miss: missCount });
    }

    if (candidates.length === 0) return null;

    // timeMs が最小のものを返す
    return candidates.reduce((bestSoFar, cur) => {
      return cur.timeMs < bestSoFar.timeMs ? cur : bestSoFar;
    });
  }, [history, isCompleted, elapsedMs, missCount]);



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
            await stopRecording();

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

                  // ===== 状態初期化 =====
                  setIsCompleted(false);
                  setFeedback(null);
                  setNextNumber(1);

                  setTrialStartAt(t0);
                  setTriggerBaseAt(t0);

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
                  if (!allTriggersConsumed) {
                    resetTrial();
                    return;
                  }

                  // ★終了：最後のトライアルは完了済みなので録音も基本止まってるはずだが念のため
                  recordStatusRef.current = "completed";
                  await stopRecording();
                  await new Promise((r) => setTimeout(r, 800));

                  // Completed画面へ
                  navigate("/Completed", { replace: true });
                }}
              >
                {allTriggersConsumed ? "終了" : "次のトライアルへ"}
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
