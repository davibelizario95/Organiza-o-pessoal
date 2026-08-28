import { state, subscribe, addItem } from "../state.js";
import { frenteByKey } from "../frentes.js";
import { icon } from "../icons.js";
import { escapeHtml, formatTime, startOfWeek, todayKey } from "../utils.js";
import { openTaskDetail } from "../components/card.js";
import { openModal } from "../components/modal.js";
import { isGoogleCalendarConfigured } from "../config.js";
import { gcalState, connect, syncNow } from "../googleCalendar.js";
import { toast } from "../components/toast.js";
import { navigate } from "../router.js";

// Item de agenda "solto": não pertence a nenhuma frente/função da vida —
// só existe pra aparecer na agenda (linha do tempo + grade da semana),
// igual aos eventos importados do Google. Ver openTimelineQuickAdd abaixo.
const AGENDA_ONLY_FRENTE = "agenda";

function openTimelineQuickAdd() {
  const { body, close } = openModal({ title: "Adicionar à agenda" });
  const now = new Date();
  const roundedMin = Math.ceil(now.getMinutes() / 5) * 5;
  const defaultTime = `${String(roundedMin === 60 ? now.getHours() + 1 : now.getHours()).padStart(2, "0")}:${String(roundedMin % 60).padStart(2, "0")}`;

  body.innerHTML = `
    <label>O que é?</label>
    <input type="text" id="qa-title" placeholder="Ex: Dentista, ligar pro fornecedor..." />
    <label class="checkbox-row"><input type="checkbox" id="qa-allday" /> Dia todo (sem horário)</label>
    <div id="qa-time-row">
      <label>Horário (hoje)</label>
      <input type="time" id="qa-time" value="${defaultTime}" />
    </div>
    <div class="flex gap-8" style="margin-top:18px;justify-content:flex-end;">
      <button class="btn" id="qa-cancel">Cancelar</button>
      <button class="btn btn-primary" id="qa-save">Adicionar</button>
    </div>
  `;

  const titleInput = body.querySelector("#qa-title");
  setTimeout(() => titleInput.focus(), 30);
  const allDayCheck = body.querySelector("#qa-allday");
  const timeRow = body.querySelector("#qa-time-row");
  allDayCheck.addEventListener("change", () => {
    timeRow.style.display = allDayCheck.checked ? "none" : "";
  });

  async function save() {
    const title = titleInput.value.trim();
    if (!title) {
      titleInput.focus();
      return;
    }
    const allDay = allDayCheck.checked;
    const time = body.querySelector("#qa-time").value || "09:00";
    await addItem({
      frente: AGENDA_ONLY_FRENTE,
      type: "task",
      title,
      column: "done",
      onAgenda: true,
      allDay,
      start: `${todayKey()}T${allDay ? "00:00" : time}:00`,
    });
    toast("Adicionado à agenda!");
    close();
  }
  body.querySelector("#qa-cancel").onclick = close;
  body.querySelector("#qa-save").onclick = save;
  titleInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      save();
    }
  });
}

let weekOffset = 0;

const TIMELINE_START_HOUR = 6;
const TIMELINE_END_HOUR = 23;
const TIMELINE_HOUR_PX = 52;

export function renderAgenda() {
  const view = document.getElementById("view");
  const unsub = subscribe(render);
  render();
  return unsub;

  function renderTimeline(container) {
    const today = todayKey();
    const todayItems = state.items
      .filter((i) => i.onAgenda && !i.allDay && i.start && i.start.slice(0, 10) === today)
      .sort((a, b) => (a.start > b.start ? 1 : -1));

    const hours = [];
    for (let h = TIMELINE_START_HOUR; h <= TIMELINE_END_HOUR; h++) hours.push(h);
    const totalPx = (TIMELINE_END_HOUR - TIMELINE_START_HOUR) * TIMELINE_HOUR_PX;

    container.style.height = `${totalPx + 20}px`;
    container.innerHTML = `
      ${hours
        .map(
          (h, idx) =>
            `<div class="timeline-hour" style="top:${idx * TIMELINE_HOUR_PX}px;"><span class="timeline-hour-label">${String(h).padStart(2, "0")}:00</span></div>`
        )
        .join("")}
      <div class="timeline-events" id="timeline-events"></div>
    `;

    const eventsWrap = container.querySelector("#timeline-events");
    if (!todayItems.length) {
      eventsWrap.innerHTML = `<div class="small text-dim" style="padding:4px 0;">Nada com horário marcado hoje.</div>`;
    }
    todayItems.forEach((i) => {
      const start = new Date(i.start);
      const startMin = Math.max(start.getHours() * 60 + start.getMinutes(), TIMELINE_START_HOUR * 60);
      let durMin = i.timeTargetMin || 30;
      if (i.end) durMin = Math.max(15, (new Date(i.end) - start) / 60000);
      const top = ((startMin - TIMELINE_START_HOUR * 60) / 60) * TIMELINE_HOUR_PX;
      const height = Math.max(22, (durMin / 60) * TIMELINE_HOUR_PX);
      const f = frenteByKey(i.frente);
      const el = document.createElement("div");
      el.className = "timeline-event";
      el.style.top = `${top}px`;
      el.style.height = `${height}px`;
      el.style.borderLeftColor = f?.color || "var(--accent)";
      el.innerHTML = `<span class="timeline-event-time">${formatTime(i.start)}</span><span class="timeline-event-title">${escapeHtml(i.title)}</span>`;
      el.addEventListener("click", () => openTaskDetail(i.id));
      eventsWrap.appendChild(el);
    });

    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    if (nowMin >= TIMELINE_START_HOUR * 60 && nowMin <= TIMELINE_END_HOUR * 60) {
      const nowTop = ((nowMin - TIMELINE_START_HOUR * 60) / 60) * TIMELINE_HOUR_PX;
      const nowLine = document.createElement("div");
      nowLine.className = "timeline-now";
      nowLine.style.top = `${nowTop}px`;
      container.appendChild(nowLine);
    }
  }

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
      <div class="section-title mt-0"><h2>Hoje — linha do tempo</h2><button class="btn btn-sm" id="timeline-add-btn">${icon("plus")} Adicionar</button></div>
      <div class="timeline-day" id="timeline-day"></div>

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

    renderTimeline(view.querySelector("#timeline-day"));
    view.querySelector("#timeline-add-btn").addEventListener("click", openTimelineQuickAdd);

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
        const failedMsg = r.failed ? ` (${r.failed} falharam)` : "";
        toast(`Sincronizado: ${r.pushed} enviados, ${r.pulled} eventos do Google.${failedMsg}`, r.failed ? "danger" : "info");
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
