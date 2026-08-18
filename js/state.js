import * as store from "./store.js";
import { randomPin } from "./utils.js";

export const state = {
  ready: false,
  profiles: [],
  profile: null, // perfil ativo neste aparelho
  items: [],
  templates: [],
};

const listeners = new Set();
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function emit() {
  listeners.forEach((fn) => fn(state));
}

let unsubItems = null;
let unsubTemplates = null;

const LS_CURRENT = "op_current_profile";
const LS_TRUSTED = "op_trusted_profiles";

export function getCurrentProfileId() {
  return localStorage.getItem(LS_CURRENT);
}

export function isTrustedOnThisDevice(profileId) {
  const list = JSON.parse(localStorage.getItem(LS_TRUSTED) || "[]");
  return list.includes(profileId);
}

export function trustProfileOnThisDevice(profileId) {
  const list = JSON.parse(localStorage.getItem(LS_TRUSTED) || "[]");
  if (!list.includes(profileId)) list.push(profileId);
  localStorage.setItem(LS_TRUSTED, JSON.stringify(list));
}

let joinLinkChecked = false;

export async function initApp() {
  await seedDefaultProfilesIfEmpty();
  store.subscribeProfiles((profiles) => {
    state.profiles = profiles.sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1));
    if (!joinLinkChecked) {
      joinLinkChecked = true;
      if (tryConsumeJoinLink(profiles)) {
        state.ready = true;
        emit();
        return;
      }
    }
    const currentId = getCurrentProfileId();
    if (currentId) {
      state.profile = profiles.find((p) => p.id === currentId) || null;
    }
    state.ready = true;
    emit();
  });
  const currentId = getCurrentProfileId();
  if (currentId) selectProfile(currentId, { silent: true });
}

// Link único por perfil: #/join?p=<id>&pin=<pin> — identifica e confia no
// perfil neste aparelho sem exigir digitar o PIN manualmente.
function tryConsumeJoinLink(profiles) {
  const hash = location.hash.replace(/^#\/?/, "");
  if (!hash.startsWith("join")) return false;
  const query = hash.split("?")[1] || "";
  const params = new URLSearchParams(query);
  const p = params.get("p");
  const pin = params.get("pin");
  const profile = profiles.find((pr) => pr.id === p && String(pr.pin) === String(pin));
  history.replaceState(null, "", location.pathname + location.search);
  if (!profile) return false;
  trustProfileOnThisDevice(profile.id);
  selectProfile(profile.id, { silent: true });
  return true;
}

async function seedDefaultProfilesIfEmpty() {
  const seeded = localStorage.getItem("op_seeded");
  // Se este aparelho já tinha dados só-locais (de antes da sincronização via
  // Firebase ser ligada) e ainda não foram migrados, migra uma única vez —
  // sem isso, ligar o Firebase faria o app "esquecer" tudo que já existia.
  if (store.backendMode === "firebase" && !localStorage.getItem("op_migrated_firebase")) {
    const migrated = await store.migrateLocalToFirebase();
    localStorage.setItem("op_migrated_firebase", "1");
    if (migrated) return;
  }
  if (seeded) return;
  const existing = await store.listProfiles();
  if (existing.length === 0) {
    // O aparelho que inicializa o app pela 1ª vez já fica confiado nos 2
    // perfis padrão (sem PIN) — evita travar o usuário num PIN que nunca viu.
    const p1 = await store.createProfile({ name: "Davi", pin: randomPin() });
    const p2 = await store.createProfile({ name: "Jessica", pin: randomPin() });
    trustProfileOnThisDevice(p1.id);
    trustProfileOnThisDevice(p2.id);
  }
  localStorage.setItem("op_seeded", "1");
}

export function selectProfile(profileId, { silent } = {}) {
  localStorage.setItem(LS_CURRENT, profileId);
  if (unsubItems) unsubItems();
  if (unsubTemplates) unsubTemplates();
  state.profile = state.profiles.find((p) => p.id === profileId) || state.profile;
  unsubItems = store.subscribeItems(profileId, (items) => {
    state.items = items;
    emit();
  });
  unsubTemplates = store.subscribeTemplates(profileId, (templates) => {
    state.templates = templates;
    emit();
  });
  if (!silent) emit();
}

export function signOutProfile() {
  localStorage.removeItem(LS_CURRENT);
  if (unsubItems) unsubItems();
  if (unsubTemplates) unsubTemplates();
  state.profile = null;
  state.items = [];
  state.templates = [];
  emit();
}

// ------------------------------------------------------------ helpers de item

export async function addItem(data) {
  if (!state.profile) return;
  return store.createItem(state.profile.id, data);
}
export async function editItem(id, patch) {
  if (!state.profile) return;
  return store.updateItem(state.profile.id, id, patch);
}
export async function removeItem(id) {
  if (!state.profile) return;
  return store.deleteItem(state.profile.id, id);
}
export function getItem(id) {
  return state.items.find((i) => i.id === id) || null;
}
