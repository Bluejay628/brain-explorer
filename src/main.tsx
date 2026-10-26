import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import "./styles.css";
import { StoreProvider } from "./store";
import { Layout } from "./components/Layout";
import { Home } from "./pages/Home";
import { Explore } from "./pages/Explore";
import { Library } from "./pages/Library";
import { StudyDetail } from "./pages/StudyDetail";
import { Saved } from "./pages/Saved";
import { Settings } from "./pages/Settings";
import { Compare } from "./pages/Compare";

function NotFound() {
  return (
    <div className="panel empty">
      <p>That page doesn't exist.</p>
      <Link className="btn" to="/" style={{ marginTop: 12 }}>Go home</Link>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <StoreProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="explore" element={<Explore />} />
            <Route path="compare" element={<Compare />} />
            <Route path="library" element={<Library />} />
            <Route path="study/:id" element={<StudyDetail />} />
            <Route path="saved" element={<Saved />} />
            <Route path="settings" element={<Settings />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </StoreProvider>
  </React.StrictMode>,
);
