import { icon } from "../icons.js";
import { openModal, confirmDialog } from "./modal.js";
import { editItem, removeItem, state, addItem } from "../state.js";
import { CONTEXTS, COLUMNS } from "../frentes.js";
import { computeElapsedSec, startTimer, stopTimer } from "./timer.js";
import { createRecorder } from "./voiceRecorder.js";
import { getAudio, deleteAudio } from "../idb.js";
import { formatDuration, escapeHtml, nowIso, uid } from "../utils.js";
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
    <button class="task-card-delete" data-quick-delete title="Excluir">${icon("close")}</button>
    <div class="task-card-title">${escapeHtml(item.title)}</div>
    <div class="task-card-meta">
      ${item.context ? `<span class="tag tag-${item.context.toLowerCase()}">${item.context}</span>` : ""}
      ${(item.tags || []).map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join("")}
      ${item.urgent ? `<span class="tag tag-urgent">Urgente</span>` : ""}
      ${item.important ? `<span class="tag tag-important">Importante</span>` : ""}
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

  const { body, close } = openModal({ title: "Detalhes do item", wide: true });

  let subtasks = (item.subtasks || []).map((s) => ({ ...s }));

  body.innerHTML = `
    <label>Título</label>
    <input type="text" id="d-title" value="${escapeHtml(item.title)}" />

    <div class="field-row">
      <div>
        <label>Prioridade</label>
        <select id="d-priority">
          <option value="normal" ${!item.urgent ? "selected" : ""}>Normal</option>
          <option value="urgent" ${item.urgent ? "selected" : ""}>Urgente</option>
        </select>
      </div>
      ${
        item.frente === "trabalho"
          ? `<div>
              <label>Coluna</label>
              <select id="d-column">
                ${COLUMNS.map((c) => `<option value="${c.key}" ${item.column === c.key ? "selected" : ""}>${c.label}</option>`).join("")}
              </select>
            </div>`
          : ""
      }
    </div>

    <label class="checkbox-row"><input type="checkbox" id="d-agenda" ${item.onAgenda ? "checked" : ""}/> Colocar na agenda</label>
    <div id="d-agenda-fields" class="field-row ${item.onAgenda ? "" : "hidden"}">
      <div>
        <label>Data</label>
        <input type="date" id="d-date" value="${item.start ? item.start.slice(0, 10) : ""}" />
      </div>
      <div>
        <label>Hora</label>
        <input type="time" id="d-time" value="${item.start ? item.start.slice(11, 16) : ""}" />
      </div>
    </div>

    <label>Subtarefas</label>
    <div id="d-subtasks" style="display:flex;flex-direction:column;margin-bottom:8px;"></div>
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
        <label>Contexto</label>
        <select id="d-context">
          <option value="">—</option>
          ${CONTEXTS.map((c) => `<option value="${c.key}" ${item.context === c.key ? "selected" : ""}>${c.key} · ${c.label}</option>`).join("")}
        </select>
      </div>
      <div>
        <label>Tags (separadas por vírgula — pra filtrar dentro de cada contexto)</label>
        <input type="text" id="d-tags" placeholder="Ex: Online, Especial" value="${escapeHtml((item.tags || []).join(", "))}" />
      </div>
    </div>

    <label>Tempo de trabalho</label>
    <div class="card" style="background:var(--bg-elev-2);padding:12px;">
      <div class="flex justify-between items-center">
        <button class="btn btn-sm" id="d-timer-toggle">${item.timerRunning ? icon("pause") + " Pausar" : icon("play") + " Iniciar"}</button>
        <div class="flex gap-16">
          <div style="text-align:center;">
            <div class="small text-dim" style="text-transform:uppercase;font-size:10.5px;">Real</div>
            <div class="timer-display" id="d-timer-display" style="font-size:20px;">${formatDuration(computeElapsedSec(item))}</div>
          </div>
          <div style="text-align:center;">
            <div class="small text-dim" style="text-transform:uppercase;font-size:10.5px;">Previsto (min)</div>
            <input type="number" id="d-target" min="0" placeholder="--" value="${item.timeTargetMin || ""}" style="width:64px;text-align:center;padding:6px;" />
          </div>
        </div>
      </div>
    </div>

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
        e.target.innerHTML = icon("play") + " Iniciar";
      } else {
        await startTimer(itemId);
        e.target.innerHTML = icon("pause") + " Pausar";
      }
    });
  }

  // ---- agenda toggle ----
  const agendaCheck = body.querySelector("#d-agenda");
  agendaCheck?.addEventListener("change", () => {
    body.querySelector("#d-agenda-fields").classList.toggle("hidden", !agendaCheck.checked);
  });

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
      urgent: body.querySelector("#d-priority").value === "urgent",
      subtasks,
    };
    if (item.frente === "trabalho") {
      patch.column = body.querySelector("#d-column").value;
      patch.context = body.querySelector("#d-context").value || null;
      patch.tags = body
        .querySelector("#d-tags")
        .value.split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const t = body.querySelector("#d-target").value;
      patch.timeTargetMin = t ? Number(t) : null;
      if (patch.column === "done" && !item.completedAt) patch.completedAt = nowIso();
      if (patch.column !== "done") patch.completedAt = null;
    }
    if (item.habit) {
      const today = new Date().toISOString().slice(0, 10);
      const doneToday = body.querySelector("#d-done-today").checked;
      const dates = new Set(item.habitDoneDates || []);
      if (doneToday) dates.add(today);
      else dates.delete(today);
      patch.habitDoneDates = [...dates];
    }
    const onAgenda = body.querySelector("#d-agenda").checked;
    patch.onAgenda = onAgenda;
    if (onAgenda) {
      const date = body.querySelector("#d-date").value;
      const time = body.querySelector("#d-time").value || "09:00";
      if (date) patch.start = `${date}T${time}:00`;
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
