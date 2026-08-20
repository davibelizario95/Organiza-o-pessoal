// Interpreta comandos de texto livre da caixa rápida do Hub, no formato:
//   Frente: título, horário dia, coluna
// Exemplo: "Trabalho: Montar arranjo, 10h00 quinta feira, A Fazer"
// Horário e coluna são opcionais — sem horário, o item cai direto em "A Fazer".
import { FRENTES } from "./frentes.js";

const WEEKDAYS = {
  domingo: 0,
  segunda: 1,
  terca: 2,
  quarta: 3,
  quinta: 4,
  sexta: 5,
  sabado: 6,
};

function normalize(str) {
  return String(str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

function matchColumn(text) {
  const n = normalize(text);
  if (n.includes("fazer")) return "todo";
  if (n.includes("andamento")) return "doing";
  if (n.includes("bloque")) return "blocked";
  if (n.includes("conclu")) return "done";
  if (n.includes("ideia") || n.includes("inbox")) return "inbox";
  return null;
}

function nextWeekday(from, targetDow) {
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  const diff = (targetDow - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + diff);
  return d;
}

// Extrai dia (hoje/amanhã/dia da semana) e horário (10h, 10h00, 10:00) de um trecho.
function parseSchedule(text) {
  const n = normalize(text);
  let date = null;

  if (/\bhoje\b/.test(n)) {
    date = new Date();
    date.setHours(0, 0, 0, 0);
  } else if (/\bamanh[a]?\b/.test(n)) {
    date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + 1);
  } else {
    for (const [name, dow] of Object.entries(WEEKDAYS)) {
      if (n.includes(name)) {
        date = nextWeekday(new Date(), dow);
        break;
      }
    }
  }

  const timeMatch = n.match(/(\d{1,2})\s*[h:]\s*(\d{2})?/);
  let hasTime = false;
  if (timeMatch) {
    const hh = Math.min(23, parseInt(timeMatch[1], 10));
    const mm = timeMatch[2] ? Math.min(59, parseInt(timeMatch[2], 10)) : 0;
    if (!Number.isNaN(hh)) {
      hasTime = true;
      if (!date) date = new Date();
      date.setHours(hh, mm, 0, 0);
    }
  }

  if (!date) return null;
  return { date, hasTime };
}

function toLocalDateTimeString(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
}

export function parseQuickCommand(raw) {
  const text = String(raw || "").trim();
  const colonIdx = text.indexOf(":");
  if (colonIdx === -1) {
    return { error: "Comece com a frente e dois pontos. Ex: Trabalho: Montar arranjo" };
  }

  const frenteWord = text.slice(0, colonIdx).trim();
  const rest = text.slice(colonIdx + 1).trim();
  if (!rest) return { error: "Falta o título depois dos dois pontos." };

  const frente = FRENTES.find(
    (f) => normalize(f.label) === normalize(frenteWord) || normalize(f.key) === normalize(frenteWord)
  );
  if (!frente) {
    return {
      error: `Não reconheci a frente "${frenteWord}". Use uma dessas: ${FRENTES.map((f) => f.label).join(", ")}.`,
    };
  }

  const parts = rest.split(",").map((p) => p.trim()).filter(Boolean);
  const title = parts.shift();
  if (!title) return { error: "Falta o título da tarefa." };

  let column = "todo"; // padrão pedido: sem horário/coluna, cai direto em "A Fazer"
  let schedule = null;
  for (const part of parts) {
    const col = matchColumn(part);
    if (col) {
      column = col;
      continue;
    }
    const sched = parseSchedule(part);
    if (sched) schedule = sched;
  }

  const data = {
    frente: frente.key,
    title,
    column,
    type: "task",
  };
  if (schedule) {
    data.onAgenda = true;
    data.allDay = !schedule.hasTime;
    data.start = toLocalDateTimeString(schedule.date);
  }

  return { data, frente };
}
