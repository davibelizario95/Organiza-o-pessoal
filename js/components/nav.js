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

// Barra de navegação do topo: fica oculta e só aparece quando o mouse passa
// pela faixa superior da tela (ver .hovernav-trigger/.hovernav no CSS).
// Reúne tudo que antes vivia na barra lateral: Frentes de vida, Agenda,
// Ajustes e o troca-perfil — a lateral deixou de existir.
export function renderTopNav() {
  const { path } = currentRoute();
  const active = path.split("/")[0];

  const frenteLinkHtml = (f) => `
    <button class="hovernav-link ${active === f.key ? "active" : ""}" data-nav="${f.key}">
      <span class="nav-dot" style="background:${f.color}"></span>
      <span>${f.label}</span>
      ${pendingCount(f.key) > 0 ? `<span class="badge-count">${pendingCount(f.key)}</span>` : ""}
    </button>`;

  const el = document.createElement("div");
  el.innerHTML = `
    <div class="hovernav-trigger" id="hovernav-trigger"></div>
    <nav class="hovernav" id="hovernav">
      <div class="hovernav-pill">
        <button class="hovernav-brand" id="hovernav-brand" title="Voltar ao início do perfil">
          <div class="brand-mark">OP</div>
        </button>
        <div class="hovernav-links">
          <button class="hovernav-link ${active === "hub" ? "active" : ""}" data-nav="hub">All</button>
          ${FRENTES.map(frenteLinkHtml).join("")}
          <span class="hovernav-divider"></span>
          <button class="hovernav-link ${active === "agenda" ? "active" : ""}" data-nav="agenda">Agenda</button>
          <button class="hovernav-link ${active === "settings" ? "active" : ""}" data-nav="settings">Ajustes</button>
        </div>
        <button class="hovernav-avatar avatar" id="hovernav-avatar" title="Trocar perfil" style="background-color:${state.profile?.color || "#888"}">${initials(state.profile?.name || "?")}</button>
      </div>
    </nav>
  `;

  const trigger = el.querySelector("#hovernav-trigger");
  const nav = el.querySelector("#hovernav");
  const open = () => nav.classList.add("open");
  const close = () => nav.classList.remove("open");
  trigger.addEventListener("mouseenter", open);
  nav.addEventListener("mouseenter", open);
  nav.addEventListener("mouseleave", close);

  el.querySelectorAll("[data-nav]").forEach((btn) => {
    btn.addEventListener("click", () => {
      navigate(btn.dataset.nav);
      close();
    });
  });
  el.querySelector("#hovernav-brand").addEventListener("click", () => {
    navigate("hub");
    close();
  });
  el.querySelector("#hovernav-avatar").addEventListener("click", () => {
    openProfileMenu();
    close();
  });
  return el;
}

export function openProfileMenu() {
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
    navigate("hub");
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
    <div class="profile-row" data-go="__profile">
      <div class="avatar" style="background-color:${state.profile?.color || "#888"}">${initials(state.profile?.name || "?")}</div>
      <div style="flex:1">
        <div style="font-weight:700;">${state.profile?.name || "Perfil"}</div>
        <div class="small text-dim">Trocar perfil</div>
      </div>
    </div>
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
      if (row.dataset.go === "__profile") openProfileMenu();
      else navigate(row.dataset.go);
    });
  });
}
