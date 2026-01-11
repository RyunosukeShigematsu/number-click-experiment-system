// src/Task/Task.jsx
import React, { useEffect, useMemo, useState, useCallback, useRef } from "react";
import "./Task.css";

const ROOM_ID = "dev-room";
const TRIGGERS = [5, 10, 15]; // とりあえず
const EVENTS_URL = "https://shigematsu.nkmr.io/m1_project/api/events.php";

async function postTrigger({ roomId, count, triggerIndex }) {
  try {
    await fetch(EVENTS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomId,
        type: "TRIGGER",
        from: "task",
        count,
        triggerIndex,
        clientTs: Date.now(),
      }),
    });
  } catch (e) {
    // 実験中は落ちないのが大事：失敗してもUIは止めない
    console.warn("postTrigger failed", e);
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

  const rows = Math.ceil(TOTAL / COLS);

  const [triggerIndex, setTriggerIndex] = useState(0); // 0-based

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
    // ★ 完了済みなら、今回の記録を履歴の先頭へ（最大5件）
    if (isCompleted && elapsedMs != null) {
      setHistory((prev) => {
        const next = [{ timeMs: elapsedMs, miss: missCount }, ...prev];
        return next.slice(0, 5);
      });
    }
    setIsStarted(false); // ★次トライアルは開始待ちに戻す  
    setIsCompleted(false);
    setNextNumber(1);
    setShuffleKey((k) => k + 1);
    setTriggerIndex(0);

    // ★計測リセット
    setTrialStartAt(null);  // 次のuseEffectでスタート時刻が入る
    setElapsedMs(null);
    setMissCount(0);
  }, [isCompleted, elapsedMs, missCount]);

  // ===== トライアル開始（この画面になった瞬間）=====
  useEffect(() => {
    if (!isStarted) return;          // ★開始ボタン押すまで開始しない
    if (trialStartAt != null) return;
    if (nextNumber !== 1) return;

    setTrialStartAt(Date.now());
  }, [isStarted, trialStartAt, nextNumber]);



  // クリック処理：正解のときだけ進める／全部押し終えたらリセット
  const handleClick = useCallback(
    (num) => {
      if (!isStarted) return; // ★開始前は押せない
      // 完了後は押せない（進行しない）
      if (isCompleted) return;

      if (num === nextNumber) {
        // 正解フィードバック
        setFeedback({ num, type: "correct" });


        if (TRIGGERS.includes(num)) {
          setTriggerIndex((prev) => {
            const next = prev + 1;
            // 非同期送信：state更新とは独立に投げる
            postTrigger({ roomId: ROOM_ID, count: num, triggerIndex: next });
            return next;
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
    [isStarted, isCompleted, nextNumber, TOTAL, trialStartAt]
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
      {/* 上部：NEXT表示（控えめ） */}
      <div className="top-reserve">
        <div className="top-left">
          <div className="next-indicator">
            {!isStarted ? (
              <button
                type="button"
                className="start-on-next"
                onClick={() => {
                  // ★開始
                  setIsStarted(true);

                  // 念のためトライアル初期化（開始時の状態を固定）
                  setIsCompleted(false);
                  setFeedback(null);
                  setNextNumber(1);
                  setTriggerIndex(0);

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
        </div>

        <div className="top-right" />
      </div>

      <div className="layout">
        <div className="grid-wrap">
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
