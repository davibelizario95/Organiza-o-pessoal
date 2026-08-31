import { icon } from "../icons.js";
import { openModal } from "./modal.js";
import { addItem, state } from "../state.js";
import { FRENTES, frenteByKey, withFrentePrefix } from "../frentes.js";
import { toast } from "./toast.js";
import { parseQuickCommand } from "../quickCommand.js";
import { attachVoiceButton } from "../speechToText.js";

// Caixa de conversa fixa: substitui o antigo botão "+" — digita o comando
// ("Frente: título, horário dia, coluna, contexto, tag") e o item já é
// criado na hora, em qualquer tela do app (mesmo parser do Hub).
export function mountQuickCapture() {
  if (document.getElementById("quick-chat-bar")) return;
  const form = document.createElement("form");
  form.id = "quick-chat-bar";
  form.className = "quick-chat";
  form.innerHTML = `
    <select class="quick-chat-frente" id="quick-chat-frente" title="Escolher frente">
      <option value="">Frente</option>
      ${FRENTES.map((f) => `<option value="${f.key}">${f.label}</option>`).join("")}
    </select>
    <input type="text" id="quick-chat-input" autocomplete="off" placeholder="Frente: título, horário dia, coluna" />
    <button type="button" class="quick-chat-mic" id="quick-chat-mic" title="Ditar por voz">${icon("mic")}</button>
    <button type="submit" class="quick-chat-send" title="Adicionar">${icon("plus")}</button>
  `;
  document.body.appendChild(form);

  const input = form.querySelector("#quick-chat-input");
  const frenteSelect = form.querySelector("#quick-chat-frente");
  frenteSelect.addEventListener("change", () => {
    if (!frenteSelect.value) return;
    input.value = withFrentePrefix(input.value, frenteSelect.value);
    frenteSelect.value = "";
    input.focus();
  });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const raw = input.value.trim();
    if (!raw) return;
    const { data, error } = parseQuickCommand(raw);
    if (error) {
      toast(error, "danger");
      return;
    }
    await addItem(data);
    toast(`Adicionado em ${frenteByKey(data.frente)?.label || data.frente}!`);
    input.value = "";
  });
  attachVoiceButton(input, form.querySelector("#quick-chat-mic"), () => form.requestSubmit());
}

export function openQuickCapture(defaultFrente) {
  const { body, close } = openModal({ title: "Captura rápida" });
  let selectedFrente = defaultFrente || state.profile ? defaultFrente || "trabalho" : "trabalho";

  body.innerHTML = `
    <label>O que você precisa lembrar?</label>
    <textarea id="qc-title" placeholder="Ex: Ligar para o fornecedor, ler Salmo 23, pagar conta de luz..." autofocus></textarea>
    <label>Frente (dá pra mudar depois)</label>
    <div class="flex wrap gap-8" id="qc-frentes"></div>
    <div class="flex gap-8" style="margin-top:18px;justify-content:flex-end;">
      <button class="btn" id="qc-cancel">Cancelar</button>
      <button class="btn btn-primary" id="qc-save">Adicionar</button>
    </div>
  `;

  const frentesWrap = body.querySelector("#qc-frentes");
  FRENTES.forEach((f) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip" + (f.key === selectedFrente ? " active" : "");
    chip.textContent = f.label;
    chip.addEventListener("click", () => {
      selectedFrente = f.key;
      frentesWrap.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
    });
    frentesWrap.appendChild(chip);
  });

  const titleInput = body.querySelector("#qc-title");
  setTimeout(() => titleInput.focus(), 30);

  async function save() {
    const title = titleInput.value.trim();
    if (!title) {
      titleInput.focus();
      return;
    }
    const frenteConf = FRENTES.find((f) => f.key === selectedFrente);
    await addItem({
      frente: selectedFrente,
      title,
      type: frenteConf?.kind === "habit" ? "habit" : frenteConf?.kind === "board" ? "task" : "task",
      column: "inbox",
      habit: frenteConf?.kind === "habit",
    });
    toast("Adicionado! Você pode categorizar e detalhar depois.");
    close();
  }

  body.querySelector("#qc-cancel").onclick = close;
  body.querySelector("#qc-save").onclick = save;
  titleInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save();
  });
}
