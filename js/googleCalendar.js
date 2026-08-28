import { getGoogleCalendarConfig, isGoogleCalendarConfigured } from "./config.js";
import { state, editItem, addItem } from "./state.js";

const SCOPE = "https://www.googleapis.com/auth/calendar.events";

export const gcalState = { scriptsReady: false, connected: false, syncing: false };

let tokenClient = null;

// Cacheia a PROMISE (não só se a tag já existe): antes, uma segunda chamada
// enquanto o script ainda estava carregando via a primeira encontrava a tag
// no DOM e resolvia na hora — sem esperar o script carregar de verdade — o
// que podia disparar "window.gapi is not defined" se o usuário clicasse
// "Conectar" duas vezes rápido.
const scriptPromises = {};
function loadScript(src) {
  if (!scriptPromises[src]) {
    scriptPromises[src] = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }
  return scriptPromises[src];
}

export async function ensureReady() {
  if (!isGoogleCalendarConfigured()) throw new Error("Google Agenda não configurado.");
  if (gcalState.scriptsReady) return;
  await Promise.all([
    loadScript("https://accounts.google.com/gsi/client"),
    loadScript("https://apis.google.com/js/api.js"),
  ]);
  await new Promise((resolve) => window.gapi.load("client", resolve));
  await window.gapi.client.init({ apiKey: getGoogleCalendarConfig().apiKey || undefined });
  await window.gapi.client.load("https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest");
  gcalState.scriptsReady = true;
}

export async function connect() {
  await ensureReady();
  return new Promise((resolve, reject) => {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: getGoogleCalendarConfig().clientId,
      scope: SCOPE,
      callback: (resp) => {
        if (resp.error) return reject(resp);
        window.gapi.client.setToken({ access_token: resp.access_token });
        gcalState.connected = true;
        resolve(resp);
      },
    });
    // prompt vazio: pede consentimento só na primeira vez (ou se o escopo
    // mudar) — antes forçava a tela de consentimento do Google toda vez que
    // clicava em "Conectar", mesmo já tendo autorizado antes nesse navegador
    tokenClient.requestAccessToken({ prompt: "" });
  });
}

export function disconnect() {
  const token = window.gapi?.client?.getToken?.();
  if (token) window.google?.accounts?.oauth2?.revoke(token.access_token, () => {});
  window.gapi?.client?.setToken?.(null);
  gcalState.connected = false;
}

function toEventResource(item) {
  if (item.allDay) {
    // a API do Google exige que o fim de um evento de dia inteiro seja
    // EXCLUSIVO — start.date == end.date fazia o evento de um dia só
    // (o caso mais comum) não aparecer certo no Google Agenda
    const startDate = item.start.slice(0, 10);
    const endDate = new Date(`${startDate}T00:00:00`);
    endDate.setDate(endDate.getDate() + 1);
    return {
      summary: item.title,
      description: item.notes || "",
      start: { date: startDate },
      end: { date: endDate.toISOString().slice(0, 10) },
      extendedProperties: { private: { opLocalId: item.id } },
    };
  }
  const start = new Date(item.start);
  const end = item.end ? new Date(item.end) : new Date(start.getTime() + 60 * 60 * 1000);
  return {
    summary: item.title,
    description: item.notes || "",
    start: { dateTime: start.toISOString() },
    end: { dateTime: end.toISOString() },
    extendedProperties: { private: { opLocalId: item.id } },
  };
}

export async function syncNow() {
  if (!gcalState.connected) throw new Error("Conecte o Google Agenda primeiro.");
  gcalState.syncing = true;
  try {
    const items = state.items.filter((i) => i.onAgenda && i.start);

    // 1) enviar itens locais para o Google (criar ou atualizar) — conta só
    // o que realmente deu certo (antes "pushed" era o total tentado, então
    // o toast dizia "N enviados" mesmo quando alguns falhavam em silêncio)
    let pushed = 0;
    let failed = 0;
    for (const item of items) {
      const resource = toEventResource(item);
      try {
        if (item.googleEventId) {
          await window.gapi.client.calendar.events.update({
            calendarId: "primary",
            eventId: item.googleEventId,
            resource,
          });
        } else {
          const res = await window.gapi.client.calendar.events.insert({
            calendarId: "primary",
            resource,
          });
          await editItem(item.id, { googleEventId: res.result.id });
        }
        pushed++;
      } catch (err) {
        failed++;
        console.warn("Falha ao sincronizar item com o Google Agenda:", item.id, err);
      }
    }

    // 2) trazer eventos do Google que ainda não existem localmente
    const timeMin = new Date();
    timeMin.setDate(timeMin.getDate() - 7);
    const timeMax = new Date();
    timeMax.setDate(timeMax.getDate() + 60);
    const knownGoogleIds = new Set(state.items.filter((i) => i.googleEventId).map((i) => i.googleEventId));
    const listRes = await window.gapi.client.calendar.events.list({
      calendarId: "primary",
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: true,
      maxResults: 250,
    });
    const events = listRes.result.items || [];
    for (const ev of events) {
      if (knownGoogleIds.has(ev.id)) continue;
      if (ev.extendedProperties?.private?.opLocalId) continue;
      const startIso = ev.start?.dateTime || (ev.start?.date ? `${ev.start.date}T00:00:00` : null);
      if (!startIso) continue;
      await addItem({
        frente: "agenda",
        title: ev.summary || "(sem título)",
        notes: ev.description || "",
        onAgenda: true,
        start: startIso,
        allDay: !ev.start?.dateTime,
        googleEventId: ev.id,
        column: "done",
      });
    }
    return { pushed, pulled: events.length, failed };
  } finally {
    gcalState.syncing = false;
  }
}
