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

    // ★ 追加：正解／ミスの一時フィードバック
    const [feedback, setFeedback] = useState(null);
    // { num: number, type: "correct" | "wrong" }

    // リセット：NEXTを1に戻して、配置もランダムにし直す
    const resetTrial = useCallback(() => {
        setNextNumber(1);
        setShuffleKey((k) => k + 1);
    }, []);

    // クリック処理：正解のときだけ進める／全部押し終えたらリセット
    const handleClick = useCallback(
        (num) => {
            if (num === nextNumber) {
                // 正解
                setFeedback({ num, type: "correct" });

                if (nextNumber >= TOTAL) {
                    resetTrial();
                } else {
                    setNextNumber((n) => n + 1);
                }
            } else {
                // ミス
                setFeedback({ num, type: "wrong" });
            }

            // ★ 一瞬で消す（アニメーション用）
            window.setTimeout(() => setFeedback(null), 220);
        },
        [nextNumber, TOTAL, resetTrial]
    );


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
                </div>

                <div className="right-reserve" />
            </div>
        </div>
    );
}
