// src/Clock/Screen.jsx
import React, { useEffect, useRef, useState } from "react";
import "./Screen.css";
import StimulusP5 from "./StimulusP5";
import { STIMULI_MIXED } from "./stimuli";

export default function StimulusScreen({
  visible = true,
  canvasWidth = 400,
  canvasHeight = 220,
}) {
  if (!visible) return null;

  const [index, setIndex] = useState(0);

  // ★ 追加：表示中フラグ（true=刺激表示、false=黒画面）
  const [showStimulus, setShowStimulus] = useState(false);

  // ★ 追加：3秒タイマー管理（連打/アンマウント対策）
  const timerRef = useRef(null);

  const [left, right, type, emphasize] = STIMULI_MIXED[index];

  const clearTimer = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  // アンマウント時にタイマー掃除
  useEffect(() => clearTimer, []);

  const handleClick = () => {
    // 表示中に押しても無視（仕様として安全）
    if (showStimulus) return;

    // いまの index の刺激を表示
    setShowStimulus(true);

    // 3秒後に非表示（真っ黒）
    clearTimer();
    timerRef.current = window.setTimeout(() => {
      setShowStimulus(false);
      timerRef.current = null;

      // ★ 非表示になった段階で、次の刺激へ進める（次回クリックで表示される）
      setIndex((i) => (i + 1) % STIMULI_MIXED.length);
    }, 3000);
  };

  const vars = {
    "--stimulus-w": `${canvasWidth}px`,
    "--stimulus-h": `${canvasHeight}px`,
  };

  return (
    <div className="stimulus-screen" style={vars}>
      <div className="stimulus-stage">
        <div className="stimulus-center-wrap">
          <StimulusP5
            left={left}
            right={right}
            type={type}
            emphasize={emphasize}
            width={canvasWidth}
            height={canvasHeight}
            visible={showStimulus}   // ★ここが肝
          />
        </div>
      </div>

      <div className="stimulus-controls">
        <button onClick={handleClick} disabled={showStimulus}>
          {showStimulus ? "表示中…" : "表示（3秒）"}
        </button>
      </div>
    </div>
  );
}
