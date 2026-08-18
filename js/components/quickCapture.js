import { icon } from "../icons.js";
import { openModal } from "./modal.js";
import { addItem, state } from "../state.js";
import { FRENTES } from "../frentes.js";
import { toast } from "./toast.js";

export function mountQuickCapture() {
  if (document.getElementById("quick-capture-fab")) return;
  const fab = document.createElement("button");
  fab.id = "quick-capture-fab";
  fab.className = "fab";
  fab.title = "Captura rápida";
  fab.innerHTML = icon("plus", "icon");
  fab.style.color = "#fff";
  document.body.appendChild(fab);
  fab.addEventListener("click", openQuickCapture);
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
