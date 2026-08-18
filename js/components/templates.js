import { state } from "../state.js";
import { createTemplate, deleteTemplate } from "../store.js";
import { openModal, confirmDialog } from "./modal.js";
import { CONTEXTS } from "../frentes.js";
import { createFromTemplate } from "./card.js";
import { escapeHtml } from "../utils.js";
import { toast } from "./toast.js";

const RECURRENCE_LABEL = { daily: "Diária", weekly: "Semanal", monthly: "Mensal" };

export function openTemplatesManager() {
  const { body, close } = openModal({ title: "Templates de tarefa recorrente", wide: true });

  function render() {
    body.innerHTML = `
      <p class="small text-dim">Para itens que se repetem (reunião semanal, revisão de projeto...). Crie um template uma vez e use quando precisar, sem recriar do zero.</p>
      <div id="tpl-list" style="margin:12px 0;"></div>
      <div class="divider"></div>
      <label>Título</label>
      <input type="text" id="tpl-title" placeholder="Ex: Reunião semanal de equipe" />
      <div class="field-row">
        <div>
          <label>Contexto</label>
          <select id="tpl-context">
            <option value="">—</option>
            ${CONTEXTS.map((c) => `<option value="${c.key}">${c.key} · ${c.label}</option>`).join("")}
          </select>
        </div>
        <div>
          <label>Recorrência</label>
          <select id="tpl-recurrence">
            <option value="weekly">Semanal</option>
            <option value="daily">Diária</option>
            <option value="monthly">Mensal</option>
          </select>
        </div>
      </div>
      <button class="btn btn-primary" id="tpl-save" style="width:100%;margin-top:14px;">Criar template</button>
    `;

    const list = body.querySelector("#tpl-list");
    list.innerHTML = state.templates.length
      ? state.templates
          .map(
            (t) => `<div class="list-item">
              <div class="list-item-title">${escapeHtml(t.title)} ${t.context ? `<span class="tag tag-${t.context.toLowerCase()}">${t.context}</span>` : ""} <span class="rec-badge">${RECURRENCE_LABEL[t.recurrence] || ""}</span></div>
              <button class="btn btn-sm" data-use="${t.id}">Usar agora</button>
              <button class="btn btn-icon btn-ghost btn-sm" data-del="${t.id}">🗑</button>
            </div>`
          )
          .join("")
      : `<div class="empty-state">Nenhum template ainda.</div>`;

    list.querySelectorAll("[data-use]").forEach((el) =>
      el.addEventListener("click", async () => {
        const tpl = state.templates.find((t) => t.id === el.dataset.use);
        await createFromTemplate(tpl);
        toast("Tarefa criada a partir do template.");
      })
    );
    list.querySelectorAll("[data-del]").forEach((el) =>
      el.addEventListener("click", async () => {
        const ok = await confirmDialog("Remover este template?");
        if (ok) await deleteTemplate(state.profile.id, el.dataset.del);
        render();
      })
    );

    body.querySelector("#tpl-save").addEventListener("click", async () => {
      const title = body.querySelector("#tpl-title").value.trim();
      if (!title) return;
      await createTemplate(state.profile.id, {
        title,
        frente: "trabalho",
        context: body.querySelector("#tpl-context").value || null,
        recurrence: body.querySelector("#tpl-recurrence").value,
      });
      toast("Template criado.");
      render();
    });
  }

  render();
  return close;
}
