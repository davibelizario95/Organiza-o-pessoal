let root = null;
function ensureRoot() {
  if (!root) {
    root = document.getElementById("toast-root");
  }
  return root;
}

export function toast(message, type = "info", timeout = 3200) {
  const r = ensureRoot();
  if (!r) return;
  const el = document.createElement("div");
  el.className = `toast ${type === "info" ? "" : type}`;
  el.textContent = message;
  r.appendChild(el);
  setTimeout(() => {
    el.style.transition = "opacity 220ms ease, transform 220ms ease";
    el.style.opacity = "0";
    el.style.transform = "translateY(-10px) scale(0.96)";
    setTimeout(() => el.remove(), 220);
  }, timeout);
}

export function notify(title, body) {
  if (!("Notification" in window)) return;
  if (Notification.permission === "granted") {
    new Notification(title, { body });
  }
}

export function requestNotificationPermission() {
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }
}
