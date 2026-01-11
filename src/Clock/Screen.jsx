// src/Clock/Screen.jsx
import React, { useEffect, useRef, useState, useCallback } from "react";
import "./Screen.css";
import StimulusP5 from "./StimulusP5";
import { STIMULI_MIXED } from "./stimuli";

const ROOM_ID = "dev-room";
const POLL_MS = 250;
const EVENTS_URL = "https://shigematsu.nkmr.io/m1_project/api/events.php";

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

  // ★追加：未処理TRIGGERを溜める（表示中に来ても落とさない）
  const pendingRef = useRef(0);

  // ★追加：サーバイベントの読み取り位置（重複防止）
  const lastIdRef = useRef(0);

  // ✅ ガード：刺激配列が空なら何もしない
  const len = STIMULI_MIXED?.length ?? 0;
  if (len === 0) return null;

  // ✅ indexが範囲外にならないように
  const safeIndex = ((index % len) + len) % len;
  const [left, right, type, emphasize] = STIMULI_MIXED[safeIndex];

  const clearTimer = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  // アンマウント時にタイマー掃除
  useEffect(() => clearTimer, []);


  // いまの「クリックで表示」を関数化：TRIGGERでも手動でも同じ挙動
  const playOnce = useCallback(() => {
    // 表示中ならキューに積む
    if (showStimulus) {
      pendingRef.current += 1;
      return;
    }

    setShowStimulus(true);

    clearTimer();
    timerRef.current = window.setTimeout(() => {
      setShowStimulus(false);
      timerRef.current = null;

      // ✅ 次の刺激へ（len を使う）
      setIndex((i) => (i + 1) % len);

      // もし待ちがあれば、次も続けて表示（0msだと描画が詰まる時があるので少し待つ）
      if (pendingRef.current > 0) {
        pendingRef.current -= 1;
        window.setTimeout(() => {
          // ここで showStimulus は false になってるはず
          playOnce();
        }, 50);
      }
    }, 3000);
  }, [showStimulus, len]);

  // ★サーバから TRIGGER をポーリングして受信→playOnce()
  useEffect(() => {
    let alive = true;

    const tick = async () => {
      try {
        const since = lastIdRef.current || 0;
        const res = await fetch(
          `${EVENTS_URL}?roomId=${encodeURIComponent(ROOM_ID)}&since=${since}`,
          { cache: "no-store" }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        // 期待形式：{ ok:true, events:[{id, type, ...}, ...] }
        const events = Array.isArray(data?.events) ? data.events : [];

        for (const ev of events) {
          // id更新（重複防止）
          if (typeof ev.id === "number") {
            lastIdRef.current = Math.max(lastIdRef.current, ev.id);
          }

          if (ev?.type === "TRIGGER") {
            playOnce();
          }
        }
      } catch (e) {
        console.warn("poll failed", e);
      }
    };

    const loop = async () => {
      while (alive) {
        await tick();
        await new Promise((r) => setTimeout(r, POLL_MS));
      }
    };

    loop();
    return () => {
      alive = false;
    };
  }, [playOnce]);

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
            visible={showStimulus}
          />
        </div>
      </div>

      <div className="stimulus-controls">
        <button onClick={playOnce} disabled={false}>
          {showStimulus ? "表示中…" : "表示（3秒）"}
        </button>
      </div>
    </div>
  );
}
