import { state, addItem, subscribe } from "../state.js";
import { frenteByKey } from "../frentes.js";
import { navigate } from "../router.js";
import { icon } from "../icons.js";
import { greeting, escapeHtml, formatTime, todayKey } from "../utils.js";
import { toast } from "../components/toast.js";
import { parseQuickCommand } from "../quickCommand.js";

// Cartão de abertura do Hub: o resumo da agenda do dia. Ocupa exatamente o
// mesmo formato/lugar que a foto ocupava — a foto continua existindo, só
// aparece depois, quando o hero expande com o scroll (ver applyProgress).
function agendaSummaryHtml(maxRows) {
  const today = todayKey();
  const items = state.items
    .filter((i) => i.onAgenda && i.start && i.start.slice(0, 10) === today)
    .sort((a, b) => {
      if (!!a.allDay !== !!b.allDay) return a.allDay ? -1 : 1;
      return a.start > b.start ? 1 : -1;
    });

  const dateLabel = new Date()
    .toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })
    .replace(/\./g, "");

  const head = `
    <div class="hub-agenda-head">
      <span class="hub-agenda-eyebrow">Agenda de hoje</span>
      <strong class="hub-agenda-date">${escapeHtml(dateLabel)}</strong>
    </div>`;

  if (!items.length) {
    return `${head}
      <div class="hub-agenda-empty">
        <strong>Dia livre</strong>
        <span>Nada marcado na agenda de hoje.</span>
      </div>`;
  }

  const nowMs = Date.now();

  // "dia todo" vale pro dia inteiro, então fica sempre à vista (no máximo 2);
  // o resto do cartão é uma janela em volta do agora, não o começo do dia —
  // senão, de tarde, o cartão enche de compromisso que já passou e esconde
  // justamente o próximo.
  const allDay = items.filter((i) => i.allDay).slice(0, 2);
  const timed = items.filter((i) => !i.allDay);
  const timedRows = Math.max(1, maxRows - allDay.length);

  const firstUpcoming = timed.findIndex((i) => new Date(i.start).getTime() >= nowMs);
  const lastWindowStart = Math.max(0, timed.length - timedRows);
  const startIdx =
    firstUpcoming === -1
      ? lastWindowStart // dia já acabou: mostra o fim dele
      : Math.min(Math.max(0, firstUpcoming - 1), lastWindowStart); // 1 item antes, de contexto
  const shown = timed.slice(startIdx, startIdx + timedRows);

  // o próximo compromisso ainda por vir ganha peso e o laranja; o que já
  // passou recua — dá pra ler "o que vem agora" sem varrer a lista
  const next = shown.find((i) => !i.completedAt && new Date(i.start).getTime() >= nowMs);

  const row = (i) => {
    const f = frenteByKey(i.frente);
    const past = !i.allDay && new Date(i.start).getTime() < nowMs;
    const cls = ["hub-agenda-row", past ? "past" : "", i.completedAt ? "done" : "", i === next ? "next" : ""]
      .filter(Boolean)
      .join(" ");
    return `
      <li class="${cls}">
        <span class="hub-agenda-time">${i.allDay ? "dia" : escapeHtml(formatTime(i.start))}</span>
        <span class="hub-agenda-dot" style="background:${f?.color || "var(--accent)"}"></span>
        <span class="hub-agenda-title">${escapeHtml(i.title)}</span>
      </li>`;
  };

  const hidden = [];
  if (startIdx > 0) hidden.push(`${startIdx} antes`);
  const after = timed.length - (startIdx + shown.length);
  if (after > 0) hidden.push(`+${after} depois`);

  return `${head}
    <ul class="hub-agenda-list">${[...allDay, ...shown].map(row).join("")}</ul>
    <div class="hub-agenda-foot">
      <span>${items.length} ${items.length === 1 ? "compromisso" : "compromissos"}</span>
      ${hidden.length ? `<span>${hidden.join(" · ")}</span>` : ""}
    </div>`;
}

// Hub central: primeira tela ao entrar num perfil. Abre com o resumo da
// agenda do dia; a foto expande conforme o usuário rola o mouse/dedo (versão
// em JS puro do efeito "scroll to expand"), revelando a caixa de captura
// rápida por comando de texto e o botão único "Entrar" pra página Geral — o
// resto da navegação já vive na barra do topo (hover, no desktop) e na
// bottom-nav (mobile).
export function renderHub() {
  const view = document.getElementById("view");
  document.body.classList.add("hub-mode");

  const titleFull = `${greeting()}, ${state.profile?.name || ""}`.trim();

  view.innerHTML = `
    <div class="hub">
      <div class="hub-ambient" id="hub-ambient"></div>
      <div class="hub-duotone"></div>
      <div class="hub-scrim"></div>
      <div class="hub-top"><div class="brand-mark">OP</div></div>

      <div class="hub-hero" id="hub-hero">
        <div class="hub-hero-media" id="hub-hero-media">
          <div class="hub-hero-photo" id="hub-hero-photo">
            <span class="hub-hero-sub">Para onde vamos hoje?</span>
          </div>
          <div class="hub-hero-agenda" id="hub-hero-agenda" role="button" tabindex="0"
            aria-label="Resumo da agenda de hoje — abrir agenda"></div>
        </div>
        <div class="hub-hero-title" id="hub-hero-title">${titleFull}</div>
        <div class="hub-hero-hint" id="hub-hero-hint">
          <span id="hub-hero-hint-text">Role pra expandir</span>
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

      <div class="hub-enter-fade" id="hub-enter-fade"></div>
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
  const photo = view.querySelector("#hub-hero-photo");
  const agendaCard = view.querySelector("#hub-hero-agenda");
  const title = view.querySelector("#hub-hero-title");
  const reveal = view.querySelector("#hub-reveal");
  const hintText = view.querySelector("#hub-hero-hint-text");
  const enterFade = view.querySelector("#hub-enter-fade");

  let progress = 0;
  let enterProgress = 0;
  let expanded = false;
  let entering = false;
  let isMobile = window.innerWidth < 768;
  let touchStartY = 0;
  let snapTimer = null;

  // tamanho do cartão fechado — o resumo da agenda fica travado nele e só
  // dissolve; quem cresce com o scroll é a mídia em volta
  function baseSize() {
    return isMobile ? { w: 260, h: 340, growW: 440, growH: 220 } : { w: 320, h: 420, growW: 1000, growH: 420 };
  }

  const clamp01 = (n) => Math.min(1, Math.max(0, n));

  function applyProgress() {
    const { w, h, growW, growH } = baseSize();
    media.style.width = `${w + progress * growW}px`;
    media.style.height = `${h + progress * growH}px`;
    media.style.transform = `scale(${1 + enterProgress * 0.08})`;
    title.style.transform = `scale(${1 + progress * 0.06})`;
    ambient.style.opacity = String(1 - progress);
    enterFade.style.opacity = String(enterProgress);

    // troca agenda → foto: a foto materializa primeiro, ainda escondida
    // atrás do cartão opaco, e só então o cartão dissolve. Assim nunca
    // existe um quadro em que as duas camadas aparecem meio transparentes.
    const photoIn = clamp01(progress / 0.22);
    const agendaOut = clamp01((progress - 0.12) / 0.28);
    photo.style.opacity = String(photoIn);
    agendaCard.style.width = `${w}px`;
    agendaCard.style.height = `${h}px`;
    agendaCard.style.opacity = String(1 - agendaOut);
    agendaCard.style.transform = `translate(-50%, -50%) scale(${1 - agendaOut * 0.04})`;
    agendaCard.style.pointerEvents = agendaOut > 0.5 ? "none" : "auto";
    agendaCard.setAttribute("aria-hidden", agendaOut > 0.5 ? "true" : "false");
  }

  // o cartão reflete o estado real: criar algo pra hoje na caixa rápida já
  // aparece aqui, sem precisar recarregar
  function renderAgendaCard() {
    agendaCard.innerHTML = agendaSummaryHtml(isMobile ? 4 : 5);
  }
  const unsubItems = subscribe(renderAgendaCard);
  renderAgendaCard();

  // tocar no cartão abre a Agenda inteira — mas só se for um toque de
  // verdade: arrastar pra rolar (mais de 10px) não navega
  let cardDownY = null;
  let cardDownX = null;
  agendaCard.addEventListener("pointerdown", (e) => {
    cardDownX = e.clientX;
    cardDownY = e.clientY;
  });
  agendaCard.addEventListener("pointerup", (e) => {
    if (cardDownY === null) return;
    const moved = Math.hypot(e.clientX - cardDownX, e.clientY - cardDownY);
    cardDownY = null;
    cardDownX = null;
    if (moved <= 10 && !expanded && !entering) navigate("agenda");
  });
  agendaCard.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      navigate("agenda");
    }
  });

  function setProgress(p) {
    progress = Math.min(1, Math.max(0, p));
    applyProgress();
    if (progress >= 1 && !expanded) {
      expanded = true;
      heroEl.classList.add("expanded");
      reveal.classList.add("visible");
      if (hintText) hintText.textContent = "Role pra entrar";
    }
  }

  // Continuar rolando pra baixo depois de expandido entra direto em Geral —
  // mesmo gesto de scroll, sem precisar clicar em "Entrar".
  function setEnterProgress(p) {
    enterProgress = Math.min(1, Math.max(0, p));
    applyProgress();
    if (enterProgress >= 1) enterDashboard();
  }

  function enterDashboard() {
    if (entering) return;
    entering = true;
    navigate("dashboard");
  }

  function collapse() {
    expanded = false;
    enterProgress = 0;
    heroEl.classList.remove("expanded");
    reveal.classList.remove("visible");
    if (hintText) hintText.textContent = "Role pra expandir";
    // volta a mídia pro tamanho inicial de uma vez, em vez de deixar
    // presa em tamanho grande até o usuário continuar rolando
    withSnapTransition(() => setProgress(0));
  }

  // Encaixe: se o usuário parar de rolar no meio do caminho, termina a
  // transição sozinho — pra frente se passou da metade, de volta se não —
  // em vez de deixar a tela "presa" entre um estágio e outro.
  function withSnapTransition(fn) {
    const layers = [media, ambient, enterFade, photo, agendaCard];
    layers.forEach((el) => el.classList.add("snap"));
    fn();
    setTimeout(() => layers.forEach((el) => el.classList.remove("snap")), 340);
  }

  function settle() {
    if (entering) return;
    if (!expanded && progress > 0 && progress < 1) {
      withSnapTransition(() => setProgress(progress >= 0.5 ? 1 : 0));
    } else if (expanded && enterProgress > 0 && enterProgress < 1) {
      withSnapTransition(() => setEnterProgress(enterProgress >= 0.5 ? 1 : 0));
    }
  }

  function scheduleSnap() {
    clearTimeout(snapTimer);
    snapTimer = setTimeout(settle, 150);
  }

  function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function onWheel(e) {
    if (entering) return;
    if (expanded) {
      if (e.deltaY < 0) {
        collapse();
        e.preventDefault();
        return;
      }
      e.preventDefault();
      setEnterProgress(enterProgress + e.deltaY * 0.0015);
      scheduleSnap();
      return;
    }
    e.preventDefault();
    setProgress(progress + e.deltaY * 0.0012);
    scheduleSnap();
  }

  function onTouchStart(e) {
    touchStartY = e.touches[0].clientY;
    clearTimeout(snapTimer);
  }
  function onTouchMove(e) {
    if (!touchStartY || entering) return;
    const y = e.touches[0].clientY;
    const deltaY = touchStartY - y;
    if (expanded) {
      if (deltaY < -20) {
        collapse();
        e.preventDefault();
        touchStartY = y;
        return;
      }
      if (deltaY > 0) {
        e.preventDefault();
        setEnterProgress(enterProgress + deltaY * 0.009);
        touchStartY = y;
      }
      return;
    }
    e.preventDefault();
    setProgress(progress + deltaY * 0.006);
    touchStartY = y;
  }
  function onTouchEnd() {
    touchStartY = 0;
    settle();
  }
  function onResize() {
    const wasMobile = isMobile;
    isMobile = window.innerWidth < 768;
    if (wasMobile !== isMobile) renderAgendaCard(); // cabem mais/menos linhas
    applyProgress();
  }
  function onHintClick() {
    if (!expanded) setProgress(1);
    else setEnterProgress(1);
  }

  applyProgress();
  if (prefersReducedMotion()) {
    // sem animação: já entrega a mídia expandida e o conteúdo visível,
    // mas não entra sozinho em Geral — precisa do clique em "Entrar"
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
    unsubItems();
    window.removeEventListener("wheel", onWheel);
    window.removeEventListener("touchstart", onTouchStart);
    window.removeEventListener("touchmove", onTouchMove);
    window.removeEventListener("touchend", onTouchEnd);
    window.removeEventListener("resize", onResize);
  };
}
