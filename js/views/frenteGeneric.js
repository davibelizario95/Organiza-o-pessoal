import { state, subscribe, addItem, editItem, removeItem } from "../state.js";
import { icon } from "../icons.js";
import { escapeHtml, startOfWeek, todayKey, nowIso } from "../utils.js";
import { openTaskDetail } from "../components/card.js";
import { openModal, confirmDialog } from "../components/modal.js";
import { toast } from "../components/toast.js";

const DOW = ["S", "T", "Q", "Q", "S", "S", "D"];

// A frente Casa abre num menu grande em vez de ir direto pra lista — as
// categorias são só tags normais (mesmo campo "tags" que já existe em
// qualquer item), então nada de esquema novo. "Ver todos os itens" e o
// botão de voltar usam "__all__" como categoria especial (mostra tudo, sem
// filtrar por tag nenhuma).
const CASA_CATEGORIES = ["Financeiro", "Tarefas de Casa", "Compras"];

export function renderFrenteGeneric(frente) {
  const view = document.getElementById("view");
  const isCasaMenu = frente.key === "casa";
  let casaCategory = null; // null = menu grande; "__all__" ou uma das CASA_CATEGORIES = lista
  const unsub = subscribe(render);
  render();
  return unsub;

  function items() {
    return state.items.filter((i) => i.frente === frente.key);
  }

  function render() {
    if (isCasaMenu && casaCategory === null) return renderCasaMenu();
    return renderList();
  }

  function renderCasaMenu() {
    const all = items();
    view.innerHTML = `
      <div class="flex items-center gap-8" style="margin-bottom:20px;">
        <span class="nav-dot" style="background:${frente.color};width:12px;height:12px;"></span>
        <h1 style="font-size:19px;">${frente.label}</h1>
      </div>
      <div class="menu-grid" id="casa-menu"></div>
      <button class="btn btn-sm" id="casa-view-all" style="margin-top:16px;">Ver todos os itens</button>
    `;
    const menu = view.querySelector("#casa-menu");
    CASA_CATEGORIES.forEach((cat) => {
      const count = all.filter((i) => (i.tags || []).includes(cat) && !i.completedAt).length;
      const tile = document.createElement("button");
      tile.type = "button";
      tile.className = "menu-tile";
      tile.innerHTML = `
        <span class="menu-tile-label">${escapeHtml(cat)}</span>
        <span class="menu-tile-count">${count ? `${count} pendente${count === 1 ? "" : "s"}` : "Nada pendente"}</span>
      `;
      tile.addEventListener("click", () => {
        casaCategory = cat;
        render();
      });
      menu.appendChild(tile);
    });
    view.querySelector("#casa-view-all").addEventListener("click", () => {
      casaCategory = "__all__";
      render();
    });
  }

  function renderList() {
    const all = items();
    const scoped = casaCategory && casaCategory !== "__all__" ? all.filter((i) => (i.tags || []).includes(casaCategory)) : all;
    const habits = scoped.filter((i) => i.habit);
    const tasks = scoped.filter((i) => !i.habit);
    const pending = tasks.filter((i) => !i.completedAt);
    const done = tasks.filter((i) => i.completedAt);

    view.innerHTML = `
      <div class="flex items-center justify-between" style="margin-bottom:16px;">
        <div class="flex items-center gap-8">
          ${isCasaMenu ? `<button class="btn btn-icon btn-ghost btn-sm" id="casa-back">${icon("chevronLeft")}</button>` : ""}
          <span class="nav-dot" style="background:${frente.color};width:12px;height:12px;"></span>
          <h1 style="font-size:19px;">${casaCategory && casaCategory !== "__all__" ? `${frente.label} · ${escapeHtml(casaCategory)}` : frente.label}</h1>
        </div>
        <button class="btn btn-primary btn-sm" id="add-btn">${icon("plus")} ${frente.kind === "habit" ? "Novo hábito/tarefa" : "Novo item"}</button>
      </div>

      ${
        habits.length
          ? `<div class="section-title"><h2>Hábitos</h2></div><div id="habits-wrap"></div>`
          : ""
      }

      <div class="section-title"><h2>Pendentes</h2></div>
      <div class="card" id="pending-wrap"></div>

      ${
        done.length
          ? `<div class="section-title"><h2>Concluídos</h2></div><div class="card" id="done-wrap"></div>`
          : ""
      }
    `;

    view.querySelector("#casa-back")?.addEventListener("click", () => {
      casaCategory = null;
      render();
    });
    const presetTag = casaCategory && casaCategory !== "__all__" ? casaCategory : null;
    view.querySelector("#add-btn").addEventListener("click", () => openAddModal(presetTag));

    const habitsWrap = view.querySelector("#habits-wrap");
    if (habitsWrap) {
      habitsWrap.innerHTML = habits.map(habitCardHtml).join("");
      habitsWrap.querySelectorAll("[data-day]").forEach((el) =>
        el.addEventListener("click", () => {
          el.classList.add("pop");
          toggleHabitDay(el.dataset.habitId, el.dataset.day);
        })
      );
      habitsWrap.querySelectorAll("[data-edit-habit]").forEach((el) =>
        el.addEventListener("click", () => openTaskDetail(el.dataset.editHabit))
      );
      habitsWrap.querySelectorAll("[data-del-habit]").forEach((el) =>
        el.addEventListener("click", async () => {
          const ok = await confirmDialog("Remover este hábito?");
          if (ok) await removeItem(el.dataset.delHabit);
        })
      );
    }

    const pendingWrap = view.querySelector("#pending-wrap");
    pendingWrap.innerHTML = pending.length
      ? pending.map(taskRowHtml).join("")
      : `<div class="empty-state">Nada pendente por aqui. 🎉</div>`;
    wireTaskRows(pendingWrap);

    const doneWrap = view.querySelector("#done-wrap");
    if (doneWrap) {
      doneWrap.innerHTML = done.map(taskRowHtml).join("");
      wireTaskRows(doneWrap);
    }
  }

  function taskRowHtml(item) {
    return `<div class="list-item" data-id="${item.id}">
      <div class="list-item-check ${item.completedAt ? "done" : ""}" data-check="${item.id}">${item.completedAt ? icon("check") : ""}</div>
      <div class="list-item-title ${item.completedAt ? "done" : ""}" data-open="${item.id}">${escapeHtml(item.title)}</div>
      ${(item.tags || []).map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join("")}
      ${item.onAgenda ? icon("agenda", "icon") : ""}
    </div>`;
  }

  function wireTaskRows(container) {
    container.querySelectorAll("[data-check]").forEach((el) =>
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        el.classList.add("pop");
        toggleDone(el.dataset.check);
      })
    );
    container.querySelectorAll("[data-open]").forEach((el) =>
      el.addEventListener("click", () => openTaskDetail(el.dataset.open))
    );
  }

  function habitCardHtml(habit) {
    const weekStart = startOfWeek();
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return todayKey(d);
    });
    const today = todayKey();
    return `<div class="card">
      <div class="flex items-center justify-between" style="margin-bottom:10px;">
        <strong style="font-size:13.5px;">${escapeHtml(habit.title)}</strong>
        <div class="flex gap-8">
          <button class="btn btn-icon btn-ghost btn-sm" data-edit-habit="${habit.id}">${icon("edit")}</button>
          <button class="btn btn-icon btn-ghost btn-sm" data-del-habit="${habit.id}">${icon("trash")}</button>
        </div>
      </div>
      <div class="habit-grid">
        ${days
          .map(
            (d, idx) => `<div class="habit-day ${habit.habitDoneDates?.includes(d) ? "done" : ""} ${d === today ? "today" : ""}"
              data-habit-id="${habit.id}" data-day="${d}">${DOW[idx]}</div>`
          )
          .join("")}
      </div>
    </div>`;
  }

  async function toggleHabitDay(habitId, day) {
    const item = state.items.find((i) => i.id === habitId);
    if (!item) return;
    const dates = new Set(item.habitDoneDates || []);
    if (dates.has(day)) dates.delete(day);
    else dates.add(day);
    await editItem(habitId, { habitDoneDates: [...dates] });
  }

  async function toggleDone(id) {
    const item = state.items.find((i) => i.id === id);
    if (!item) return;
    await editItem(id, { completedAt: item.completedAt ? null : nowIso() });
  }

  function openAddModal(presetTag) {
    const { body, close } = openModal({ title: frente.kind === "habit" ? "Novo hábito ou tarefa" : `Novo item — ${frente.label}` });
    body.innerHTML = `
      <label>Título</label>
      <input type="text" id="a-title" placeholder="Ex: ${frente.kind === "habit" ? "Leitura bíblica diária" : "Pagar conta de luz"}" />
      ${
        frente.kind === "habit"
          ? `<label class="checkbox-row"><input type="checkbox" id="a-habit" checked/> É um hábito recorrente (com checklist semanal)</label>`
          : ""
      }
      ${presetTag ? `<p class="small text-dim">Vai entrar em <strong>${escapeHtml(presetTag)}</strong>.</p>` : ""}
      <button class="btn btn-primary" id="a-save" style="width:100%;margin-top:16px;">Adicionar</button>
    `;
    const titleField = body.querySelector("#a-title");
    setTimeout(() => titleField.focus(), 30);
    async function save() {
      const title = titleField.value.trim();
      if (!title) return titleField.focus();
      const isHabit = frente.kind === "habit" ? body.querySelector("#a-habit").checked : false;
      await addItem({
        frente: frente.key,
        title,
        habit: isHabit,
        type: isHabit ? "habit" : "task",
        tags: presetTag ? [presetTag] : [],
      });
      toast("Adicionado.");
      close();
    }
    body.querySelector("#a-save").addEventListener("click", save);
    titleField.addEventListener("keydown", (e) => {
      if (e.key === "Enter") save();
    });
  }
}
