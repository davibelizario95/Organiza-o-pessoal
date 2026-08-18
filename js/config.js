// Configuração do app. Pode ser preenchida editando os objetos abaixo, ou
// (mais fácil) colando as chaves na tela Ajustes do app, que grava um
// "override" no localStorage deste navegador — todo aparelho que for usar
// sincronização precisa colar a mesma configuração do Firebase uma vez.
const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyD3YcV6NPyRm33pvDk88dhk_hmEF4EzczI",
  authDomain: "organizacao-pessoal-4d666.firebaseapp.com",
  projectId: "organizacao-pessoal-4d666",
  storageBucket: "organizacao-pessoal-4d666.firebasestorage.app",
  messagingSenderId: "599402029492",
  appId: "1:599402029492:web:8605560dcd647ef93a52e1",
  measurementId: "G-BXV2CDJR63",
};

const DEFAULT_GOOGLE_CONFIG = {
  clientId: "",
  apiKey: "",
};

const LS_FIREBASE = "op_firebase_config";
const LS_GOOGLE = "op_google_config";

export function getFirebaseConfig() {
  try {
    const override = JSON.parse(localStorage.getItem(LS_FIREBASE) || "null");
    if (override) return override;
  } catch {
    /* ignore */
  }
  return DEFAULT_FIREBASE_CONFIG;
}

export function setFirebaseConfig(cfg) {
  localStorage.setItem(LS_FIREBASE, JSON.stringify(cfg));
}

export function clearFirebaseConfig() {
  localStorage.removeItem(LS_FIREBASE);
}

export function getGoogleCalendarConfig() {
  try {
    const override = JSON.parse(localStorage.getItem(LS_GOOGLE) || "null");
    if (override) return override;
  } catch {
    /* ignore */
  }
  return DEFAULT_GOOGLE_CONFIG;
}

export function setGoogleCalendarConfig(cfg) {
  localStorage.setItem(LS_GOOGLE, JSON.stringify(cfg));
}

export function isFirebaseConfigured() {
  const c = getFirebaseConfig();
  return Boolean(c.apiKey && c.projectId);
}

export function isGoogleCalendarConfigured() {
  const c = getGoogleCalendarConfig();
  return Boolean(c.clientId);
}
