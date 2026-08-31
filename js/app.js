import { initApp, state, subscribe } from "./state.js";
import { startRouter, registerRoute } from "./router.js";
import { renderTopNav, renderBottomNav } from "./components/nav.js";
import { mountQuickCapture } from "./components/quickCapture.js";
import { startGlobalTicker } from "./components/timer.js";
import { requestNotificationPermission } from "./components/toast.js";
import { renderProfilePicker } from "./views/profileSelect.js";
import { renderHub } from "./views/hub.js";
import { renderDashboard } from "./views/dashboard.js";
import { renderFrenteGeneric } from "./views/frenteGeneric.js";
import { renderTrabalho } from "./views/trabalho.js";
import { renderAgenda } from "./views/agenda.js";
import { renderSettings } from "./views/settings.js";
import { renderFinanceiro } from "./views/financeiro.js";
import { FRENTES } from "./frentes.js";

const root = document.getElementById("root");
let shellBuilt = false;

function buildShell() {
  root.innerHTML = `
    <div id="app-shell">
      <div id="hovernav-root"></div>
      <div id="main-area">
        <main id="view"></main>
      </div>
      <nav class="bottom-nav" id="bottom-nav"></nav>
    </div>
  `;
  shellBuilt = true;
}

function refreshChrome() {
  if (!shellBuilt) return;
  const hovernavRoot = document.getElementById("hovernav-root");
  const bottomNav = document.getElementById("bottom-nav");
  if (!hovernavRoot) return;
  hovernavRoot.innerHTML = "";
  hovernavRoot.appendChild(renderTopNav());
  bottomNav.innerHTML = "";
  bottomNav.appendChild(renderBottomNav());
}

function setupRoutes() {
  registerRoute("hub", renderHub);
  registerRoute("dashboard", renderDashboard);
  FRENTES.filter((f) => f.kind !== "board" && f.key !== "financeiro").forEach((f) =>
    registerRoute(f.key, (ctx) => renderFrenteGeneric(f, ctx))
  );
  registerRoute("trabalho", renderTrabalho);
  registerRoute("agenda", renderAgenda);
  registerRoute("settings", renderSettings);
  registerRoute("financeiro", renderFinanceiro);
}

function renderApp() {
  if (!state.ready) return;
  if (!state.profile) {
    shellBuilt = false;
    root.innerHTML = "";
    root.appendChild(renderProfilePicker());
    return;
  }
  if (!shellBuilt) {
    buildShell();
    setupRoutes();
    startRouter();
    window.addEventListener("hashchange", refreshChrome);
    mountQuickCapture();
    startGlobalTicker();
    requestNotificationPermission();
  }
  refreshChrome();
}

subscribe(renderApp);
initApp();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}
