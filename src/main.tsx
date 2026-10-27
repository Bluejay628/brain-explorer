import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./styles.css";
import { StoreProvider } from "./store";
import { App } from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <StoreProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StoreProvider>
  </React.StrictMode>,
);
