import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

// Placeholder screen. The real app is built after the API and views are tested.
function App() {
  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: 16 }}>
      <h1>Gift Lists</h1>
      <p>Coming soon.</p>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
