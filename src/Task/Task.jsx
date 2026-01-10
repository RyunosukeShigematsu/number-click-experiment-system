// src/Task/Task.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import "./Task.css";

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
  const TOTAL = 50;
  const COLS = 10;

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

    setIsCompleted(false);
    setNextNumber(1);
    setShuffleKey((k) => k + 1);

    // ★計測リセット
    setTrialStartAt(null);  // 次のuseEffectでスタート時刻が入る
    setElapsedMs(null);
    setMissCount(0);
  }, [isCompleted, elapsedMs, missCount]);

  // ===== トライアル開始（この画面になった瞬間）=====
  useEffect(() => {
    // すでに開始済みなら何もしない
    if (trialStartAt != null) return;

    // 念のため「次が1のとき」だけ開始にする（安全）
    if (nextNumber !== 1) return;

    setTrialStartAt(Date.now());
  }, [trialStartAt, nextNumber]);


  // クリック処理：正解のときだけ進める／全部押し終えたらリセット
  const handleClick = useCallback(
    (num) => {
      // 完了後は押せない（進行しない）
      if (isCompleted) return;

      if (num === nextNumber) {
        // 正解フィードバック
        setFeedback({ num, type: "correct" });

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
    [isCompleted, nextNumber, TOTAL, trialStartAt]
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
            NEXT:
            <span className="next-number">{nextNumber}</span>
          </div>
        </div>
        <div className="top-right" />
      </div>

      <div className="layout">
        <div className="grid-wrap">
          <div
            className="number-grid"
            style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}
          >
            {numbers.map((num) => (
              <button
                key={`${shuffleKey}-${num}`}
                type="button"
                className={`cell ${feedback?.num === num
                  ? feedback.type === "correct"
                    ? "cell--correct"
                    : "cell--wrong"
                  : ""
                  }`}
                onClick={() => handleClick(num)}
              >

                {num}
              </button>
            ))}
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
