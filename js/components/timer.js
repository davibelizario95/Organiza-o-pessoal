import { state, editItem } from "../state.js";
import { nowIso } from "../utils.js";
import { toast, notify } from "./toast.js";

export function computeElapsedSec(item) {
  const base = item.timeSpentSec || 0;
  if (item.timerRunning && item.timerStartedAt) {
    return base + (Date.now() - new Date(item.timerStartedAt).getTime()) / 1000;
  }
  return base;
}

export async function startTimer(itemId) {
  await editItem(itemId, {
    timerRunning: true,
    timerStartedAt: nowIso(),
    timerAlerted: false,
  });
}

export async function stopTimer(itemId) {
  const item = state.items.find((i) => i.id === itemId);
  if (!item) return;
  const elapsed = computeElapsedSec(item);
  await editItem(itemId, {
    timerRunning: false,
    timeSpentSec: Math.round(elapsed),
    timerStartedAt: null,
  });
}

let tickerStarted = false;
export function startGlobalTicker() {
  if (tickerStarted) return;
  tickerStarted = true;
  setInterval(async () => {
    const running = state.items.filter((i) => i.timerRunning);
    for (const item of running) {
      const elapsed = computeElapsedSec(item);
      const targetSec = (item.timeTargetMin || 0) * 60;
      if (targetSec > 0 && elapsed >= targetSec && !item.timerAlerted) {
        toast(`⏱ Tempo alvo estourado: "${item.title}"`, "warn", 6000);
        notify("Tempo de trabalho excedido", item.title);
        await editItem(item.id, { timerAlerted: true });
      }
      // checkpoint a cada minuto para não perder progresso e evitar drift
      if (Math.floor(elapsed) % 60 === 0) {
        await editItem(item.id, {
          timeSpentSec: Math.round(elapsed),
          timerStartedAt: nowIso(),
        });
      }
    }
  }, 15000);
}
