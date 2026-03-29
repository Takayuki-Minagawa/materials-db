/* ===== State ===== */
let allMaterials = [];
let dbData = null;
let lang = "ja";             // "ja" | "en"
let selectedCategory = null;  // null = all
let selectedSubcategory = null;
let searchQuery = "";

/* ===== Category CSS class mapping ===== */
const catClassMap = {
  "Metal": "cat-metal",
  "Polymer": "cat-polymer",
  "Elastomer": "cat-elastomer",
  "Wood": "cat-wood",
  "Composite": "cat-composite",
  "Adhesive": "cat-adhesive",
  "Ceramics": "cat-ceramics",
  "Foam": "cat-foam",
  "Glass": "cat-glass",
  "Concrete and Grout": "cat-concrete",
  "Soil": "cat-soil",
};

/* ===== Helpers ===== */
function catClass(catEn) {
  return catClassMap[catEn] || "";
}

function catLabel(m) {
  const c = m.classification || {};
  return lang === "ja" ? (c.category_ja || c.category_en || "") : (c.category_en || "");
}

function subcatLabel(m) {
  const c = m.classification || {};
  return lang === "ja" ? (c.subcategory_ja || c.subcategory_en || "") : (c.subcategory_en || "");
}

function formatValue(val, unit) {
  if (val == null) return "-";
  if (typeof val === "number") {
    if (Math.abs(val) >= 1e9) return (val / 1e9).toFixed(1) + " GPa";
    if (Math.abs(val) >= 1e6) return (val / 1e6).toFixed(1) + " MPa";
    if (Math.abs(val) >= 1e3) return (val / 1e3).toFixed(1) + " kPa";
    return val.toFixed(4);
  }
  return String(val);
}

function formatStress(val) {
  if (val == null) return "-";
  if (Math.abs(val) >= 1e9) return (val / 1e9).toFixed(1) + " GPa";
  if (Math.abs(val) >= 1e6) return (val / 1e6).toFixed(1) + " MPa";
  if (Math.abs(val) >= 1e3) return (val / 1e3).toFixed(1) + " kPa";
  return val.toFixed(2) + " Pa";
}

function formatDensity(val) {
  if (val == null) return "-";
  return val.toLocaleString() + " kg/m\u00B3";
}

function esc(str) {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

/* ===== Build category / subcategory lists ===== */
function buildFilters() {
  const cats = {};
  const subcats = {};

  allMaterials.forEach((m) => {
    const c = m.classification || {};
    const catEn = c.category_en || "Other";
    const catJa = c.category_ja || catEn;
    const subEn = c.subcategory_en || "Other";
    const subJa = c.subcategory_ja || subEn;

    if (!cats[catEn]) cats[catEn] = { en: catEn, ja: catJa, count: 0 };
    cats[catEn].count++;

    const subKey = catEn + "::" + subEn;
    if (!subcats[subKey])
      subcats[subKey] = { en: subEn, ja: subJa, catEn, count: 0 };
    subcats[subKey].count++;
  });

  renderCategoryList(cats);
  renderSubcategoryList(subcats);
}

function renderCategoryList(cats) {
  const ul = document.getElementById("categoryList");
  const sorted = Object.values(cats).sort((a, b) => b.count - a.count);

  let html = `<li class="category-item ${selectedCategory === null ? "active" : ""}" data-cat="">
    <div class="category-item-inner"><span class="category-label">${lang === "ja" ? "すべて" : "All"}</span></div>
    <span class="category-count">${allMaterials.length}</span>
  </li>`;

  sorted.forEach((c) => {
    const active = selectedCategory === c.en ? "active" : "";
    const label = lang === "ja" ? c.ja : c.en;
    const cls = catClass(c.en);
    html += `<li class="category-item ${cls} ${active}" data-cat="${esc(c.en)}">
      <div class="category-item-inner">
        <span class="category-dot" style="background:var(--cat-color, var(--accent))"></span>
        <span class="category-label">${esc(label)}</span>
      </div>
      <span class="category-count">${c.count}</span>
    </li>`;
  });

  ul.innerHTML = html;

  ul.querySelectorAll(".category-item").forEach((li) => {
    li.addEventListener("click", () => {
      const v = li.dataset.cat;
      selectedCategory = v || null;
      selectedSubcategory = null;
      buildFilters();
      renderMaterials();
    });
  });
}

function renderSubcategoryList(subcats) {
  const ul = document.getElementById("subcategoryList");
  let filtered = Object.values(subcats);
  if (selectedCategory) {
    filtered = filtered.filter((s) => s.catEn === selectedCategory);
  }
  filtered.sort((a, b) => b.count - a.count);

  if (filtered.length === 0) {
    ul.innerHTML = `<li class="category-item" style="color:var(--text-secondary);cursor:default;font-size:0.8rem">${lang === "ja" ? "大分類を選択" : "Select a category"}</li>`;
    return;
  }

  let html = `<li class="category-item ${selectedSubcategory === null ? "active" : ""}" data-sub="">
    <div class="category-item-inner"><span class="category-label">${lang === "ja" ? "すべて" : "All"}</span></div>
    <span class="category-count">${filtered.reduce((s, c) => s + c.count, 0)}</span>
  </li>`;

  filtered.forEach((s) => {
    const active = selectedSubcategory === s.en ? "active" : "";
    const label = lang === "ja" ? s.ja : s.en;
    const cls = catClass(s.catEn);
    html += `<li class="category-item ${cls} ${active}" data-sub="${esc(s.en)}">
      <div class="category-item-inner">
        <span class="category-label">${esc(label)}</span>
      </div>
      <span class="category-count">${s.count}</span>
    </li>`;
  });

  ul.innerHTML = html;

  ul.querySelectorAll(".category-item").forEach((li) => {
    li.addEventListener("click", () => {
      const v = li.dataset.sub;
      selectedSubcategory = v || null;
      renderSubcategoryList(subcats);
      renderMaterials();
    });
  });
}

/* ===== Render Material Cards ===== */
function getFilteredMaterials() {
  return allMaterials.filter((m) => {
    const c = m.classification || {};
    if (selectedCategory && c.category_en !== selectedCategory) return false;
    if (selectedSubcategory && c.subcategory_en !== selectedSubcategory)
      return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const name = (m.name || "").toLowerCase();
      const id = (m.id || "").toLowerCase();
      if (!name.includes(q) && !id.includes(q)) return false;
    }
    return true;
  });
}

function renderMaterials() {
  const container = document.getElementById("materialList");
  const filtered = getFilteredMaterials();
  document.getElementById("materialCount").textContent =
    `${filtered.length} / ${allMaterials.length} materials`;

  if (filtered.length === 0) {
    container.innerHTML = `<div class="no-results">${lang === "ja" ? "該当する材料がありません" : "No materials found"}</div>`;
    return;
  }

  container.innerHTML = filtered
    .map((m) => {
      const c = m.classification || {};
      const cls = catClass(c.category_en);
      const p = m.properties || {};
      const le = p.linear_elastic || {};
      const oe = p.orthotropic_elastic || p.orthotropic_elastic_partial || {};

      const E = le.youngs_modulus_pa;
      const nu = le.poissons_ratio;
      const rho = le.density_kg_m3;

      let propsHtml = "";
      if (E != null) propsHtml += `<div class="card-prop"><span class="card-prop-label">E</span><span class="card-prop-value">${formatStress(E)}</span></div>`;
      if (nu != null) propsHtml += `<div class="card-prop"><span class="card-prop-label">&nu;</span><span class="card-prop-value">${nu}</span></div>`;
      if (rho != null) propsHtml += `<div class="card-prop"><span class="card-prop-label">&rho;</span><span class="card-prop-value">${formatDensity(rho)}</span></div>`;

      // For orthotropic, show E_x if available
      if (!E && oe.E_x_pa) propsHtml += `<div class="card-prop"><span class="card-prop-label">E<sub>x</sub></span><span class="card-prop-value">${formatStress(oe.E_x_pa)}</span></div>`;

      return `<div class="material-card ${cls}" data-id="${esc(m.id)}">
        <div class="card-header">
          <div class="card-name">${esc(m.name)}</div>
          <div class="card-badges">
            <span class="badge ${cls}">${esc(catLabel(m))}</span>
            <span class="badge">${esc(subcatLabel(m))}</span>
          </div>
        </div>
        <div class="card-props">${propsHtml}</div>
      </div>`;
    })
    .join("");

  container.querySelectorAll(".material-card").forEach((card) => {
    card.addEventListener("click", () => {
      const mat = allMaterials.find((m) => m.id === card.dataset.id);
      if (mat) openDetail(mat);
    });
  });
}

/* ===== Detail Panel ===== */
function openDetail(m) {
  const panel = document.getElementById("materialDetail");
  const overlay = document.getElementById("overlay");

  const c = m.classification || {};
  const cls = catClass(c.category_en);
  const p = m.properties || {};
  const other = m.other || {};

  let html = `<button class="detail-close" id="detailClose">&times;</button>`;
  html += `<div class="detail-name">${esc(m.name)}</div>`;
  html += `<div class="detail-meta">
    <span class="badge ${cls}">${esc(catLabel(m))}</span>
    <span class="badge">${esc(subcatLabel(m))}</span>
    ${other.condition ? `<span class="badge">${esc(other.condition)}</span>` : ""}
    ${other.validation_tier ? `<span class="badge">${esc(other.validation_tier)}</span>` : ""}
  </div>`;

  // Linear Elastic
  if (p.linear_elastic) {
    html += renderLinearElastic(p.linear_elastic);
  }

  // Orthotropic Elastic
  if (p.orthotropic_elastic) {
    html += renderOrthotropicElastic(p.orthotropic_elastic, lang === "ja" ? "直交異方性弾性" : "Orthotropic Elastic");
  }
  if (p.orthotropic_elastic_partial) {
    html += renderOrthotropicElastic(p.orthotropic_elastic_partial, lang === "ja" ? "直交異方性弾性 (部分)" : "Orthotropic Elastic (Partial)");
  }

  // Strength Data
  if (p.strength_data) {
    html += renderStrengthData(p.strength_data);
  }

  // Nonlinear Models
  if (p.nonlinear_models) {
    html += renderNonlinearModels(p.nonlinear_models);
  }

  // Solver Mappings
  const solverKeys = ["ansys_mapping", "abaqus_mapping", "dolfinx_mapping", "lsdyna_mapping"];
  solverKeys.forEach((key) => {
    if (other[key]) {
      html += renderSolverMapping(other[key], key.replace("_mapping", "").toUpperCase());
    }
  });

  // Thermal Properties
  if (other.thermal_properties) {
    html += renderKeyValueSection(other.thermal_properties, lang === "ja" ? "熱特性" : "Thermal Properties");
  }

  // Physical Properties
  if (other.physical_properties) {
    html += renderKeyValueSection(other.physical_properties, lang === "ja" ? "物理特性" : "Physical Properties");
  }

  // Additional Properties
  if (other.additional_properties) {
    html += renderKeyValueSection(other.additional_properties, lang === "ja" ? "追加特性" : "Additional Properties");
  }

  // Beam/Column/Panel reference design values
  if (other.beam_reference_design_values) {
    html += renderKeyValueSection(other.beam_reference_design_values, lang === "ja" ? "梁設計基準値" : "Beam Reference Design Values");
  }
  if (other.column_reference_design_values) {
    html += renderKeyValueSection(other.column_reference_design_values, lang === "ja" ? "柱設計基準値" : "Column Reference Design Values");
  }
  if (other.panel_reference_design_values) {
    html += renderKeyValueSection(other.panel_reference_design_values, lang === "ja" ? "パネル設計基準値" : "Panel Reference Design Values");
  }

  // Notes
  if (other.notes && other.notes.length) {
    html += `<div class="detail-section">
      <div class="detail-section-title">${lang === "ja" ? "備考" : "Notes"}</div>
      <ul class="detail-notes">${other.notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>
    </div>`;
  }

  // Sources
  if (m.sources && m.sources.length) {
    html += `<div class="detail-section">
      <div class="detail-section-title">${lang === "ja" ? "出典" : "Sources"}</div>
      <ul class="detail-notes">${m.sources.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>
    </div>`;
  }

  panel.innerHTML = html;
  panel.classList.remove("hidden");
  requestAnimationFrame(() => {
    panel.classList.add("open");
    overlay.classList.remove("hidden");
    overlay.classList.add("open");
  });

  document.getElementById("detailClose").addEventListener("click", closeDetail);
  overlay.addEventListener("click", closeDetail);
}

function closeDetail() {
  const panel = document.getElementById("materialDetail");
  const overlay = document.getElementById("overlay");
  panel.classList.remove("open");
  overlay.classList.remove("open");
  setTimeout(() => {
    panel.classList.add("hidden");
    overlay.classList.add("hidden");
  }, 300);
}

/* ===== Detail Section Renderers ===== */
function renderLinearElastic(le) {
  let rows = "";
  if (le.youngs_modulus_pa != null)
    rows += `<tr><td>Young's Modulus (E)</td><td>${formatStress(le.youngs_modulus_pa)}</td></tr>`;
  if (le.poissons_ratio != null)
    rows += `<tr><td>Poisson's Ratio (&nu;)</td><td>${le.poissons_ratio}</td></tr>`;
  if (le.density_kg_m3 != null)
    rows += `<tr><td>Density (&rho;)</td><td>${formatDensity(le.density_kg_m3)}</td></tr>`;
  if (le.shear_modulus_pa != null)
    rows += `<tr><td>Shear Modulus (G)</td><td>${formatStress(le.shear_modulus_pa)}</td></tr>`;
  if (le.bulk_modulus_pa != null)
    rows += `<tr><td>Bulk Modulus (K)</td><td>${formatStress(le.bulk_modulus_pa)}</td></tr>`;

  // Catch any other keys
  const known = new Set(["youngs_modulus_pa", "poissons_ratio", "density_kg_m3", "shear_modulus_pa", "bulk_modulus_pa"]);
  Object.entries(le).forEach(([k, v]) => {
    if (!known.has(k) && v != null) {
      rows += `<tr><td>${esc(k)}</td><td>${typeof v === "number" ? formatStress(v) : esc(String(v))}</td></tr>`;
    }
  });

  return `<div class="detail-section">
    <div class="detail-section-title">${lang === "ja" ? "線形弾性" : "Linear Elastic"}</div>
    <table class="detail-table"><thead><tr><th>${lang === "ja" ? "特性" : "Property"}</th><th>${lang === "ja" ? "値" : "Value"}</th></tr></thead>
    <tbody>${rows}</tbody></table>
  </div>`;
}

function renderOrthotropicElastic(oe, title) {
  let rows = "";
  Object.entries(oe).forEach(([k, v]) => {
    if (v != null && typeof v !== "object") {
      const display = typeof v === "number" && k.includes("_pa") ? formatStress(v) : (typeof v === "number" ? v : esc(String(v)));
      rows += `<tr><td>${esc(k)}</td><td>${display}</td></tr>`;
    }
  });
  if (!rows) return "";
  return `<div class="detail-section">
    <div class="detail-section-title">${esc(title)}</div>
    <table class="detail-table"><thead><tr><th>${lang === "ja" ? "特性" : "Property"}</th><th>${lang === "ja" ? "値" : "Value"}</th></tr></thead>
    <tbody>${rows}</tbody></table>
  </div>`;
}

function renderStrengthData(sd) {
  let html = `<div class="detail-section"><div class="detail-section-title">${lang === "ja" ? "強度データ" : "Strength Data"}</div>`;

  // Yield strength
  if (sd.yield_strength_pa != null) {
    html += `<table class="detail-table"><tbody><tr><td>${lang === "ja" ? "降伏強度" : "Yield Strength"}</td><td>${formatStress(sd.yield_strength_pa)}</td></tr></tbody></table>`;
  }
  if (sd.yield_strength_by_thickness_pa) {
    html += `<div class="detail-subsection">${lang === "ja" ? "降伏強度 (板厚別)" : "Yield Strength (by thickness)"}</div>`;
    html += `<table class="detail-table"><thead><tr><th>${lang === "ja" ? "板厚 (mm)" : "Thickness (mm)"}</th><th>${lang === "ja" ? "値" : "Value"}</th></tr></thead><tbody>`;
    sd.yield_strength_by_thickness_pa.forEach((entry) => {
      const t = entry.thickness_mm;
      html += `<tr><td>${t[0]} - ${t[1]}</td><td>${formatStress(entry.value)}</td></tr>`;
    });
    html += `</tbody></table>`;
  }

  // UTS
  if (sd.ultimate_tensile_strength_pa != null) {
    html += `<table class="detail-table"><tbody><tr><td>${lang === "ja" ? "引張強度" : "Ultimate Tensile Strength"}</td><td>${formatStress(sd.ultimate_tensile_strength_pa)}</td></tr></tbody></table>`;
  }
  if (sd.ultimate_tensile_strength_by_thickness_pa) {
    html += `<div class="detail-subsection">${lang === "ja" ? "引張強度 (板厚別)" : "UTS (by thickness)"}</div>`;
    html += `<table class="detail-table"><thead><tr><th>${lang === "ja" ? "板厚 (mm)" : "Thickness (mm)"}</th><th>Min</th><th>Max</th></tr></thead><tbody>`;
    sd.ultimate_tensile_strength_by_thickness_pa.forEach((entry) => {
      const t = entry.thickness_mm;
      html += `<tr><td>${t[0]} - ${t[1]}</td><td>${formatStress(entry.min)}</td><td>${formatStress(entry.max)}</td></tr>`;
    });
    html += `</tbody></table>`;
  }

  // Elongation
  if (sd.elongation_min_percent != null) {
    html += `<table class="detail-table"><tbody><tr><td>${lang === "ja" ? "伸び (最小)" : "Elongation (min)"}</td><td>${sd.elongation_min_percent}%</td></tr></tbody></table>`;
  }

  // Compressive strength
  if (sd.compressive_strength_pa != null) {
    html += `<table class="detail-table"><tbody><tr><td>${lang === "ja" ? "圧縮強度" : "Compressive Strength"}</td><td>${formatStress(sd.compressive_strength_pa)}</td></tr></tbody></table>`;
  }

  // Flexural strength
  if (sd.flexural_strength_pa != null) {
    html += `<table class="detail-table"><tbody><tr><td>${lang === "ja" ? "曲げ強度" : "Flexural Strength"}</td><td>${formatStress(sd.flexural_strength_pa)}</td></tr></tbody></table>`;
  }

  // Catch remaining scalar keys
  const known = new Set([
    "yield_strength_pa", "yield_strength_by_thickness_pa",
    "ultimate_tensile_strength_pa", "ultimate_tensile_strength_by_thickness_pa",
    "elongation_min_percent", "compressive_strength_pa", "flexural_strength_pa",
  ]);
  let extraRows = "";
  Object.entries(sd).forEach(([k, v]) => {
    if (!known.has(k) && v != null && typeof v !== "object") {
      const display = typeof v === "number" && k.includes("_pa") ? formatStress(v) : (typeof v === "number" ? v : esc(String(v)));
      extraRows += `<tr><td>${esc(k)}</td><td>${display}</td></tr>`;
    }
  });
  if (extraRows) {
    html += `<table class="detail-table"><tbody>${extraRows}</tbody></table>`;
  }

  html += `</div>`;
  return html;
}

function renderNonlinearModels(nl) {
  let html = `<div class="detail-section"><div class="detail-section-title">${lang === "ja" ? "非線形モデル" : "Nonlinear Models"}</div>`;

  Object.entries(nl).forEach(([modelName, model]) => {
    html += `<div class="detail-subsection">${esc(modelName)}${model.recommended ? " \u2605" : ""}</div>`;

    // Variants by thickness
    if (model.variants_by_thickness_mm) {
      html += `<table class="detail-table"><thead><tr><th>${lang === "ja" ? "板厚 (mm)" : "Thickness (mm)"}</th><th>${lang === "ja" ? "降伏応力" : "Yield Stress"}</th><th>H<sub>iso</sub></th><th>E<sub>t</sub></th></tr></thead><tbody>`;
      model.variants_by_thickness_mm.forEach((v) => {
        const t = v.thickness_mm;
        html += `<tr><td>${t[0]} - ${t[1]}</td><td>${formatStress(v.yield_stress_pa)}</td><td>${formatStress(v.isotropic_hardening_modulus_pa)}</td><td>${formatStress(v.tangent_modulus_pa)}</td></tr>`;
      });
      html += `</tbody></table>`;
    }

    // Simple scalar parameters
    const skip = new Set(["recommended", "material_model", "variants_by_thickness_mm", "notes", "source_ids"]);
    let paramRows = "";
    Object.entries(model).forEach(([k, v]) => {
      if (!skip.has(k) && v != null && typeof v !== "object") {
        const display = typeof v === "number" && k.includes("_pa") ? formatStress(v) : (typeof v === "number" ? v : esc(String(v)));
        paramRows += `<tr><td>${esc(k)}</td><td>${display}</td></tr>`;
      }
    });
    if (paramRows) {
      html += `<table class="detail-table"><tbody>${paramRows}</tbody></table>`;
    }

    // Notes
    if (model.notes && model.notes.length) {
      html += `<ul class="detail-notes">${model.notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>`;
    }
  });

  html += `</div>`;
  return html;
}

function renderSolverMapping(mapping, solverName) {
  let rows = "";
  Object.entries(mapping).forEach(([k, v]) => {
    if (v != null && typeof v !== "object") {
      rows += `<tr><td>${esc(k)}</td><td>${esc(String(v))}</td></tr>`;
    } else if (Array.isArray(v)) {
      rows += `<tr><td>${esc(k)}</td><td>${v.map((x) => esc(String(x))).join(", ")}</td></tr>`;
    }
  });
  if (!rows) return "";
  return `<div class="detail-section">
    <div class="detail-section-title">${esc(solverName)} Mapping</div>
    <table class="detail-table"><thead><tr><th>Parameter</th><th>Value</th></tr></thead>
    <tbody>${rows}</tbody></table>
  </div>`;
}

function renderKeyValueSection(obj, title) {
  if (!obj || typeof obj !== "object") return "";
  let rows = "";

  function flatten(o, prefix) {
    Object.entries(o).forEach(([k, v]) => {
      const key = prefix ? prefix + "." + k : k;
      if (v != null && typeof v === "object" && !Array.isArray(v)) {
        flatten(v, key);
      } else if (Array.isArray(v)) {
        rows += `<tr><td>${esc(key)}</td><td>${v.map((x) => typeof x === "object" ? JSON.stringify(x) : esc(String(x))).join(", ")}</td></tr>`;
      } else if (v != null) {
        const display = typeof v === "number" && (key.includes("_pa") || key.includes("modulus") || key.includes("strength"))
          ? formatStress(v) : (typeof v === "number" ? v : esc(String(v)));
        rows += `<tr><td>${esc(key)}</td><td>${display}</td></tr>`;
      }
    });
  }

  flatten(obj, "");
  if (!rows) return "";

  return `<div class="detail-section">
    <div class="detail-section-title">${esc(title)}</div>
    <table class="detail-table"><thead><tr><th>${lang === "ja" ? "特性" : "Property"}</th><th>${lang === "ja" ? "値" : "Value"}</th></tr></thead>
    <tbody>${rows}</tbody></table>
  </div>`;
}

/* ===== Theme Toggle ===== */
function initTheme() {
  const saved = localStorage.getItem("materials-db-theme");
  if (saved) {
    document.documentElement.setAttribute("data-theme", saved);
  } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
    document.documentElement.setAttribute("data-theme", "dark");
  }
  updateThemeIcon();
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme");
  const next = current === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("materials-db-theme", next);
  updateThemeIcon();
}

function updateThemeIcon() {
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  document.getElementById("themeIconSun").classList.toggle("hidden", isDark);
  document.getElementById("themeIconMoon").classList.toggle("hidden", !isDark);
}

/* ===== Language Toggle ===== */
function toggleLang() {
  lang = lang === "ja" ? "en" : "ja";
  document.getElementById("langLabel").textContent = lang === "ja" ? "EN" : "JA";
  document.getElementById("searchInput").placeholder =
    lang === "ja" ? "材料名で検索..." : "Search materials...";
  document.getElementById("categoryHeading").textContent =
    lang === "ja" ? "大分類" : "Category";
  document.getElementById("subcategoryHeading").textContent =
    lang === "ja" ? "中分類" : "Subcategory";
  buildFilters();
  renderMaterials();

  // Re-render detail if open
  const panel = document.getElementById("materialDetail");
  if (panel.classList.contains("open")) {
    const nameEl = panel.querySelector(".detail-name");
    if (nameEl) {
      const mat = allMaterials.find((m) => m.name === nameEl.textContent);
      if (mat) openDetail(mat);
    }
  }
}

/* ===== Mobile Sidebar ===== */
function initMobileSidebar() {
  const headerLeft = document.querySelector(".header-left");
  headerLeft.addEventListener("click", (e) => {
    if (window.innerWidth <= 768) {
      document.getElementById("sidebar").classList.toggle("open");
    }
  });
}

/* ===== Keyboard ===== */
function initKeyboard() {
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeDetail();
    if ((e.key === "/" || e.key === "f") && !e.ctrlKey && !e.metaKey) {
      const active = document.activeElement;
      if (active.tagName !== "INPUT" && active.tagName !== "TEXTAREA") {
        e.preventDefault();
        document.getElementById("searchInput").focus();
      }
    }
  });
}

/* ===== Init ===== */
async function init() {
  initTheme();
  initKeyboard();
  initMobileSidebar();

  document.getElementById("themeToggle").addEventListener("click", toggleTheme);
  document.getElementById("langToggle").addEventListener("click", toggleLang);

  // Search
  let debounce;
  document.getElementById("searchInput").addEventListener("input", (e) => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      searchQuery = e.target.value.trim();
      renderMaterials();
    }, 200);
  });

  // Load data
  const container = document.getElementById("materialList");
  container.innerHTML = `<div class="loading">${lang === "ja" ? "読み込み中" : "Loading"}</div>`;

  try {
    const res = await fetch("materials_db.json");
    dbData = await res.json();
    allMaterials = dbData.materials || [];
    buildFilters();
    renderMaterials();
  } catch (err) {
    container.innerHTML = `<div class="no-results">Failed to load data: ${esc(err.message)}</div>`;
  }
}

init();
