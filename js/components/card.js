import { icon } from "../icons.js";
import { openModal, confirmDialog } from "./modal.js";
import { editItem, removeItem, state, addItem } from "../state.js";
import { CONTEXTS, COLUMNS, frenteByKey, MENU_FRENTE_DEFAULTS } from "../frentes.js";
import { computeElapsedSec, startTimer, stopTimer } from "./timer.js";
import { createRecorder } from "./voiceRecorder.js";
import { getAudio, deleteAudio } from "../idb.js";
import { formatDuration, escapeHtml, nowIso, uid, todayKey } from "../utils.js";
import { toast } from "./toast.js";

export function renderTaskCard(item, { onDragStart } = {}) {
  const el = document.createElement("div");
  el.className = "task-card";
  el.draggable = true;
  el.dataset.id = item.id;

  const elapsed = computeElapsedSec(item);
  const targetSec = (item.timeTargetMin || 0) * 60;
  const over = targetSec > 0 && elapsed >= targetSec;

  el.innerHTML = `
    ${item.column !== "done" ? `<button class="task-card-done" data-quick-done title="Marcar como concluído">${icon("check")}</button>` : ""}
    <button class="task-card-delete" data-quick-delete title="Excluir">${icon("close")}</button>
    <div class="task-card-title">${escapeHtml(item.title)}</div>
    <div class="task-card-meta">
      ${item.context ? `<span class="tag tag-${item.context.toLowerCase()}">${item.context}</span>` : ""}
      ${(item.tags || []).map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join("")}
      ${item.urgent ? `<span class="tag tag-urgent">Urgente</span>` : item.important ? `<span class="tag tag-important">Prioridade</span>` : ""}
      ${
        item.subtasks?.length
          ? `<span class="tag">${icon("check", "icon")} ${item.subtasks.filter((s) => s.done).length}/${item.subtasks.length}</span>`
          : ""
      }
      ${item.voiceNotes?.length ? `<span class="tag">${icon("mic", "icon")} ${item.voiceNotes.length}</span>` : ""}
      ${item.onAgenda ? `<span class="tag">${icon("agenda", "icon")}</span>` : ""}
    </div>
    ${
      item.timeTargetMin || item.timerRunning || item.timeSpentSec
        ? `<div class="task-card-footer">
            <span class="task-card-timer ${item.timerRunning ? "running" : ""} ${over ? "over" : ""}">
              ${icon("timer", "icon")} <span data-elapsed>${formatDuration(elapsed)}</span>${item.timeTargetMin ? ` / ${item.timeTargetMin}m` : ""}
            </span>
          </div>`
        : ""
    }
  `;

  el.addEventListener("click", () => openTaskDetail(item.id));
  el.querySelector("[data-quick-done]")?.addEventListener("click", async (e) => {
    e.stopPropagation();
    if (item.timerRunning) await stopTimer(item.id);
    await editItem(item.id, { column: "done", completedAt: item.completedAt || nowIso() });
    toast("Marcado como concluído.");
  });
  el.querySelector("[data-quick-delete]").addEventListener("click", async (e) => {
    e.stopPropagation();
    const ok = await confirmDialog(`Excluir "${item.title}"?`);
    if (ok) {
      await removeItem(item.id);
      toast("Item excluído.");
    }
  });
  el.addEventListener("dragstart", (e) => {
    el.classList.add("dragging");
    e.dataTransfer.setData("text/plain", item.id);
    onDragStart?.(item.id);
  });
  el.addEventListener("dragend", () => el.classList.remove("dragging"));

  // atualiza o cronômetro exibido no card sem re-renderizar tudo
  if (item.timerRunning) {
    const span = el.querySelector("[data-elapsed]");
    const int = setInterval(() => {
      if (!document.body.contains(el)) return clearInterval(int);
      span.textContent = formatDuration(computeElapsedSec(item));
    }, 1000);
  }

  return el;
}

export function openTaskDetail(itemId) {
  const item = state.items.find((i) => i.id === itemId);
  if (!item) return;

  const frenteInfo = frenteByKey(item.frente);
  const { body, head, close } = openModal({ title: "", wide: true });

  // troca o título genérico do modal por um "canal" (# frente), como na referência
  const titleEl = head.querySelector("h2");
  if (titleEl) {
    titleEl.outerHTML = `
      <div class="task-modal-channel">
        <div class="task-modal-channel-label">Canal</div>
        <div class="task-modal-channel-tag"># ${escapeHtml(frenteInfo?.label || (item.frente === "agenda" ? "Agenda" : item.frente))}</div>
      </div>
    `;
  }

  let subtasks = (item.subtasks || []).map((s) => ({ ...s }));
  let priorityTier = item.urgent ? "urgent" : item.important ? "priority" : "normal";
  let onAgenda = !!item.onAgenda;
  let agendaDate = item.start ? item.start.slice(0, 10) : null;
  let agendaTime = item.start ? item.start.slice(11, 16) : "09:00";
  let doneChecked = item.frente === "trabalho" ? item.column === "done" : !!item.completedAt;
  let calViewYear, calViewMonth;
  {
    const base = agendaDate ? new Date(`${agendaDate}T00:00:00`) : new Date();
    calViewYear = base.getFullYear();
    calViewMonth = base.getMonth();
  }

  body.innerHTML = `
    <div class="task-modal-actions">
      <div class="task-modal-action-wrap">
        <button type="button" class="task-modal-action-btn" id="btn-priority">${icon("flag")} <span id="btn-priority-label"></span></button>
        <div class="task-popover" id="pop-priority">
          <button type="button" class="task-popover-item" data-pri="normal">Normal</button>
          <button type="button" class="task-popover-item" data-pri="priority">Prioridade</button>
          <button type="button" class="task-popover-item" data-pri="urgent">Urgente</button>
        </div>
      </div>
      <div class="task-modal-action-wrap">
        <button type="button" class="task-modal-action-btn" id="btn-agenda">${icon("agenda")} <span id="btn-agenda-label"></span></button>
        <div class="task-popover task-popover-cal" id="pop-agenda">
          <div class="mini-cal-head">
            <button type="button" id="cal-prev">${icon("chevronLeft")}</button>
            <strong id="cal-label"></strong>
            <button type="button" id="cal-next">${icon("chevronRight")}</button>
          </div>
          <div class="mini-cal-dow"><span>D</span><span>S</span><span>T</span><span>Q</span><span>Q</span><span>S</span><span>S</span></div>
          <div class="mini-cal-grid" id="cal-grid"></div>
          <div class="mini-cal-footer">
            <input type="time" id="pop-agenda-time" value="${agendaTime}" />
            <button type="button" class="btn btn-sm btn-ghost" id="pop-agenda-clear">Remover</button>
          </div>
        </div>
      </div>
      <button type="button" class="task-modal-action-btn" id="btn-subtasks">${icon("plus")} <span id="btn-subtasks-label">Subtarefas</span></button>
    </div>

    <div class="task-modal-main">
      ${!item.habit ? `<button type="button" class="task-modal-check ${doneChecked ? "done" : ""}" id="d-done-toggle">${doneChecked ? icon("check") : ""}</button>` : ""}
      <input type="text" id="d-title" class="task-modal-title" value="${escapeHtml(item.title)}" />
      ${
        item.frente === "trabalho"
          ? `<div class="task-modal-timer">
              <button type="button" class="btn btn-sm" id="d-timer-toggle">${item.timerRunning ? icon("pause") + " Pause" : icon("play") + " Start"}</button>
              <div class="task-modal-timer-stat">
                <div class="task-modal-timer-label">Actual</div>
                <div class="timer-display" id="d-timer-display" style="font-size:18px;">${formatDuration(computeElapsedSec(item))}</div>
              </div>
              <div class="task-modal-timer-stat">
                <div class="task-modal-timer-label">Planned</div>
                <input type="number" id="d-target" min="0" placeholder="--" value="${item.timeTargetMin || ""}" />
              </div>
            </div>`
          : ""
      }
    </div>

    <div id="d-subtasks" style="display:flex;flex-direction:column;margin:12px 0 4px;"></div>
    <div class="flex gap-8">
      <input type="text" id="d-subtask-new" placeholder="Nova subtarefa" style="flex:1;" />
      <button class="btn btn-icon" id="d-subtask-add" title="Adicionar subtarefa">${icon("plus")}</button>
    </div>

    <label>Notas</label>
    <textarea id="d-notes" placeholder="Detalhes, links, contexto...">${escapeHtml(item.notes || "")}</textarea>

    ${
      item.frente === "trabalho"
        ? `
    <div class="field-row">
      <div>
        <label>Coluna</label>
        <select id="d-column">
          ${COLUMNS.map((c) => `<option value="${c.key}" ${item.column === c.key ? "selected" : ""}>${c.label}</option>`).join("")}
        </select>
      </div>
      <div>
        <label>Contexto</label>
        <select id="d-context">
          <option value="">—</option>
          ${CONTEXTS.map((c) => `<option value="${c.key}" ${item.context === c.key ? "selected" : ""}>${c.key} · ${c.label}</option>`).join("")}
        </select>
      </div>
    </div>
    `
        : ""
    }
    ${
      item.frente === "trabalho" || item.frente in MENU_FRENTE_DEFAULTS
        ? `
    <label>Tags${
      item.frente in MENU_FRENTE_DEFAULTS
        ? ` (ex: ${MENU_FRENTE_DEFAULTS[item.frente].join(", ")} — pra aparecer no menu de ${frenteByKey(item.frente)?.label || item.frente})`
        : " (separadas por vírgula — pra filtrar dentro de cada contexto)"
    }</label>
    <input type="text" id="d-tags" placeholder="${item.frente in MENU_FRENTE_DEFAULTS ? `Ex: ${MENU_FRENTE_DEFAULTS[item.frente][0]}` : "Ex: Online, Especial"}" value="${escapeHtml((item.tags || []).join(", "))}" />
    `
        : ""
    }
    ${
      item.frente === "trabalho"
        ? `
    <label>Nota de voz</label>
    <div class="card" style="background:var(--bg-elev-2);padding:12px;">
      <button class="btn mic-btn" id="d-mic">${icon("mic")} Gravar nota de voz</button>
      <div id="d-voicenotes" style="margin-top:10px;display:flex;flex-direction:column;gap:8px;"></div>
    </div>
    `
        : ""
    }

    ${
      item.habit
        ? `<label class="checkbox-row"><input type="checkbox" id="d-done-today" ${item.habitDoneDates?.includes(new Date().toISOString().slice(0, 10)) ? "checked" : ""}/> Marcar como feito hoje</label>`
        : ""
    }

    <div class="flex gap-8" style="margin-top:20px;justify-content:space-between;">
      <button class="btn btn-danger" id="d-delete">${icon("trash")} Excluir</button>
      <div class="flex gap-8">
        <button class="btn" id="d-cancel">Cancelar</button>
        <button class="btn btn-primary" id="d-save">Salvar</button>
      </div>
    </div>
  `;

  // ---- popovers (prioridade / agenda) ----
  const popovers = [];
  function registerPopover(trigger, panel) {
    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = panel.classList.contains("open");
      popovers.forEach((p) => p.panel.classList.remove("open"));
      if (!isOpen) panel.classList.add("open");
    });
    panel.addEventListener("click", (e) => e.stopPropagation());
    popovers.push({ trigger, panel });
  }
  function closeAllPopovers() {
    popovers.forEach((p) => p.panel.classList.remove("open"));
  }
  document.addEventListener("click", closeAllPopovers);
  registerPopover(body.querySelector("#btn-priority"), body.querySelector("#pop-priority"));
  registerPopover(body.querySelector("#btn-agenda"), body.querySelector("#pop-agenda"));

  // ---- prioridade ----
  function updatePriorityLabel() {
    body.querySelector("#btn-priority-label").textContent =
      priorityTier === "urgent" ? "Urgente" : priorityTier === "priority" ? "Prioridade" : "Normal";
  }
  updatePriorityLabel();
  body.querySelectorAll("#pop-priority [data-pri]").forEach((btn) =>
    btn.addEventListener("click", () => {
      priorityTier = btn.dataset.pri;
      updatePriorityLabel();
      closeAllPopovers();
    })
  );

  // ---- agenda: mini calendário ----
  function updateAgendaLabel() {
    const label = body.querySelector("#btn-agenda-label");
    if (!onAgenda || !agendaDate) {
      label.textContent = "Agenda";
      return;
    }
    if (agendaDate === todayKey()) {
      label.textContent = "Hoje";
      return;
    }
    label.textContent = new Date(`${agendaDate}T00:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  }
  updateAgendaLabel();
  function renderMiniCal() {
    const monthLabel = new Date(calViewYear, calViewMonth, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    body.querySelector("#cal-label").textContent = monthLabel;
    const firstDow = new Date(calViewYear, calViewMonth, 1).getDay();
    const daysInMonth = new Date(calViewYear, calViewMonth + 1, 0).getDate();
    const todayStr = todayKey();
    let html = "";
    for (let i = 0; i < firstDow; i++) html += "<span></span>";
    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${calViewYear}-${String(calViewMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      html += `<button type="button" class="mini-cal-day ${agendaDate === key ? "selected" : ""} ${key === todayStr ? "today" : ""}" data-day="${key}">${d}</button>`;
    }
    const grid = body.querySelector("#cal-grid");
    grid.innerHTML = html;
    grid.querySelectorAll("[data-day]").forEach((btn) =>
      btn.addEventListener("click", () => {
        agendaDate = btn.dataset.day;
        onAgenda = true;
        updateAgendaLabel();
        renderMiniCal();
      })
    );
  }
  renderMiniCal();
  body.querySelector("#cal-prev").addEventListener("click", () => {
    calViewMonth -= 1;
    if (calViewMonth < 0) {
      calViewMonth = 11;
      calViewYear -= 1;
    }
    renderMiniCal();
  });
  body.querySelector("#cal-next").addEventListener("click", () => {
    calViewMonth += 1;
    if (calViewMonth > 11) {
      calViewMonth = 0;
      calViewYear += 1;
    }
    renderMiniCal();
  });
  body.querySelector("#pop-agenda-time").addEventListener("change", (e) => {
    agendaTime = e.target.value || "09:00";
  });
  body.querySelector("#pop-agenda-clear").addEventListener("click", () => {
    onAgenda = false;
    agendaDate = null;
    updateAgendaLabel();
    closeAllPopovers();
  });

  // ---- checkbox principal (feito/não feito) ----
  const doneBtn = body.querySelector("#d-done-toggle");
  function setDoneVisual() {
    if (!doneBtn) return;
    doneBtn.classList.toggle("done", doneChecked);
    doneBtn.innerHTML = doneChecked ? icon("check") : "";
  }
  doneBtn?.addEventListener("click", () => {
    doneChecked = !doneChecked;
    setDoneVisual();
    const colSelect = body.querySelector("#d-column");
    if (colSelect) colSelect.value = doneChecked ? "done" : "todo";
  });
  body.querySelector("#d-column")?.addEventListener("change", (e) => {
    doneChecked = e.target.value === "done";
    setDoneVisual();
  });

  // ---- subtarefas ----
  const subtasksWrap = body.querySelector("#d-subtasks");
  function renderSubtasks() {
    subtasksWrap.innerHTML = subtasks.length
      ? subtasks
          .map(
            (s) => `<div class="list-item" data-sub="${s.id}" style="padding:6px 0;">
              <div class="list-item-check ${s.done ? "done" : ""}" data-sub-toggle="${s.id}">${s.done ? icon("check") : ""}</div>
              <div class="list-item-title ${s.done ? "done" : ""}" style="flex:1;">${escapeHtml(s.title)}</div>
              <button class="btn btn-icon btn-ghost btn-sm" data-sub-del="${s.id}">${icon("close")}</button>
            </div>`
          )
          .join("")
      : `<div class="empty-state" style="padding:8px 4px;text-align:left;">Nenhuma subtarefa ainda.</div>`;
    body.querySelector("#btn-subtasks-label").textContent = subtasks.length ? `Subtarefas (${subtasks.length})` : "Subtarefas";
    subtasksWrap.querySelectorAll("[data-sub-toggle]").forEach((el) =>
      el.addEventListener("click", () => {
        const s = subtasks.find((x) => x.id === el.dataset.subToggle);
        s.done = !s.done;
        renderSubtasks();
      })
    );
    subtasksWrap.querySelectorAll("[data-sub-del]").forEach((el) =>
      el.addEventListener("click", () => {
        subtasks = subtasks.filter((x) => x.id !== el.dataset.subDel);
        renderSubtasks();
      })
    );
  }
  renderSubtasks();
  function addSubtask() {
    const input = body.querySelector("#d-subtask-new");
    const title = input.value.trim();
    if (!title) return;
    subtasks.push({ id: uid(), title, done: false });
    input.value = "";
    renderSubtasks();
    input.focus();
  }
  body.querySelector("#d-subtask-add").addEventListener("click", addSubtask);
  body.querySelector("#d-subtask-new").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addSubtask();
    }
  });
  body.querySelector("#btn-subtasks").addEventListener("click", () => {
    const input = body.querySelector("#d-subtask-new");
    input.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => input.focus(), 150);
  });

  // ---- cronômetro ----
  let timerInt = null;
  const timerDisplay = body.querySelector("#d-timer-display");
  if (timerDisplay) {
    timerInt = setInterval(() => {
      const fresh = state.items.find((i) => i.id === itemId);
      if (fresh) timerDisplay.textContent = formatDuration(computeElapsedSec(fresh));
    }, 1000);
    body.querySelector("#d-timer-toggle").addEventListener("click", async (e) => {
      const fresh = state.items.find((i) => i.id === itemId);
      if (fresh.timerRunning) {
        await stopTimer(itemId);
        e.target.innerHTML = icon("play") + " Start";
      } else {
        await startTimer(itemId);
        e.target.innerHTML = icon("pause") + " Pause";
      }
    });
  }

  // ---- voice notes ----
  const voiceList = body.querySelector("#d-voicenotes");
  async function renderVoiceNotes() {
    if (!voiceList) return;
    voiceList.innerHTML = "";
    const fresh = state.items.find((i) => i.id === itemId);
    for (const vn of fresh?.voiceNotes || []) {
      const row = document.createElement("div");
      row.className = "flex gap-8 items-center";
      const blob = await getAudio(vn.localAudioKey);
      const url = blob ? URL.createObjectURL(blob) : null;
      row.innerHTML = `
        ${url ? `<audio controls src="${url}"></audio>` : `<span class="small text-dim">áudio indisponível neste aparelho</span>`}
        <button class="btn btn-icon btn-ghost btn-sm" data-del-voice="${vn.id}">${icon("trash")}</button>
      `;
      row.querySelector("[data-del-voice]").addEventListener("click", async () => {
        await deleteAudio(vn.localAudioKey);
        const f = state.items.find((i) => i.id === itemId);
        await editItem(itemId, { voiceNotes: f.voiceNotes.filter((v) => v.id !== vn.id) });
        renderVoiceNotes();
      });
      voiceList.appendChild(row);
    }
  }
  renderVoiceNotes();

  const micBtn = body.querySelector("#d-mic");
  if (micBtn) {
    const recorder = createRecorder({
      onStop: async (note) => {
        const fresh = state.items.find((i) => i.id === itemId);
        await editItem(itemId, { voiceNotes: [...(fresh.voiceNotes || []), note] });
        micBtn.classList.remove("recording");
        micBtn.innerHTML = icon("mic") + " Gravar nota de voz";
        renderVoiceNotes();
      },
      onError: () => {
        toast("Não foi possível acessar o microfone.", "danger");
        micBtn.classList.remove("recording");
      },
    });
    micBtn.addEventListener("click", async () => {
      if (recorder.isRecording()) {
        recorder.stop();
      } else {
        try {
          await recorder.start();
          micBtn.classList.add("recording");
          micBtn.innerHTML = icon("stop") + " Parar gravação";
        } catch {
          toast("Permissão de microfone negada.", "danger");
        }
      }
    });
  }

  function cleanup() {
    if (timerInt) clearInterval(timerInt);
    document.removeEventListener("click", closeAllPopovers);
  }

  body.querySelector("#d-cancel").onclick = () => {
    cleanup();
    close();
  };
  body.querySelector("#d-delete").onclick = async () => {
    const ok = await confirmDialog("Excluir este item definitivamente?");
    if (ok) {
      cleanup();
      await removeItem(itemId);
      close();
      toast("Item excluído.");
    }
  };
  body.querySelector("#d-save").onclick = async () => {
    const patch = {
      title: body.querySelector("#d-title").value.trim() || item.title,
      notes: body.querySelector("#d-notes").value,
      urgent: priorityTier === "urgent",
      important: priorityTier === "urgent" || priorityTier === "priority",
      subtasks,
    };
    if (item.frente === "trabalho") {
      patch.column = body.querySelector("#d-column").value;
      patch.context = body.querySelector("#d-context").value || null;
      const t = body.querySelector("#d-target").value;
      patch.timeTargetMin = t ? Number(t) : null;
      if (patch.column === "done" && !item.completedAt) patch.completedAt = nowIso();
      if (patch.column !== "done") patch.completedAt = null;
    } else {
      patch.completedAt = doneChecked ? item.completedAt || nowIso() : null;
    }
    if (item.frente === "trabalho" || item.frente in MENU_FRENTE_DEFAULTS) {
      patch.tags = body
        .querySelector("#d-tags")
        .value.split(",")
        .map((t) => t.trim())
        .filter(Boolean);
    }
    if (item.habit) {
      const today = new Date().toISOString().slice(0, 10);
      const doneToday = body.querySelector("#d-done-today").checked;
      const dates = new Set(item.habitDoneDates || []);
      if (doneToday) dates.add(today);
      else dates.delete(today);
      patch.habitDoneDates = [...dates];
    }
    patch.onAgenda = onAgenda;
    if (onAgenda && agendaDate) {
      patch.start = `${agendaDate}T${agendaTime || "09:00"}:00`;
    }
    cleanup();
    await editItem(itemId, patch);
    close();
  };
}

export async function saveAsTemplate(item) {
  const { createTemplate } = await import("../store.js");
  await createTemplate(state.profile.id, {
    title: item.title,
    frente: item.frente,
    context: item.context,
    recurrence: "weekly",
  });
  toast("Template salvo.");
}

export async function createFromTemplate(tpl) {
  return addItem({
    frente: tpl.frente,
    title: tpl.title,
    context: tpl.context || null,
    column: "todo",
    templateId: tpl.id,
  });
}
