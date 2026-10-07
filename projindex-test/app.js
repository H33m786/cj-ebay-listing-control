"use strict";

// ---------------------------------------------------------------------
// Backend URL: persisted in localStorage (a per-viewer convenience --
// never shared state, never read back by anything but this page) so a
// page hosted remotely (GitHub Pages) still remembers which local
// backend to call on return visits.
// ---------------------------------------------------------------------
const backendInput = document.getElementById("backendUrl");
try {
  const saved = localStorage.getItem("projindex_backend_url");
  if (saved) backendInput.value = saved;
} catch (e) { /* private window / blocked storage -- fall back to the default already in the input */ }

function backendUrl() {
  return backendInput.value.replace(/\/+$/, "");
}
backendInput.addEventListener("change", () => {
  try { localStorage.setItem("projindex_backend_url", backendInput.value); } catch (e) {}
  checkConnection();
});

async function api(path, options) {
  const res = await fetch(backendUrl() + path, options);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body;
}
async function apiGet(path) { return api(path, { method: "GET" }); }
async function apiPost(path, data) {
  return api(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data || {}),
  });
}

const connDot = document.getElementById("connDot");
async function checkConnection() {
  try {
    await apiGet("/api/status");
    connDot.className = "conn-dot ok";
    connDot.title = "connected";
  } catch (e) {
    connDot.className = "conn-dot bad";
    connDot.title = "cannot reach backend -- is `projindex serve` running?";
  }
}

// ---------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------
document.getElementById("tabs").addEventListener("click", (ev) => {
  const btn = ev.target.closest(".tab");
  if (!btn) return;
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t === btn));
  document.querySelectorAll(".panel").forEach((p) => p.classList.toggle("active", p.id === "panel-" + btn.dataset.tab));
});

// ---------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------
async function refreshStatus() {
  const grid = document.getElementById("statGrid");
  try {
    const data = await apiGet("/api/status");
    grid.innerHTML = "";
    const order = ["projects", "files", "segments", "content_facts", "entities", "entity_mentions", "tasks", "dropped_facts"];
    const keys = order.filter((k) => k in data.table_counts).concat(Object.keys(data.table_counts).filter((k) => !order.includes(k)));
    keys.forEach((k) => {
      const tile = document.createElement("div");
      tile.className = "stat-tile";
      tile.innerHTML = `<div class="n">${data.table_counts[k].toLocaleString()}</div><div class="label">${k.replace(/_/g, " ")}</div>`;
      grid.appendChild(tile);
    });

    const runningBox = document.getElementById("runningJobsBox");
    const runningList = document.getElementById("runningJobsList");
    const jobIds = Object.keys(data.running_jobs || {});
    if (jobIds.length) {
      runningBox.hidden = false;
      runningList.innerHTML = jobIds.map((id) => {
        const j = data.running_jobs[id];
        return `<div class="stage-status">${j.name} — running since ${new Date(j.started_at).toLocaleTimeString()}</div>`;
      }).join("");
    } else {
      runningBox.hidden = true;
    }
    connDot.className = "conn-dot ok";
  } catch (e) {
    grid.innerHTML = `<div class="stat-empty">Can't reach the backend at ${backendUrl()}. Is \`projindex serve\` running?</div>`;
    connDot.className = "conn-dot bad";
  }
}
document.querySelector('[data-action="refresh-status"]').addEventListener("click", refreshStatus);

// ---------------------------------------------------------------------
// Pipeline: trigger a job, then poll it until done/error, updating the
// stage card's own status line in place.
// ---------------------------------------------------------------------
function setStageStatus(stage, text, cls) {
  const el = document.querySelector(`[data-status-for="${stage}"]`);
  el.textContent = text;
  el.className = "stage-status" + (cls ? " " + cls : "");
}

async function pollJob(stage, jobId) {
  setStageStatus(stage, `running (job ${jobId})…`);
  while (true) {
    await new Promise((r) => setTimeout(r, 1500));
    let job;
    try {
      job = await apiGet(`/api/jobs/${jobId}`);
    } catch (e) {
      setStageStatus(stage, `lost contact with backend: ${e.message}`, "error");
      return;
    }
    if (job.status === "running") continue;
    if (job.status === "done") {
      setStageStatus(stage, summarizeResult(job.result), "ok");
      refreshStatus();
      return;
    }
    setStageStatus(stage, `failed: ${job.error}`, "error");
    return;
  }
}
function summarizeResult(result) {
  if (result == null) return "done";
  if (typeof result !== "object") return String(result);
  const parts = Object.entries(result)
    .filter(([k, v]) => typeof v !== "object")
    .map(([k, v]) => `${k}=${v}`);
  return parts.length ? parts.join("  ") : "done";
}

async function runStage(stage, endpoint, body) {
  setStageStatus(stage, "starting…");
  try {
    const { job_id } = await apiPost(endpoint, body || {});
    pollJob(stage, job_id);
  } catch (e) {
    setStageStatus(stage, `could not start: ${e.message}`, "error");
  }
}

document.querySelector('[data-action="run-scan"]').addEventListener("click", () =>
  runStage("scan", "/api/jobs/scan", { dry_run: document.getElementById("scanDryRun").checked }));
document.querySelector('[data-action="run-extract"]').addEventListener("click", () =>
  runStage("extract", "/api/jobs/extract"));
document.querySelector('[data-action="run-segment"]').addEventListener("click", () =>
  runStage("segment", "/api/jobs/segment"));
document.querySelector('[data-action="run-run"]').addEventListener("click", () =>
  runStage("run", "/api/jobs/run", { limit: Number(document.getElementById("runLimit").value) || 20 }));
document.querySelector('[data-action="run-rollup"]').addEventListener("click", () =>
  runStage("rollup", "/api/jobs/rollup", { limit: Number(document.getElementById("rollupLimit").value) || 20, stage: "both" }));
document.querySelector('[data-action="run-relations"]').addEventListener("click", async () => {
  setStageStatus("relations", "rebuilding…");
  try {
    const r = await apiPost("/api/build-relations", {});
    setStageStatus("relations", `${r.edges} edges`, "ok");
    refreshStatus();
  } catch (e) {
    setStageStatus("relations", `failed: ${e.message}`, "error");
  }
});

// ---------------------------------------------------------------------
// Search & Ask
// ---------------------------------------------------------------------
function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

async function runSearch() {
  const q = document.getElementById("searchQuery").value.trim();
  const mode = document.getElementById("searchMode").value;
  const box = document.getElementById("searchResults");
  if (!q) return;
  box.innerHTML = `<div class="empty-note">Searching…</div>`;
  try {
    const data = await apiGet(`/api/search?q=${encodeURIComponent(q)}&mode=${mode}&limit=20`);
    if (!data.hits.length) {
      box.innerHTML = `<div class="empty-note">No matches for "${escapeHtml(q)}".</div>`;
      return;
    }
    box.innerHTML = data.hits.map((hit) => {
      const locs = hit.locations.map((l) => `${escapeHtml(l.project_name)} / ${escapeHtml(l.rel_path)}${l.label ? " :: " + escapeHtml(l.label) : ""}`).join("<br>");
      return `<div class="result-card">
        <div class="score">score ${Number(hit.score).toFixed(3)} · ${hit.occurrences} occurrence(s)</div>
        <div class="loc">${locs}</div>
        <div class="snippet">${escapeHtml(hit.snippet)}</div>
      </div>`;
    }).join("");
  } catch (e) {
    box.innerHTML = `<div class="empty-note">Search failed: ${escapeHtml(e.message)}</div>`;
  }
}
document.querySelector('[data-action="run-search"]').addEventListener("click", runSearch);
document.getElementById("searchQuery").addEventListener("keydown", (ev) => { if (ev.key === "Enter") runSearch(); });

async function runAsk() {
  const q = document.getElementById("askQuestion").value.trim();
  const box = document.getElementById("askResult");
  if (!q) return;
  box.innerHTML = `<div class="empty-note">Thinking… (this calls the real model, can take a while)</div>`;
  try {
    const data = await apiPost("/api/ask", { question: q, max_hits: 5 });
    let html = `<div class="ask-answer${data.grounded ? "" : " ungrounded"}">${escapeHtml(data.answer)}</div>`;
    const list = data.citations.length ? data.citations : data.retrieved;
    const labelText = data.citations.length ? "Sources" : "Retrieved but not cited";
    if (list.length) {
      html += `<div class="citation-list"><strong>${labelText}:</strong><br>` + list.map((c) =>
        `[${c.number}] ${escapeHtml(c.project_name)} / ${escapeHtml(c.rel_path)}${c.label ? " :: " + escapeHtml(c.label) : ""}`
      ).join("<br>") + `</div>`;
    }
    box.innerHTML = html;
  } catch (e) {
    box.innerHTML = `<div class="empty-note">Ask failed: ${escapeHtml(e.message)}</div>`;
  }
}
document.querySelector('[data-action="run-ask"]').addEventListener("click", runAsk);
document.getElementById("askQuestion").addEventListener("keydown", (ev) => { if (ev.key === "Enter") runAsk(); });

// ---------------------------------------------------------------------
// Connections: project picker + live force-directed graph
// ---------------------------------------------------------------------
const selected = new Map(); // id -> name

function renderSelected() {
  const box = document.getElementById("selectedProjects");
  box.innerHTML = "";
  selected.forEach((name, id) => {
    const chip = document.createElement("span");
    chip.className = "selected-chip";
    chip.innerHTML = `${escapeHtml(name)} <button aria-label="remove">&times;</button>`;
    chip.querySelector("button").addEventListener("click", () => { selected.delete(id); renderSelected(); });
    box.appendChild(chip);
  });
}

let projectSearchTimer = null;
document.getElementById("projectSearch").addEventListener("input", (ev) => {
  clearTimeout(projectSearchTimer);
  const q = ev.target.value.trim();
  projectSearchTimer = setTimeout(async () => {
    const box = document.getElementById("projectResults");
    if (!q) { box.innerHTML = ""; return; }
    try {
      const data = await apiGet(`/api/projects?q=${encodeURIComponent(q)}&limit=15`);
      box.innerHTML = data.projects.map((p) =>
        `<span class="project-chip" data-id="${p.id}" data-name="${escapeHtml(p.name)}">${escapeHtml(p.name)}</span>`
      ).join("");
      box.querySelectorAll(".project-chip").forEach((chip) => {
        chip.addEventListener("click", () => {
          selected.set(Number(chip.dataset.id), chip.dataset.name);
          renderSelected();
        });
      });
    } catch (e) {
      box.innerHTML = `<span class="empty-note">${escapeHtml(e.message)}</span>`;
    }
  }, 250);
});

let sim = null;
async function drawGraph() {
  const ids = Array.from(selected.keys());
  if (!ids.length) return;
  const maxDocFreq = document.getElementById("maxDocFreq").value;
  const url = `/api/connections?project_ids=${ids.join(",")}` + (maxDocFreq ? `&max_entity_doc_freq=${maxDocFreq}` : "");
  let data;
  try {
    data = await apiGet(url);
  } catch (e) {
    alert("Could not load connections: " + e.message);
    return;
  }
  renderGraph(data.nodes, data.edges);
}
document.querySelector('[data-action="draw-graph"]').addEventListener("click", drawGraph);

function renderGraph(rawNodes, rawEdges) {
  const svg = d3.select("#graphSvg");
  svg.selectAll("*").remove();
  document.getElementById("graphLegend").hidden = rawNodes.length === 0;

  const rect = svg.node().getBoundingClientRect();
  const W = rect.width || 900, H = rect.height || 560;

  const nodes = rawNodes.map((n) => ({ ...n }));
  const byId = {};
  nodes.forEach((n) => { byId[n.id] = n; });
  const links = rawEdges.map((e) => ({ source: e.source, target: e.target, weight: e.weight }));

  const g = svg.append("g");
  svg.call(d3.zoom().scaleExtent([0.3, 3]).on("zoom", (ev) => g.attr("transform", ev.transform)));

  const linkSel = g.append("g").selectAll("line").data(links).join("line")
    .attr("class", (d) => "link" + (d.weight >= 3 ? " hot" : ""))
    .attr("stroke-width", (d) => Math.max(1, Math.sqrt(d.weight) * 1.5));

  const nodeG = g.append("g").selectAll("g").data(nodes).join("g").style("cursor", "pointer").call(drag());

  nodeG.append("circle")
    .attr("class", (d) => "node-circle" + (d.type === "project" ? " project" : ""))
    .attr("r", (d) => d.type === "project" ? 24 : 6 + (d.degree || 1) * 3.2)
    .attr("fill", (d) => d.type === "entity" ? `var(--k-${d.kind})` : null);

  nodeG.append("text")
    .attr("class", (d) => "node-label" + (d.type === "project" ? " project" : ""))
    .attr("text-anchor", "middle")
    .attr("dy", (d) => d.type === "project" ? 4 : -(9 + (d.degree || 1) * 3.2))
    .text((d) => d.label);

  nodeG.on("click", (ev, d) => { showDetail(d, links, byId); ev.stopPropagation(); });
  svg.on("click", hideDetail);

  if (sim) sim.stop();
  sim = d3.forceSimulation(nodes)
    .force("link", d3.forceLink(links).id((d) => d.id).distance((d) => 65 + 35 / Math.max(d.weight, 1)).strength(0.55))
    .force("charge", d3.forceManyBody().strength((d) => d.type === "project" ? -550 : -140))
    .force("center", d3.forceCenter(W / 2, H / 2))
    .force("collide", d3.forceCollide().radius((d) => (d.type === "project" ? 24 : 6 + (d.degree || 1) * 3.2) + 12))
    .on("tick", () => {
      linkSel
        .attr("x1", (d) => d.source.x).attr("y1", (d) => d.source.y)
        .attr("x2", (d) => d.target.x).attr("y2", (d) => d.target.y);
      nodeG.attr("transform", (d) => `translate(${d.x},${d.y})`);
    });

  function drag() {
    return d3.drag()
      .on("start", (ev, d) => { if (!ev.active) sim.alphaTarget(0.25).restart(); d.fx = d.x; d.fy = d.y; })
      .on("drag", (ev, d) => { d.fx = ev.x; d.fy = ev.y; })
      .on("end", (ev, d) => { if (!ev.active) sim.alphaTarget(0); d.fx = null; d.fy = null; });
  }
}

function showDetail(d, links, byId) {
  const panel = document.getElementById("graphDetail");
  panel.hidden = false;
  const conns = links.filter((l) => {
    const s = typeof l.source === "object" ? l.source.id : l.source;
    const t = typeof l.target === "object" ? l.target.id : l.target;
    return s === d.id || t === d.id;
  }).map((l) => {
    const s = typeof l.source === "object" ? l.source.id : l.source;
    const otherId = s === d.id ? (typeof l.target === "object" ? l.target.id : l.target) : s;
    return { label: byId[otherId] ? byId[otherId].label : otherId, weight: l.weight };
  }).sort((a, b) => b.weight - a.weight);

  panel.innerHTML = `<h4>${escapeHtml(d.label)}</h4>` +
    `<div class="k">${d.type === "project" ? "Project" : d.kind}</div>` +
    conns.map((c) => `<div class="conn-row"><span>${escapeHtml(c.label)}</span><span>${c.weight}&times;</span></div>`).join("");
}
function hideDetail() { document.getElementById("graphDetail").hidden = true; }

// ---------------------------------------------------------------------
// Review: dropped facts + conflicts
// ---------------------------------------------------------------------
async function refreshDropped() {
  const box = document.getElementById("droppedList");
  box.innerHTML = `<div class="empty-note">Loading…</div>`;
  try {
    const data = await apiGet("/api/dropped-facts?limit=30");
    if (!data.items.length) { box.innerHTML = `<div class="empty-note">Nothing pending.</div>`; return; }
    box.innerHTML = "";
    data.items.forEach((item) => {
      const card = document.createElement("div");
      card.className = "review-card";
      const label = item.field === "attributes" ? `${item.field_name}` : (item.kind || item.field);
      card.innerHTML = `
        <div class="meta">#${item.id} · ${escapeHtml(item.field)} · ${escapeHtml(item.drop_reason)}</div>
        <div class="value">${escapeHtml(label)}: "${escapeHtml(item.value)}"</div>
        <div class="excerpt">${escapeHtml(item.excerpt || "(no excerpt found)")}</div>
        <div class="actions">
          <button class="btn small" data-act="recover">Recover</button>
          <button class="btn small" data-act="reject">Confirm reject</button>
        </div>`;
      card.querySelector('[data-act="recover"]').addEventListener("click", async () => {
        try {
          const r = await apiPost(`/api/dropped-facts/${item.id}/recover`, {});
          card.querySelector(".actions").innerHTML = r.recovered ? "recovered" : `not recoverable: ${escapeHtml(r.reason)}`;
        } catch (e) { alert(e.message); }
      });
      card.querySelector('[data-act="reject"]').addEventListener("click", async () => {
        try {
          await apiPost(`/api/dropped-facts/${item.id}/reject`, {});
          card.querySelector(".actions").innerHTML = "confirmed reject";
        } catch (e) { alert(e.message); }
      });
      box.appendChild(card);
    });
  } catch (e) {
    box.innerHTML = `<div class="empty-note">${escapeHtml(e.message)}</div>`;
  }
}
document.querySelector('[data-action="refresh-dropped"]').addEventListener("click", refreshDropped);

async function refreshConflicts() {
  const box = document.getElementById("conflictsList");
  box.innerHTML = `<div class="empty-note">Loading…</div>`;
  try {
    const data = await apiGet("/api/conflicts?limit=30");
    if (!data.items.length) { box.innerHTML = `<div class="empty-note">No pending conflicts.</div>`; return; }
    box.innerHTML = "";
    data.items.forEach((item) => {
      const card = document.createElement("div");
      card.className = "review-card";
      const membersHtml = item.members.map((m, i) =>
        `<div class="conflict-member"><span>[${i + 1}] "${escapeHtml(m.value_text)}" &larr; ${escapeHtml(m.rel_path)}</span>
         <button class="btn small" data-pick="${i}">use this</button></div>`
      ).join("");
      card.innerHTML = `
        <div class="meta">#${item.id} · ${escapeHtml(item.project_name || "project " + item.project_id)} · field: ${escapeHtml(item.field_key)}</div>
        ${membersHtml}
        <input type="text" class="reason-input" placeholder="Reason (required)">
        <div class="actions">
          <button class="btn small" data-act="dismiss">Not a real conflict</button>
        </div>`;
      const reasonInput = card.querySelector(".reason-input");
      card.querySelectorAll("[data-pick]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const reason = reasonInput.value.trim();
          if (!reason) { reasonInput.focus(); return; }
          const value = item.members[Number(btn.dataset.pick)].value_text;
          try {
            await apiPost(`/api/conflicts/${item.id}/resolve`, { value_text: value, reason });
            card.innerHTML = "resolved";
          } catch (e) { alert(e.message); }
        });
      });
      card.querySelector('[data-act="dismiss"]').addEventListener("click", async () => {
        const reason = reasonInput.value.trim();
        if (!reason) { reasonInput.focus(); return; }
        try {
          await apiPost(`/api/conflicts/${item.id}/dismiss`, { reason });
          card.innerHTML = "dismissed";
        } catch (e) { alert(e.message); }
      });
      box.appendChild(card);
    });
  } catch (e) {
    box.innerHTML = `<div class="empty-note">${escapeHtml(e.message)}</div>`;
  }
}
document.querySelector('[data-action="refresh-conflicts"]').addEventListener("click", refreshConflicts);
document.querySelector('[data-action="detect-conflicts"]').addEventListener("click", async () => {
  try {
    const r = await apiPost("/api/conflicts/detect", {});
    alert(`${r.groups_found} conflict group(s) found (includes already-known ones).`);
    refreshConflicts();
  } catch (e) { alert(e.message); }
});

// ---------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------
checkConnection();
refreshStatus();

