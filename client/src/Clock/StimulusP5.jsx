// src/Clock/StimulusCenterP5.jsx
import React, { useEffect, useRef } from "react";
import p5 from "p5";

/**
 * 刺激提示の中心表示（p5）
 * - 今は「真っ黒なキャンバス」を出すだけ
 * - サイズは props の width / height を唯一の正とする
 */
export default function StimulusP5({
  width = 400,
  height = 220,
  left = "",
  right = "",
  type = "number", // "time" | "number" | "alphabet"
  emphasize = "normal",   // "left" | "right" | "normal"
  visible = true,
}) {
  const hostRef = useRef(null);
  const p5Ref = useRef(null);

  useEffect(() => {
    if (!hostRef.current) return;

    const sketch = (p) => {
      const BASE_SIZE = 72;
      const BIG_SIZE = 108; // ← 強調サイズ（調整可）

      p.setup = () => {
        p.createCanvas(width, height);
        p.noStroke();
        p.textAlign(p.CENTER, p.CENTER);
        p.textFont("monospace");
      };

      p.draw = () => {
        // 背景
        p.background(0);

        // ===== 非表示モード =====
        if (!visible) return;

        // ===== 表示モード =====
        p.fill(255);
        p.noStroke();
        p.fill(255);
        p.noStroke();

        const centerX = width / 2;
        const centerY = height / 2;

        // X位置
        const leftX = width * 0.27;
        const rightX = width * 0.73;

        // ===== 左文字 =====
        p.textSize(
          emphasize === "left" ? BIG_SIZE : BASE_SIZE
        );
        p.text(left, leftX, centerY);

        // ===== 右文字 =====
        p.textSize(
          emphasize === "right" ? BIG_SIZE : BASE_SIZE
        );
        p.text(right, rightX, centerY);

        // ===== ":"（時刻のみ・サイズは常にベース）=====
        if (type === "time") {
          p.textSize(BASE_SIZE);
          p.text(":", centerX, centerY);
        }
      };
    };


    p5Ref.current = new p5(sketch, hostRef.current);

    return () => {
      try {
        p5Ref.current?.remove();
      } catch (_) { }
      p5Ref.current = null;
    };
  }, [width, height, left, right, type, emphasize, visible]);

  // ★ wrap / canvas と必ず同じサイズ
  return (
    <div
      ref={hostRef}
      style={{
        width: `${width}px`,
        height: `${height}px`,
        background: "#000", // ★ 念のため
      }}
    />
  );
}
