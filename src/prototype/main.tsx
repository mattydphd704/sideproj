import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./prototype.css";
import { installMockFetch } from "./mockServer";
import { startMemoryRouting } from "../web/lib/router";
import { Prototype } from "./Prototype";

installMockFetch();
startMemoryRouting("/");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Prototype />
  </StrictMode>,
);
