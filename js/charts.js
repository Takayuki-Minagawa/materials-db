/* ===== Charts Module (SVG-based) ===== */
const Charts = (() => {
  const NS = "http://www.w3.org/2000/svg";

  function svgEl(tag, attrs = {}) {
    const el = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
    return el;
  }

  const CAT_COLORS = {
    Metal: "#ef4444", Polymer: "#3b82f6", Elastomer: "#8b5cf6",
    Wood: "#a16207", Composite: "#0891b2", Adhesive: "#d97706",
    Ceramics: "#dc2626", Foam: "#0d9488", Glass: "#6366f1",
    "Concrete and Grout": "#71717a", Soil: "#854d0e",
  };

  function getCatColor(catEn) { return CAT_COLORS[catEn] || "#94a3b8"; }

  function fmtAxis(v) {
    if (v == null || !isFinite(v)) return "";
    const a = Math.abs(v);
    if (a >= 1e12) return (v / 1e12).toPrecision(3) + "T";
    if (a >= 1e9)  return (v / 1e9).toPrecision(3) + "G";
    if (a >= 1e6)  return (v / 1e6).toPrecision(3) + "M";
    if (a >= 1e3)  return (v / 1e3).toPrecision(3) + "k";
    if (a >= 1)    return v.toPrecision(3);
    if (a >= 0.001) return v.toPrecision(3);
    return v.toExponential(1);
  }

  function niceStep(range, targetTicks) {
    const rough = range / targetTicks;
    const mag = Math.pow(10, Math.floor(Math.log10(rough)));
    const norm = rough / mag;
    const nice = norm <= 1.5 ? 1 : norm <= 3 ? 2 : norm <= 7 ? 5 : 10;
    return nice * mag;
  }

  /* ===== Scatter Plot ===== */
  function renderScatterPlot(container, materials, options = {}) {
    container.innerHTML = "";
    const W = options.width || container.clientWidth || 780;
    const H = options.height || 480;
    const M = { top: 30, right: 30, bottom: 60, left: 80, ...(options.margin || {}) };
    const { xLabel = "", yLabel = "", getX, getY, logX = false, logY = false, onClickPoint } = options;

    const points = [];
    for (const m of materials) {
      const x = getX(m), y = getY(m);
      const cat = m.classification?.category_en || "Other";
      if (x != null && y != null && isFinite(x) && isFinite(y) && (!logX || x > 0) && (!logY || y > 0))
        points.push({ x, y, cat, m });
    }
    if (!points.length) {
      container.innerHTML = '<div class="chart-empty">No data for selected axes</div>';
      return;
    }

    const pW = W - M.left - M.right, pH = H - M.top - M.bottom;
    let xMin = Math.min(...points.map(p => p.x)), xMax = Math.max(...points.map(p => p.x));
    let yMin = Math.min(...points.map(p => p.y)), yMax = Math.max(...points.map(p => p.y));
    if (logX) { xMin *= 0.7; xMax *= 1.4; } else { const pad = (xMax - xMin) * 0.06 || xMax * 0.1; xMin -= pad; xMax += pad; }
    if (logY) { yMin *= 0.7; yMax *= 1.4; } else { const pad = (yMax - yMin) * 0.06 || yMax * 0.1; yMin -= pad; yMax += pad; }

    const sx = logX
      ? v => (Math.log10(v) - Math.log10(xMin)) / (Math.log10(xMax) - Math.log10(xMin)) * pW
      : v => ((v - xMin) / (xMax - xMin)) * pW;
    const sy = logY
      ? v => pH - (Math.log10(v) - Math.log10(yMin)) / (Math.log10(yMax) - Math.log10(yMin)) * pH
      : v => pH - ((v - yMin) / (yMax - yMin)) * pH;

    const svg = svgEl("svg", { width: W, height: H, class: "chart-svg" });
    const g = svgEl("g", { transform: `translate(${M.left},${M.top})` });

    // Grid
    const nTicks = 6;
    for (let i = 0; i <= nTicks; i++) {
      const frac = i / nTicks;
      const yv = logY ? Math.pow(10, Math.log10(yMin) + frac * (Math.log10(yMax) - Math.log10(yMin))) : yMin + frac * (yMax - yMin);
      const py = pH - frac * pH;
      g.appendChild(svgEl("line", { x1: 0, y1: py, x2: pW, y2: py, stroke: "var(--border-color)", "stroke-width": 0.5 }));
      const txt = svgEl("text", { x: -8, y: py + 4, "text-anchor": "end", fill: "var(--text-secondary)", "font-size": 10 });
      txt.textContent = fmtAxis(yv); g.appendChild(txt);

      const xv = logX ? Math.pow(10, Math.log10(xMin) + frac * (Math.log10(xMax) - Math.log10(xMin))) : xMin + frac * (xMax - xMin);
      const px = frac * pW;
      g.appendChild(svgEl("line", { x1: px, y1: 0, x2: px, y2: pH, stroke: "var(--border-color)", "stroke-width": 0.5 }));
      const txt2 = svgEl("text", { x: px, y: pH + 16, "text-anchor": "middle", fill: "var(--text-secondary)", "font-size": 10 });
      txt2.textContent = fmtAxis(xv); g.appendChild(txt2);
    }

    // Axis labels
    const xl = svgEl("text", { x: pW / 2, y: pH + 42, "text-anchor": "middle", fill: "var(--text-primary)", "font-size": 13, "font-weight": 600 });
    xl.textContent = xLabel; g.appendChild(xl);
    const yl = svgEl("text", { x: -(pH / 2), y: -58, "text-anchor": "middle", fill: "var(--text-primary)", "font-size": 13, "font-weight": 600, transform: "rotate(-90)" });
    yl.textContent = yLabel; g.appendChild(yl);

    // Tooltip
    const tip = document.createElement("div");
    tip.className = "chart-tooltip hidden";

    // Points
    for (const p of points) {
      const cx = sx(p.x), cy = sy(p.y);
      const c = svgEl("circle", { cx, cy, r: 5, fill: getCatColor(p.cat), opacity: 0.75, stroke: "#fff", "stroke-width": 1, cursor: "pointer" });
      c.addEventListener("mouseenter", e => {
        c.setAttribute("r", 8); c.setAttribute("opacity", 1);
        tip.innerHTML = `<strong>${p.m.name}</strong><br>${xLabel}: ${fmtAxis(p.x)}<br>${yLabel}: ${fmtAxis(p.y)}<br>${p.cat}`;
        tip.classList.remove("hidden");
      });
      c.addEventListener("mousemove", e => {
        const r = container.getBoundingClientRect();
        tip.style.left = (e.clientX - r.left + 14) + "px";
        tip.style.top = (e.clientY - r.top - 12) + "px";
      });
      c.addEventListener("mouseleave", () => { c.setAttribute("r", 5); c.setAttribute("opacity", 0.75); tip.classList.add("hidden"); });
      if (onClickPoint) c.addEventListener("click", () => onClickPoint(p.m));
      g.appendChild(c);
    }

    svg.appendChild(g); container.style.position = "relative";
    container.appendChild(svg); container.appendChild(tip);

    // Legend
    const cats = [...new Set(points.map(p => p.cat))].sort();
    const legend = document.createElement("div");
    legend.className = "chart-legend";
    legend.innerHTML = cats.map(cat => `<span class="chart-legend-item"><span class="chart-legend-dot" style="background:${getCatColor(cat)}"></span>${cat}</span>`).join("");
    container.appendChild(legend);
  }

  /* ===== Radar Chart ===== */
  function renderRadarChart(container, datasets, axisLabels, options = {}) {
    container.innerHTML = "";
    const size = options.size || Math.min(container.clientWidth || 380, 380);
    const levels = options.levels || 5;
    const n = axisLabels.length;
    if (n < 3 || !datasets.length) return;

    const cx = size / 2, cy = size / 2, R = size / 2 - 45;
    const svg = svgEl("svg", { width: size, height: size, class: "chart-svg" });

    const angle = i => (Math.PI * 2 * i) / n - Math.PI / 2;

    // Grid
    for (let lv = 1; lv <= levels; lv++) {
      const lr = R * lv / levels;
      const pts = Array.from({ length: n }, (_, i) => `${cx + lr * Math.cos(angle(i))},${cy + lr * Math.sin(angle(i))}`).join(" ");
      svg.appendChild(svgEl("polygon", { points: pts, fill: "none", stroke: "var(--border-color)", "stroke-width": 0.8 }));
    }

    // Axes + labels
    for (let i = 0; i < n; i++) {
      const a = angle(i);
      svg.appendChild(svgEl("line", { x1: cx, y1: cy, x2: cx + R * Math.cos(a), y2: cy + R * Math.sin(a), stroke: "var(--border-color)", "stroke-width": 0.8 }));
      const lx = cx + (R + 18) * Math.cos(a), ly = cy + (R + 18) * Math.sin(a);
      const anch = Math.abs(Math.cos(a)) < 0.15 ? "middle" : Math.cos(a) > 0 ? "start" : "end";
      const txt = svgEl("text", { x: lx, y: ly + 4, "text-anchor": anch, fill: "var(--text-primary)", "font-size": 10 });
      txt.textContent = axisLabels[i]; svg.appendChild(txt);
    }

    // Data
    for (const ds of datasets) {
      const pts = Array.from({ length: n }, (_, i) => {
        const v = Math.max(0, Math.min(1, ds.values[i] || 0));
        const a = angle(i);
        return `${cx + R * v * Math.cos(a)},${cy + R * v * Math.sin(a)}`;
      }).join(" ");
      svg.appendChild(svgEl("polygon", { points: pts, fill: ds.color, "fill-opacity": 0.15, stroke: ds.color, "stroke-width": 2 }));
      for (let i = 0; i < n; i++) {
        const v = Math.max(0, Math.min(1, ds.values[i] || 0)), a = angle(i);
        svg.appendChild(svgEl("circle", { cx: cx + R * v * Math.cos(a), cy: cy + R * v * Math.sin(a), r: 3, fill: ds.color }));
      }
    }

    container.appendChild(svg);
    const legend = document.createElement("div"); legend.className = "chart-legend";
    legend.innerHTML = datasets.map(ds => `<span class="chart-legend-item"><span class="chart-legend-dot" style="background:${ds.color}"></span>${ds.label}</span>`).join("");
    container.appendChild(legend);
  }

  /* ===== Histogram ===== */
  function renderHistogram(container, data, options = {}) {
    container.innerHTML = "";
    const W = options.width || container.clientWidth || 600;
    const H = options.height || 340;
    const M = { top: 20, right: 20, bottom: 58, left: 58 };
    const numBins = options.bins || 20;
    const { xLabel = "", yLabel = "Count" } = options;

    const vals = data.filter(d => d.value != null && isFinite(d.value));
    if (!vals.length) { container.innerHTML = '<div class="chart-empty">No data</div>'; return; }

    const vMin = Math.min(...vals.map(d => d.value)), vMax = Math.max(...vals.map(d => d.value));
    const range = vMax - vMin || 1, binW = range / numBins;
    const bins = Array.from({ length: numBins }, () => ({ total: 0, cats: {} }));

    for (const d of vals) {
      let idx = Math.floor((d.value - vMin) / binW);
      if (idx >= numBins) idx = numBins - 1; if (idx < 0) idx = 0;
      bins[idx].total++;
      bins[idx].cats[d.cat] = (bins[idx].cats[d.cat] || 0) + 1;
    }
    const maxCount = Math.max(...bins.map(b => b.total), 1);
    const pW = W - M.left - M.right, pH = H - M.top - M.bottom;
    const barW = pW / numBins;

    const svg = svgEl("svg", { width: W, height: H, class: "chart-svg" });
    const g = svgEl("g", { transform: `translate(${M.left},${M.top})` });

    for (let i = 0; i <= 5; i++) {
      const py = pH - pH * i / 5;
      g.appendChild(svgEl("line", { x1: 0, y1: py, x2: pW, y2: py, stroke: "var(--border-color)", "stroke-width": 0.5 }));
      const txt = svgEl("text", { x: -6, y: py + 4, "text-anchor": "end", fill: "var(--text-secondary)", "font-size": 10 });
      txt.textContent = Math.round(maxCount * i / 5); g.appendChild(txt);
    }

    const allCats = [...new Set(vals.map(d => d.cat))].sort();
    for (let i = 0; i < numBins; i++) {
      let yOff = 0;
      for (const cat of allCats) {
        const cnt = bins[i].cats[cat] || 0; if (!cnt) continue;
        const bH = (cnt / maxCount) * pH;
        g.appendChild(svgEl("rect", { x: i * barW + 1, y: pH - yOff - bH, width: barW - 2, height: bH, fill: getCatColor(cat), opacity: 0.8, rx: 1 }));
        yOff += bH;
      }
      if (i % Math.max(1, Math.ceil(numBins / 8)) === 0 || i === numBins - 1) {
        const v = vMin + (i + 0.5) * binW;
        const txt = svgEl("text", { x: i * barW + barW / 2, y: pH + 16, "text-anchor": "middle", fill: "var(--text-secondary)", "font-size": 10 });
        txt.textContent = fmtAxis(v); g.appendChild(txt);
      }
    }
    const xl = svgEl("text", { x: pW / 2, y: pH + 42, "text-anchor": "middle", fill: "var(--text-primary)", "font-size": 12, "font-weight": 600 });
    xl.textContent = xLabel; g.appendChild(xl);
    const yl = svgEl("text", { x: -(pH / 2), y: -40, "text-anchor": "middle", fill: "var(--text-primary)", "font-size": 12, "font-weight": 600, transform: "rotate(-90)" });
    yl.textContent = yLabel; g.appendChild(yl);

    svg.appendChild(g); container.appendChild(svg);
    const legend = document.createElement("div"); legend.className = "chart-legend";
    legend.innerHTML = allCats.map(cat => `<span class="chart-legend-item"><span class="chart-legend-dot" style="background:${getCatColor(cat)}"></span>${cat}</span>`).join("");
    container.appendChild(legend);
  }

  /* ===== Line Chart (thickness) ===== */
  function renderLineChart(container, datasets, options = {}) {
    container.innerHTML = "";
    const W = options.width || container.clientWidth || 480;
    const H = options.height || 260;
    const M = { top: 16, right: 20, bottom: 46, left: 68 };
    const { xLabel = "", yLabel = "" } = options;

    const allX = datasets.flatMap(ds => ds.points.map(p => p.x));
    const allY = datasets.flatMap(ds => ds.points.map(p => p.y));
    if (!allX.length) { container.innerHTML = '<div class="chart-empty">No data</div>'; return; }

    const xMin = Math.min(...allX), xMax = Math.max(...allX);
    const yMin = Math.min(...allY) * 0.95, yMax = Math.max(...allY) * 1.05;
    const pW = W - M.left - M.right, pH = H - M.top - M.bottom;
    const sx = v => ((v - xMin) / ((xMax - xMin) || 1)) * pW;
    const sy = v => pH - ((v - yMin) / ((yMax - yMin) || 1)) * pH;

    const svg = svgEl("svg", { width: W, height: H, class: "chart-svg" });
    const g = svgEl("g", { transform: `translate(${M.left},${M.top})` });

    for (let i = 0; i <= 4; i++) {
      const py = pH * i / 4;
      g.appendChild(svgEl("line", { x1: 0, y1: py, x2: pW, y2: py, stroke: "var(--border-color)", "stroke-width": 0.5 }));
      const val = yMax - (yMax - yMin) * i / 4;
      const txt = svgEl("text", { x: -6, y: py + 4, "text-anchor": "end", fill: "var(--text-secondary)", "font-size": 10 });
      txt.textContent = fmtAxis(val); g.appendChild(txt);
    }

    for (const ds of datasets) {
      if (!ds.points.length) continue;
      const sorted = [...ds.points].sort((a, b) => a.x - b.x);
      const d = sorted.map((p, i) => `${i ? "L" : "M"}${sx(p.x)},${sy(p.y)}`).join(" ");
      g.appendChild(svgEl("path", { d, fill: "none", stroke: ds.color, "stroke-width": 2 }));
      for (const p of sorted) g.appendChild(svgEl("circle", { cx: sx(p.x), cy: sy(p.y), r: 4, fill: ds.color, stroke: "#fff", "stroke-width": 1 }));
    }

    const uxs = [...new Set(allX)].sort((a, b) => a - b);
    const step = Math.max(1, Math.ceil(uxs.length / 8));
    uxs.forEach((xv, i) => { if (i % step === 0 || i === uxs.length - 1) {
      const txt = svgEl("text", { x: sx(xv), y: pH + 16, "text-anchor": "middle", fill: "var(--text-secondary)", "font-size": 10 });
      txt.textContent = xv; g.appendChild(txt);
    }});

    const xl = svgEl("text", { x: pW / 2, y: pH + 38, "text-anchor": "middle", fill: "var(--text-primary)", "font-size": 11, "font-weight": 600 });
    xl.textContent = xLabel; g.appendChild(xl);
    const yl = svgEl("text", { x: -(pH / 2), y: -50, "text-anchor": "middle", fill: "var(--text-primary)", "font-size": 11, "font-weight": 600, transform: "rotate(-90)" });
    yl.textContent = yLabel; g.appendChild(yl);

    svg.appendChild(g); container.appendChild(svg);
    if (datasets.length > 1) {
      const legend = document.createElement("div"); legend.className = "chart-legend";
      legend.innerHTML = datasets.map(ds => `<span class="chart-legend-item"><span class="chart-legend-dot" style="background:${ds.color}"></span>${ds.label}</span>`).join("");
      container.appendChild(legend);
    }
  }

  /* ===== Bar Chart (dashboard) ===== */
  function renderBarChart(container, data, options = {}) {
    container.innerHTML = "";
    const W = options.width || container.clientWidth || 480;
    const H = options.height || 280;
    const M = { top: 16, right: 16, bottom: 72, left: 64 };
    const { yLabel = "" } = options;
    if (!data.length) return;

    const maxVal = Math.max(...data.map(d => d.value), 0.001);
    const pW = W - M.left - M.right, pH = H - M.top - M.bottom;
    const barW = Math.min((pW / data.length) - 4, 44);
    const gap = (pW - barW * data.length) / (data.length + 1);

    const svg = svgEl("svg", { width: W, height: H, class: "chart-svg" });
    const g = svgEl("g", { transform: `translate(${M.left},${M.top})` });

    for (let i = 0; i <= 4; i++) {
      const py = pH - pH * i / 4;
      g.appendChild(svgEl("line", { x1: 0, y1: py, x2: pW, y2: py, stroke: "var(--border-color)", "stroke-width": 0.5 }));
      const txt = svgEl("text", { x: -6, y: py + 4, "text-anchor": "end", fill: "var(--text-secondary)", "font-size": 10 });
      txt.textContent = fmtAxis(maxVal * i / 4); g.appendChild(txt);
    }

    for (let i = 0; i < data.length; i++) {
      const d = data[i], x = gap + i * (barW + gap), bH = (d.value / maxVal) * pH;
      g.appendChild(svgEl("rect", { x, y: pH - bH, width: barW, height: bH, fill: d.color || "var(--accent)", rx: 2, opacity: 0.85 }));
      const txt = svgEl("text", { x: x + barW / 2, y: pH + 12, "text-anchor": "end", fill: "var(--text-secondary)", "font-size": 10, transform: `rotate(-40,${x + barW / 2},${pH + 12})` });
      txt.textContent = d.label.length > 14 ? d.label.slice(0, 13) + "…" : d.label; g.appendChild(txt);
    }

    const yl = svgEl("text", { x: -(pH / 2), y: -46, "text-anchor": "middle", fill: "var(--text-primary)", "font-size": 11, "font-weight": 600, transform: "rotate(-90)" });
    yl.textContent = yLabel; g.appendChild(yl);

    svg.appendChild(g); container.appendChild(svg);
  }

  return { renderScatterPlot, renderRadarChart, renderHistogram, renderLineChart, renderBarChart, getCatColor, fmtAxis };
})();
