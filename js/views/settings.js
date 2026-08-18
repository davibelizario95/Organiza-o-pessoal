import { state, subscribe, signOutProfile } from "../state.js";
import { updateProfile, backendMode } from "../store.js";
import {
  getFirebaseConfig,
  setFirebaseConfig,
  clearFirebaseConfig,
  isFirebaseConfigured,
  getGoogleCalendarConfig,
  setGoogleCalendarConfig,
  isGoogleCalendarConfigured,
} from "../config.js";
import { gcalState, connect, disconnect } from "../googleCalendar.js";
import { icon } from "../icons.js";
import { openTemplatesManager } from "../components/templates.js";
import { openCreateProfile, showPinReveal } from "./profileSelect.js";
import { toast } from "../components/toast.js";
import { escapeHtml } from "../utils.js";

function initials(name = "") {
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

export function renderSettings() {
  const view = document.getElementById("view");
  const unsub = subscribe(render);
  render();
  return unsub;

  function render() {
    const fbOn = isFirebaseConfigured();
    const gcalOn = isGoogleCalendarConfigured();
    const fbCfg = getFirebaseConfig();
    const gCfg = getGoogleCalendarConfig();

    view.innerHTML = `
      <div class="section-title mt-0"><h2>Perfis</h2><button class="btn btn-sm" id="new-profile">${icon("plus")} Novo perfil</button></div>
      <div class="card" id="profiles-list"></div>

      <div class="section-title"><h2>Templates de tarefa recorrente</h2></div>
      <div class="card">
        <p class="small text-dim">Gerencie templates usados na frente Trabalho para tarefas que se repetem.</p>
        <button class="btn" id="open-templates">${icon("repeat")} Abrir templates</button>
      </div>

      <div class="section-title"><h2>Sincronização entre aparelhos (Firebase)</h2></div>
      <div class="card">
        <p class="small text-dim">
          Status: <strong style="color:${fbOn ? "var(--ok)" : "var(--text-dim)"}">${fbOn ? "Conectado ao Firebase" : "Somente local neste aparelho"}</strong>
        </p>
        <p class="small text-dim">
          Para sincronizar entre computador e celular, crie um projeto gratuito em
          <strong>console.firebase.google.com</strong> → Adicionar app da Web → copie o objeto de configuração
          e cole abaixo. Ative também o <strong>Firestore Database</strong> (modo produção) e a
          <strong>Autenticação anônima</strong> no console. Faça isso uma vez e cole a mesma config em cada aparelho.
        </p>
        <label>Configuração do Firebase (JSON)</label>
        <textarea id="fb-json" rows="6" placeholder='{"apiKey":"...","authDomain":"...","projectId":"...","storageBucket":"...","messagingSenderId":"...","appId":"..."}'>${fbOn ? escapeHtml(JSON.stringify(fbCfg, null, 2)) : ""}</textarea>
        <div class="flex gap-8" style="margin-top:10px;">
          <button class="btn btn-primary" id="fb-save">Salvar e recarregar</button>
          ${fbOn ? `<button class="btn btn-danger" id="fb-clear">Desconectar</button>` : ""}
        </div>
      </div>

      <div class="section-title"><h2>Google Agenda</h2></div>
      <div class="card">
        <p class="small text-dim">
          Status: <strong style="color:${gcalState.connected ? "var(--ok)" : "var(--text-dim)"}">${gcalOn ? (gcalState.connected ? "Conectado" : "Configurado, não conectado") : "Não configurado"}</strong>
        </p>
        <p class="small text-dim">
          Passo a passo: acesse <strong>console.cloud.google.com</strong> → crie um projeto → ative a
          <strong>Google Calendar API</strong> → em "Credenciais", crie um <strong>ID do cliente OAuth</strong>
          do tipo "Aplicativo da Web", adicionando esta URL em "Origens JavaScript autorizadas":
          <code>${location.origin}</code>. Cole o Client ID abaixo (a chave de API é opcional).
        </p>
        <label>Client ID OAuth</label>
        <input type="text" id="gc-client" value="${gCfg.clientId || ""}" placeholder="xxxxxxxx.apps.googleusercontent.com" />
        <label>API Key (opcional)</label>
        <input type="text" id="gc-key" value="${gCfg.apiKey || ""}" placeholder="AIza..." />
        <div class="flex gap-8" style="margin-top:10px;">
          <button class="btn btn-primary" id="gc-save">Salvar</button>
          ${gcalOn && !gcalState.connected ? `<button class="btn" id="gc-connect">Conectar</button>` : ""}
          ${gcalState.connected ? `<button class="btn btn-danger" id="gc-disconnect">Desconectar</button>` : ""}
        </div>
      </div>

      <div class="section-title"><h2>Instalar como app</h2></div>
      <div class="card">
        <p class="small text-dim">No celular, abra o menu do navegador e escolha <strong>"Adicionar à tela inicial"</strong> (Android/Chrome) ou <strong>"Adicionar à Tela de Início"</strong> no botão compartilhar (iPhone/Safari). O app abre em tela cheia, como um aplicativo nativo.</p>
      </div>

      <div class="section-title"><h2>Modo de dados</h2></div>
      <div class="card small text-dim">Backend ativo nesta sessão: <strong>${backendMode === "firebase" ? "Firebase (sincronizado)" : "localStorage (somente este aparelho)"}</strong></div>
    `;

    // ---- profiles ----
    const list = view.querySelector("#profiles-list");
    list.innerHTML = state.profiles
      .map(
        (p) => `<div class="list-item">
          <div class="avatar" style="background-color:${p.color || "#888"}">${initials(p.name)}</div>
          <div class="list-item-title" style="font-weight:600;">${escapeHtml(p.name)} ${p.id === state.profile?.id ? '<span class="tag">ativo</span>' : ""}</div>
          <button class="btn btn-icon btn-ghost btn-sm" data-rename="${p.id}">${icon("edit")}</button>
          <button class="btn btn-sm" data-pin="${p.id}">PIN / link</button>
        </div>`
      )
      .join("");
    list.querySelectorAll("[data-pin]").forEach((btn) =>
      btn.addEventListener("click", () => {
        const p = state.profiles.find((pr) => pr.id === btn.dataset.pin);
        showPinReveal(p);
      })
    );
    list.querySelectorAll("[data-rename]").forEach((btn) =>
      btn.addEventListener("click", async () => {
        const p = state.profiles.find((pr) => pr.id === btn.dataset.rename);
        const name = window.prompt("Novo nome do perfil:", p.name);
        if (name && name.trim()) await updateProfile(p.id, { name: name.trim() });
      })
    );
    view.querySelector("#new-profile").addEventListener("click", openCreateProfile);
    view.querySelector("#open-templates").addEventListener("click", () => openTemplatesManager());

    // ---- firebase ----
    view.querySelector("#fb-save").addEventListener("click", () => {
      try {
        const parsed = JSON.parse(view.querySelector("#fb-json").value);
        if (!parsed.apiKey || !parsed.projectId) throw new Error("faltam campos");
        setFirebaseConfig(parsed);
        toast("Configuração salva. Recarregando...");
        setTimeout(() => location.reload(), 800);
      } catch {
        toast("JSON inválido. Cole exatamente o objeto de configuração do Firebase.", "danger");
      }
    });
    view.querySelector("#fb-clear")?.addEventListener("click", () => {
      clearFirebaseConfig();
      toast("Desconectado. Recarregando...");
      setTimeout(() => location.reload(), 800);
    });

    // ---- google calendar ----
    view.querySelector("#gc-save").addEventListener("click", () => {
      const clientId = view.querySelector("#gc-client").value.trim();
      const apiKey = view.querySelector("#gc-key").value.trim();
      if (!clientId) return toast("Informe o Client ID.", "danger");
      setGoogleCalendarConfig({ clientId, apiKey });
      toast("Google Agenda configurado.");
      render();
    });
    view.querySelector("#gc-connect")?.addEventListener("click", async () => {
      try {
        await connect();
        toast("Conectado ao Google Agenda!");
        render();
      } catch {
        toast("Falha ao conectar.", "danger");
      }
    });
    view.querySelector("#gc-disconnect")?.addEventListener("click", () => {
      disconnect();
      render();
    });
  }
}
