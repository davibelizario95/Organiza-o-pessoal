import * as store from "./store.js";
import { randomPin } from "./utils.js";

export const state = {
  ready: false,
  profiles: [],
  profile: null, // perfil ativo neste aparelho
  items: [],
  templates: [],
  filters: [],
  transactions: [],
  financeCategories: [],
  menuCategories: [],
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
let unsubFilters = null;
let unsubTransactions = null;
let unsubFinanceCategories = null;
let unsubMenuCategories = null;

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
  if (unsubFilters) unsubFilters();
  if (unsubTransactions) unsubTransactions();
  if (unsubFinanceCategories) unsubFinanceCategories();
  if (unsubMenuCategories) unsubMenuCategories();
  state.profile = state.profiles.find((p) => p.id === profileId) || state.profile;
  unsubItems = store.subscribeItems(profileId, (items) => {
    state.items = items;
    emit();
  });
  unsubTemplates = store.subscribeTemplates(profileId, (templates) => {
    state.templates = templates;
    emit();
  });
  unsubFilters = store.subscribeFilters(profileId, (filters) => {
    state.filters = filters;
    emit();
  });
  unsubTransactions = store.subscribeTransactions(profileId, (transactions) => {
    state.transactions = transactions;
    emit();
  });
  unsubFinanceCategories = store.subscribeFinanceCategories(profileId, (financeCategories) => {
    state.financeCategories = financeCategories;
    emit();
  });
  unsubMenuCategories = store.subscribeMenuCategories(profileId, (menuCategories) => {
    state.menuCategories = menuCategories;
    emit();
  });
  if (!silent) emit();
}

export function signOutProfile() {
  localStorage.removeItem(LS_CURRENT);
  if (unsubItems) unsubItems();
  if (unsubTemplates) unsubTemplates();
  if (unsubFilters) unsubFilters();
  if (unsubTransactions) unsubTransactions();
  if (unsubFinanceCategories) unsubFinanceCategories();
  if (unsubMenuCategories) unsubMenuCategories();
  state.profile = null;
  state.items = [];
  state.templates = [];
  state.filters = [];
  state.transactions = [];
  state.financeCategories = [];
  state.menuCategories = [];
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

// ------------------------------------------------------ helpers financeiro

export async function addTransaction(data) {
  if (!state.profile) return;
  return store.createTransaction(state.profile.id, data);
}
export async function editTransaction(id, patch) {
  if (!state.profile) return;
  return store.updateTransaction(state.profile.id, id, patch);
}
export async function removeTransaction(id) {
  if (!state.profile) return;
  return store.deleteTransaction(state.profile.id, id);
}
export async function addFinanceCategory(data) {
  if (!state.profile) return;
  return store.createFinanceCategory(state.profile.id, data);
}
export async function removeFinanceCategory(id) {
  if (!state.profile) return;
  return store.deleteFinanceCategory(state.profile.id, id);
}
export async function addMenuCategory(data) {
  if (!state.profile) return;
  return store.createMenuCategory(state.profile.id, data);
}
export async function removeMenuCategory(id) {
  if (!state.profile) return;
  return store.deleteMenuCategory(state.profile.id, id);
}
// Renomeia a categoria E reetiqueta todo item que já usava o nome antigo —
// senão o item "some" do menu (a tag antiga fica órfã, sem tile nenhum).
export async function renameMenuCategory(id, oldName, newName) {
  if (!state.profile) return;
  await store.updateMenuCategory(state.profile.id, id, { nome: newName });
  const affected = state.items.filter((i) => (i.tags || []).includes(oldName));
  for (const item of affected) {
    const tags = item.tags.map((t) => (t === oldName ? newName : t));
    await store.updateItem(state.profile.id, item.id, { tags });
  }
}
