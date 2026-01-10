// src/Task/Task.jsx
import React, { useEffect, useMemo } from "react";
import "./Task.css";

function makeNumbers(n = 60) {
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

  // ★ スクロール完全禁止（Task表示中だけ）
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;

    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    const prevBodyPosition = body.style.position;
    const prevBodyWidth = body.style.width;

    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    body.style.position = "fixed"; // iOSのバウンス対策
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

  const numbers = useMemo(() => shuffle(makeNumbers(TOTAL)), []);

  return (
    <div className="task-root">
      {/* 上に情報を置くための余白（今は空） */}
      <div className="top-reserve" />

      {/* 右に情報を置く予定なので、少し左寄りのメイン領域 */}
      <div className="layout">
        <div className="grid-wrap">
          <div
            className="number-grid"
            style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}
          >
            {numbers.map((num) => (
              <button key={num} type="button" className="cell" onClick={() => {}}>
                {num}
              </button>
            ))}
          </div>
        </div>

        {/* 右側に情報を出す予定のスペース（今は空の箱） */}
        <div className="right-reserve" />
      </div>
    </div>
  );
}
