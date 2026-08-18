import { state } from "../state.js";
import { openModal } from "../components/modal.js";
import { openTaskDetail } from "../components/card.js";
import { contextLabel } from "../frentes.js";
import { escapeHtml, startOfWeek, endOfWeek, daysAgo, formatDate } from "../utils.js";

export function openWeeklyReview() {
  const { body } = openModal({ title: "Revisão semanal — Trabalho", wide: true });
  const items = state.items.filter((i) => i.frente === "trabalho");
  const weekStart = startOfWeek();
  const weekEnd = endOfWeek();

  const completedThisWeek = items.filter(
    (i) => i.completedAt && new Date(i.completedAt) >= weekStart && new Date(i.completedAt) < weekEnd
  );
  const stuck = items
    .filter((i) => (i.column === "doing" || i.column === "blocked") && daysAgo(i.updatedAt) >= 3)
    .sort((a, b) => daysAgo(b.updatedAt) - daysAgo(a.updatedAt));

  body.innerHTML = `
    <p class="small text-dim">Semana de ${formatDate(weekStart)} a ${formatDate(new Date(weekEnd - 86400000))}</p>

    <div class="section-title" style="margin-top:14px;"><h2>✅ Concluído esta semana (${completedThisWeek.length})</h2></div>
    <div class="card" id="wr-done"></div>

    <div class="section-title"><h2>⏳ Parado há 3+ dias em Em Andamento / Bloqueado (${stuck.length})</h2></div>
    <div class="card" id="wr-stuck"></div>
  `;

  const doneWrap = body.querySelector("#wr-done");
  doneWrap.innerHTML = completedThisWeek.length
    ? completedThisWeek
        .map(
          (i) => `<div class="list-item" data-open="${i.id}">
        <div class="list-item-title">${escapeHtml(i.title)}</div>
        ${i.context ? `<span class="tag tag-${i.context.toLowerCase()}">${i.context}</span>` : ""}
        <span class="small text-dim">${formatDate(i.completedAt)}</span>
      </div>`
        )
        .join("")
    : `<div class="empty-state">Nada concluído ainda esta semana.</div>`;

  const stuckWrap = body.querySelector("#wr-stuck");
  stuckWrap.innerHTML = stuck.length
    ? stuck
        .map(
          (i) => `<div class="list-item" data-open="${i.id}">
        <div class="list-item-title">${escapeHtml(i.title)}</div>
        ${i.context ? `<span class="tag tag-${i.context.toLowerCase()}">${i.context}</span>` : ""}
        <span class="small text-dim">${daysAgo(i.updatedAt)}d parado · ${i.column === "doing" ? "Em Andamento" : "Bloqueado"}</span>
      </div>`
        )
        .join("")
    : `<div class="empty-state">Nada parado há muito tempo. 👏</div>`;

  body.querySelectorAll("[data-open]").forEach((el) => el.addEventListener("click", () => openTaskDetail(el.dataset.open)));
}
