import React from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.jsx";
import "./styles.css";

// Register the service worker in auto-update mode: when a new build has been
// installed and activated, the page reloads itself so the update shows right
// away (the plan is saved on every edit, so a reload never loses work). An
// installed app can stay open for days, so also poll for updates hourly.
registerSW({
  immediate: true,
  onRegisteredSW(_url, registration) {
    if (registration) setInterval(() => registration.update(), 60 * 60 * 1000);
  },
});

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
