// src/App.jsx
import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./App.css";

import Task from "./Task/Task";
import Screen from "./Clock/Screen";
import Login from "./Login";
import Completed from "./Completed"; 

// ✅ ローカル(dev)は "/"、サーバ(build)は "/m1_project/app"
const BASENAME = import.meta.env.DEV ? "/" : "/m1_project/app";

export default function App() {
  return (
    <div className="no-select">
      <BrowserRouter basename={BASENAME}>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/Task" element={<Task />} />
          <Route path="/Screen" element={<Screen />} />
          <Route path="/Completed" element={<Completed />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </div >
  );
}
