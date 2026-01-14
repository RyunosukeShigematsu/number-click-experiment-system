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
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [stimulus, setStimulus] = useState({
    left: "",
    right: "",
    type: "time",
    emphasize: "normal",
  });

  // ★ 追加：表示中フラグ（true=刺激表示、false=黒画面）
  const [showStimulus, setShowStimulus] = useState(false);

  // ★ 追加：3秒タイマー管理（連打/アンマウント対策）
  const timerRef = useRef(null);

  // ★追加：未処理TRIGGERを溜める（表示中に来ても落とさない）
  const pendingRef = useRef([]);

  // ★追加：サーバイベントの読み取り位置（重複防止）
  const lastIdRef = useRef(0);

  const totalStimuli = STIMULUS_PLAN?.length ?? 0;
  if (totalStimuli === 0) return null;


  const { left, right, type, emphasize } = stimulus ?? {
    left: "",
    right: "",
    type: "time",
    emphasize: "normal",
  };

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
    }, 4000);
  }, [showStimulus]);

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
      if (el.webkitRequestFullscreen) return await el.webkitRequestFullscreen();
      if (el.mozRequestFullScreen) return await el.mozRequestFullScreen();
      if (el.msRequestFullscreen) return await el.msRequestFullscreen();
    } catch (e) {
      console.warn("requestFullscreen failed", e);
    }
  }

  async function exitFs() {
    try {
      if (document.exitFullscreen) return await document.exitFullscreen();
      if (document.webkitExitFullscreen) return await document.webkitExitFullscreen();
      if (document.mozCancelFullScreen) return await document.mozCancelFullScreen();
      if (document.msExitFullscreen) return await document.msExitFullscreen();
    } catch (e) {
      console.warn("exitFullscreen failed", e);
    }
  }

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(!!getFsEl());
    };

    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("webkitfullscreenchange", onFsChange);

    onFsChange(); // 初期反映

    return () => {
      document.removeEventListener("fullscreenchange", onFsChange);
      document.removeEventListener("webkitfullscreenchange", onFsChange);
    };
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const fsEl = getFsEl();
    if (fsEl) {
      await exitFs();
    } else {
      await requestFs(document.documentElement);
    }
  }, []);



  // ★サーバから TRIGGER をポーリングして受信→playOnce()
  useEffect(() => {
    let alive = true;

    const tick = async ({ skipPlay = false } = {}) => {
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

        // ★ まずIDだけ進める
        for (const ev of events) {
          if (typeof ev.id === "number") {
            lastIdRef.current = Math.max(lastIdRef.current, ev.id);
          }
        }

        // ★ 起動直後は再生しない
        if (skipPlay) return;

        for (const ev of events) {
          if (ev?.type === "TRIGGER") {
            const k = Number(ev.triggerIndex);
            if (!Number.isInteger(k) || k < 0) continue;

            const item = STIMULUS_PLAN?.[k] ?? null;
            if (item && typeof item === "object") {
              playOnce(item);
            } else {
              console.warn("Invalid stimulus at index", { k, item, ev });
            }
          }
        }
      } catch (e) {
        console.warn("poll failed", e);
      }
    };

    const loop = async () => {
      // ★ 起動時：過去分を消化（再生しない）
      await tick({ skipPlay: true });

      // ★ 以降は新着だけ再生
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

      {!isFullscreen && (
        <button
          type="button"
          className="menu-btn"
          onClick={() => {
            if (window.confirm("ホームに戻りますか？（実験は中断されます）")) {
              window.location.href = "/m1_project/app/";
              // or navigate("/")
            }
          }}
          aria-label="Menu"
          title="メニュー"
        >
          ⋯
        </button>
      )}

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
