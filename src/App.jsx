// src/App.jsx
import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./App.css";

import Task from "./Task/Task";
import Screen from "./Clock/Screen";

const BASENAME = "/m1_project/app"; // ★ 末尾スラッシュ無し推奨

export default function App() {
  return (
    <div className="no-select">
      <BrowserRouter basename={BASENAME}>
        <Routes>
          <Route path="/Task" element={<Task />} />
          <Route path="/Screen" element={<Screen />} />
          <Route path="/" element={<Navigate to="/Task" replace />} />
        </Routes>
      </BrowserRouter>
    </div >
  );
}
