// src/Login.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Login.css";

export default function Login() {
    const navigate = useNavigate();

    const [name, setName] = useState("");
    const [dest, setDest] = useState(null); // "Task" | "Screen"
    const [isFullscreen, setIsFullscreen] = useState(false);

    // fullscreen 状態を追従（ESCで抜けた時も反映）
    useEffect(() => {
        const sync = () => setIsFullscreen(!!document.fullscreenElement);
        sync();
        document.addEventListener("fullscreenchange", sync);
        return () => document.removeEventListener("fullscreenchange", sync);
    }, []);


    const trimmed = useMemo(() => name.trim(), [name]);

    // ★ フルスクリーン必須にする
    const canGo = trimmed.length > 0 && !!dest && isFullscreen;

    const toggleFullscreen = async () => {
        try {
            if (!document.fullscreenElement) {
                await document.documentElement.requestFullscreen();
            } else {
                await document.exitFullscreen();
            }
        } catch (e) {
            // 失敗してもUIは壊さない（iOS/Safari等）
            console.warn("Fullscreen request failed:", e);
        }
    };
    const go = () => {
        if (!canGo) return;

        // 必要なら state で渡せる（Task/Screen側で useLocation().state で受け取れる）
        navigate(`/${dest}`, { state: { participant: trimmed } });
    };

    return (
        <div className="login-root">
            <div className="login-card" role="form" aria-label="Login">

                <button
                    type="button"
                    className={`login-fs-btn ${isFullscreen ? "is-on" : ""}`}
                    onClick={toggleFullscreen}
                    aria-label="Fullscreen"
                    aria-pressed={isFullscreen}
                    title={isFullscreen ? "フルスクリーン解除" : "フルスクリーン"}
                >
                    ⛶
                </button>

                <div className="login-title">Login</div>

                <label className="login-label" htmlFor="name">
                    名前
                </label>
                <input
                    id="name"
                    className="login-input"
                    value={name}
                    placeholder="例: 山田太郎"
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    inputMode="text"
                />

                <div className="login-subtitle">モードを選択</div>

                <div className="login-seg" role="radiogroup" aria-label="Destination">
                    <button
                        type="button"
                        className={`login-seg-btn ${dest === "Task" ? "is-active" : ""}`}
                        onClick={() => setDest("Task")}
                        aria-pressed={dest === "Task"}
                    >
                        Task
                        <span className="login-seg-desc">実験参加者用</span>
                    </button>

                    <button
                        type="button"
                        className={`login-seg-btn ${dest === "Screen" ? "is-active" : ""}`}
                        onClick={() => setDest("Screen")}
                        aria-pressed={dest === "Screen"}
                    >
                        Screen
                        <span className="login-seg-desc">実験者用</span>
                    </button>
                </div>

                <button
                    type="button"
                    className="login-primary"
                    onClick={go}
                    disabled={!canGo}
                >
                    開始
                </button>

                <div className="login-hint">
                    {!isFullscreen
                        ? "フルスクリーンにしてから開始できます"
                        : "名前を入力し，モードを選択すると開始できます"}
                </div>
            </div>
        </div>
    );
}
