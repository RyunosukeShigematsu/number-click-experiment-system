// src/Clock/Screen.jsx
import React, { useEffect, useRef, useState, useCallback } from "react";
import "./Screen.css";
import StimulusP5 from "./StimulusP5";
import { STIMULUS_PLAN } from "./stimulusPlan";

const ROOM_ID = "dev-room";
const POLL_MS = 250;
const EVENTS_URL = "https://shigematsu.nkmr.io/m1_project/api/events.php";

export default function StimulusScreen({
  visible = true,
  canvasWidth = 400,
  canvasHeight = 220,
}) {
  if (!visible) return null;

  const [stimulus, setStimulus] = useState(["", "", "time", "normal"]);

  // ★ 追加：表示中フラグ（true=刺激表示、false=黒画面）
  const [showStimulus, setShowStimulus] = useState(false);

  // ★ 追加：3秒タイマー管理（連打/アンマウント対策）
  const timerRef = useRef(null);

  // ★追加：未処理TRIGGERを溜める（表示中に来ても落とさない）
  const pendingRef = useRef([]);

  // ★追加：サーバイベントの読み取り位置（重複防止）
  const lastIdRef = useRef(0);

  const totalTrials = STIMULUS_PLAN?.length ?? 0;
  if (totalTrials === 0) return null;

  // stimulus が未設定のときは適当な初期値（黒画面なので何でもOK）
  const [left, right, type, emphasize] = stimulus;

  const clearTimer = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  // アンマウント時にタイマー掃除
  useEffect(() => clearTimer, []);


  // いまの「クリックで表示」を関数化：TRIGGERでも手動でも同じ挙動
  const playOnce = useCallback((nextStimulus) => {
    // 表示中ならキューに積む
    if (showStimulus) {
      if (nextStimulus) pendingRef.current.push(nextStimulus);
      return;
    }

    // 表示する刺激を確定
    if (nextStimulus) setStimulus(nextStimulus);

    setShowStimulus(true);

    clearTimer();
    timerRef.current = window.setTimeout(() => {
      setShowStimulus(false);
      timerRef.current = null;

      const next = pendingRef.current.shift();
      if (next) {
        window.setTimeout(() => playOnce(next), 50);
      }
    }, 3000);
  }, [showStimulus]);

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
            const t = Number(ev.trialIndex);
            const k = Number(ev.triggerIndex);

            const next = STIMULUS_PLAN?.[t]?.[k] ?? null;
            if (next) {
              playOnce(next);
            } else {
              console.warn("No stimulus for", { trialIndex: ev.trialIndex, triggerIndex: ev.triggerIndex, ev });
            }
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
    </div>
  );
}
