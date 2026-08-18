import { getFirebaseConfig, isFirebaseConfigured } from "./config.js";

let appPromise = null;

// Carrega o SDK do Firebase via CDN (ESM) só quando configurado, para não
// pesar o app nem quebrar quando ninguém preencheu a configuração ainda.
export function getFirebase() {
  if (!isFirebaseConfigured()) return Promise.resolve(null);
  if (appPromise) return appPromise;

  appPromise = (async () => {
    const [{ initializeApp }, firestoreMod, authMod] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js"),
      import("https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js"),
    ]);

    const app = initializeApp(getFirebaseConfig());
    const db = firestoreMod.getFirestore(app);
    const auth = authMod.getAuth(app);

    // Autenticação anônima automática e invisível: não é um "login" para o
    // usuário (sem tela, sem senha), mas permite que as regras do Firestore
    // exijam `request.auth != null`, evitando acesso público total.
    await new Promise((resolve) => {
      authMod.onAuthStateChanged(auth, (user) => {
        if (user) return resolve();
        authMod.signInAnonymously(auth).catch(() => resolve());
      });
    });

    return { app, db, firestore: firestoreMod, auth };
  })();

  return appPromise;
}
