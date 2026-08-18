import { state, subscribe, editItem } from "../state.js";
import { COLUMNS, CONTEXTS } from "../frentes.js";
import { icon } from "../icons.js";
import { renderTaskCard } from "../components/card.js";
import { startTimer, stopTimer } from "../components/timer.js";
import { openWeeklyReview } from "./weeklyReview.js";
import { openTemplatesManager } from "../components/templates.js";
import { nowIso } from "../utils.js";
import { openQuickCapture } from "../components/quickCapture.js";

let contextFilter = "all";

export function renderTrabalho() {
  const view = document.getElementById("view");
  const unsub = subscribe(render);
  render();
  return unsub;

  function items() {
    let list = state.items.filter((i) => i.frente === "trabalho");
    if (contextFilter !== "all") list = list.filter((i) => i.context === contextFilter);
    return list;
  }

  function render() {
    const all = items();
    view.innerHTML = `
      <div class="board-toolbar">
        <button class="chip ${contextFilter === "all" ? "active" : ""}" data-ctx="all">Todos</button>
        ${CONTEXTS.map((c) => `<button class="chip ${contextFilter === c.key ? "active" : ""}" data-ctx="${c.key}">${c.key}</button>`).join("")}
        <span style="flex:1"></span>
        <button class="btn btn-sm" id="tpl-btn">${icon("repeat")} Templates</button>
        <button class="btn btn-sm" id="review-btn">${icon("review")} Revisão semanal</button>
        <button class="btn btn-sm btn-primary" id="new-card-btn">${icon("plus")} Novo card</button>
      </div>
      <div class="board" id="board"></div>
    `;

    view.querySelectorAll("[data-ctx]").forEach((chip) =>
      chip.addEventListener("click", () => {
        contextFilter = chip.dataset.ctx;
        render();
      })
    );
    view.querySelector("#tpl-btn").addEventListener("click", () => openTemplatesManager());
    view.querySelector("#review-btn").addEventListener("click", () => openWeeklyReview());
    view.querySelector("#new-card-btn").addEventListener("click", () => openQuickCapture("trabalho"));

    const board = view.querySelector("#board");
    COLUMNS.forEach((col) => {
      const colItems = all.filter((i) => i.column === col.key);
      const colEl = document.createElement("div");
      colEl.className = "board-col";
      colEl.dataset.col = col.key;
      colEl.innerHTML = `
        <div class="board-col-head"><span>${col.label}</span><span>${colItems.length}</span></div>
        <div class="board-col-body"></div>
      `;
      const bodyEl = colEl.querySelector(".board-col-body");
      colItems.forEach((item) => bodyEl.appendChild(renderTaskCard(item)));

      colEl.addEventListener("dragover", (e) => {
        e.preventDefault();
        colEl.classList.add("drag-over");
      });
      colEl.addEventListener("dragleave", () => colEl.classList.remove("drag-over"));
      colEl.addEventListener("drop", async (e) => {
        e.preventDefault();
        colEl.classList.remove("drag-over");
        const id = e.dataTransfer.getData("text/plain");
        await moveCard(id, col.key);
      });

      board.appendChild(colEl);
    });
  }

  async function moveCard(id, newColumn) {
    const item = state.items.find((i) => i.id === id);
    if (!item || item.column === newColumn) return;
    const patch = { column: newColumn };
    if (newColumn === "done" && !item.completedAt) patch.completedAt = nowIso();
    if (newColumn !== "done") patch.completedAt = null;
    await editItem(id, patch);
    if (newColumn === "doing" && item.column !== "doing" && !item.timerRunning) {
      await startTimer(id);
    } else if (item.column === "doing" && newColumn !== "doing" && item.timerRunning) {
      await stopTimer(id);
    }
  }
}
