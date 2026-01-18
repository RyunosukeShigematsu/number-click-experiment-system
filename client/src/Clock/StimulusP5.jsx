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
      const BASE_SIZE = 70;
      const BIG_SIZE = BASE_SIZE * 1.5; // ← 強調サイズ（調整可）

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
        const leftX = width * 0.33;
        const rightX = width * 0.67;

        // ★ Y位置：強調時は中央、非強調時は下げる
        const offsetY =  8; // ★ 下げる量を調整可能
        const leftY = emphasize === "right" ? centerY + offsetY : centerY;
        const rightY = emphasize === "left" ? centerY + offsetY : centerY;

        // ★ ":"のX軸オフセット（強調側に寄せる）
        const colonOffsetX = 5; // ★ ずらす量を調整可能
        let colonX = centerX;
        if (emphasize === "left") {
          colonX = centerX + colonOffsetX; // 左に寄せる
        } else if (emphasize === "right") {
          colonX = centerX - colonOffsetX; // 右に寄せる
        }

        // ★ ":"のY位置：強調側に合わせる
        const colonOffsetY = 5; // ★ ずらす量を調整可能
        let colonY = centerY - 5;
        if (emphasize === "left") {
          colonY = centerY + colonOffsetY; // 左と同じ高さ
        } else if (emphasize === "right") {
          colonY = centerY + colonOffsetY; // 右と同じ高さ
        }

        // ===== 左文字 =====
        p.textSize(
          emphasize === "left" ? BIG_SIZE : BASE_SIZE
        );
        p.text(left, leftX, leftY);

        // ===== 右文字 =====
        p.textSize(
          emphasize === "right" ? BIG_SIZE : BASE_SIZE
        );
        p.text(right, rightX, rightY);

        // ===== ":"（時刻のみ・サイズは常にベース）=====
        if (type === "time") {
          p.textSize(BASE_SIZE);
          p.text(":", colonX, colonY);
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
