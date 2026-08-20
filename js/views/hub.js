import { state, addItem } from "../state.js";
import { frenteByKey } from "../frentes.js";
import { navigate } from "../router.js";
import { icon } from "../icons.js";
import { greeting } from "../utils.js";
import { toast } from "../components/toast.js";
import { parseQuickCommand } from "../quickCommand.js";

// Hub central: primeira tela ao entrar num perfil. A foto expande conforme
// o usuário rola o mouse/dedo (versão em JS puro do efeito "scroll to
// expand"), revelando a caixa de captura rápida por comando de texto e o
// botão único "Entrar" pra página Geral — o resto da navegação já vive na
// barra do topo (hover, no desktop) e na bottom-nav (mobile).
export function renderHub() {
  const view = document.getElementById("view");
  document.body.classList.add("hub-mode");

  const titleFull = `${greeting()}, ${state.profile?.name || ""}`.trim();
  const spaceIdx = titleFull.indexOf(" ");
  const firstWord = spaceIdx === -1 ? titleFull : titleFull.slice(0, spaceIdx);
  const restWord = spaceIdx === -1 ? "" : titleFull.slice(spaceIdx + 1);

  view.innerHTML = `
    <div class="hub">
      <div class="hub-ambient" id="hub-ambient"></div>
      <div class="hub-duotone"></div>
      <div class="hub-scrim"></div>
      <div class="hub-top"><div class="brand-mark">OP</div></div>

      <div class="hub-hero" id="hub-hero">
        <div class="hub-hero-media" id="hub-hero-media">
          <span class="hub-hero-sub">Para onde vamos hoje?</span>
        </div>
        <div class="hub-hero-title">
          <span class="hub-hero-word" id="hub-hero-word-1">${firstWord}</span>
          <span class="hub-hero-word" id="hub-hero-word-2">${restWord}</span>
        </div>
        <div class="hub-hero-hint" id="hub-hero-hint">
          <span>Role pra expandir</span>
          ${icon("chevronDown")}
        </div>
      </div>

      <div class="hub-reveal" id="hub-reveal">
        <form class="hub-quickbar" id="hub-quickbar">
          <input type="text" id="hub-quickbar-input" autocomplete="off"
            placeholder="Frente: título, horário dia, coluna" />
          <button type="submit" class="hub-quickbar-send" title="Adicionar">${icon("plus")}</button>
        </form>
        <div class="hub-enter">
          <button class="btn btn-primary hub-enter-btn" id="hub-enter-btn">Entrar</button>
        </div>
      </div>
    </div>
  `;

  // ---------------------------------------------------- captura rápida
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

  // ------------------------------------------- hero que expande com o scroll
  const ambient = view.querySelector("#hub-ambient");
  const heroEl = view.querySelector("#hub-hero");
  const media = view.querySelector("#hub-hero-media");
  const word1 = view.querySelector("#hub-hero-word-1");
  const word2 = view.querySelector("#hub-hero-word-2");
  const reveal = view.querySelector("#hub-reveal");

  let progress = 0;
  let expanded = false;
  let isMobile = window.innerWidth < 768;
  let touchStartY = 0;

  function applyProgress() {
    const baseW = isMobile ? 220 : 320;
    const baseH = isMobile ? 300 : 420;
    const growW = isMobile ? 480 : 1000;
    const growH = isMobile ? 260 : 420;
    media.style.width = `${baseW + progress * growW}px`;
    media.style.height = `${baseH + progress * growH}px`;
    const translate = progress * (isMobile ? 8 : 20);
    word1.style.transform = `translateX(-${translate}vw)`;
    word2.style.transform = `translateX(${translate}vw)`;
    ambient.style.opacity = String(1 - progress);
  }

  function setProgress(p) {
    progress = Math.min(1, Math.max(0, p));
    applyProgress();
    if (progress >= 1 && !expanded) {
      expanded = true;
      heroEl.classList.add("expanded");
      reveal.classList.add("visible");
    }
  }

  function collapse() {
    expanded = false;
    heroEl.classList.remove("expanded");
    reveal.classList.remove("visible");
  }

  function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function onWheel(e) {
    if (expanded && e.deltaY < 0) {
      collapse();
      e.preventDefault();
      return;
    }
    if (!expanded) {
      e.preventDefault();
      setProgress(progress + e.deltaY * 0.0012);
    }
  }

  function onTouchStart(e) {
    touchStartY = e.touches[0].clientY;
  }
  function onTouchMove(e) {
    if (!touchStartY) return;
    const y = e.touches[0].clientY;
    const deltaY = touchStartY - y;
    if (expanded && deltaY < -20) {
      collapse();
      e.preventDefault();
      touchStartY = y;
      return;
    }
    if (!expanded) {
      e.preventDefault();
      setProgress(progress + deltaY * 0.006);
      touchStartY = y;
    }
  }
  function onTouchEnd() {
    touchStartY = 0;
  }
  function onResize() {
    isMobile = window.innerWidth < 768;
    applyProgress();
  }
  function onHintClick() {
    setProgress(1);
  }

  applyProgress();
  if (prefersReducedMotion()) {
    // sem animação: já entrega a mídia expandida e o conteúdo visível
    setProgress(1);
  } else {
    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);
    window.addEventListener("resize", onResize);
    view.querySelector("#hub-hero-hint").addEventListener("click", onHintClick);
  }

  return () => {
    document.body.classList.remove("hub-mode");
    window.removeEventListener("wheel", onWheel);
    window.removeEventListener("touchstart", onTouchStart);
    window.removeEventListener("touchmove", onTouchMove);
    window.removeEventListener("touchend", onTouchEnd);
    window.removeEventListener("resize", onResize);
  };
}
