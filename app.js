// ---------- PWA SW ----------
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  });
}

// ---------- Helpers ----------
function normText(s) {
  if (s === null || s === undefined) return "";
  const str = String(s).trim().toUpperCase();
  // remove acentos
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ");
}
function normTag(s) {
  return normText(s).replace(/[^A-Z0-9]/g, "");
}
function digitsOnly(s) {
  return normText(s).replace(/[^0-9]/g, "");
}
function splitTerms(q) {
  const t = normText(q);
  if (!t) return [];
  return t.split(" ").filter(Boolean);
}

// Ordenação: TAG forte primeiro, depois tag, depois descrição
function sortResults(results, query) {
  const qn = normTag(query);
  const qd = digitsOnly(query);

  function tagStrength(r) {
    // 2 = match forte numérico, 1 = contém, 0 = nada
    if (qd && r.tag_digits === qd) return 2;
    if (qn && (r.tag_norm === qn || r.tag_norm.includes(qn))) return 1;
    if (qd && (r.tag_digits && r.tag_digits.includes(qd))) return 1;
    return 0;
  }

  return results.sort((a, b) => {
    const sa = tagStrength(a);
    const sb = tagStrength(b);
    if (sb !== sa) return sb - sa;

    // desempate: TAG alfabética, depois descrição
    const ta = normText(a.tag);
    const tb = normText(b.tag);
    if (ta < tb) return -1;
    if (ta > tb) return 1;

    const da = normText(a.equip_desc);
    const db = normText(b.equip_desc);
    if (da < db) return -1;
    if (da > db) return 1;
    return 0;
  });
}

// Busca AND: todos os termos devem aparecer em (tag/dígitos/descrição)
function matchesAND(record, terms) {
  if (!terms.length) return true;
  const hayTag = record.tag_norm || "";
  const hayDigits = record.tag_digits || "";
  const hayDesc = record.equip_desc_norm || "";

  return terms.every((t) => {
    const tn = normTag(t);
    const td = digitsOnly(t);

    // se termo é só número, prioriza dígitos
    if (td && td.length >= 3) {
      return hayDigits.includes(td) || hayTag.includes(td) || hayDesc.includes(normText(t));
    }
    // termo misto/alfabético
    return hayTag.includes(tn) || hayDesc.includes(normText(t));
  });
}

// ---------- UI ----------
const elQ = document.getElementById("q");
const elClear = document.getElementById("btn-clear");
const elStatus = document.getElementById("status");
const elCount = document.getElementById("count");
const elResults = document.getElementById("results");

const viewSearch = document.getElementById("view-search");
const viewDetail = document.getElementById("view-detail");
const btnBack = document.getElementById("btn-back");

const dLub = document.getElementById("d-lub");
const dNm = document.getElementById("d-nm");
const dTag = document.getElementById("d-tag");
const dDesc = document.getElementById("d-desc");
const dSistema = document.getElementById("d-sistema");
const dLocal = document.getElementById("d-local");
const dNmDesc = document.getElementById("d-nm-desc");
const btnCopy = document.getElementById("btn-copy");

let DATA = [];
let CURRENT = null;

function showSearch() {
  viewDetail.classList.remove("view--active");
  viewSearch.classList.add("view--active");
  CURRENT = null;
}

function showDetail(rec) {
  CURRENT = rec;
  viewSearch.classList.remove("view--active");
  viewDetail.classList.add("view--active");

  dLub.textContent = rec.lub_adotado || "—";
  dNm.textContent = rec.nm || "—";
  dTag.textContent = rec.tag || "—";
  dDesc.textContent = rec.equip_desc || "—";
  dSistema.textContent = rec.sistema || "—";
  dLocal.textContent = rec.local || "—";
  dNmDesc.textContent = rec.nm_desc || "—";
}

function renderList(list, query) {
  elResults.innerHTML = "";
  elCount.textContent = list.length ? `${list.length} resultado(s)` : "";

  if (!list.length) {
    elResults.innerHTML = `<div class="status">Nenhum resultado.</div>`;
    return;
  }

  const frag = document.createDocumentFragment();
  list.forEach((r) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "card";
    card.style.textAlign = "left";

    card.innerHTML = `
      <div class="card__tag">${r.tag || "—"}</div>
      <div class="card__desc">${r.equip_desc || "—"}</div>
      <div class="card__lub">${r.lub_adotado || "—"}</div>
      <div class="card__meta">${r.sistema || ""}${r.local ? " • " + r.local : ""}</div>
    `;

    card.addEventListener("click", () => showDetail(r));
    frag.appendChild(card);
  });
  elResults.appendChild(frag);
}

function doSearch() {
  const q = elQ.value || "";
  const terms = splitTerms(q);

  const filtered = DATA.filter((r) => matchesAND(r, terms));
  const sorted = sortResults(filtered, q);
  renderList(sorted, q);
}

// ---------- Load data ----------
async function loadData() {
  elStatus.textContent = "Carregando base…";
  try {
    const resp = await fetch("./data/lubrificantes.json", { cache: "no-store" });
    const json = await resp.json();
    if (!Array.isArray(json)) throw new Error("JSON deve ser uma lista de registros");

    DATA = json;
    elStatus.textContent = `Base carregada (${DATA.length} itens). Offline habilitado.`;
    doSearch();
  } catch (e) {
    elStatus.textContent = "Falha ao carregar base. Verifique data/lubrificantes.json";
  }
}

// ---------- Events ----------
elQ.addEventListener("input", () => doSearch());
elClear.addEventListener("click", () => { elQ.value = ""; doSearch(); elQ.focus(); });
btnBack.addEventListener("click", () => showSearch());

btnCopy.addEventListener("click", async () => {
  if (!CURRENT) return;
  const text = `LUBRIFICANTE: ${CURRENT.lub_adotado || ""}\nNM: ${CURRENT.nm || ""}\nTAG: ${CURRENT.tag || ""}\nDESC: ${CURRENT.equip_desc || ""}`;
  try {
    await navigator.clipboard.writeText(text);
    btnCopy.textContent = "Copiado!";
    setTimeout(() => (btnCopy.textContent = "Copiar lubrificante + NM"), 1200);
  } catch {
    btnCopy.textContent = "Não foi possível copiar";
    setTimeout(() => (btnCopy.textContent = "Copiar lubrificante + NM"), 1200);
  }
});

loadData();
