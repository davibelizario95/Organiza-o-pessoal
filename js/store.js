// Camada de dados única para o app. Usa Firestore quando js/config.js está
// preenchido (sincroniza entre aparelhos); senão cai automaticamente para
// localStorage (dados ficam só neste navegador).
import { isFirebaseConfigured } from "./config.js";
import { getFirebase } from "./firebase.js";
import { uid, nowIso } from "./utils.js";

const LS_PROFILES = "op_profiles";
const lsItemsKey = (p) => `op_items_${p}`;
const lsTemplatesKey = (p) => `op_templates_${p}`;
const lsFiltersKey = (p) => `op_filters_${p}`;
const lsTransactionsKey = (p) => `op_transactions_${p}`;
const lsFinanceCategoriesKey = (p) => `op_finance_categories_${p}`;
const lsMenuCategoriesKey = (p) => `op_menu_categories_${p}`;
const LS_CURRENT = "op_current_profile";
const LS_TRUSTED = "op_trusted_profiles";

function readLs(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function writeLs(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

// listeners locais por chave, para simular onSnapshot no modo localStorage
const localListeners = new Map(); // key -> Set(callback)
function notifyLocal(key) {
  const list = readLs(key, []);
  (localListeners.get(key) || new Set()).forEach((cb) => cb(list));
}
function subscribeLocal(key, cb) {
  if (!localListeners.has(key)) localListeners.set(key, new Set());
  localListeners.get(key).add(cb);
  cb(readLs(key, []));
  const onStorage = (e) => {
    if (e.key === key) cb(readLs(key, []));
  };
  window.addEventListener("storage", onStorage);
  return () => {
    localListeners.get(key)?.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

export const backendMode = isFirebaseConfigured() ? "firebase" : "local";

// ---------------------------------------------------------------- PROFILES

export async function listProfiles() {
  if (backendMode === "firebase") {
    const fb = await getFirebase();
    const { collection, getDocs, orderBy, query } = fb.firestore;
    const q = query(collection(fb.db, "profiles"), orderBy("createdAt", "asc"));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }
  return readLs(LS_PROFILES, []);
}

export function subscribeProfiles(cb) {
  if (backendMode === "firebase") {
    let unsub = () => {};
    getFirebase().then((fb) => {
      const { collection, onSnapshot, orderBy, query } = fb.firestore;
      const q = query(collection(fb.db, "profiles"), orderBy("createdAt", "asc"));
      unsub = onSnapshot(q, (snap) => {
        cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      });
    });
    return () => unsub();
  }
  return subscribeLocal(LS_PROFILES, cb);
}

export async function createProfile({ name, color, pin }) {
  const profile = {
    name,
    color: color || randomColor(),
    pin,
    createdAt: nowIso(),
  };
  if (backendMode === "firebase") {
    const fb = await getFirebase();
    const { collection, addDoc } = fb.firestore;
    const ref = await addDoc(collection(fb.db, "profiles"), profile);
    return { id: ref.id, ...profile };
  }
  const list = readLs(LS_PROFILES, []);
  const item = { id: uid(), ...profile };
  list.push(item);
  writeLs(LS_PROFILES, list);
  notifyLocal(LS_PROFILES);
  return item;
}

export async function updateProfile(id, patch) {
  if (backendMode === "firebase") {
    const fb = await getFirebase();
    const { doc, updateDoc } = fb.firestore;
    await updateDoc(doc(fb.db, "profiles", id), patch);
    return;
  }
  const list = readLs(LS_PROFILES, []);
  const idx = list.findIndex((p) => p.id === id);
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...patch };
    writeLs(LS_PROFILES, list);
    notifyLocal(LS_PROFILES);
  }
}

// Migração única: se este aparelho já tinha perfis/tarefas guardados só em
// localStorage (de antes de configurar o Firebase) e o Firestore do projeto
// ainda está vazio, copia tudo pra lá — perfis, itens e templates — e
// atualiza o perfil atual/confiados deste aparelho pros novos IDs.
export async function migrateLocalToFirebase() {
  const localProfiles = readLs(LS_PROFILES, []);
  if (!localProfiles.length) return false;
  const fb = await getFirebase();
  if (!fb) return false;
  const { collection, addDoc, getDocs } = fb.firestore;

  const existingSnap = await getDocs(collection(fb.db, "profiles"));
  if (existingSnap.size > 0) return false;

  for (const p of localProfiles) {
    const { id: oldId, ...profileData } = p;
    const ref = await addDoc(collection(fb.db, "profiles"), profileData);
    const newId = ref.id;

    for (const it of readLs(lsItemsKey(oldId), [])) {
      const { id, ...itemData } = it;
      await addDoc(collection(fb.db, "profiles", newId, "items"), itemData);
    }
    for (const t of readLs(lsTemplatesKey(oldId), [])) {
      const { id, ...tplData } = t;
      await addDoc(collection(fb.db, "profiles", newId, "templates"), tplData);
    }

    if (localStorage.getItem(LS_CURRENT) === oldId) localStorage.setItem(LS_CURRENT, newId);
    try {
      const trusted = JSON.parse(localStorage.getItem(LS_TRUSTED) || "[]");
      const idx = trusted.indexOf(oldId);
      if (idx >= 0) {
        trusted[idx] = newId;
        localStorage.setItem(LS_TRUSTED, JSON.stringify(trusted));
      }
    } catch {
      /* ignore */
    }
  }
  return true;
}

function randomColor() {
  const palette = ["#6C5CE7", "#00B894", "#0984E3", "#E17055", "#FDCB6E", "#E84393", "#00CEC9"];
  return palette[Math.floor(Math.random() * palette.length)];
}

// ------------------------------------------------------------------ ITEMS

export async function listItems(profileId) {
  if (backendMode === "firebase") {
    const fb = await getFirebase();
    const { collection, getDocs, orderBy, query } = fb.firestore;
    const q = query(
      collection(fb.db, "profiles", profileId, "items"),
      orderBy("createdAt", "desc")
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }
  return readLs(lsItemsKey(profileId), []);
}

export function subscribeItems(profileId, cb) {
  if (backendMode === "firebase") {
    let unsub = () => {};
    getFirebase().then((fb) => {
      const { collection, onSnapshot, orderBy, query } = fb.firestore;
      const q = query(
        collection(fb.db, "profiles", profileId, "items"),
        orderBy("createdAt", "desc")
      );
      unsub = onSnapshot(q, (snap) => {
        cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      });
    });
    return () => unsub();
  }
  return subscribeLocal(lsItemsKey(profileId), cb);
}

export async function createItem(profileId, data) {
  const item = {
    frente: "trabalho",
    type: "task",
    title: "",
    notes: "",
    column: "inbox",
    context: null,
    urgent: false,
    important: false,
    timeTargetMin: null,
    timeSpentSec: 0,
    timerRunning: false,
    timerStartedAt: null,
    timerAlerted: false,
    voiceNotes: [],
    subtasks: [],
    templateId: null,
    habit: false,
    habitDoneDates: [],
    onAgenda: false,
    start: null,
    end: null,
    allDay: false,
    googleEventId: null,
    tags: [],
    createdAt: nowIso(),
    updatedAt: nowIso(),
    completedAt: null,
    ...data,
  };
  if (backendMode === "firebase") {
    const fb = await getFirebase();
    const { collection, addDoc } = fb.firestore;
    const ref = await addDoc(collection(fb.db, "profiles", profileId, "items"), item);
    return { id: ref.id, ...item };
  }
  const list = readLs(lsItemsKey(profileId), []);
  const full = { id: uid(), ...item };
  list.unshift(full);
  writeLs(lsItemsKey(profileId), list);
  notifyLocal(lsItemsKey(profileId));
  return full;
}

export async function updateItem(profileId, itemId, patch) {
  const withTs = { ...patch, updatedAt: nowIso() };
  if (backendMode === "firebase") {
    const fb = await getFirebase();
    const { doc, updateDoc } = fb.firestore;
    await updateDoc(doc(fb.db, "profiles", profileId, "items", itemId), withTs);
    return;
  }
  const list = readLs(lsItemsKey(profileId), []);
  const idx = list.findIndex((i) => i.id === itemId);
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...withTs };
    writeLs(lsItemsKey(profileId), list);
    notifyLocal(lsItemsKey(profileId));
  }
}

export async function deleteItem(profileId, itemId) {
  if (backendMode === "firebase") {
    const fb = await getFirebase();
    const { doc, deleteDoc } = fb.firestore;
    await deleteDoc(doc(fb.db, "profiles", profileId, "items", itemId));
    return;
  }
  const list = readLs(lsItemsKey(profileId), []).filter((i) => i.id !== itemId);
  writeLs(lsItemsKey(profileId), list);
  notifyLocal(lsItemsKey(profileId));
}

// -------------------------------------------------------------- TEMPLATES

export async function listTemplates(profileId) {
  if (backendMode === "firebase") {
    const fb = await getFirebase();
    const { collection, getDocs } = fb.firestore;
    const snap = await getDocs(collection(fb.db, "profiles", profileId, "templates"));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }
  return readLs(lsTemplatesKey(profileId), []);
}

export function subscribeTemplates(profileId, cb) {
  if (backendMode === "firebase") {
    let unsub = () => {};
    getFirebase().then((fb) => {
      const { collection, onSnapshot } = fb.firestore;
      unsub = onSnapshot(collection(fb.db, "profiles", profileId, "templates"), (snap) => {
        cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      });
    });
    return () => unsub();
  }
  return subscribeLocal(lsTemplatesKey(profileId), cb);
}

export async function createTemplate(profileId, data) {
  const tpl = { createdAt: nowIso(), ...data };
  if (backendMode === "firebase") {
    const fb = await getFirebase();
    const { collection, addDoc } = fb.firestore;
    const ref = await addDoc(collection(fb.db, "profiles", profileId, "templates"), tpl);
    return { id: ref.id, ...tpl };
  }
  const list = readLs(lsTemplatesKey(profileId), []);
  const full = { id: uid(), ...tpl };
  list.push(full);
  writeLs(lsTemplatesKey(profileId), list);
  notifyLocal(lsTemplatesKey(profileId));
  return full;
}

export async function deleteTemplate(profileId, id) {
  if (backendMode === "firebase") {
    const fb = await getFirebase();
    const { doc, deleteDoc } = fb.firestore;
    await deleteDoc(doc(fb.db, "profiles", profileId, "templates", id));
    return;
  }
  const list = readLs(lsTemplatesKey(profileId), []).filter((t) => t.id !== id);
  writeLs(lsTemplatesKey(profileId), list);
  notifyLocal(lsTemplatesKey(profileId));
}

// ---------------------------------------------------------------- FILTROS
// Filtros salvos (ex: "IC · Online") pra aplicar contexto + tags de um
// clique só, em vez de clicar contexto e tag toda vez.

export async function listFilters(profileId) {
  if (backendMode === "firebase") {
    const fb = await getFirebase();
    const { collection, getDocs } = fb.firestore;
    const snap = await getDocs(collection(fb.db, "profiles", profileId, "filters"));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }
  return readLs(lsFiltersKey(profileId), []);
}

export function subscribeFilters(profileId, cb) {
  if (backendMode === "firebase") {
    let unsub = () => {};
    getFirebase().then((fb) => {
      const { collection, onSnapshot } = fb.firestore;
      unsub = onSnapshot(collection(fb.db, "profiles", profileId, "filters"), (snap) => {
        cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      });
    });
    return () => unsub();
  }
  return subscribeLocal(lsFiltersKey(profileId), cb);
}

export async function createFilter(profileId, data) {
  const filter = { createdAt: nowIso(), ...data };
  if (backendMode === "firebase") {
    const fb = await getFirebase();
    const { collection, addDoc } = fb.firestore;
    const ref = await addDoc(collection(fb.db, "profiles", profileId, "filters"), filter);
    return { id: ref.id, ...filter };
  }
  const list = readLs(lsFiltersKey(profileId), []);
  const full = { id: uid(), ...filter };
  list.push(full);
  writeLs(lsFiltersKey(profileId), list);
  notifyLocal(lsFiltersKey(profileId));
  return full;
}

export async function deleteFilter(profileId, id) {
  if (backendMode === "firebase") {
    const fb = await getFirebase();
    const { doc, deleteDoc } = fb.firestore;
    await deleteDoc(doc(fb.db, "profiles", profileId, "filters", id));
    return;
  }
  const list = readLs(lsFiltersKey(profileId), []).filter((f) => f.id !== id);
  writeLs(lsFiltersKey(profileId), list);
  notifyLocal(lsFiltersKey(profileId));
}

// ------------------------------------------------------ FINANCEIRO: lançamentos

export async function listTransactions(profileId) {
  if (backendMode === "firebase") {
    const fb = await getFirebase();
    const { collection, getDocs, orderBy, query } = fb.firestore;
    const q = query(collection(fb.db, "profiles", profileId, "transactions"), orderBy("data", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }
  return readLs(lsTransactionsKey(profileId), []);
}

export function subscribeTransactions(profileId, cb) {
  if (backendMode === "firebase") {
    let unsub = () => {};
    getFirebase().then((fb) => {
      const { collection, onSnapshot, orderBy, query } = fb.firestore;
      const q = query(collection(fb.db, "profiles", profileId, "transactions"), orderBy("data", "desc"));
      unsub = onSnapshot(q, (snap) => {
        cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      });
    });
    return () => unsub();
  }
  return subscribeLocal(lsTransactionsKey(profileId), cb);
}

export async function createTransaction(profileId, data) {
  const tx = {
    tipo: "gasto",
    valor: 0,
    descricao: "",
    categoria: "",
    data: nowIso().slice(0, 10),
    formaPagamento: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    ...data,
  };
  if (backendMode === "firebase") {
    const fb = await getFirebase();
    const { collection, addDoc } = fb.firestore;
    const ref = await addDoc(collection(fb.db, "profiles", profileId, "transactions"), tx);
    return { id: ref.id, ...tx };
  }
  const list = readLs(lsTransactionsKey(profileId), []);
  const full = { id: uid(), ...tx };
  list.unshift(full);
  writeLs(lsTransactionsKey(profileId), list);
  notifyLocal(lsTransactionsKey(profileId));
  return full;
}

export async function updateTransaction(profileId, id, patch) {
  const withTs = { ...patch, updatedAt: nowIso() };
  if (backendMode === "firebase") {
    const fb = await getFirebase();
    const { doc, updateDoc } = fb.firestore;
    await updateDoc(doc(fb.db, "profiles", profileId, "transactions", id), withTs);
    return;
  }
  const list = readLs(lsTransactionsKey(profileId), []);
  const idx = list.findIndex((t) => t.id === id);
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...withTs };
    writeLs(lsTransactionsKey(profileId), list);
    notifyLocal(lsTransactionsKey(profileId));
  }
}

export async function deleteTransaction(profileId, id) {
  if (backendMode === "firebase") {
    const fb = await getFirebase();
    const { doc, deleteDoc } = fb.firestore;
    await deleteDoc(doc(fb.db, "profiles", profileId, "transactions", id));
    return;
  }
  const list = readLs(lsTransactionsKey(profileId), []).filter((t) => t.id !== id);
  writeLs(lsTransactionsKey(profileId), list);
  notifyLocal(lsTransactionsKey(profileId));
}

// ------------------------------------------------ FINANCEIRO: categorias extras
// Só as categorias CRIADAS pelo usuário — as pré-definidas vivem como
// constante em financeCategories.js e não passam por aqui.

export async function listFinanceCategories(profileId) {
  if (backendMode === "firebase") {
    const fb = await getFirebase();
    const { collection, getDocs } = fb.firestore;
    const snap = await getDocs(collection(fb.db, "profiles", profileId, "financeCategories"));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }
  return readLs(lsFinanceCategoriesKey(profileId), []);
}

export function subscribeFinanceCategories(profileId, cb) {
  if (backendMode === "firebase") {
    let unsub = () => {};
    getFirebase().then((fb) => {
      const { collection, onSnapshot } = fb.firestore;
      unsub = onSnapshot(collection(fb.db, "profiles", profileId, "financeCategories"), (snap) => {
        cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      });
    });
    return () => unsub();
  }
  return subscribeLocal(lsFinanceCategoriesKey(profileId), cb);
}

export async function createFinanceCategory(profileId, data) {
  const cat = { createdAt: nowIso(), ...data };
  if (backendMode === "firebase") {
    const fb = await getFirebase();
    const { collection, addDoc } = fb.firestore;
    const ref = await addDoc(collection(fb.db, "profiles", profileId, "financeCategories"), cat);
    return { id: ref.id, ...cat };
  }
  const list = readLs(lsFinanceCategoriesKey(profileId), []);
  const full = { id: uid(), ...cat };
  list.push(full);
  writeLs(lsFinanceCategoriesKey(profileId), list);
  notifyLocal(lsFinanceCategoriesKey(profileId));
  return full;
}

export async function deleteFinanceCategory(profileId, id) {
  if (backendMode === "firebase") {
    const fb = await getFirebase();
    const { doc, deleteDoc } = fb.firestore;
    await deleteDoc(doc(fb.db, "profiles", profileId, "financeCategories", id));
    return;
  }
  const list = readLs(lsFinanceCategoriesKey(profileId), []).filter((c) => c.id !== id);
  writeLs(lsFinanceCategoriesKey(profileId), list);
  notifyLocal(lsFinanceCategoriesKey(profileId));
}

// -------------------------------------------------- MENU DE CATEGORIAS (genérico)
// Categorias criadas pelo usuário pro "menu grande" de qualquer frente que
// tiver uma (Casa, Estudo, ...) — cada doc tem {frente, nome}. As opções
// padrão de cada frente vivem hardcoded em frenteGeneric.js, essas aqui são
// só as extras que o botão "Nova categoria" cria.

export async function listMenuCategories(profileId) {
  if (backendMode === "firebase") {
    const fb = await getFirebase();
    const { collection, getDocs } = fb.firestore;
    const snap = await getDocs(collection(fb.db, "profiles", profileId, "menuCategories"));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }
  return readLs(lsMenuCategoriesKey(profileId), []);
}

export function subscribeMenuCategories(profileId, cb) {
  if (backendMode === "firebase") {
    let unsub = () => {};
    getFirebase().then((fb) => {
      const { collection, onSnapshot } = fb.firestore;
      unsub = onSnapshot(collection(fb.db, "profiles", profileId, "menuCategories"), (snap) => {
        cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      });
    });
    return () => unsub();
  }
  return subscribeLocal(lsMenuCategoriesKey(profileId), cb);
}

export async function createMenuCategory(profileId, data) {
  const cat = { createdAt: nowIso(), ...data };
  if (backendMode === "firebase") {
    const fb = await getFirebase();
    const { collection, addDoc } = fb.firestore;
    const ref = await addDoc(collection(fb.db, "profiles", profileId, "menuCategories"), cat);
    return { id: ref.id, ...cat };
  }
  const list = readLs(lsMenuCategoriesKey(profileId), []);
  const full = { id: uid(), ...cat };
  list.push(full);
  writeLs(lsMenuCategoriesKey(profileId), list);
  notifyLocal(lsMenuCategoriesKey(profileId));
  return full;
}

export async function deleteMenuCategory(profileId, id) {
  if (backendMode === "firebase") {
    const fb = await getFirebase();
    const { doc, deleteDoc } = fb.firestore;
    await deleteDoc(doc(fb.db, "profiles", profileId, "menuCategories", id));
    return;
  }
  const list = readLs(lsMenuCategoriesKey(profileId), []).filter((c) => c.id !== id);
  writeLs(lsMenuCategoriesKey(profileId), list);
  notifyLocal(lsMenuCategoriesKey(profileId));
}
