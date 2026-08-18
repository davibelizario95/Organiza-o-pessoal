import { state, isTrustedOnThisDevice, trustProfileOnThisDevice, selectProfile } from "../state.js";
import { createProfile } from "../store.js";
import { randomPin } from "../utils.js";
import { icon } from "../icons.js";
import { openModal } from "../components/modal.js";
import { toast } from "../components/toast.js";

function initials(name = "") {
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Boa madrugada";
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export function renderProfilePicker() {
  const wrap = document.createElement("div");
  wrap.className = "profile-picker-wrap";
  wrap.innerHTML = `
    <div class="profile-picker">
      <div style="text-align:center;margin-bottom:8px;">
        <div class="brand-mark" style="margin:0 auto 12px;width:44px;height:44px;font-size:18px;">OP</div>
        <p class="greeting">${greeting()}</p>
        <h1 style="font-size:20px;">Organização Pessoal</h1>
        <p class="text-dim small">Escolha seu perfil para continuar</p>
      </div>
      <div class="profile-list" id="profile-list"></div>
      <button class="btn" id="new-profile-btn" style="width:100%;">${icon("plus")} Criar novo perfil</button>
    </div>
  `;

  const list = wrap.querySelector("#profile-list");
  state.profiles.forEach((p, i) => {
    const row = document.createElement("div");
    row.className = "profile-row";
    row.style.setProperty("--row-i", i);
    row.innerHTML = `
      <div class="avatar" style="background-color:${p.color || "#888"}">${initials(p.name)}</div>
      <div style="flex:1">
        <div style="font-weight:700;font-size:14px;">${p.name}</div>
        <div class="small text-dim">${isTrustedOnThisDevice(p.id) ? "Continuar" : "Confirmar PIN para entrar"}</div>
      </div>
      ${icon("chevronRight")}
    `;
    row.addEventListener("click", () => handleSelect(p));
    list.appendChild(row);
  });

  if (state.profiles.length === 0) {
    list.innerHTML = `<div class="empty-state">Nenhum perfil ainda. Crie o primeiro abaixo.</div>`;
  }

  wrap.querySelector("#new-profile-btn").addEventListener("click", openCreateProfile);

  return wrap;
}

function handleSelect(profile) {
  if (isTrustedOnThisDevice(profile.id)) {
    selectProfile(profile.id);
    return;
  }
  const { body, close } = openModal({ title: `Entrar como ${profile.name}` });
  body.innerHTML = `
    <p class="small text-dim">Digite o PIN de 4 dígitos deste perfil. Você encontra o PIN em Ajustes, no aparelho onde o perfil foi criado.</p>
    <input type="text" inputmode="numeric" maxlength="4" class="pin-input" id="pin-field" placeholder="••••" />
    <button class="btn btn-primary" id="pin-confirm" style="width:100%;margin-top:14px;">Entrar</button>
  `;
  const field = body.querySelector("#pin-field");
  setTimeout(() => field.focus(), 30);
  function confirm() {
    if (String(field.value).trim() === String(profile.pin)) {
      trustProfileOnThisDevice(profile.id);
      close();
      selectProfile(profile.id);
    } else {
      toast("PIN incorreto.", "danger");
      field.value = "";
      field.focus();
    }
  }
  body.querySelector("#pin-confirm").addEventListener("click", confirm);
  field.addEventListener("keydown", (e) => {
    if (e.key === "Enter") confirm();
  });
}

export function openCreateProfile() {
  const { body, close } = openModal({ title: "Novo perfil" });
  body.innerHTML = `
    <label>Nome</label>
    <input type="text" id="new-name" placeholder="Ex: Davi" />
    <button class="btn btn-primary" id="create-confirm" style="width:100%;margin-top:16px;">Criar perfil</button>
  `;
  const nameField = body.querySelector("#new-name");
  setTimeout(() => nameField.focus(), 30);
  body.querySelector("#create-confirm").addEventListener("click", async () => {
    const name = nameField.value.trim();
    if (!name) return nameField.focus();
    const pin = randomPin();
    const profile = await createProfile({ name, pin });
    close();
    showPinReveal(profile);
  });
}

export function showPinReveal(profile) {
  const { body, close } = openModal({ title: `Perfil "${profile.name}" criado!` });
  const link = `${location.origin}${location.pathname}#/join?p=${profile.id}&pin=${profile.pin}`;
  body.innerHTML = `
    <p class="small text-dim">Guarde este PIN para acessar o perfil em outro aparelho, ou use o link único abaixo (ele já entra automaticamente).</p>
    <label>PIN deste perfil</label>
    <div class="pin-input" style="letter-spacing:14px;">${profile.pin}</div>
    <label>Link único (copiar e abrir no celular)</label>
    <div class="flex gap-8">
      <input type="text" readonly value="${link}" id="join-link" />
      <button class="btn btn-icon" id="copy-link">${icon("link")}</button>
    </div>
    <button class="btn btn-primary" id="ok-btn" style="width:100%;margin-top:16px;">Entendi</button>
  `;
  body.querySelector("#copy-link").addEventListener("click", async () => {
    await navigator.clipboard.writeText(link);
    toast("Link copiado!");
  });
  body.querySelector("#ok-btn").addEventListener("click", () => {
    trustProfileOnThisDevice(profile.id);
    close();
    selectProfile(profile.id);
  });
}
