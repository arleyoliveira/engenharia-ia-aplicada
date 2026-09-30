import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { WarRoom } from "./ui/WarRoom";
import "./styles.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("Elemento #root ausente.");
}

createRoot(root).render(
  <StrictMode>
    <WarRoom />
  </StrictMode>,
);
