// Interpreta comandos de texto livre da caixa rápida (Hub e barra global),
// separados por vírgula, EM QUALQUER ORDEM:
//   Trabalho, Editar Online, 10h00, a fazer, IC, Online, Urgente
// Cada pedaço é reconhecido pelo que ele É (frente, horário/dia, coluna,
// contexto, prioridade), não pela posição em que aparece. O único pedaço
// que sobra sem reconhecer nada vira o título; pedaços extras que sobrarem
// depois do título viram tags. "Frente: título" (com dois pontos, como
// antes) continua funcionando do mesmo jeito.
import { FRENTES, CONTEXTS } from "./frentes.js";

const WEEKDAYS = {
  domingo: 0,
  segunda: 1,
  terca: 2,
  quarta: 3,
  quinta: 4,
  sexta: 5,
  sabado: 6,
};

// pedaços que são só uma palavra/expressão-chave curta (horário, coluna,
// contexto, prioridade, frente) — evita que um título comprido que por
// acaso contenha essas palavras (ex: "Fazer compras") seja confundido
// com um desses campos
const KEYWORD_MAX_LEN = 24;

function normalize(str) {
  return String(str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

function matchFrente(text) {
  const n = normalize(text);
  return FRENTES.find((f) => normalize(f.label) === n || normalize(f.key) === n) || null;
}

// Comparação EXATA (não "includes") contra uma lista de frases curtas
// conhecidas — evita que um título comum tipo "Fazer compras" seja
// confundido com a coluna "A Fazer" só por conter a palavra "fazer".
const COLUMN_PHRASES = {
  todo: ["a fazer", "pra fazer", "fazer", "todo", "to do"],
  doing: ["fazendo", "em andamento", "andamento", "doing"],
  blocked: ["bloqueado", "bloqueada", "blocked"],
  done: ["concluido", "concluida", "feito", "pronto", "done"],
  inbox: ["inbox", "ideias", "ideia"],
};

function matchColumn(text) {
  const n = normalize(text);
  if (n.length > KEYWORD_MAX_LEN) return null;
  for (const [key, phrases] of Object.entries(COLUMN_PHRASES)) {
    if (phrases.includes(n)) return key;
  }
  return null;
}

function matchContext(text) {
  const n = normalize(text);
  if (n.length > KEYWORD_MAX_LEN) return null;
  const found = CONTEXTS.find((c) => normalize(c.key) === n || normalize(c.label) === n);
  return found ? found.key : null;
}

// Prioridade em 3 níveis: Normal, Prioridade (importante, sem urgência) e
// Urgente — mapeados nos campos urgent/important que o app já usa.
function matchPriority(text) {
  const n = normalize(text);
  if (n.length > KEYWORD_MAX_LEN) return null;
  if (n === "normal") return "normal";
  if (n === "prioridade" || n === "importante") return "priority";
  if (n === "urgente") return "urgent";
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
  if (n.length > KEYWORD_MAX_LEN) return null;
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
  if (!text) return { error: "Digite algo pra criar o item." };

  const parts = text.split(",").map((p) => p.trim()).filter(Boolean);
  if (!parts.length) return { error: "Digite algo pra criar o item." };

  let frente = null;
  let column = "todo"; // padrão pedido: sem horário/coluna, cai direto em "A Fazer"
  let schedule = null;
  let context = null;
  let priorityTier = null;
  const titleParts = [];

  for (let part of parts) {
    // formato antigo "Frente: resto" dentro de um único pedaço — os dois
    // pontos continuam funcionando, só não são mais obrigatórios
    if (!frente) {
      const colonIdx = part.indexOf(":");
      if (colonIdx !== -1) {
        const maybeFrente = matchFrente(part.slice(0, colonIdx));
        if (maybeFrente) {
          frente = maybeFrente;
          part = part.slice(colonIdx + 1).trim();
          if (!part) continue;
        }
      }
    }

    if (!frente) {
      const f = matchFrente(part);
      if (f) {
        frente = f;
        continue;
      }
    }
    const col = matchColumn(part);
    if (col) {
      column = col;
      continue;
    }
    const sched = parseSchedule(part);
    if (sched) {
      schedule = sched;
      continue;
    }
    const ctx = matchContext(part);
    if (ctx) {
      context = ctx;
      continue;
    }
    const pri = matchPriority(part);
    if (pri) {
      priorityTier = pri;
      continue;
    }
    titleParts.push(part);
  }

  if (!frente) {
    return {
      error: `Não reconheci a frente. Cite uma dessas em qualquer parte do texto: ${FRENTES.map((f) => f.label).join(", ")}.`,
    };
  }
  if (!titleParts.length) return { error: "Falta o título da tarefa." };

  const [title, ...tags] = titleParts;

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
  if (context) data.context = context;
  if (tags.length) data.tags = tags;
  if (priorityTier === "urgent") {
    data.urgent = true;
    data.important = true;
  } else if (priorityTier === "priority") {
    data.urgent = false;
    data.important = true;
  } else if (priorityTier === "normal") {
    data.urgent = false;
    data.important = false;
  }

  return { data, frente };
}
