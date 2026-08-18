import { icon } from "../icons.js";

// Abre um modal genérico. `renderBody` recebe o elemento .modal e deve
// preencher o conteúdo. Retorna funções { close, root }.
export function openModal({ title, onClose, wide } = {}) {
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  const modal = document.createElement("div");
  modal.className = "modal";
  if (wide) modal.style.maxWidth = "720px";

  const grabber = document.createElement("div");
  grabber.className = "modal-grabber";
  modal.appendChild(grabber);

  const head = document.createElement("div");
  head.className = "modal-head";
  head.innerHTML = `<h2>${title || ""}</h2>`;
  const closeBtn = document.createElement("button");
  closeBtn.className = "btn btn-icon btn-ghost";
  closeBtn.innerHTML = icon("close");
  head.appendChild(closeBtn);

  const body = document.createElement("div");
  body.className = "modal-body";

  modal.appendChild(head);
  modal.appendChild(body);
  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);

  let closed = false;
  function close(opts = {}) {
    if (closed) return;
    closed = true;
    document.removeEventListener("keydown", onKey);
    detachDragToDismiss();
    // saída suave (a entrada usa a mola definida em CSS via @keyframes);
    // um flick rápido no grabber pode encurtar a duração (handoff de velocidade)
    const dur = opts.duration || 220;
    modal.style.transition = `transform ${dur}ms ease, opacity ${dur}ms ease`;
    modal.style.transform = window.innerWidth <= 700 ? "translateY(100%)" : "scale(0.95)";
    modal.style.opacity = "0";
    setTimeout(() => backdrop.remove(), dur);
    if (onClose) onClose();
  }
  function onKey(e) {
    if (e.key === "Escape") close();
  }
  document.addEventListener("keydown", onKey);
  closeBtn.addEventListener("click", close);
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) close();
  });

  const detachDragToDismiss = attachDragToDismiss(grabber, modal, close);

  return { backdrop, modal, body, head, close };
}

// Gesto de arrastar o "sheet" para baixo e soltar para fechar (só no mobile,
// onde o modal vira uma folha que sobe do fundo da tela).
function attachDragToDismiss(handle, modal, close) {
  let dragging = false;
  let startY = 0;
  let deltaY = 0;
  // pequeno histórico de posição/tempo para calcular velocidade no soltar
  let history = [];

  function isSheetMode() {
    return window.innerWidth <= 700;
  }
  function pointY(e) {
    return e.touches ? e.touches[0].clientY : e.clientY;
  }
  function onDown(e) {
    if (!isSheetMode()) return;
    dragging = true;
    startY = pointY(e);
    history = [{ y: startY, t: performance.now() }];
    modal.style.transition = "none";
  }
  function onMove(e) {
    if (!dragging) return;
    const y = pointY(e);
    deltaY = Math.max(0, y - startY);
    modal.style.transform = `translateY(${deltaY}px)`;
    history.push({ y, t: performance.now() });
    if (history.length > 5) history.shift();
  }
  function onUp() {
    if (!dragging) return;
    dragging = false;
    // velocidade (px/ms) com base nos últimos pontos — um flick rápido
    // fecha mesmo sem ter percorrido a distância inteira do limiar
    let velocity = 0;
    if (history.length >= 2) {
      const first = history[0];
      const last = history[history.length - 1];
      const dt = last.t - first.t;
      if (dt > 0) velocity = (last.y - first.y) / dt;
    }
    const shouldClose = deltaY > 110 || (deltaY > 24 && velocity > 0.5);
    if (shouldClose) {
      // mantém a velocidade do gesto: quanto mais rápido o flick, mais rápida a saída
      const dur = Math.max(120, 220 - velocity * 120);
      close({ duration: dur });
    } else {
      modal.style.transition = "transform var(--dur-2) var(--ease-spring)";
      modal.style.transform = "translateY(0)";
    }
    deltaY = 0;
  }

  handle.addEventListener("pointerdown", onDown);
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);

  return function detach() {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
  };
}

export function confirmDialog(message) {
  return new Promise((resolve) => {
    const { body, close } = openModal({ title: "Confirmar" });
    body.innerHTML = `<p>${message}</p>`;
    const actions = document.createElement("div");
    actions.className = "flex gap-8";
    actions.style.marginTop = "14px";
    actions.style.justifyContent = "flex-end";
    const cancel = document.createElement("button");
    cancel.className = "btn";
    cancel.textContent = "Cancelar";
    const ok = document.createElement("button");
    ok.className = "btn btn-primary";
    ok.textContent = "Confirmar";
    actions.append(cancel, ok);
    body.appendChild(actions);
    cancel.onclick = () => {
      close();
      resolve(false);
    };
    ok.onclick = () => {
      close();
      resolve(true);
    };
  });
}
