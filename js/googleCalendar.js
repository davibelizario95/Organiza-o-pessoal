import { getGoogleCalendarConfig, isGoogleCalendarConfigured } from "./config.js";
import { state, editItem, addItem } from "./state.js";

const SCOPE = "https://www.googleapis.com/auth/calendar.events";

export const gcalState = { scriptsReady: false, connected: false, syncing: false };

let tokenClient = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
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
    tokenClient.requestAccessToken({ prompt: "consent" });
  });
}

export function disconnect() {
  const token = window.gapi?.client?.getToken?.();
  if (token) window.google?.accounts?.oauth2?.revoke(token.access_token, () => {});
  window.gapi?.client?.setToken?.(null);
  gcalState.connected = false;
}

function toEventResource(item) {
  const start = new Date(item.start);
  const end = item.end ? new Date(item.end) : new Date(start.getTime() + 60 * 60 * 1000);
  return {
    summary: item.title,
    description: item.notes || "",
    start: item.allDay ? { date: item.start.slice(0, 10) } : { dateTime: start.toISOString() },
    end: item.allDay ? { date: item.start.slice(0, 10) } : { dateTime: end.toISOString() },
    extendedProperties: { private: { opLocalId: item.id } },
  };
}

export async function syncNow() {
  if (!gcalState.connected) throw new Error("Conecte o Google Agenda primeiro.");
  gcalState.syncing = true;
  try {
    const items = state.items.filter((i) => i.onAgenda && i.start);

    // 1) enviar itens locais para o Google (criar ou atualizar)
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
      } catch {
        /* segue tentando os demais itens */
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
    return { pushed: items.length, pulled: events.length };
  } finally {
    gcalState.syncing = false;
  }
}
