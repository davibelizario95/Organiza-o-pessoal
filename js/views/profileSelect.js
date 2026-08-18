import { state, isTrustedOnThisDevice, trustProfileOnThisDevice, selectProfile } from "../state.js";
import { createProfile, updateProfile } from "../store.js";
import { randomPin, greeting } from "../utils.js";
import { icon } from "../icons.js";
import { openModal } from "../components/modal.js";
import { toast } from "../components/toast.js";

function initials(name = "") {
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Redimensiona a foto escolhida pro tamanho do avatar antes de guardar,
// pra não estourar o limite de tamanho do localStorage/Firestore.
function readImageAsDataUrl(file, maxSize = 200) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

// Animação de "abertura": um círculo cresce a partir do avatar clicado até
// cobrir a tela inteira, e some assim que o app já estiver montado por baixo.
let openTransitionEl = null;
function playOpeningTransition(circleEl, color) {
  return new Promise((resolve) => {
    if (prefersReducedMotion() || !circleEl) return resolve();
    const rect = circleEl.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dist = Math.max(
      Math.hypot(cx, cy),
      Math.hypot(window.innerWidth - cx, cy),
      Math.hypot(cx, window.innerHeight - cy),
      Math.hypot(window.innerWidth - cx, window.innerHeight - cy)
    );
    const el = document.createElement("div");
    el.className = "profile-open-transition";
    el.style.width = el.style.height = rect.width + "px";
    el.style.left = cx + "px";
    el.style.top = cy + "px";
    el.style.background = color || "var(--accent)";
    el.style.setProperty("--open-scale", (dist * 2.05) / rect.width);
    document.body.appendChild(el);
    openTransitionEl = el;
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("open")));
    setTimeout(resolve, 380);
  });
}
function dismissOpeningTransition() {
  const el = openTransitionEl;
  if (!el) return;
  openTransitionEl = null;
  requestAnimationFrame(() => {
    el.style.transition = "opacity 260ms ease";
    el.style.opacity = "0";
    setTimeout(() => el.remove(), 260);
  });
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
      <div class="profile-avatars-row" id="profile-avatars"></div>
    </div>
  `;

  const row = wrap.querySelector("#profile-avatars");
  state.profiles.forEach((p, i) => {
    const item = document.createElement("button");
    item.className = "profile-avatar-item";
    item.style.setProperty("--row-i", i);
    const bg = p.photo
      ? `background-image:url('${p.photo}')`
      : `background-color:${p.color || "#888"}`;
    item.innerHTML = `
      <div class="profile-avatar-circle" style="${bg}">
        ${p.photo ? "" : initials(p.name)}
        <label class="avatar-photo-edit" title="Adicionar foto">
          ${icon("camera")}
          <input type="file" accept="image/*" />
        </label>
      </div>
      <span class="profile-avatar-name">${p.name}</span>
    `;
    const circle = item.querySelector(".profile-avatar-circle");
    item.addEventListener("click", () => handleSelect(p, circle));
    const fileInput = item.querySelector("input[type=file]");
    const editBadge = item.querySelector(".avatar-photo-edit");
    editBadge.addEventListener("click", (e) => e.stopPropagation());
    fileInput.addEventListener("click", (e) => e.stopPropagation());
    fileInput.addEventListener("change", async () => {
      const file = fileInput.files[0];
      if (!file) return;
      const dataUrl = await readImageAsDataUrl(file);
      await updateProfile(p.id, { photo: dataUrl });
      toast("Foto atualizada!");
    });
    row.appendChild(item);
  });

  const addItem = document.createElement("button");
  addItem.className = "profile-avatar-item";
  addItem.style.setProperty("--row-i", state.profiles.length);
  addItem.innerHTML = `
    <div class="profile-avatar-circle add-circle">${icon("plus")}</div>
    <span class="profile-avatar-name">Novo perfil</span>
  `;
  addItem.addEventListener("click", openCreateProfile);
  row.appendChild(addItem);

  return wrap;
}

function handleSelect(profile, circleEl) {
  if (isTrustedOnThisDevice(profile.id)) {
    playOpeningTransition(circleEl, profile.color).then(() => {
      selectProfile(profile.id);
      dismissOpeningTransition();
    });
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
      playOpeningTransition(circleEl, profile.color).then(() => {
        selectProfile(profile.id);
        dismissOpeningTransition();
      });
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
