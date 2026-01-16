// src/Completed.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import "./Completed.css";

export default function Completed() {
  const navigate = useNavigate();

  const goHome = async () => {
    // フルスクリーン解除
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch (e) {
      console.warn("exitFullscreen failed", e);
    }

    navigate("/", { replace: true });
  };

  return (
    <div className="completed-root">
      <div className="completed-card" role="main" aria-label="Completed">
        <div className="completed-title">実験完了</div>

        <div className="completed-message">
          実験は終了しました。<br />
          お疲れ様でした！
        </div>

        <div className="completed-note">
          このあとアンケートを回答して終わりになります
        </div>

        <button
          type="button"
          className="completed-primary"
          onClick={goHome}
        >
          ログイン画面に戻る
        </button>
      </div>
    </div>
  );
}
