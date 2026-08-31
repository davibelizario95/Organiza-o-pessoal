import {
  state,
  subscribe,
  addTransaction,
  editTransaction,
  removeTransaction,
  addFinanceCategory,
  removeFinanceCategory,
} from "../state.js";
import { icon } from "../icons.js";
import { escapeHtml, todayKey, startOfWeek } from "../utils.js";
import { confirmDialog } from "../components/modal.js";
import { toast } from "../components/toast.js";
import {
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_INCOME_CATEGORIES,
  PAYMENT_METHODS,
  colorForCategory,
} from "../financeCategories.js";

// Filtros/aba ficam no módulo (persistem entre navegações, igual o filtro
// de contexto do Trabalho) — só o estado de edição/formulário reseta a
// cada visita.
let activeTab = "lancamentos"; // "lancamentos" | "categorias" | "dashboard"
let periodFilter = "month"; // "day" | "week" | "month" | "custom"
let customFrom = null;
let customTo = null;
let tipoFilter = "all"; // "all" | "gasto" | "entrada"
let categoriaFilter = "all";

function fmtMoney(n) {
  return (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// "YYYY-MM-DD" -> "DD/MM/AAAA", sem passar por Date/UTC (evitando o erro
// clássico de dia errado por causa do fuso horário)
function formatDateBr(dateStr) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
}

function monthLabel(date) {
  const s = date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function sumTipo(list, tipo) {
  return list.filter((t) => t.tipo === tipo).reduce((s, t) => s + (Number(t.valor) || 0), 0);
}

function totalsByCategory(list) {
  const map = new Map();
  for (const t of list) {
    const key = t.categoria || "Sem categoria";
    map.set(key, (map.get(key) || 0) + (Number(t.valor) || 0));
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

export function renderFinanceiro() {
  const view = document.getElementById("view");
  let editingId = null;
  let formTipo = "gasto";
  const unsub = subscribe(render);
  render();
  return unsub;

  // ------------------------------------------------------------ categorias

  function categoriesForTipo(tipo) {
    const defaults = tipo === "entrada" ? DEFAULT_INCOME_CATEGORIES : DEFAULT_EXPENSE_CATEGORIES;
    const custom = state.financeCategories.filter((c) => c.tipo === tipo).map((c) => c.nome);
    return [...new Set([...defaults, ...custom])];
  }

  function allCategoriesFlat() {
    return [...new Set([...categoriesForTipo("gasto"), ...categoriesForTipo("entrada")])];
  }

  // ------------------------------------------------------------- período

  function periodRange() {
    const today = new Date();
    if (periodFilter === "day") {
      const k = todayKey();
      return { from: k, to: k };
    }
    if (periodFilter === "week") {
      const start = startOfWeek();
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      return { from: todayKey(start), to: todayKey(end) };
    }
    if (periodFilter === "month") {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return { from: todayKey(start), to: todayKey(end) };
    }
    return { from: customFrom || todayKey(), to: customTo || todayKey() };
  }

  function filteredTransactions() {
    const { from, to } = periodRange();
    return state.transactions
      .filter((t) => t.data >= from && t.data <= to)
      .filter((t) => tipoFilter === "all" || t.tipo === tipoFilter)
      .filter((t) => categoriaFilter === "all" || t.categoria === categoriaFilter)
      .sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0));
  }

  // --------------------------------------------------------------- shell

  function render() {
    view.innerHTML = `
      <div class="flex items-center gap-8" style="margin-bottom:16px;">
        <span class="nav-dot" style="background:var(--c-financeiro);width:12px;height:12px;"></span>
        <h1 style="font-size:19px;">Financeiro</h1>
      </div>
      <div class="board-toolbar" style="margin-bottom:20px;">
        <button class="chip ${activeTab === "lancamentos" ? "active" : ""}" data-tab="lancamentos">Lançamentos</button>
        <button class="chip ${activeTab === "categorias" ? "active" : ""}" data-tab="categorias">Categorias</button>
        <button class="chip ${activeTab === "dashboard" ? "active" : ""}" data-tab="dashboard">Dashboard</button>
      </div>
      <div id="fin-body"></div>
    `;
    view.querySelectorAll("[data-tab]").forEach((btn) =>
      btn.addEventListener("click", () => {
        activeTab = btn.dataset.tab;
        editingId = null;
        render();
      })
    );
    const bodyEl = view.querySelector("#fin-body");
    if (activeTab === "lancamentos") renderLancamentos(bodyEl);
    else if (activeTab === "categorias") renderCategorias(bodyEl);
    else renderDashboard(bodyEl);
  }

  // ------------------------------------------------------------ lançamentos

  function renderLancamentos(root) {
    const list = filteredTransactions();
    const totals = totalsByCategory(list);
    const totalGasto = sumTipo(list, "gasto");
    const totalEntrada = sumTipo(list, "entrada");

    root.innerHTML = `
      <div class="card" id="tx-form-card"></div>

      <div class="section-title"><h2>Filtros</h2></div>
      <div class="board-toolbar">
        <button class="chip ${periodFilter === "day" ? "active" : ""}" data-period="day">Dia</button>
        <button class="chip ${periodFilter === "week" ? "active" : ""}" data-period="week">Semana</button>
        <button class="chip ${periodFilter === "month" ? "active" : ""}" data-period="month">Mês</button>
        <button class="chip ${periodFilter === "custom" ? "active" : ""}" data-period="custom">Personalizado</button>
      </div>
      ${
        periodFilter === "custom"
          ? `<div class="field-row" style="max-width:340px;margin-top:10px;">
              <div><label>De</label><input type="date" id="custom-from" value="${customFrom || todayKey()}"/></div>
              <div><label>Até</label><input type="date" id="custom-to" value="${customTo || todayKey()}"/></div>
            </div>`
          : ""
      }
      <div class="board-toolbar" style="margin-top:10px;">
        <button class="chip ${tipoFilter === "all" ? "active" : ""}" data-tipo-f="all">Todos</button>
        <button class="chip ${tipoFilter === "gasto" ? "active" : ""}" data-tipo-f="gasto">Gastos</button>
        <button class="chip ${tipoFilter === "entrada" ? "active" : ""}" data-tipo-f="entrada">Entradas</button>
      </div>
      <div class="board-toolbar" style="margin-top:-6px;" id="cat-toolbar"></div>

      <div class="grid grid-2" style="margin:18px 0;">
        <div class="fin-stat"><div class="num" style="color:var(--ok);">${fmtMoney(totalEntrada)}</div><div class="lbl">Entradas no período</div></div>
        <div class="fin-stat"><div class="num" style="color:var(--danger);">${fmtMoney(totalGasto)}</div><div class="lbl">Gastos no período</div></div>
      </div>

      ${
        totals.length
          ? `<div class="section-title"><h2>Total por categoria</h2></div><div class="card" id="cat-totals"></div>`
          : ""
      }

      <div class="section-title"><h2>Lançamentos (${list.length})</h2></div>
      <div class="card" id="tx-list"></div>
    `;

    renderTxForm(root.querySelector("#tx-form-card"));

    root.querySelectorAll("[data-period]").forEach((btn) =>
      btn.addEventListener("click", () => {
        periodFilter = btn.dataset.period;
        render();
      })
    );
    root.querySelector("#custom-from")?.addEventListener("change", (e) => {
      customFrom = e.target.value;
      render();
    });
    root.querySelector("#custom-to")?.addEventListener("change", (e) => {
      customTo = e.target.value;
      render();
    });
    root.querySelectorAll("[data-tipo-f]").forEach((btn) =>
      btn.addEventListener("click", () => {
        tipoFilter = btn.dataset.tipoF;
        categoriaFilter = "all";
        render();
      })
    );

    const catToolbar = root.querySelector("#cat-toolbar");
    const catOptions =
      tipoFilter === "entrada" ? categoriesForTipo("entrada") : tipoFilter === "gasto" ? categoriesForTipo("gasto") : allCategoriesFlat();
    catToolbar.innerHTML = `
      <button class="chip ${categoriaFilter === "all" ? "active" : ""}" data-cat-f="all">Todas as categorias</button>
      ${catOptions
        .map((c) => `<button class="chip ${categoriaFilter === c ? "active" : ""}" data-cat-f="${escapeHtml(c)}">${escapeHtml(c)}</button>`)
        .join("")}
    `;
    catToolbar.querySelectorAll("[data-cat-f]").forEach((btn) =>
      btn.addEventListener("click", () => {
        categoriaFilter = btn.dataset.catF;
        render();
      })
    );

    const catTotalsEl = root.querySelector("#cat-totals");
    if (catTotalsEl) {
      // pra colorir certo, acha o tipo de UM lançamento dessa categoria na
      // lista filtrada — só importa quando "Todos" mistura gasto e entrada
      catTotalsEl.innerHTML = totals
        .map(([cat, val]) => {
          const tipo = list.find((t) => (t.categoria || "Sem categoria") === cat)?.tipo || "gasto";
          return `<div class="list-item">
            <span class="cat-dot" style="background:${colorForCategory(cat, tipo, state.financeCategories)}"></span>
            <div class="list-item-title" style="flex:1;">${escapeHtml(cat)}</div>
            <strong>${fmtMoney(val)}</strong>
          </div>`;
        })
        .join("");
    }

    const txListEl = root.querySelector("#tx-list");
    txListEl.innerHTML = list.length ? list.map(txRowHtml).join("") : `<div class="empty-state">Nenhum lançamento nesse período/filtro.</div>`;
    txListEl.querySelectorAll("[data-edit-tx]").forEach((btn) =>
      btn.addEventListener("click", () => {
        editingId = btn.dataset.editTx;
        render();
        root.querySelector("#tx-form-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
      })
    );
    txListEl.querySelectorAll("[data-del-tx]").forEach((btn) =>
      btn.addEventListener("click", async () => {
        const t = state.transactions.find((x) => x.id === btn.dataset.delTx);
        const ok = await confirmDialog(`Excluir o lançamento "${t?.descricao || t?.categoria || "sem descrição"}"?`);
        if (ok) {
          await removeTransaction(btn.dataset.delTx);
          toast("Lançamento excluído.");
        }
      })
    );
  }

  function txRowHtml(t) {
    const sign = t.tipo === "entrada" ? "+" : "−";
    const color = t.tipo === "entrada" ? "var(--ok)" : "var(--danger)";
    return `<div class="list-item">
      <span class="cat-dot" style="background:${colorForCategory(t.categoria, t.tipo, state.financeCategories)}"></span>
      <div style="flex:1;min-width:0;">
        <div class="list-item-title">${escapeHtml(t.descricao || t.categoria || "—")}</div>
        <div class="small text-dim">${formatDateBr(t.data)} · ${escapeHtml(t.categoria || "Sem categoria")}${
      t.formaPagamento ? ` · ${escapeHtml(t.formaPagamento)}` : ""
    }</div>
      </div>
      <strong style="color:${color};white-space:nowrap;">${sign} ${fmtMoney(t.valor)}</strong>
      <button class="btn btn-icon btn-ghost btn-sm" data-edit-tx="${t.id}" title="Editar">${icon("edit")}</button>
      <button class="btn btn-icon btn-ghost btn-sm" data-del-tx="${t.id}" title="Excluir">${icon("trash")}</button>
    </div>`;
  }

  function categorySelectOptionsHtml(tipo, selected) {
    return categoriesForTipo(tipo)
      .map((c) => `<option value="${escapeHtml(c)}" ${c === selected ? "selected" : ""}>${escapeHtml(c)}</option>`)
      .join("");
  }

  function renderTxForm(root) {
    const editing = editingId ? state.transactions.find((t) => t.id === editingId) : null;
    const tipo = editing ? editing.tipo : formTipo;

    root.innerHTML = `
      <div class="flex items-center justify-between" style="margin-bottom:12px;">
        <strong style="font-size:14px;">${editing ? "Editar lançamento" : "Novo lançamento"}</strong>
        ${editing ? `<button class="btn btn-sm btn-ghost" id="tx-cancel-edit">Cancelar edição</button>` : ""}
      </div>
      <div class="board-toolbar" style="margin-bottom:12px;">
        <button type="button" class="chip ${tipo === "gasto" ? "active" : ""}" data-form-tipo="gasto" ${editing ? "disabled" : ""}>Gasto</button>
        <button type="button" class="chip ${tipo === "entrada" ? "active" : ""}" data-form-tipo="entrada" ${editing ? "disabled" : ""}>Entrada</button>
      </div>
      <div class="field-row">
        <div><label>Valor</label><input type="number" id="tx-valor" step="0.01" min="0" placeholder="0,00" value="${
          editing ? editing.valor : ""
        }"/></div>
        <div><label>Data</label><input type="date" id="tx-data" value="${editing ? editing.data : todayKey()}"/></div>
      </div>
      <label>Descrição</label>
      <input type="text" id="tx-descricao" placeholder="Ex: Almoço, Cachê show sábado..." value="${escapeHtml(editing?.descricao || "")}"/>
      <div class="field-row">
        <div>
          <label>Categoria</label>
          <select id="tx-categoria">${categorySelectOptionsHtml(tipo, editing?.categoria)}</select>
        </div>
        <div>
          <label>Forma de pagamento (opcional)</label>
          <select id="tx-forma">
            <option value="">—</option>
            ${PAYMENT_METHODS.map((m) => `<option value="${m}" ${editing?.formaPagamento === m ? "selected" : ""}>${m}</option>`).join("")}
          </select>
        </div>
      </div>
      <button class="btn btn-primary" id="tx-save" style="width:100%;margin-top:14px;">${editing ? "Salvar alterações" : "Adicionar lançamento"}</button>
    `;

    if (!editing) {
      root.querySelectorAll("[data-form-tipo]").forEach((btn) =>
        btn.addEventListener("click", () => {
          formTipo = btn.dataset.formTipo;
          root.querySelectorAll("[data-form-tipo]").forEach((b) => b.classList.toggle("active", b.dataset.formTipo === formTipo));
          root.querySelector("#tx-categoria").innerHTML = categorySelectOptionsHtml(formTipo, null);
        })
      );
    }

    root.querySelector("#tx-cancel-edit")?.addEventListener("click", () => {
      editingId = null;
      render();
    });

    root.querySelector("#tx-save").addEventListener("click", async () => {
      const valor = Math.abs(Number(root.querySelector("#tx-valor").value));
      if (!valor) {
        toast("Informe um valor.", "danger");
        return;
      }
      const payload = {
        tipo: editing ? editing.tipo : formTipo,
        valor,
        data: root.querySelector("#tx-data").value || todayKey(),
        descricao: root.querySelector("#tx-descricao").value.trim(),
        categoria: root.querySelector("#tx-categoria").value,
        formaPagamento: root.querySelector("#tx-forma").value || null,
      };
      if (editing) {
        await editTransaction(editing.id, payload);
        toast("Lançamento atualizado.");
        editingId = null;
      } else {
        await addTransaction(payload);
        toast("Lançamento adicionado.");
      }
      render();
    });
  }

  // -------------------------------------------------------------- categorias

  function renderCategorias(root) {
    const customExpense = state.financeCategories.filter((c) => c.tipo === "gasto");
    const customIncome = state.financeCategories.filter((c) => c.tipo === "entrada");

    root.innerHTML = `
      <div class="card">
        <div class="section-title mt-0"><h2>Categorias de gasto</h2></div>
        <div id="cat-gasto-list"></div>
        <div class="flex gap-8" style="margin-top:12px;">
          <input type="text" id="new-cat-gasto" placeholder="Nova categoria de gasto" style="flex:1;"/>
          <button class="btn btn-icon" id="add-cat-gasto" title="Adicionar">${icon("plus")}</button>
        </div>
      </div>
      <div class="card" style="margin-top:16px;">
        <div class="section-title mt-0"><h2>Categorias de entrada</h2></div>
        <div id="cat-entrada-list"></div>
        <div class="flex gap-8" style="margin-top:12px;">
          <input type="text" id="new-cat-entrada" placeholder="Nova categoria de entrada" style="flex:1;"/>
          <button class="btn btn-icon" id="add-cat-entrada" title="Adicionar">${icon("plus")}</button>
        </div>
      </div>
    `;

    function catChipsHtml(defaults, custom, tipo) {
      return `<div class="board-toolbar" style="margin-bottom:0;">
        ${defaults
          .map(
            (c) =>
              `<span class="chip fin-cat-chip"><span class="cat-dot" style="background:${colorForCategory(
                c,
                tipo,
                state.financeCategories
              )}"></span>${escapeHtml(c)}</span>`
          )
          .join("")}
        ${custom
          .map(
            (c) =>
              `<span class="chip fin-cat-chip"><span class="cat-dot" style="background:${colorForCategory(
                c.nome,
                tipo,
                state.financeCategories
              )}"></span>${escapeHtml(c.nome)}<button class="chip-remove" data-del-cat="${c.id}" title="Remover">${icon(
                "close"
              )}</button></span>`
          )
          .join("")}
      </div>`;
    }
    root.querySelector("#cat-gasto-list").innerHTML = catChipsHtml(DEFAULT_EXPENSE_CATEGORIES, customExpense, "gasto");
    root.querySelector("#cat-entrada-list").innerHTML = catChipsHtml(DEFAULT_INCOME_CATEGORIES, customIncome, "entrada");

    root.querySelectorAll("[data-del-cat]").forEach((btn) =>
      btn.addEventListener("click", async () => {
        const ok = await confirmDialog(
          "Remover essa categoria? Lançamentos que já usam ela continuam com o nome — só não aparece mais pra escolher em novos lançamentos."
        );
        if (ok) await removeFinanceCategory(btn.dataset.delCat);
      })
    );

    async function addCat(inputId, tipo) {
      const input = root.querySelector(inputId);
      const nome = input.value.trim();
      if (!nome) return;
      const exists = [...DEFAULT_EXPENSE_CATEGORIES, ...DEFAULT_INCOME_CATEGORIES, ...state.financeCategories.map((c) => c.nome)].some(
        (n) => n.toLowerCase() === nome.toLowerCase()
      );
      if (exists) {
        toast("Essa categoria já existe.", "danger");
        return;
      }
      await addFinanceCategory({ nome, tipo });
      toast("Categoria criada.");
      input.value = "";
    }
    root.querySelector("#add-cat-gasto").addEventListener("click", () => addCat("#new-cat-gasto", "gasto"));
    root.querySelector("#add-cat-entrada").addEventListener("click", () => addCat("#new-cat-entrada", "entrada"));
    root.querySelector("#new-cat-gasto").addEventListener("keydown", (e) => {
      if (e.key === "Enter") addCat("#new-cat-gasto", "gasto");
    });
    root.querySelector("#new-cat-entrada").addEventListener("keydown", (e) => {
      if (e.key === "Enter") addCat("#new-cat-entrada", "entrada");
    });
  }

  // -------------------------------------------------------------- dashboard

  function renderDashboard(root) {
    const today = new Date();
    const monthStart = todayKey(new Date(today.getFullYear(), today.getMonth(), 1));
    const monthEnd = todayKey(new Date(today.getFullYear(), today.getMonth() + 1, 0));
    const prevDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const prevStart = todayKey(new Date(prevDate.getFullYear(), prevDate.getMonth(), 1));
    const prevEnd = todayKey(new Date(prevDate.getFullYear(), prevDate.getMonth() + 1, 0));

    const monthTx = state.transactions.filter((t) => t.data >= monthStart && t.data <= monthEnd);
    const prevTx = state.transactions.filter((t) => t.data >= prevStart && t.data <= prevEnd);

    const totalEntrada = sumTipo(monthTx, "entrada");
    const totalGasto = sumTipo(monthTx, "gasto");
    const saldo = totalEntrada - totalGasto;
    const prevGasto = sumTipo(prevTx, "gasto");
    const delta = totalGasto - prevGasto;
    const catTotals = totalsByCategory(monthTx.filter((t) => t.tipo === "gasto"));

    root.innerHTML = `
      <div class="grid grid-3" style="margin-bottom:18px;">
        <div class="fin-stat"><div class="num" style="color:var(--ok);">${fmtMoney(totalEntrada)}</div><div class="lbl">Entradas — ${monthLabel(
      today
    )}</div></div>
        <div class="fin-stat"><div class="num" style="color:var(--danger);">${fmtMoney(totalGasto)}</div><div class="lbl">Gastos — ${monthLabel(
      today
    )}</div></div>
        <div class="fin-stat"><div class="num" style="color:${saldo >= 0 ? "var(--ok)" : "var(--danger)"};">${fmtMoney(
      saldo
    )}</div><div class="lbl">Saldo do mês</div></div>
      </div>

      <div class="card" style="margin-bottom:20px;">
        <div class="flex items-center gap-8">
          <span class="fin-delta-arrow" style="color:${delta > 0 ? "var(--danger)" : delta < 0 ? "var(--ok)" : "var(--text-dim)"};">${
      delta > 0 ? "▲" : delta < 0 ? "▼" : "—"
    }</span>
          <span class="small">${
            delta === 0
              ? `Mesmo total de gastos de ${monthLabel(prevDate)}.`
              : `${fmtMoney(Math.abs(delta))} ${delta > 0 ? "a mais" : "a menos"} que ${monthLabel(prevDate)} (${fmtMoney(prevGasto)}).`
          }</span>
        </div>
      </div>

      <div class="section-title mt-0"><h2>Gastos por categoria — ${monthLabel(today)}</h2></div>
      <div class="card" id="fin-donut-card" style="margin-bottom:20px;"></div>

      <div class="section-title"><h2>Entradas × gastos — últimos 6 meses</h2></div>
      <div class="card" id="fin-trend-card"></div>
    `;

    renderDonut(root.querySelector("#fin-donut-card"), catTotals, totalGasto);
    renderTrend(root.querySelector("#fin-trend-card"));
  }

  function renderDonut(root, catTotals, total) {
    if (!total || !catTotals.length) {
      root.innerHTML = `<div class="empty-state">Nenhum gasto registrado esse mês ainda.</div>`;
      return;
    }
    const R = 70;
    const CX = 90;
    const CY = 90;
    const STROKE = 28;
    const CIRC = 2 * Math.PI * R;
    const GAP = 3;
    let offset = 0;
    const segments = catTotals.map(([cat, val]) => {
      const frac = val / total;
      const len = Math.max(0, frac * CIRC - GAP);
      const seg = {
        cat,
        val,
        color: colorForCategory(cat, "gasto", state.financeCategories), // donut mostra só gasto
        dasharray: `${len} ${CIRC - len}`,
        dashoffset: -offset,
      };
      offset += frac * CIRC;
      return seg;
    });

    root.innerHTML = `
      <div class="fin-donut-wrap">
        <svg viewBox="0 0 180 180" class="fin-donut" role="img" aria-label="Gastos por categoria">
          <circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="var(--bg-elev-2)" stroke-width="${STROKE}"/>
          ${segments
            .map(
              (s) => `<circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="${s.color}" stroke-width="${STROKE}"
                stroke-dasharray="${s.dasharray}" stroke-dashoffset="${s.dashoffset}" stroke-linecap="round"
                transform="rotate(-90 ${CX} ${CY})"><title>${escapeHtml(s.cat)}: ${fmtMoney(s.val)} (${Math.round(
                (s.val / total) * 100
              )}%)</title></circle>`
            )
            .join("")}
          <text x="${CX}" y="${CY - 4}" text-anchor="middle" class="fin-donut-total">${fmtMoney(total).replace("R$", "").trim()}</text>
          <text x="${CX}" y="${CY + 15}" text-anchor="middle" class="fin-donut-total-lbl">TOTAL</text>
        </svg>
        <div class="fin-legend">
          ${segments
            .map(
              (s) => `<div class="fin-legend-row">
                <span class="cat-dot" style="background:${s.color}"></span>
                <span class="fin-legend-label">${escapeHtml(s.cat)}</span>
                <span class="fin-legend-value">${fmtMoney(s.val)} · ${Math.round((s.val / total) * 100)}%</span>
              </div>`
            )
            .join("")}
        </div>
      </div>
    `;
  }

  function renderTrend(root) {
    const now = new Date();
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const start = todayKey(d);
      const end = todayKey(new Date(d.getFullYear(), d.getMonth() + 1, 0));
      const tx = state.transactions.filter((t) => t.data >= start && t.data <= end);
      months.push({
        label: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
        entrada: sumTipo(tx, "entrada"),
        gasto: sumTipo(tx, "gasto"),
      });
    }
    const max = Math.max(1, ...months.flatMap((m) => [m.entrada, m.gasto]));
    const W = 560;
    const H = 220;
    const PAD_BOTTOM = 28;
    const PAD_TOP = 10;
    const chartH = H - PAD_BOTTOM - PAD_TOP;
    const groupW = W / months.length;
    const barW = Math.min(22, groupW * 0.28);

    const bars = months
      .map((m, i) => {
        const cx = groupW * i + groupW / 2;
        const hEntrada = (m.entrada / max) * chartH;
        const hGasto = (m.gasto / max) * chartH;
        return `
          <rect x="${cx - barW - 3}" y="${PAD_TOP + chartH - hEntrada}" width="${barW}" height="${Math.max(1, hEntrada)}" rx="4" fill="var(--ok)">
            <title>${m.label}: entradas ${fmtMoney(m.entrada)}</title>
          </rect>
          <rect x="${cx + 3}" y="${PAD_TOP + chartH - hGasto}" width="${barW}" height="${Math.max(1, hGasto)}" rx="4" fill="var(--danger)">
            <title>${m.label}: gastos ${fmtMoney(m.gasto)}</title>
          </rect>
          <text x="${cx}" y="${H - 8}" text-anchor="middle" class="fin-trend-axis-label">${m.label}</text>
        `;
      })
      .join("");

    root.innerHTML = `
      <div class="fin-legend fin-legend-inline">
        <div class="fin-legend-row"><span class="cat-dot" style="background:var(--ok)"></span><span class="fin-legend-label">Entradas</span></div>
        <div class="fin-legend-row"><span class="cat-dot" style="background:var(--danger)"></span><span class="fin-legend-label">Gastos</span></div>
      </div>
      <svg viewBox="0 0 ${W} ${H}" class="fin-trend-svg" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Entradas e gastos por mês">
        <line x1="0" y1="${PAD_TOP + chartH}" x2="${W}" y2="${PAD_TOP + chartH}" class="fin-trend-baseline"/>
        ${bars}
      </svg>
    `;
  }
}
