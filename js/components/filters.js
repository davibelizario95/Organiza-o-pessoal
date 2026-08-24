import { state } from "../state.js";
import { createFilter, deleteFilter } from "../store.js";
import { openModal, confirmDialog } from "./modal.js";
import { CONTEXTS } from "../frentes.js";
import { escapeHtml } from "../utils.js";
import { toast } from "./toast.js";

// Filtros salvos pra Trabalho: uma combinação de contexto + tags que o
// usuário nomeia uma vez ("IC · Online") e depois seleciona com um clique
// só, em vez de clicar contexto e tag toda vez.
export function openFiltersManager({ onUse } = {}) {
  const { body, close } = openModal({ title: "Filtros de Trabalho", wide: true });

  function render() {
    body.innerHTML = `
      <p class="small text-dim">Combine contexto (IC/DB/PP) e tags num filtro nomeado — depois é só selecionar ele na página Trabalho.</p>
      <div id="filters-list" style="margin:12px 0;"></div>
      <div class="divider"></div>
      <label>Nome do filtro</label>
      <input type="text" id="filter-name" placeholder="Ex: IC Online" />
      <div class="field-row">
        <div>
          <label>Contexto</label>
          <select id="filter-context">
            <option value="">Qualquer</option>
            ${CONTEXTS.map((c) => `<option value="${c.key}">${c.key} · ${c.label}</option>`).join("")}
          </select>
        </div>
        <div>
          <label>Tags (separadas por vírgula)</label>
          <input type="text" id="filter-tags" placeholder="Ex: Online, Especial" />
        </div>
      </div>
      <button class="btn btn-primary" id="filter-save" style="width:100%;margin-top:14px;">Criar filtro</button>
    `;

    const list = body.querySelector("#filters-list");
    list.innerHTML = state.filters.length
      ? state.filters
          .map((f) => {
            const parts = [
              f.context ? `<span class="tag tag-${f.context.toLowerCase()}">${f.context}</span>` : "",
              ...(f.tags || []).map((t) => `<span class="tag">${escapeHtml(t)}</span>`),
            ].join(" ");
            return `<div class="list-item">
              <div class="list-item-title">${escapeHtml(f.name)} ${parts}</div>
              ${onUse ? `<button class="btn btn-sm" data-use="${f.id}">Usar</button>` : ""}
              <button class="btn btn-icon btn-ghost btn-sm" data-del="${f.id}">🗑</button>
            </div>`;
          })
          .join("")
      : `<div class="empty-state">Nenhum filtro ainda.</div>`;

    list.querySelectorAll("[data-use]").forEach((el) =>
      el.addEventListener("click", () => {
        const filter = state.filters.find((f) => f.id === el.dataset.use);
        onUse?.(filter);
        close();
      })
    );
    list.querySelectorAll("[data-del]").forEach((el) =>
      el.addEventListener("click", async () => {
        const ok = await confirmDialog("Remover este filtro?");
        if (ok) await deleteFilter(state.profile.id, el.dataset.del);
        render();
      })
    );

    body.querySelector("#filter-save").addEventListener("click", async () => {
      const name = body.querySelector("#filter-name").value.trim();
      if (!name) return;
      const tags = body
        .querySelector("#filter-tags")
        .value.split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      await createFilter(state.profile.id, {
        name,
        context: body.querySelector("#filter-context").value || null,
        tags,
      });
      toast("Filtro criado.");
      render();
    });
  }

  render();
  return close;
}
