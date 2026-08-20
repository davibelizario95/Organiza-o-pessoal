import { state, addItem } from "../state.js";
import { frenteByKey } from "../frentes.js";
import { navigate } from "../router.js";
import { icon } from "../icons.js";
import { greeting } from "../utils.js";
import { toast } from "../components/toast.js";
import { parseQuickCommand } from "../quickCommand.js";

// Hub central: primeira tela ao entrar num perfil. Uma caixa de captura
// rápida por comando de texto ("Frente: título, horário dia, coluna") e um
// único botão pra entrar na página Geral — o resto da navegação já vive na
// barra do topo (hover, no desktop) e na bottom-nav (mobile).
export function renderHub() {
  const view = document.getElementById("view");
  document.body.classList.add("hub-mode");

  view.innerHTML = `
    <div class="hub">
      <div class="hub-ambient"></div>
      <div class="hub-portrait"></div>
      <div class="hub-duotone"></div>
      <div class="hub-scrim"></div>
      <div class="hub-top">
        <div class="brand-mark">OP</div>
        <div>
          <div class="hub-greeting">${greeting()}, ${state.profile?.name || ""}</div>
          <div class="hub-sub">Para onde vamos hoje?</div>
        </div>
      </div>
      <form class="hub-quickbar" id="hub-quickbar">
        <input type="text" id="hub-quickbar-input" autocomplete="off"
          placeholder="Frente: título, horário dia, coluna" />
        <button type="submit" class="hub-quickbar-send" title="Adicionar">${icon("plus")}</button>
      </form>
      <div class="hub-enter">
        <button class="btn btn-primary hub-enter-btn" id="hub-enter-btn">Entrar</button>
      </div>
    </div>
  `;

  const form = view.querySelector("#hub-quickbar");
  const input = view.querySelector("#hub-quickbar-input");
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

  view.querySelector("#hub-enter-btn").addEventListener("click", () => navigate("dashboard"));

  return () => document.body.classList.remove("hub-mode");
}
