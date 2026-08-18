import { state, subscribe } from "../state.js";
import { frenteByKey } from "../frentes.js";
import { icon } from "../icons.js";
import { escapeHtml, formatTime, startOfWeek, todayKey } from "../utils.js";
import { openTaskDetail } from "../components/card.js";
import { isGoogleCalendarConfigured } from "../config.js";
import { gcalState, connect, syncNow } from "../googleCalendar.js";
import { toast } from "../components/toast.js";
import { navigate } from "../router.js";

let weekOffset = 0;

export function renderAgenda() {
  const view = document.getElementById("view");
  const unsub = subscribe(render);
  render();
  return unsub;

  function render() {
    const base = startOfWeek();
    base.setDate(base.getDate() + weekOffset * 7);
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base);
      d.setDate(d.getDate() + i);
      return d;
    });
    const today = todayKey();
    const configured = isGoogleCalendarConfigured();

    view.innerHTML = `
      <div class="flex items-center justify-between wrap gap-8" style="margin-bottom:16px;">
        <div class="flex items-center gap-8">
          <button class="btn btn-icon" id="prev-week">${icon("chevronLeft")}</button>
          <strong style="font-size:14px;">${days[0].toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} – ${days[6].toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</strong>
          <button class="btn btn-icon" id="next-week">${icon("chevronRight")}</button>
          ${weekOffset !== 0 ? `<button class="btn btn-sm" id="today-btn">Hoje</button>` : ""}
        </div>
        <div>
          ${
            !configured
              ? `<button class="btn btn-sm" id="gcal-setup">${icon("calendarSync")} Configurar Google Agenda</button>`
              : gcalState.connected
              ? `<button class="btn btn-sm" id="gcal-sync">${icon("calendarSync")} ${gcalState.syncing ? "Sincronizando..." : "Sincronizar com Google Agenda"}</button>`
              : `<button class="btn btn-sm btn-primary" id="gcal-connect">${icon("calendarSync")} Conectar Google Agenda</button>`
          }
        </div>
      </div>

      <div class="grid" style="grid-template-columns:repeat(7,1fr);gap:10px;" id="agenda-grid"></div>
    `;

    view.querySelector("#prev-week").onclick = () => {
      weekOffset -= 1;
      render();
    };
    view.querySelector("#next-week").onclick = () => {
      weekOffset += 1;
      render();
    };
    view.querySelector("#today-btn")?.addEventListener("click", () => {
      weekOffset = 0;
      render();
    });
    view.querySelector("#gcal-setup")?.addEventListener("click", () => navigate("settings"));
    view.querySelector("#gcal-connect")?.addEventListener("click", async () => {
      try {
        await connect();
        toast("Conectado ao Google Agenda!");
        render();
      } catch {
        toast("Não foi possível conectar ao Google Agenda.", "danger");
      }
    });
    view.querySelector("#gcal-sync")?.addEventListener("click", async () => {
      render();
      try {
        const r = await syncNow();
        toast(`Sincronizado: ${r.pushed} enviados, ${r.pulled} eventos do Google.`);
      } catch (e) {
        toast(e.message || "Erro ao sincronizar.", "danger");
      }
      render();
    });

    const grid = view.querySelector("#agenda-grid");
    grid.className = "agenda-grid";

    days.forEach((d) => {
      const key = todayKey(d);
      const dayItems = state.items
        .filter((i) => i.onAgenda && i.start && i.start.slice(0, 10) === key)
        .sort((a, b) => (a.start > b.start ? 1 : -1));
      const dayEl = document.createElement("div");
      dayEl.className = "agenda-day";
      dayEl.innerHTML = `
        <div class="agenda-day-head">
          <span class="dow">${d.toLocaleDateString("pt-BR", { weekday: "short" })}</span>
          <span class="num ${key === today ? "" : ""}" style="${key === today ? "color:var(--accent)" : ""}">${d.getDate()}</span>
        </div>
        <div class="agenda-day-events"></div>
      `;
      const evWrap = dayEl.querySelector(".agenda-day-events");
      if (dayItems.length === 0) {
        evWrap.innerHTML = `<div class="small text-dim">—</div>`;
      } else {
        dayItems.forEach((i) => {
          const f = frenteByKey(i.frente);
          const el = document.createElement("div");
          el.className = "agenda-event";
          el.innerHTML = `
            <span class="dot" style="background:${f?.color || "#999"}"></span>
            <div>
              <div>${escapeHtml(i.title)}</div>
              <div class="t">${i.allDay ? "dia todo" : formatTime(i.start)}${i.googleEventId ? " · G" : ""}</div>
            </div>
          `;
          el.addEventListener("click", () => openTaskDetail(i.id));
          evWrap.appendChild(el);
        });
      }
      grid.appendChild(dayEl);
    });
  }
}
