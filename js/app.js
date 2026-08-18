import { initApp, state, subscribe } from "./state.js";
import { startRouter, registerRoute, currentRoute } from "./router.js";
import { renderSidebar, renderBottomNav, openMobileSidebar, closeMobileSidebar } from "./components/nav.js";
import { mountQuickCapture } from "./components/quickCapture.js";
import { startGlobalTicker } from "./components/timer.js";
import { requestNotificationPermission } from "./components/toast.js";
import { renderProfilePicker } from "./views/profileSelect.js";
import { renderDashboard } from "./views/dashboard.js";
import { renderFrenteGeneric } from "./views/frenteGeneric.js";
import { renderTrabalho } from "./views/trabalho.js";
import { renderAgenda } from "./views/agenda.js";
import { renderSettings } from "./views/settings.js";
import { icon } from "./icons.js";
import { FRENTES } from "./frentes.js";

const root = document.getElementById("root");
let shellBuilt = false;

const TITLES = {
  dashboard: "Início",
  agenda: "Agenda",
  settings: "Ajustes",
};
FRENTES.forEach((f) => (TITLES[f.key] = f.label));

function buildShell() {
  root.innerHTML = `
    <div id="app-shell">
      <div class="sidebar-overlay" id="sidebar-overlay"></div>
      <nav class="sidebar" id="sidebar"></nav>
      <div id="main-area">
        <header class="topbar">
          <div class="flex items-center gap-8">
            <button class="btn btn-icon menu-toggle" id="menu-toggle">${icon("menu")}</button>
            <h1 id="topbar-title">Início</h1>
          </div>
          <div class="topbar-actions"></div>
        </header>
        <main id="view"></main>
      </div>
      <nav class="bottom-nav" id="bottom-nav"></nav>
    </div>
  `;
  document.getElementById("menu-toggle").addEventListener("click", openMobileSidebar);
  document.getElementById("sidebar-overlay").addEventListener("click", closeMobileSidebar);
  shellBuilt = true;
}

function refreshChrome() {
  if (!shellBuilt) return;
  const sidebar = document.getElementById("sidebar");
  const bottomNav = document.getElementById("bottom-nav");
  const title = document.getElementById("topbar-title");
  if (!sidebar) return;
  sidebar.innerHTML = "";
  sidebar.appendChild(renderSidebar());
  bottomNav.innerHTML = "";
  bottomNav.appendChild(renderBottomNav());
  const base = currentRoute().path.split("/")[0];
  const nextTitle = TITLES[base] || "Organização Pessoal";
  if (title && title.textContent !== nextTitle) {
    title.style.opacity = "0";
    requestAnimationFrame(() => {
      title.textContent = nextTitle;
      requestAnimationFrame(() => (title.style.opacity = "1"));
    });
  }
}

function setupRoutes() {
  registerRoute("dashboard", renderDashboard);
  FRENTES.filter((f) => f.kind !== "board").forEach((f) =>
    registerRoute(f.key, (ctx) => renderFrenteGeneric(f, ctx))
  );
  registerRoute("trabalho", renderTrabalho);
  registerRoute("agenda", renderAgenda);
  registerRoute("settings", renderSettings);
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
