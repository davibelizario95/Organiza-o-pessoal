import { state, subscribe, editItem, removeItem } from "../state.js";
import { COLUMNS, CONTEXTS } from "../frentes.js";
import { icon } from "../icons.js";
import { escapeHtml } from "../utils.js";
import { renderTaskCard, openTaskDetail } from "../components/card.js";
import { confirmDialog } from "../components/modal.js";
import { toast } from "../components/toast.js";
import { stopTimer } from "../components/timer.js";
import { openWeeklyReview } from "./weeklyReview.js";
import { openTemplatesManager } from "../components/templates.js";
import { openFiltersManager } from "../components/filters.js";
import { nowIso } from "../utils.js";
import { openQuickCapture } from "../components/quickCapture.js";

let contextFilter = "all";
let tagFilters = []; // tags ativas (todas precisam bater — AND)

function sameTags(a, b) {
  if (a.length !== b.length) return false;
  const setB = new Set(b);
  return a.every((t) => setB.has(t));
}

export function renderTrabalho() {
  const view = document.getElementById("view");
  const unsub = subscribe(render);
  render();
  return unsub;

  // itens da frente já filtrados por contexto (IC/DB/PP) — usado tanto pra
  // montar a lista de tags disponíveis quanto como base do filtro final
  function itemsByContext() {
    let list = state.items.filter((i) => i.frente === "trabalho");
    if (contextFilter !== "all") list = list.filter((i) => i.context === contextFilter);
    return list;
  }

  function items() {
    let list = itemsByContext();
    if (tagFilters.length) list = list.filter((i) => tagFilters.every((t) => (i.tags || []).includes(t)));
    return list;
  }

  // aplica de um clique só o contexto + tags salvos num filtro nomeado
  function applyFilter(filter) {
    contextFilter = filter.context || "all";
    tagFilters = filter.tags || [];
    render();
  }

  function render() {
    const byContext = itemsByContext();
    const all = items();
    // tags usadas nos itens + as que já estão ativas no filtro (mesmo que
    // nenhum item bata com elas agora — senão o chip "some" e o filtro
    // aplicado fica sem indicação visual nem como desmarcar)
    const availableTags = [...new Set([...byContext.flatMap((i) => i.tags || []), ...tagFilters])].sort((a, b) =>
      a.localeCompare(b, "pt-BR")
    );
    // itens fora das 3 colunas do quadro (ex: "inbox"/"blocked" antigos, ou
    // qualquer item novo ainda sem coluna definida) — lista resumida, só
    // texto, em vez de cards, até serem organizados numa coluna real
    const summaryItems = all.filter((i) => !COLUMNS.some((c) => c.key === i.column));

    view.innerHTML = `
      <div class="board-toolbar">
        <button class="chip ${contextFilter === "all" ? "active" : ""}" data-ctx="all">Todos</button>
        ${CONTEXTS.map((c) => `<button class="chip ${contextFilter === c.key ? "active" : ""}" data-ctx="${c.key}">${c.key}</button>`).join("")}
        <span style="flex:1"></span>
        <button class="btn btn-sm" id="filters-btn">${icon("bolt")} Filtros</button>
        <button class="btn btn-sm" id="tpl-btn">${icon("repeat")} Templates</button>
        <button class="btn btn-sm" id="review-btn">${icon("review")} Revisão semanal</button>
        <button class="btn btn-sm btn-primary" id="new-card-btn">${icon("plus")} Novo card</button>
      </div>
      ${
        state.filters.length
          ? `<div class="board-toolbar" style="margin-top:-8px;">
              ${state.filters
                .map((f) => {
                  const active = (f.context || "all") === contextFilter && sameTags(f.tags || [], tagFilters);
                  return `<button class="chip ${active ? "active" : ""}" data-filter="${f.id}">${icon("bolt")} ${escapeHtml(f.name)}</button>`;
                })
                .join("")}
            </div>`
          : ""
      }
      ${
        availableTags.length
          ? `<div class="board-toolbar" style="margin-top:-8px;">
              <button class="chip ${tagFilters.length === 0 ? "active" : ""}" data-tag="all">Todas as tags</button>
              ${availableTags
                .map(
                  (t) =>
                    `<button class="chip ${tagFilters.length === 1 && tagFilters[0] === t ? "active" : ""}" data-tag="${escapeHtml(t)}">${escapeHtml(t)}</button>`
                )
                .join("")}
            </div>`
          : ""
      }
      ${
        summaryItems.length
          ? `<div class="section-title" style="margin-top:0;"><h2>Todas as tarefas (${summaryItems.length})</h2></div>
             <div class="card" id="summary-list" style="margin-bottom:16px;"></div>`
          : ""
      }
      <div class="board" id="board"></div>
    `;

    view.querySelectorAll("[data-ctx]").forEach((chip) =>
      chip.addEventListener("click", () => {
        contextFilter = chip.dataset.ctx;
        tagFilters = [];
        render();
      })
    );
    view.querySelectorAll("[data-tag]").forEach((chip) =>
      chip.addEventListener("click", () => {
        tagFilters = chip.dataset.tag === "all" ? [] : [chip.dataset.tag];
        render();
      })
    );
    view.querySelectorAll("[data-filter]").forEach((chip) =>
      chip.addEventListener("click", () => {
        const filter = state.filters.find((f) => f.id === chip.dataset.filter);
        if (filter) applyFilter(filter);
      })
    );
    view.querySelector("#filters-btn").addEventListener("click", () => openFiltersManager({ onUse: applyFilter }));
    view.querySelector("#tpl-btn").addEventListener("click", () => openTemplatesManager());
    view.querySelector("#review-btn").addEventListener("click", () => openWeeklyReview());
    view.querySelector("#new-card-btn").addEventListener("click", () => openQuickCapture("trabalho"));

    const summaryList = view.querySelector("#summary-list");
    if (summaryList) {
      summaryList.innerHTML = summaryItems
        .map(
          (i) => `<div class="list-item" data-open="${i.id}">
            <div class="list-item-title" style="flex:1;cursor:pointer;">${escapeHtml(i.title)}</div>
            <button class="btn btn-icon btn-ghost btn-sm" data-quickdel="${i.id}" title="Excluir">${icon("close")}</button>
          </div>`
        )
        .join("");
      summaryList.querySelectorAll(".list-item-title").forEach((el) =>
        el.addEventListener("click", () => openTaskDetail(el.closest("[data-open]").dataset.open))
      );
      summaryList.querySelectorAll("[data-quickdel]").forEach((el) =>
        el.addEventListener("click", async (e) => {
          e.stopPropagation();
          const item = state.items.find((i) => i.id === el.dataset.quickdel);
          const ok = await confirmDialog(`Excluir "${item?.title}"?`);
          if (ok) {
            await removeItem(el.dataset.quickdel);
            toast("Item excluído.");
          }
        })
      );
    }

    const board = view.querySelector("#board");
    COLUMNS.forEach((col) => {
      const colItems = all.filter((i) => i.column === col.key);
      const colEl = document.createElement("div");
      colEl.className = "board-col";
      colEl.dataset.col = col.key;
      colEl.innerHTML = `
        <div class="board-col-head">
          <span>${col.label}</span>
          <div class="flex items-center gap-8">
            <span>${colItems.length}</span>
            ${
              colItems.length
                ? `<button class="btn btn-icon btn-ghost btn-sm" data-clear-col title="Excluir todos os cards desta coluna">${icon("trash")}</button>`
                : ""
            }
          </div>
        </div>
        <div class="board-col-body"></div>
      `;
      const bodyEl = colEl.querySelector(".board-col-body");
      colItems.forEach((item) => bodyEl.appendChild(renderTaskCard(item)));

      colEl.querySelector("[data-clear-col]")?.addEventListener("click", async (e) => {
        e.stopPropagation();
        const ok = await confirmDialog(
          `Excluir todos os ${colItems.length} cards de "${col.label}"? Essa ação não pode ser desfeita.`
        );
        if (!ok) return;
        for (const item of colItems) await removeItem(item.id);
        toast(`${colItems.length} cards excluídos.`);
      });

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
    // não inicia o cronômetro sozinho ao mover pra "Fazendo" — só para se
    // já estava rodando e o card sai de "Fazendo" (o início continua sendo
    // manual, pelo botão Start dentro do card)
    if (item.column === "doing" && newColumn !== "doing" && item.timerRunning) {
      await stopTimer(id);
    }
  }
}
