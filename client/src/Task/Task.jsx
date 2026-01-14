// src/Task/Task.jsx
import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import "./Task.css";
import { getTriggerIndex, TRIGGER_PLAN } from "./triggerPlan";

const ROOM_ID = "dev-room";
const EVENTS_URL = "https://shigematsu.nkmr.io/m1_project/api/events.php";

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

export default function Task() {
  const TOTAL = 20;
  const COLS = 5;
  const GAP = 10;

  const [isFullscreen, setIsFullscreen] = useState(false);

  const rows = Math.ceil(TOTAL / COLS);

  const [trialIndex, setTrialIndex] = useState(0); // 0-based（何トライアル目か）

  // ★グリッドの“箱”を測る
  const gridBoxRef = useRef(null);
  const [cellPx, setCellPx] = useState(80); // 初期値は適当でOK

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

  // ===== 履歴（直近5回分）=====
  const [history, setHistory] = useState([]);


  // リセット：NEXTを1に戻して、配置もランダムにし直す
  const resetTrial = useCallback(() => {
    const totalTrials = TRIGGER_PLAN.length;
    // ★ 完了済みなら、今回の記録を履歴の先頭へ（最大5件）
    if (isCompleted && elapsedMs != null) {
      setHistory((prev) => {
        const next = [{ timeMs: elapsedMs, miss: missCount }, ...prev];
        return next.slice(0, 5);
      });
    }

    // 次の trialIndex を決める
    const nextTrial = trialIndex + 1;

    // ★ 2トライアル終わったら一旦リロード
    if (nextTrial >= totalTrials) {
      // 念のため started/completed を戻す（体感のため）
      setIsStarted(false);
      setIsCompleted(false);
      // すぐリロード
      window.location.reload();
      return;
    }


    setIsStarted(false); // ★次トライアルは開始待ちに戻す  
    setIsCompleted(false);
    setNextNumber(1);
    setShuffleKey((k) => k + 1);
    setTrialIndex(nextTrial);

    // ★計測リセット
    setTrialStartAt(null);  // 次のuseEffectでスタート時刻が入る
    setElapsedMs(null);
    setMissCount(0);
  }, [isCompleted, elapsedMs, missCount, trialIndex]);

  // ===== トライアル開始（この画面になった瞬間）=====
  useEffect(() => {
    if (!isStarted) return;          // ★開始ボタン押すまで開始しない
    if (trialStartAt != null) return;
    if (nextNumber !== 1) return;

    setTrialStartAt(Date.now());
  }, [isStarted, trialStartAt, nextNumber]);

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
    (num) => {
      if (!isStarted) return; // ★開始前は押せない
      // 完了後は押せない（進行しない）
      if (isCompleted) return;

      if (num === nextNumber) {
        // 正解フィードバック
        setFeedback({ num, type: "correct" });

        // ★ trialIndex と num から、そのtrial内の triggerIndex を決定
        const tIdx = getTriggerIndex(trialIndex, num); // null or 0,1,2...
        if (tIdx != null) {
          // ★ クリック時点で音を解錠（安全）
          unlockAudio();
          // ★ 1秒後にビープ
          window.setTimeout(() => {
            beep({ durationMs: 220, freq: 1000, gain: 0.35 });
          }, 1500);
          // 非同期送信（UIは止めない）
          postTrigger({
            roomId: ROOM_ID,
            trialIndex,
            triggerIndex: tIdx,
            count: num,
          });
        }

        // 50達成したら「完了」にする（次へはボタン）
        if (nextNumber >= TOTAL) {
          setIsCompleted(true);
          // ★完了：経過時間を確定
          const end = Date.now();
          const start = trialStartAt ?? end; // 念のため
          setElapsedMs(end - start);
        } else {
          setNextNumber((n) => n + 1);
        }
      } else {
        // ミスフィードバック
        setFeedback({ num, type: "wrong" });
        // ★ミス回数加算
        setMissCount((m) => m + 1);
      }

      window.setTimeout(() => setFeedback(null), 220);
    },
    [isStarted, isCompleted, nextNumber, TOTAL, trialStartAt, trialIndex]
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
          onClick={() => {
            if (window.confirm("ホームに戻りますか？（実験は中断されます）")) {
              // basename を使ってるならこれが一番安全
              window.location.href = "/m1_project/app/";
              // もしくは: navigate("/")
            }
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

                  // ★開始
                  setIsStarted(true);

                  // 念のためトライアル初期化（開始時の状態を固定）
                  setIsCompleted(false);
                  setFeedback(null);
                  setNextNumber(1);

                  setTrialStartAt(null); // useEffectが入れる
                  setElapsedMs(null);
                  setMissCount(0);

                  // もし「開始押した瞬間に配置を確定したい」ならこれもON
                  // setShuffleKey((k) => k + 1);
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
                    onClick={() => handleClick(num)}
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
                onClick={resetTrial}
              >
                次のトライアルへ
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
