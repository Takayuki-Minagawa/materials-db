/* ===== Features Module ===== */
const Features = (() => {

  /* -- Property Definitions (shared across features) -- */
  const PROPERTY_DEFS = [
    { key: "youngs_modulus", label: { ja: "ヤング率 (E)", en: "Young's Modulus (E)" }, unit: "stress",
      get: m => m.properties?.linear_elastic?.youngs_modulus_pa ?? m.properties?.orthotropic_elastic?.E_x_pa ?? m.properties?.orthotropic_elastic_partial?.E_x_pa ?? null },
    { key: "density", label: { ja: "密度 (ρ)", en: "Density (ρ)" }, unit: "density",
      get: m => m.properties?.linear_elastic?.density_kg_m3 ?? m.properties?.orthotropic_elastic?.density_kg_m3 ?? m.properties?.orthotropic_elastic_partial?.density_kg_m3 ?? null },
    { key: "yield_strength", label: { ja: "降伏強度 (σy)", en: "Yield Strength (σy)" }, unit: "stress",
      get: m => { const s = m.properties?.strength_data; if (!s) return null; if (s.yield_strength_pa != null) return s.yield_strength_pa; if (Array.isArray(s.yield_strength_by_thickness_pa)) return s.yield_strength_by_thickness_pa.reduce((mx, e) => e.value != null ? (mx == null ? e.value : Math.max(mx, e.value)) : mx, null); return null; } },
    { key: "uts", label: { ja: "引張強度 (σUTS)", en: "UTS (σUTS)" }, unit: "stress",
      get: m => m.properties?.strength_data?.ultimate_tensile_strength_pa ?? null },
    { key: "compressive", label: { ja: "圧縮強度", en: "Compressive Strength" }, unit: "stress",
      get: m => m.properties?.strength_data?.compressive_strength_pa ?? null },
    { key: "poissons_ratio", label: { ja: "ポアソン比 (ν)", en: "Poisson's Ratio (ν)" }, unit: "none",
      get: m => m.properties?.linear_elastic?.poissons_ratio ?? null },
    { key: "shear_modulus", label: { ja: "せん断弾性率 (G)", en: "Shear Modulus (G)" }, unit: "stress",
      get: m => m.properties?.linear_elastic?.shear_modulus_pa ?? null },
    { key: "bulk_modulus", label: { ja: "体積弾性率 (K)", en: "Bulk Modulus (K)" }, unit: "stress",
      get: m => m.properties?.linear_elastic?.bulk_modulus_pa ?? null },
  ];

  const SOLVER_KEYS = ["ansys", "abaqus", "dolfinx", "lsdyna"];
  const SOLVER_LABELS = { ansys: "ANSYS", abaqus: "Abaqus", dolfinx: "DOLFINx", lsdyna: "LS-DYNA" };

  /* -- Unit Conversion -- */
  function formatStressWithUnit(value, us) {
    if (value == null) return "-";
    if (us === "imperial") {
      const psi = value * 0.000145038;
      if (Math.abs(psi) >= 1e6) return `${(psi / 1e6).toFixed(1)} Mpsi`;
      if (Math.abs(psi) >= 1e3) return `${(psi / 1e3).toFixed(1)} ksi`;
      return `${psi.toFixed(1)} psi`;
    }
    if (Math.abs(value) >= 1e9) return `${(value / 1e9).toFixed(1)} GPa`;
    if (Math.abs(value) >= 1e6) return `${(value / 1e6).toFixed(1)} MPa`;
    if (Math.abs(value) >= 1e3) return `${(value / 1e3).toFixed(1)} kPa`;
    return `${value.toFixed(2)} Pa`;
  }

  function formatDensityWithUnit(value, us) {
    if (value == null) return "-";
    if (us === "imperial") return `${(value * 0.062428).toFixed(2)} lb/ft³`;
    return `${value.toLocaleString()} kg/m³`;
  }

  /* -- Similar Materials -- */
  function findSimilarMaterials(target, allMaterials, topN = 5) {
    const keys = ["youngs_modulus", "density", "yield_strength", "poissons_ratio"];
    const getters = {};
    for (const k of keys) { const def = PROPERTY_DEFS.find(d => d.key === k); if (def) getters[k] = def.get; }

    // Gather global ranges
    const ranges = {};
    for (const k of keys) ranges[k] = [];
    for (const m of allMaterials) { for (const k of keys) { const v = getters[k]?.(m); if (v != null && isFinite(v)) ranges[k].push(v); } }
    const norms = {};
    for (const k of keys) {
      const vs = ranges[k];
      norms[k] = vs.length > 1 ? { min: Math.min(...vs), max: Math.max(...vs) } : null;
    }
    const norm = (v, k) => { if (v == null || !norms[k]) return null; const { min, max } = norms[k]; return max === min ? 0 : (v - min) / (max - min); };

    const tProps = {}; for (const k of keys) tProps[k] = norm(getters[k]?.(target), k);

    const scores = [];
    for (const m of allMaterials) {
      if (m.id === target.id) continue;
      let sumSq = 0, dims = 0;
      for (const k of keys) {
        const a = tProps[k], b = norm(getters[k]?.(m), k);
        if (a != null && b != null) { sumSq += (a - b) ** 2; dims++; }
      }
      if (dims === 0) continue;
      scores.push({ material: m, distance: Math.sqrt(sumSq / dims) });
    }
    scores.sort((a, b) => a.distance - b.distance);
    return scores.slice(0, topN);
  }

  /* -- Category Statistics -- */
  function computeCategoryStats(materials) {
    const stats = {};
    for (const m of materials) {
      const cat = m.classification?.category_en || "Other";
      if (!stats[cat]) stats[cat] = { count: 0, E: [], density: [], yield: [] };
      stats[cat].count++;
      const defs = { E: "youngs_modulus", density: "density", yield: "yield_strength" };
      for (const [k, dk] of Object.entries(defs)) {
        const def = PROPERTY_DEFS.find(d => d.key === dk);
        const v = def?.get(m);
        if (v != null && isFinite(v)) stats[cat][k].push(v);
      }
    }
    for (const cat of Object.keys(stats)) {
      for (const prop of ["E", "density", "yield"]) {
        const vs = stats[cat][prop];
        if (vs.length) {
          stats[cat][`${prop}_avg`] = vs.reduce((a, b) => a + b, 0) / vs.length;
          stats[cat][`${prop}_min`] = Math.min(...vs);
          stats[cat][`${prop}_max`] = Math.max(...vs);
          stats[cat][`${prop}_count`] = vs.length;
        }
      }
    }
    return stats;
  }

  /* -- CSV Export -- */
  function buildCSV(materials) {
    const headers = ["ID","Name","Category","Subcategory","Condition","Youngs_Modulus_Pa","Poissons_Ratio","Density_kg_m3","Yield_Strength_Pa","UTS_Pa","Compressive_Strength_Pa","Shear_Modulus_Pa","Bulk_Modulus_Pa","Validation_Tier"];
    const rows = materials.map(m => {
      const g = k => { const d = PROPERTY_DEFS.find(p => p.key === k); return d ? (d.get(m) ?? "") : ""; };
      return [m.id, m.name, m.classification?.category_en || "", m.classification?.subcategory_en || "", m.other?.condition || "",
        g("youngs_modulus"), m.properties?.linear_elastic?.poissons_ratio ?? "", g("density"), g("yield_strength"),
        g("uts"), g("compressive"), g("shear_modulus"), g("bulk_modulus"), m.other?.validation_tier || ""];
    });
    return [headers, ...rows].map(row => row.map(c => { const s = String(c); return /[,"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(",")).join("\n");
  }

  function downloadFile(content, filename, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /* -- Solver Card Generation -- */
  function generateSolverCard(material, solver) {
    const le = material.properties?.linear_elastic || {};
    const name = material.name || material.id;
    const E = le.youngs_modulus_pa || 0, nu = le.poissons_ratio || 0, rho = le.density_kg_m3 || 0;
    const G = le.shear_modulus_pa;
    const mapping = material.other?.[`${solver}_mapping`] || {};

    switch (solver) {
      case "ansys": {
        let c = `! Material: ${name}\n! ID: ${material.id}\nMP,EX,1,${E}\nMP,PRXY,1,${nu}\nMP,DENS,1,${rho}\n`;
        if (G) c += `MP,GXY,1,${G}\n`;
        if (mapping.tb_biso) c += `TB,BISO,1,1,2\nTBDATA,1,${mapping.tb_biso.yield_stress_pa || 0},${mapping.tb_biso.tangent_modulus_pa || 0}\n`;
        return c;
      }
      case "abaqus": {
        let c = `** Material: ${name}\n** ID: ${material.id}\n*MATERIAL, NAME=${material.id.toUpperCase()}\n*ELASTIC\n${E}, ${nu}\n*DENSITY\n${rho},\n`;
        if (mapping.plastic_table) { c += `*PLASTIC\n`; for (const r of mapping.plastic_table) c += `${r.stress_pa || 0}, ${r.plastic_strain || 0}\n`; }
        return c;
      }
      case "lsdyna": {
        return `$ Material: ${name}\n$ ID: ${material.id}\n*MAT_ELASTIC\n$      MID        RO         E        PR\n         1  ${rho}  ${E}  ${nu}\n`;
      }
      case "dolfinx": {
        return `# Material: ${name}\n# ID: ${material.id}\nE = ${E}  # Young's Modulus [Pa]\nnu = ${nu}  # Poisson's Ratio\nrho = ${rho}  # Density [kg/m³]\nmu = E / (2 * (1 + nu))  # Shear Modulus\nlmbda = E * nu / ((1 + nu) * (1 - 2 * nu))  # Lamé parameter\n`;
      }
      default: return JSON.stringify(mapping, null, 2);
    }
  }

  /* -- Range Filter Helpers -- */
  function getPropertyRange(materials, propKey) {
    const def = PROPERTY_DEFS.find(d => d.key === propKey);
    if (!def) return null;
    let min = Infinity, max = -Infinity, cnt = 0;
    for (const m of materials) { const v = def.get(m); if (v != null && isFinite(v)) { if (v < min) min = v; if (v > max) max = v; cnt++; } }
    return cnt > 0 ? { min, max } : null;
  }

  function materialsMatchRangeFilters(material, rangeFilters) {
    for (const [key, range] of Object.entries(rangeFilters)) {
      if (!range || (range.min == null && range.max == null)) continue;
      const def = PROPERTY_DEFS.find(d => d.key === key);
      if (!def) continue;
      const v = def.get(material);
      if (v == null) return false;
      if (range.min != null && v < range.min) return false;
      if (range.max != null && v > range.max) return false;
    }
    return true;
  }

  function materialHasSolver(material, solverKey) {
    return !!material.other?.[`${solverKey}_mapping`];
  }

  return {
    PROPERTY_DEFS, SOLVER_KEYS, SOLVER_LABELS,
    formatStressWithUnit, formatDensityWithUnit,
    findSimilarMaterials, computeCategoryStats,
    buildCSV, downloadFile, generateSolverCard,
    getPropertyRange, materialsMatchRangeFilters, materialHasSolver,
  };
})();
