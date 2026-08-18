const routes = new Map();
let currentUnmount = null;
let notFoundHandler = () => {};

export function registerRoute(path, renderFn) {
  routes.set(path, renderFn);
}

export function setNotFound(fn) {
  notFoundHandler = fn;
}

export function navigate(path) {
  if (location.hash.slice(1) !== path) {
    location.hash = path;
  } else {
    render();
  }
}

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, "");
  const [path, query] = raw.split("?");
  return { path: path || "dashboard", params: new URLSearchParams(query || "") };
}

export function currentRoute() {
  return parseHash();
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

async function render() {
  const { path, params } = parseHash();
  const view = document.getElementById("view");
  // saída rápida da página atual antes de trocar o conteúdo — evita o corte
  // seco de uma view sumir e a próxima aparecer no mesmo instante
  if (view && view.childElementCount && !prefersReducedMotion()) {
    view.style.transition = "opacity 110ms ease, transform 110ms ease";
    view.style.opacity = "0";
    view.style.transform = "translateY(-6px)";
    await new Promise((r) => setTimeout(r, 110));
  }
  if (typeof currentUnmount === "function") {
    try {
      currentUnmount();
    } catch {
      /* ignore */
    }
    currentUnmount = null;
  }
  const [base] = path.split("/");
  const handler = routes.get(base) || routes.get(path);
  if (!handler) {
    notFoundHandler();
    return;
  }
  const result = await handler({ path, params });
  if (typeof result === "function") currentUnmount = result;
  if (view) {
    view.scrollTop = 0;
    view.style.transition = "";
    view.style.transform = "";
    view.style.opacity = "";
  }
  replayViewTransition();
}

// Reaplica a animação de entrada da view a cada navegação (não a cada
// re-render interno de dados, já que cada view controla seu próprio refresh).
function replayViewTransition() {
  const view = document.getElementById("view");
  if (!view) return;
  view.classList.remove("view-enter");
  // força reflow para reiniciar a animação
  void view.offsetWidth;
  view.classList.add("view-enter");
}

export function startRouter() {
  window.addEventListener("hashchange", render);
  render();
}

export function rerender() {
  render();
}
