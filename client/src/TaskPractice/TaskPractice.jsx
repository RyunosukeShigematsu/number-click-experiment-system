// src/TaskPractice/TaskPractice.jsx
import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import "./TaskPractice.css";

const TOTAL = 10;
const COLS = 5;
const GAP = 10;

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

export default function TaskPractice() {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const rows = Math.ceil(TOTAL / COLS);

  // グリッドの"箱"を測る
  const gridBoxRef = useRef(null);
  const [cellPx, setCellPx] = useState(80);

  // ===== 計測 =====
  const [nextNumber, setNextNumber] = useState(1);
  const [isStarted, setIsStarted] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [trialStartAt, setTrialStartAt] = useState(null);
  const [elapsedMs, setElapsedMs] = useState(null);
  const [missCount, setMissCount] = useState(0);

  const [shuffleKey, setShuffleKey] = useState(0);

  const numbers = useMemo(() => {
    return shuffle(makeNumbers(TOTAL));
  }, [shuffleKey]);

  // ===== フルスクリーン状態 =====
  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(!!getFsEl());
    };

    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("webkitfullscreenchange", onFsChange); // Safari

    onFsChange();

    return () => {
      document.removeEventListener("fullscreenchange", onFsChange);
      document.removeEventListener("webkitfullscreenchange", onFsChange);
    };
  }, []);

  useEffect(() => {
    const el = gridBoxRef.current;
    if (!el) return;

    const ro = new ResizeObserver(() => {
      const boxW = el.clientWidth;
      const boxH = el.clientHeight;

      const maxByW = (boxW - GAP * (COLS - 1)) / COLS;
      const maxByH = (boxH - GAP * (rows - 1)) / rows;

      const next = Math.floor(Math.max(34, Math.min(maxByW, maxByH, 220)));

      setCellPx(next);
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, [COLS, rows, GAP]);

  // ===== スクロール完全禁止 =====
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

  const toggleFullscreen = useCallback(async () => {
    const fsEl = getFsEl();
    if (fsEl) {
      await exitFs();
      return;
    }

    await requestFs(document.documentElement);
  }, []);

  const resetTrial = useCallback(() => {
    setIsStarted(false);
    setIsCompleted(false);
    setNextNumber(1);
    setShuffleKey((k) => k + 1);

    setTrialStartAt(null);
    setElapsedMs(null);
    setMissCount(0);
  }, []);

  const handleClick = useCallback(
    (num, pos) => {
      if (!isStarted) return;

      if (isCompleted) return;

      if (num === nextNumber) {
        // 正解フィードバック
        setFeedback({ num, type: "correct" });

        if (nextNumber >= TOTAL) {
          setIsCompleted(true);
          const end = Date.now();
          const start = trialStartAt ?? end;
          const progress = TOTAL;

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
    [isStarted, isCompleted, nextNumber, TOTAL, trialStartAt]
  );

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

      <div className="layout">
        <div className="grid-wrap">
          <div className="next-indicator">
            {!isStarted ? (
              <button
                type="button"
                className="start-on-next"
                onClick={() => {
                  const t0 = Date.now();

                  setIsCompleted(false);
                  setFeedback(null);
                  setNextNumber(1);

                  setTrialStartAt(t0);

                  setElapsedMs(null);
                  setMissCount(0);

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
                onClick={() => {
                  resetTrial();
                }}
              >
                もう一度
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

          <div style={{ marginTop: "auto" }}>
            <button
              type="button"
              className="practice-exit-btn"
              onClick={() => {
                window.history.back();
              }}
            >
              練習を終了
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
