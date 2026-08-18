import { state } from "../state.js";
import { FRENTES } from "../frentes.js";
import { navigate } from "../router.js";
import { icon } from "../icons.js";
import { greeting } from "../utils.js";

// Hub central: primeira tela ao entrar num perfil. Reaproveita as rotas já
// existentes (dashboard + cada frente) — não duplica nenhuma lógica de dados,
// só oferece um ponto de entrada visual pra elas.
export function renderHub() {
  const view = document.getElementById("view");
  document.body.classList.add("hub-mode");

  const cards = [
    { key: "dashboard", label: "Geral", icon: "dashboard", primary: true },
    ...FRENTES.map((f) => ({ key: f.key, label: f.label, icon: f.icon, color: f.color })),
  ];

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
      <div class="hub-frentes" id="hub-frentes"></div>
    </div>
  `;

  const row = view.querySelector("#hub-frentes");
  cards.forEach((c, i) => {
    const card = document.createElement("button");
    card.className = "hub-frente-card" + (c.primary ? " primary" : "");
    card.style.setProperty("--row-i", i);
    if (c.color) card.style.setProperty("--card-accent", c.color);
    card.innerHTML = `
      <span class="hub-frente-icon">${icon(c.icon)}</span>
      <span class="hub-frente-label">${c.label}</span>
    `;
    card.addEventListener("click", () => navigate(c.key));
    row.appendChild(card);
  });

  return () => document.body.classList.remove("hub-mode");
}
