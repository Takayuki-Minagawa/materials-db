/* ===== Features Module ===== */
const Features = (() => {

  function finiteMinimum(...values) {
    const numbers = [];
    const collect = value => {
      if (typeof value === "number" && Number.isFinite(value)) {
        numbers.push(value);
      } else if (Array.isArray(value)) {
        value.forEach(collect);
      } else if (value && typeof value === "object") {
        Object.values(value).forEach(collect);
      }
    };
    values.forEach(collect);
    return numbers.length ? Math.min(...numbers) : null;
  }

  function getPrimaryYoungsModulus(m) {
    const p = m.properties || {};
    return p.linear_elastic?.youngs_modulus_pa ??
      p.orthotropic_elastic?.EX_pa ??
      p.orthotropic_elastic?.E1_pa ??
      p.orthotropic_elastic_partial?.EX_pa ??
      p.orthotropic_elastic_partial?.E1_pa ??
      null;
  }

  function getPrimaryDensity(m) {
    const p = m.properties || {};
    const full = p.orthotropic_elastic || {};
    const partial = p.orthotropic_elastic_partial || {};
    return p.linear_elastic?.density_kg_m3 ??
      full.reference_density_kg_m3_approx ??
      full.density_kg_m3 ??
      full.laminate_density_kg_m3 ??
      full.fiber_density_kg_m3 ??
      full.mean_density_kg_m3 ??
      partial.reference_density_kg_m3_approx ??
      partial.density_kg_m3 ??
      partial.laminate_density_kg_m3 ??
      partial.fiber_density_kg_m3 ??
      partial.mean_density_kg_m3 ??
      p.strength_data?.density_kg_m3 ??
      null;
  }

  function getPrimaryYieldStrength(m) {
    const s = m.properties?.strength_data || {};
    return finiteMinimum(s.yield_strength_pa) ??
      finiteMinimum(s.yield_strength_min_pa) ??
      finiteMinimum(s.yield_strength_range_pa) ??
      finiteMinimum((s.yield_strength_by_thickness_pa || []).map(entry => entry.value)) ??
      null;
  }

  function getPrimaryUltimateTensileStrength(m) {
    const s = m.properties?.strength_data || {};
    return finiteMinimum(s.ultimate_tensile_strength_pa) ??
      finiteMinimum(s.ultimate_tensile_strength_pa_min) ??
      finiteMinimum(s.ultimate_tensile_strength_min_pa) ??
      finiteMinimum(s.ultimate_tensile_strength_range_pa) ??
      finiteMinimum((s.ultimate_tensile_strength_by_thickness_pa || []).map(entry => entry.min ?? entry.value)) ??
      finiteMinimum(s.tensile_strength_min_pa) ??
      finiteMinimum(s.tensile_strength_pa) ??
      finiteMinimum(s.fiber_tensile_strength_pa) ??
      null;
  }

  function getPrimaryCompressiveStrength(m) {
    const s = m.properties?.strength_data || {};
    return finiteMinimum(s.compressive_strength_pa) ??
      finiteMinimum(s.compressive_strength_min_pa) ??
      finiteMinimum(s.uniaxial_compressive_strength_pa) ??
      finiteMinimum(s.specified_masonry_compressive_strength_pa) ??
      finiteMinimum(s.reference_unconfined_compressive_strength_pa) ??
      finiteMinimum(s.compressive_strength_nominal_pa) ??
      null;
  }

  /* -- Property Definitions (shared across features) -- */
  const PROPERTY_DEFS = [
    { key: "youngs_modulus", label: { ja: "ヤング率 (E)", en: "Young's Modulus (E)" }, unit: "stress",
      get: getPrimaryYoungsModulus },
    { key: "density", label: { ja: "密度 (ρ)", en: "Density (ρ)" }, unit: "density",
      get: getPrimaryDensity },
    { key: "yield_strength", label: { ja: "降伏強度 (σy)", en: "Yield Strength (σy)" }, unit: "stress",
      get: getPrimaryYieldStrength },
    { key: "uts", label: { ja: "引張強度 (σUTS)", en: "UTS (σUTS)" }, unit: "stress",
      get: getPrimaryUltimateTensileStrength },
    { key: "compressive", label: { ja: "圧縮強度", en: "Compressive Strength" }, unit: "stress",
      get: getPrimaryCompressiveStrength },
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
  function mappingNotice(mapping, handledKeys, prefix) {
    const unhandled = Object.keys(mapping || {}).filter(key => !handledKeys.has(key));
    return unhandled.length
      ? `${prefix} WARNING: Reference/partial mapping section(s) not emitted as executable commands: ${unhandled.join(", ")}\n`
      : "";
  }

  function referenceOnlyCard(material, solver, mapping, prefix) {
    const name = material.name || material.id;
    const body = JSON.stringify(mapping, null, 2)
      .split("\n")
      .map(line => `${prefix} ${line}`)
      .join("\n");
    return `${prefix} Material: ${name}\n${prefix} ID: ${material.id}\n${prefix} REFERENCE/PARTIAL MAPPING ONLY\n${prefix} No runnable ${SOLVER_LABELS[solver] || solver} card was generated. Complete and validate the required parameters first.\n${body}\n`;
  }

  function getSolverMappingStatus(material, solver) {
    const mapping = material.other?.[`${solver}_mapping`];
    if (!mapping) return "none";
    const keys = Object.keys(mapping);
    const oe = material.properties?.orthotropic_elastic || material.properties?.orthotropic_elastic_partial;
    const hasDeclaredGap = keys.some(key => /partial|reference|variants/i.test(key)) ||
      (Array.isArray(oe?.missing_parameters) && oe.missing_parameters.length > 0);
    if (hasDeclaredGap) return "partial";

    const runnableKeys = {
      ansys: new Set(["linear_mp", "tb_biso", "orthotropic_mp"]),
      abaqus: new Set(["elastic", "plastic", "plastic_table", "engineering_constants"]),
      dolfinx: new Set(["linear_elastic", "small_strain_j2", "orthotropic_linear_elastic"]),
      lsdyna: new Set(),
    };
    return keys.some(key => runnableKeys[solver]?.has(key)) ? "runnable" : "reference";
  }

  function generateSolverCard(material, solver) {
    const le = material.properties?.linear_elastic;
    const oe = material.properties?.orthotropic_elastic || material.properties?.orthotropic_elastic_partial;
    const name = material.name || material.id;
    const mapping = material.other?.[`${solver}_mapping`] || {};

    if (!le && oe) {
      return generateOrthotropicCard(oe, name, material.id, solver, mapping);
    }

    const props = le || {};
    const E = props.youngs_modulus_pa ?? null;
    const nu = props.poissons_ratio ?? null;
    const rho = props.density_kg_m3 ?? null;
    const G = props.shear_modulus_pa;
    const missing = [
      E == null ? "youngs_modulus_pa" : null,
      nu == null ? "poissons_ratio" : null,
      rho == null ? "density_kg_m3" : null,
    ].filter(Boolean);

    switch (solver) {
      case "ansys": {
        let c = `! Material: ${name}\n! ID: ${material.id}\n`;
        if (missing.length) c += `! WARNING: Incomplete linear data: ${missing.join(", ")}\n`;
        if (E != null) c += `MP,EX,1,${E}\n`;
        if (nu != null) c += `MP,PRXY,1,${nu}\n`;
        if (rho != null) c += `MP,DENS,1,${rho}\n`;
        if (G != null) c += `MP,GXY,1,${G}\n`;
        if (mapping.tb_biso) {
          const yieldStress = mapping.tb_biso.yield_stress_pa;
          const tangentModulus = mapping.tb_biso.tangent_modulus_pa;
          if (yieldStress != null && tangentModulus != null) {
            c += `TB,BISO,1,1,2\nTBDATA,1,${yieldStress},${tangentModulus}\n`;
          } else {
            c += "! WARNING: TB,BISO was not emitted because yield stress or tangent modulus is missing.\n";
          }
        }
        c += mappingNotice(mapping, new Set(["linear_mp", "tb_biso"]), "!");
        return c;
      }
      case "abaqus": {
        let c = `** Material: ${name}\n** ID: ${material.id}\n*MATERIAL, NAME=${material.id.toUpperCase()}\n`;
        if (E != null && nu != null) {
          c += `*ELASTIC\n${E}, ${nu}\n`;
        } else {
          c += `** WARNING: *ELASTIC not emitted; missing ${[E == null ? "youngs_modulus_pa" : null, nu == null ? "poissons_ratio" : null].filter(Boolean).join(", ")}\n`;
        }
        if (rho != null) c += `*DENSITY\n${rho},\n`;
        else c += "** WARNING: *DENSITY not emitted; density_kg_m3 is missing.\n";

        const plasticRows = Array.isArray(mapping.plastic_table)
          ? mapping.plastic_table
          : mapping.plastic && typeof mapping.plastic === "object"
            ? [mapping.plastic]
            : [];
        const validPlasticRows = plasticRows.filter(row =>
          (row?.stress_pa != null || row?.yield_stress_pa != null) &&
          row?.plastic_strain != null
        );
        if (validPlasticRows.length) {
          c += "*PLASTIC\n";
          for (const row of validPlasticRows) {
            c += `${row.stress_pa ?? row.yield_stress_pa}, ${row.plastic_strain}\n`;
          }
        }
        if (plasticRows.length !== validPlasticRows.length) {
          c += "** WARNING: Incomplete *PLASTIC row(s) were not emitted; stress and plastic_strain are both required.\n";
        }
        c += mappingNotice(mapping, new Set(["elastic", "plastic", "plastic_table"]), "**");
        return c;
      }
      case "lsdyna": {
        return referenceOnlyCard(material, solver, mapping, "$");
      }
      case "dolfinx": {
        let c = `# Material: ${name}\n# ID: ${material.id}\n`;
        if (missing.length) c += `# WARNING: Incomplete linear data: ${missing.join(", ")}\n`;
        if (E != null) c += `E = ${E}  # Young's Modulus [Pa]\n`;
        if (nu != null) c += `nu = ${nu}  # Poisson's Ratio\n`;
        if (rho != null) c += `rho = ${rho}  # Density [kg/m³]\n`;
        if (E != null && nu != null) {
          c += "mu = E / (2 * (1 + nu))  # Shear Modulus\n";
          c += "lmbda = E * nu / ((1 + nu) * (1 - 2 * nu))  # Lamé parameter\n";
        }
        if (mapping.small_strain_j2) {
          const j2 = mapping.small_strain_j2;
          if (j2.sigma_y_pa != null) c += `sigma_y = ${j2.sigma_y_pa}  # J2 yield stress [Pa]\n`;
          if (j2.H_iso_pa != null) c += `H_iso = ${j2.H_iso_pa}  # Isotropic hardening modulus [Pa]\n`;
          c += "# Implement the return-mapping constitutive update in the selected DOLFINx/UFL formulation.\n";
        }
        c += mappingNotice(mapping, new Set(["linear_elastic", "small_strain_j2"]), "#");
        return c;
      }
      default: return JSON.stringify(mapping, null, 2);
    }
  }

  function generateOrthotropicCard(oe, name, id, solver, mapping) {
    const EX = oe.EX_pa ?? oe.E1_pa ?? null;
    const EY = oe.EY_pa ?? oe.E2_pa ?? null;
    const EZ = oe.EZ_pa ?? oe.E3_pa ?? null;
    const GXY = oe.GXY_pa ?? oe.G12_pa ?? null;
    const GYZ = oe.GYZ_pa ?? oe.G23_pa ?? null;
    const GXZ = oe.GXZ_pa ?? oe.G13_pa ?? null;
    const nuXY = oe.PRXY ?? oe.nu12 ?? null;
    const nuYZ = oe.PRYZ ?? oe.nu23 ?? null;
    const nuXZ = oe.PRXZ ?? oe.nu13 ?? null;
    const rho = oe.reference_density_kg_m3_approx ??
      oe.density_kg_m3 ??
      oe.laminate_density_kg_m3 ??
      oe.fiber_density_kg_m3 ??
      oe.mean_density_kg_m3 ??
      null;
    const inferredMissing = (oe.missing_parameters?.length ? [] : [
      EX == null ? "E1/EX" : null,
      EY == null ? "E2/EY" : null,
      EZ == null ? "E3/EZ" : null,
      nuXY == null ? "nu12/PRXY" : null,
      nuXZ == null ? "nu13/PRXZ" : null,
      nuYZ == null ? "nu23/PRYZ" : null,
      GXY == null ? "G12/GXY" : null,
      GXZ == null ? "G13/GXZ" : null,
      GYZ == null ? "G23/GYZ" : null,
    ]).filter(Boolean);
    const missing = [...new Set([...(oe.missing_parameters || []), ...inferredMissing])];
    const isPartial = missing.length > 0;

    switch (solver) {
      case "ansys": {
        let c = `! Material: ${name}\n! ID: ${id}\n! Orthotropic\n`;
        if (isPartial) c += `! WARNING: Incomplete data – missing: ${missing.join(", ")}\n`;
        if (EX != null) c += `MP,EX,1,${EX}\n`;
        if (EY != null) c += `MP,EY,1,${EY}\n`;
        if (EZ != null) c += `MP,EZ,1,${EZ}\n`;
        if (nuXY != null) c += `MP,PRXY,1,${nuXY}\n`;
        if (nuYZ != null) c += `MP,PRYZ,1,${nuYZ}\n`;
        if (nuXZ != null) c += `MP,PRXZ,1,${nuXZ}\n`;
        if (GXY != null) c += `MP,GXY,1,${GXY}\n`;
        if (GYZ != null) c += `MP,GYZ,1,${GYZ}\n`;
        if (GXZ != null) c += `MP,GXZ,1,${GXZ}\n`;
        if (rho != null) c += `MP,DENS,1,${rho}\n`;
        c += mappingNotice(
          mapping,
          new Set(["orthotropic_mp"]),
          "!",
        );
        return c;
      }
      case "abaqus": {
        if (isPartial) {
          let c = `** Material: ${name}\n** ID: ${id}\n** Orthotropic (partial data)\n** WARNING: Incomplete data – missing: ${missing.join(", ")}\n`;
          c += `*MATERIAL, NAME=${id.toUpperCase()}\n`;
          if (EX != null) c += `**   E1 = ${EX}\n`;
          if (EY != null) c += `**   E2 = ${EY}\n`;
          if (EZ != null) c += `**   E3 = ${EZ}\n`;
          if (nuXY != null) c += `**   Nu12 = ${nuXY}\n`;
          if (nuXZ != null) c += `**   Nu13 = ${nuXZ}\n`;
          if (nuYZ != null) c += `**   Nu23 = ${nuYZ}\n`;
          if (GXY != null) c += `**   G12 = ${GXY}\n`;
          if (GXZ != null) c += `**   G13 = ${GXZ}\n`;
          if (GYZ != null) c += `**   G23 = ${GYZ}\n`;
          if (rho != null) c += `*DENSITY\n${rho},\n`;
          c += mappingNotice(
            mapping,
            new Set(["engineering_constants"]),
            "**",
          );
          return c;
        }
        let c = `** Material: ${name}\n** ID: ${id}\n** Orthotropic\n*MATERIAL, NAME=${id.toUpperCase()}\n*ELASTIC, TYPE=ENGINEERING CONSTANTS\n${EX}, ${EY}, ${EZ}, ${nuXY}, ${nuXZ}, ${nuYZ}, ${GXY}, ${GXZ}\n${GYZ},\n`;
        if (rho != null) c += `*DENSITY\n${rho},\n`;
        else c += "** WARNING: *DENSITY not emitted; density is missing.\n";
        c += mappingNotice(
          mapping,
          new Set(["engineering_constants"]),
          "**",
        );
        return c;
      }
      case "lsdyna": {
        if (isPartial || rho == null) {
          let c = `$ Material: ${name}\n$ ID: ${id}\n$ Orthotropic (partial data)\n$ WARNING: Incomplete data – missing: ${missing.join(", ")}\n`;
          if (EX != null) c += `$   EA = ${EX}\n`;
          if (EY != null) c += `$   EB = ${EY}\n`;
          if (EZ != null) c += `$   EC = ${EZ}\n`;
          if (nuXY != null) c += `$   PRBA = ${nuXY}\n`;
          if (nuXZ != null) c += `$   PRCA = ${nuXZ}\n`;
          if (nuYZ != null) c += `$   PRCB = ${nuYZ}\n`;
          if (GXY != null) c += `$   GAB = ${GXY}\n`;
          if (GYZ != null) c += `$   GBC = ${GYZ}\n`;
          if (GXZ != null) c += `$   GCA = ${GXZ}\n`;
          if (rho != null) c += `$   RO = ${rho}\n`;
          c += mappingNotice(mapping, new Set(["mat_orthotropic_elastic"]), "$");
          return c;
        }
        let c = `$ Material: ${name}\n$ ID: ${id}\n$ Orthotropic\n*MAT_ORTHOTROPIC_ELASTIC\n$      MID        RO        EA        EB        EC      PRBA      PRCA      PRCB\n         1  ${rho}  ${EX}  ${EY}  ${EZ}  ${nuXY}  ${nuXZ}  ${nuYZ}\n$      GAB       GBC       GCA\n  ${GXY}  ${GYZ}  ${GXZ}\n`;
        c += mappingNotice(mapping, new Set(["mat_orthotropic_elastic"]), "$");
        return c;
      }
      case "dolfinx": {
        let c = `# Material: ${name}\n# ID: ${id}\n# Orthotropic\n`;
        if (isPartial) c += `# WARNING: Incomplete data – missing: ${missing.join(", ")}\n`;
        if (EX != null) c += `EX = ${EX}  # Young's Modulus X [Pa]\n`;
        if (EY != null) c += `EY = ${EY}  # Young's Modulus Y [Pa]\n`;
        if (EZ != null) c += `EZ = ${EZ}  # Young's Modulus Z [Pa]\n`;
        if (nuXY != null) c += `nu_xy = ${nuXY}  # Poisson's Ratio XY\n`;
        if (nuYZ != null) c += `nu_yz = ${nuYZ}  # Poisson's Ratio YZ\n`;
        if (nuXZ != null) c += `nu_xz = ${nuXZ}  # Poisson's Ratio XZ\n`;
        if (GXY != null) c += `G_xy = ${GXY}  # Shear Modulus XY [Pa]\n`;
        if (GYZ != null) c += `G_yz = ${GYZ}  # Shear Modulus YZ [Pa]\n`;
        if (GXZ != null) c += `G_xz = ${GXZ}  # Shear Modulus XZ [Pa]\n`;
        if (rho != null) c += `rho = ${rho}  # Density [kg/m³]\n`;
        c += mappingNotice(mapping, new Set(["orthotropic_linear_elastic"]), "#");
        return c;
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

  const STRICT_DECIMAL_PATTERN = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

  function parseStrictFiniteNumber(value) {
    if (typeof value !== "string") return null;
    const text = value.trim();
    if (!STRICT_DECIMAL_PATTERN.test(text)) return null;
    const number = Number(text);
    return Number.isFinite(number) ? number : null;
  }

  function parseRangeFilters(params, allowedKeys) {
    const allowed = new Set(allowedKeys);
    const filters = Object.create(null);

    for (const [paramKey, rawValue] of params.entries()) {
      const match = /^r_([a-z0-9_]+)_(min|max)$/.exec(paramKey);
      if (!match) continue;

      const [, propertyKey, bound] = match;
      if (!allowed.has(propertyKey)) continue;

      const value = parseStrictFiniteNumber(rawValue);
      if (value == null) continue;

      if (!Object.hasOwn(filters, propertyKey)) {
        filters[propertyKey] = Object.create(null);
      }
      filters[propertyKey][bound] = value;
    }

    return filters;
  }

  function appendRangeFilters(params, rangeFilters, allowedKeys) {
    for (const propertyKey of allowedKeys) {
      const range = rangeFilters?.[propertyKey];
      if (!range || typeof range !== "object") continue;

      for (const bound of ["min", "max"]) {
        const value = range[bound];
        if (typeof value === "number" && Number.isFinite(value)) {
          params.set(`r_${propertyKey}_${bound}`, String(value));
        }
      }
    }
  }

  function materialHasSolver(material, solverKey) {
    return !!material.other?.[`${solverKey}_mapping`];
  }

  return {
    PROPERTY_DEFS, SOLVER_KEYS, SOLVER_LABELS,
    getPrimaryYoungsModulus, getPrimaryDensity, getPrimaryYieldStrength,
    getPrimaryUltimateTensileStrength, getPrimaryCompressiveStrength,
    formatStressWithUnit, formatDensityWithUnit,
    findSimilarMaterials, computeCategoryStats,
    buildCSV, downloadFile, generateSolverCard,
    getPropertyRange, materialsMatchRangeFilters,
    parseStrictFiniteNumber, parseRangeFilters, appendRangeFilters, materialHasSolver,
    getSolverMappingStatus,
  };
})();
