import { state, subscribe, editItem } from "../state.js";
import { FRENTES, frenteByKey } from "../frentes.js";
import { icon } from "../icons.js";
import { escapeHtml, formatTime, todayKey } from "../utils.js";
import { navigate } from "../router.js";
import { openTaskDetail } from "../components/card.js";

export function renderDashboard() {
  const view = document.getElementById("view");
  const unsub = subscribe(render);
  render();
  return unsub;

  function render() {
    const items = state.items;
    const today = todayKey();
    const todayAgenda = items
      .filter((i) => i.onAgenda && i.start && i.start.slice(0, 10) === today)
      .sort((a, b) => (a.start > b.start ? 1 : -1));

    const habitFrentes = FRENTES.filter((f) => f.kind === "habit");
    const habits = items.filter((i) => i.habit);
    const habitsDoneToday = habits.filter((h) => h.habitDoneDates?.includes(today)).length;

    const doing = items.filter((i) => i.frente === "trabalho" && i.column === "doing");
    const blocked = items.filter((i) => i.frente === "trabalho" && i.column === "blocked");

    const pendingByFrente = FRENTES.filter((f) => f.kind !== "board").map((f) => ({
      frente: f,
      items: items.filter((i) => i.frente === f.key && !i.habit && i.column !== "done" && !i.completedAt),
    }));

    view.innerHTML = `
      <div class="stat-row">
        <div class="stat"><div class="num">${todayAgenda.length}</div><div class="lbl">Na agenda hoje</div></div>
        <div class="stat"><div class="num">${doing.length}</div><div class="lbl">Em andamento</div></div>
        <div class="stat"><div class="num">${blocked.length}</div><div class="lbl">Bloqueados</div></div>
        <div class="stat"><div class="num">${habitsDoneToday}/${habits.length}</div><div class="lbl">Hábitos hoje</div></div>
      </div>

      <div class="section-title"><h2>Agenda de hoje</h2><button class="btn btn-sm" data-go="agenda">Ver agenda</button></div>
      <div class="card" id="today-agenda-card"></div>

      ${
        habits.length
          ? `<div class="section-title"><h2>Hábitos de hoje</h2></div><div class="card" id="habits-card"></div>`
          : ""
      }

      <div class="section-title"><h2>Pendências por frente</h2></div>
      <div class="grid grid-2" id="pending-grid"></div>
    `;

    view.querySelectorAll("[data-go]").forEach((b) => b.addEventListener("click", () => navigate(b.dataset.go)));

    const agendaCard = view.querySelector("#today-agenda-card");
    if (todayAgenda.length === 0) {
      agendaCard.innerHTML = `<div class="empty-state">Nada agendado para hoje. 🎉</div>`;
    } else {
      agendaCard.innerHTML = todayAgenda
        .map((i) => {
          const f = frenteByKey(i.frente);
          return `<div class="list-item" data-open="${i.id}">
            <span class="nav-dot" style="background:${f?.color || "#999"}"></span>
            <div class="list-item-title">${escapeHtml(i.title)}</div>
            <div class="small text-dim">${formatTime(i.start)}</div>
          </div>`;
        })
        .join("");
      agendaCard.querySelectorAll("[data-open]").forEach((el) => el.addEventListener("click", () => openTaskDetail(el.dataset.open)));
    }

    const habitsCard = view.querySelector("#habits-card");
    if (habitsCard) {
      habitsCard.innerHTML = habitFrentes
        .map((f) => {
          const list = habits.filter((h) => h.frente === f.key);
          if (!list.length) return "";
          return `<div style="margin-bottom:8px;">
            <div class="small" style="font-weight:700;color:${f.color};margin-bottom:4px;">${f.label}</div>
            ${list
              .map(
                (h) => `<div class="list-item" data-habit="${h.id}">
                  <div class="list-item-check ${h.habitDoneDates?.includes(today) ? "done" : ""}">${h.habitDoneDates?.includes(today) ? icon("check") : ""}</div>
                  <div class="list-item-title ${h.habitDoneDates?.includes(today) ? "done" : ""}">${escapeHtml(h.title)}</div>
                </div>`
              )
              .join("")}
          </div>`;
        })
        .join("");
      habitsCard.querySelectorAll("[data-habit]").forEach((el) =>
        el.addEventListener("click", () => {
          el.querySelector(".list-item-check")?.classList.add("pop");
          toggleHabit(el.dataset.habit, today);
        })
      );
    }

    const grid = view.querySelector("#pending-grid");
    grid.innerHTML = pendingByFrente
      .map(
        ({ frente, items }) => `
      <div class="card">
        <div class="flex items-center justify-between" style="margin-bottom:8px;">
          <div class="flex items-center gap-8"><span class="nav-dot" style="background:${frente.color}"></span><strong style="font-size:13.5px;">${frente.label}</strong></div>
          <button class="btn btn-sm btn-ghost" data-go="${frente.key}">Ver tudo</button>
        </div>
        ${
          items.length === 0
            ? `<div class="empty-state">Sem pendências</div>`
            : items
                .slice(0, 4)
                .map((i) => `<div class="list-item" data-open="${i.id}"><div class="list-item-title">${escapeHtml(i.title)}</div></div>`)
                .join("")
        }
      </div>`
      )
      .join("");
    grid.querySelectorAll("[data-go]").forEach((b) => b.addEventListener("click", () => navigate(b.dataset.go)));
    grid.querySelectorAll("[data-open]").forEach((el) => el.addEventListener("click", () => openTaskDetail(el.dataset.open)));
  }

  async function toggleHabit(id, today) {
    const item = state.items.find((i) => i.id === id);
    if (!item) return;
    const dates = new Set(item.habitDoneDates || []);
    if (dates.has(today)) dates.delete(today);
    else dates.add(today);
    await editItem(id, { habitDoneDates: [...dates] });
  }
}
