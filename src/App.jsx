// src/App.jsx
import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Task from "./Task/Task";
import Screen from "./Clock/Screen";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Task */}
        <Route path="/Task" element={<Task />} />

        {/* ★ これを足すだけ */}
        <Route path="/Screen" element={<Screen />} />

        {/* お好み：/ は Task に */}
        <Route path="/" element={<Navigate to="/Task" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
