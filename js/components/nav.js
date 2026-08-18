import { icon } from "../icons.js";
import { FRENTES } from "../frentes.js";
import { state, signOutProfile } from "../state.js";
import { currentRoute, navigate } from "../router.js";
import { openModal } from "./modal.js";

function initials(name = "") {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function pendingCount(frenteKey) {
  return state.items.filter((i) => i.frente === frenteKey && !i.completedAt && i.column !== "done").length;
}

const TOP_LINKS = [{ key: "dashboard", label: "Início", icon: "dashboard" }];
const BOTTOM_LINKS = [
  { key: "agenda", label: "Agenda", icon: "agenda" },
  { key: "settings", label: "Ajustes", icon: "settings" },
];

export function renderSidebar() {
  const { path } = currentRoute();
  const active = path.split("/")[0];

  const linkHtml = (l, color) => `
    <button class="nav-link ${active === l.key ? "active" : ""}" data-nav="${l.key}">
      ${color ? `<span class="nav-dot" style="background:${color}"></span>` : icon(l.icon)}
      <span>${l.label}</span>
      ${l.key !== "dashboard" && l.key !== "agenda" && l.key !== "settings" && pendingCount(l.key) > 0
        ? `<span class="badge-count">${pendingCount(l.key)}</span>`
        : ""}
    </button>`;

  const el = document.createElement("div");
  el.innerHTML = `
    <div class="brand">
      <div class="brand-mark">OP</div>
      <div class="brand-name">Organização Pessoal</div>
    </div>
    ${TOP_LINKS.map((l) => linkHtml(l)).join("")}
    <div class="nav-section-label">Frentes de vida</div>
    ${FRENTES.map((f) => linkHtml({ key: f.key, label: f.label, icon: f.icon }, f.color)).join("")}
    <div class="nav-section-label">Geral</div>
    ${BOTTOM_LINKS.map((l) => linkHtml(l)).join("")}
    <div class="profile-switcher" id="profile-switcher">
      <div class="avatar" style="background-color:${state.profile?.color || "#888"}">${initials(state.profile?.name || "?")}</div>
      <div>
        <div style="font-size:13px;font-weight:700;">${state.profile?.name || "Perfil"}</div>
        <div class="small text-dim">Trocar perfil</div>
      </div>
    </div>
  `;

  el.querySelectorAll("[data-nav]").forEach((btn) => {
    btn.addEventListener("click", () => {
      navigate(btn.dataset.nav);
      closeMobileSidebar();
    });
  });
  el.querySelector("#profile-switcher").addEventListener("click", openProfileMenu);
  return el;
}

function openProfileMenu() {
  const { body, close } = openModal({ title: "Perfil" });
  body.innerHTML = `
    <div class="flex items-center gap-8" style="margin-bottom:14px;">
      <div class="avatar" style="width:44px;height:44px;background-color:${state.profile?.color}">${initials(state.profile?.name || "?")}</div>
      <div>
        <div style="font-weight:700;">${state.profile?.name}</div>
        <div class="small text-dim">Ativo neste aparelho</div>
      </div>
    </div>
    <button class="btn" id="switch-profile-btn" style="width:100%;justify-content:flex-start;">Trocar de perfil</button>
    <button class="btn" id="goto-settings-btn" style="width:100%;justify-content:flex-start;margin-top:8px;">Ajustes do perfil</button>
  `;
  body.querySelector("#switch-profile-btn").onclick = () => {
    close();
    signOutProfile();
    navigate("dashboard");
  };
  body.querySelector("#goto-settings-btn").onclick = () => {
    close();
    navigate("settings");
  };
}

export function renderBottomNav() {
  const { path } = currentRoute();
  const active = path.split("/")[0];
  const items = [
    { key: "dashboard", label: "Início", icon: "dashboard" },
    { key: "trabalho", label: "Trabalho", icon: "trabalho" },
    { key: "agenda", label: "Agenda", icon: "agenda" },
    { key: "frentes", label: "Frentes", icon: "menu" },
  ];
  const el = document.createElement("div");
  el.innerHTML = items
    .map(
      (i) => `<button class="${active === i.key ? "active" : ""}" data-bnav="${i.key}">${icon(i.icon)}<span>${i.label}</span></button>`
    )
    .join("");
  el.querySelectorAll("[data-bnav]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.dataset.bnav === "frentes") {
        openFrentesSheet();
      } else {
        navigate(btn.dataset.bnav);
      }
    });
  });
  return el;
}

function openFrentesSheet() {
  const { body, close } = openModal({ title: "Frentes de vida" });
  body.innerHTML = `<div class="profile-list">
    ${FRENTES.map(
      (f) => `<div class="profile-row" data-go="${f.key}">
        <span class="nav-dot" style="background:${f.color};width:12px;height:12px;"></span>
        <div style="flex:1">${f.label}</div>
        ${pendingCount(f.key) > 0 ? `<span class="badge-count">${pendingCount(f.key)}</span>` : ""}
      </div>`
    ).join("")}
    <div class="profile-row" data-go="settings">${icon("settings")}<div style="flex:1">Ajustes</div></div>
  </div>`;
  body.querySelectorAll("[data-go]").forEach((row) => {
    row.addEventListener("click", () => {
      close();
      navigate(row.dataset.go);
    });
  });
}

export function openMobileSidebar() {
  document.getElementById("sidebar")?.classList.add("open");
  document.getElementById("sidebar-overlay")?.classList.add("open");
}
export function closeMobileSidebar() {
  document.getElementById("sidebar")?.classList.remove("open");
  document.getElementById("sidebar-overlay")?.classList.remove("open");
}
