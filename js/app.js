/* ===== State ===== */
let allMaterials = [];
let dbData = null;
let lang = "ja";
let selectedCategory = null;
let selectedSubcategory = null;
let searchQuery = "";
let sortKey = "name_asc";
let activeCollection = "all";
let selectedMaterialId = null;
let compareIds = [];
let favoriteIds = new Set();
let recentIds = [];
let comparePanelOpen = false;
let toastTimer = null;
let searchDebounce = null;

const MAX_COMPARE_ITEMS = 4;
const MAX_RECENT_ITEMS = 12;

const STORAGE_KEYS = {
  theme: "materials-db-theme",
  favorites: "materials-db-favorites",
  recent: "materials-db-recent",
};

const uiText = {
  pageTitle: {
    ja: "構造材料特性データベース",
    en: "Structural Materials Properties Database",
  },
  searchPlaceholder: {
    ja: "材料名・ID・カテゴリで検索...",
    en: "Search by name, id, or category...",
  },
  categoryHeading: { ja: "大分類", en: "Category" },
  subcategoryHeading: { ja: "中分類", en: "Subcategory" },
  collectionHeading: { ja: "コレクション", en: "Collections" },
  collectionAll: { ja: "すべて", en: "All" },
  collectionFavorites: { ja: "お気に入り", en: "Favorites" },
  collectionRecent: { ja: "最近見た材料", en: "Recently Viewed" },
  sortLabel: { ja: "並び替え", en: "Sort" },
  shareView: { ja: "表示を共有", en: "Share View" },
  compare: { ja: "比較", en: "Compare" },
  compareTrayTitle: { ja: "比較候補", en: "Compare Queue" },
  openCompare: { ja: "比較表示", en: "Open Compare" },
  clear: { ja: "クリア", en: "Clear" },
  close: { ja: "閉じる", en: "Close" },
  materialsUnit: { ja: "件", en: "materials" },
  noResults: {
    ja: "該当する材料がありません",
    en: "No materials found",
  },
  noFavorites: {
    ja: "お気に入りに追加された材料はありません",
    en: "No favorite materials yet",
  },
  noRecent: {
    ja: "最近閲覧した材料はありません",
    en: "No recently viewed materials yet",
  },
  selectCategory: {
    ja: "大分類を選択",
    en: "Select a category",
  },
  favorite: { ja: "お気に入りに追加", en: "Add Favorite" },
  unfavorite: { ja: "お気に入り解除", en: "Remove Favorite" },
  addToCompare: { ja: "比較に追加", en: "Add to Compare" },
  removeFromCompare: { ja: "比較から外す", en: "Remove from Compare" },
  detailCopyLink: { ja: "リンクをコピー", en: "Copy Link" },
  detailCopyJson: { ja: "JSON をコピー", en: "Copy JSON" },
  detailCopySources: { ja: "出典をコピー", en: "Copy Sources" },
  copiedViewLink: {
    ja: "現在の表示 URL をコピーしました",
    en: "Copied the current view URL",
  },
  copiedMaterialLink: {
    ja: "材料の直リンクをコピーしました",
    en: "Copied the material deep link",
  },
  copiedMaterialJson: {
    ja: "材料 JSON をコピーしました",
    en: "Copied the material JSON",
  },
  copiedSources: {
    ja: "出典一覧をコピーしました",
    en: "Copied the source list",
  },
  compareLimit: {
    ja: "比較対象は 4 件までです",
    en: "You can compare up to 4 materials",
  },
  compareNeedMore: {
    ja: "比較表示には 2 件以上を選択してください",
    en: "Select at least 2 materials to compare",
  },
  compareTitle: { ja: "材料比較", en: "Material Compare" },
  compareSubtitle: {
    ja: "主要物性と参照情報を横並びで確認できます",
    en: "Review key properties and references side by side",
  },
  propertyLabel: { ja: "特性", en: "Property" },
  valueLabel: { ja: "値", en: "Value" },
  compareSectionIdentity: { ja: "基本情報", en: "Identity" },
  compareSectionElastic: { ja: "弾性特性", en: "Elastic Properties" },
  compareSectionStrength: { ja: "強度", en: "Strength" },
  compareSectionModels: { ja: "モデル", en: "Models" },
  compareSectionReferences: { ja: "参照情報", en: "References" },
  compareId: { ja: "ID", en: "ID" },
  compareCategory: { ja: "大分類", en: "Category" },
  compareSubcategory: { ja: "中分類", en: "Subcategory" },
  compareCondition: { ja: "条件", en: "Condition" },
  compareValidation: { ja: "Validation Tier", en: "Validation Tier" },
  compareProductForm: { ja: "製品形態", en: "Product Form" },
  compareYoungs: { ja: "代表 E", en: "Primary E" },
  comparePoisson: { ja: "ポアソン比", en: "Poisson's Ratio" },
  compareDensity: { ja: "密度", en: "Density" },
  compareShear: { ja: "せん断弾性率", en: "Shear Modulus" },
  compareBulk: { ja: "体積弾性率", en: "Bulk Modulus" },
  compareYield: { ja: "降伏強度", en: "Yield Strength" },
  compareUltimate: { ja: "引張強度", en: "Ultimate Tensile Strength" },
  compareCompressive: { ja: "圧縮強度", en: "Compressive Strength" },
  compareFlexural: { ja: "曲げ強度", en: "Flexural Strength" },
  compareElongation: { ja: "伸び", en: "Elongation" },
  compareNonlinear: { ja: "非線形モデル", en: "Nonlinear Models" },
  compareMappings: { ja: "ソルバーマッピング", en: "Solver Mappings" },
  compareSources: { ja: "出典数", en: "Sources" },
  themeTitle: { ja: "ダークモード切替", en: "Toggle dark mode" },
  langTitle: { ja: "表示言語切替", en: "Switch language" },
};

const sortOptions = [
  { value: "name_asc", label: { ja: "名称順", en: "Name A-Z" } },
  { value: "name_desc", label: { ja: "名称逆順", en: "Name Z-A" } },
  { value: "category_name", label: { ja: "分類順", en: "Category" } },
  { value: "youngs_desc", label: { ja: "代表 E が高い順", en: "Highest E" } },
  { value: "density_desc", label: { ja: "密度が高い順", en: "Highest Density" } },
  { value: "yield_desc", label: { ja: "降伏強度が高い順", en: "Highest Yield" } },
  { value: "recent_desc", label: { ja: "最近閲覧順", en: "Recently Viewed" } },
];

const catClassMap = {
  Metal: "cat-metal",
  Polymer: "cat-polymer",
  Elastomer: "cat-elastomer",
  Wood: "cat-wood",
  Composite: "cat-composite",
  Adhesive: "cat-adhesive",
  Ceramics: "cat-ceramics",
  Foam: "cat-foam",
  Glass: "cat-glass",
  "Concrete and Grout": "cat-concrete",
  Soil: "cat-soil",
};

/* ===== Helpers ===== */
function t(key) {
  return uiText[key] ? uiText[key][lang] : key;
}

function catClass(catEn) {
  return catClassMap[catEn] || "";
}

function catLabel(material) {
  const classification = material.classification || {};
  return lang === "ja"
    ? classification.category_ja || classification.category_en || ""
    : classification.category_en || "";
}

function subcatLabel(material) {
  const classification = material.classification || {};
  return lang === "ja"
    ? classification.subcategory_ja || classification.subcategory_en || ""
    : classification.subcategory_en || "";
}

function formatStress(value) {
  if (value == null) return "-";
  if (Math.abs(value) >= 1e9) return `${(value / 1e9).toFixed(1)} GPa`;
  if (Math.abs(value) >= 1e6) return `${(value / 1e6).toFixed(1)} MPa`;
  if (Math.abs(value) >= 1e3) return `${(value / 1e3).toFixed(1)} kPa`;
  return `${value.toFixed(2)} Pa`;
}

function formatDensity(value) {
  if (value == null) return "-";
  return `${value.toLocaleString()} kg/m\u00B3`;
}

function esc(value) {
  const div = document.createElement("div");
  div.textContent = value == null ? "" : String(value);
  return div.innerHTML;
}

function formatScalarValue(key, value) {
  if (value == null) return "-";
  if (typeof value === "number") {
    if (key.includes("_pa") || key.includes("modulus") || key.includes("strength")) {
      return formatStress(value);
    }
    if (key.includes("_kg_m3") || key.includes("density")) {
      return formatDensity(value);
    }
    return String(value);
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  return esc(value);
}

function formatComplexValue(value, key) {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (Array.isArray(item)) return esc(item.join(" - "));
        if (item && typeof item === "object") return esc(JSON.stringify(item));
        return formatScalarValue(key, item);
      })
      .join(", ");
  }
  if (value && typeof value === "object") return esc(JSON.stringify(value));
  return formatScalarValue(key, value);
}

function compareStrings(a, b) {
  return String(a || "").localeCompare(String(b || ""), lang === "ja" ? "ja" : "en", {
    sensitivity: "base",
  });
}

function uniqueValidIds(ids) {
  const validIds = new Set(allMaterials.map((material) => material.id));
  const seen = new Set();
  return ids.filter((id) => {
    if (!validIds.has(id) || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function getMaterialById(id) {
  return allMaterials.find((material) => material.id === id) || null;
}

function getMaterialSourceEntries(material) {
  const rawSources = material.sources;
  const sourceCatalog = dbData?.sources || {};

  if (Array.isArray(rawSources)) {
    return rawSources.map((source) => {
      if (typeof source === "string") {
        return { label: source, text: source, url: null };
      }
      if (source && typeof source === "object") {
        const label = source.title || source.name || source.id || JSON.stringify(source);
        const text = [
          source.title,
          source.name,
          source.publisher,
          source.url,
          ...(Array.isArray(source.info_used) ? source.info_used : []),
        ]
          .filter(Boolean)
          .join(" | ");
        return {
          label,
          text: text || label,
          url: source.url || null,
        };
      }
      const label = String(source);
      return { label, text: label, url: null };
    });
  }

  if (rawSources && typeof rawSources === "object" && Array.isArray(rawSources.source_ids)) {
    return rawSources.source_ids.map((sourceId) => {
      const source = sourceCatalog[sourceId];
      if (!source) {
        return { label: sourceId, text: sourceId, url: null };
      }
      const label = source.publisher ? `${source.title} (${source.publisher})` : source.title || sourceId;
      const text = [
        sourceId,
        source.title,
        source.publisher,
        source.url,
        ...(Array.isArray(source.info_used) ? source.info_used : []),
      ]
        .filter(Boolean)
        .join(" | ");
      return {
        label,
        text: text || label,
        url: source.url || null,
      };
    });
  }

  if (rawSources && typeof rawSources === "object") {
    return Object.entries(rawSources).map(([key, value]) => {
      const label = `${key}: ${typeof value === "object" ? JSON.stringify(value) : value}`;
      return { label, text: label, url: null };
    });
  }

  return [];
}

function getCollectionMaterials() {
  if (activeCollection === "favorites") {
    return allMaterials.filter((material) => favoriteIds.has(material.id));
  }
  if (activeCollection === "recent") {
    return recentIds.map((id) => getMaterialById(id)).filter(Boolean);
  }
  return allMaterials;
}

function getScopedMaterials() {
  return getCollectionMaterials().filter((material) => {
    const classification = material.classification || {};
    if (selectedCategory && classification.category_en !== selectedCategory) return false;
    if (selectedSubcategory && classification.subcategory_en !== selectedSubcategory) return false;
    return true;
  });
}

function getSearchBlob(material) {
  const classification = material.classification || {};
  const properties = material.properties || {};
  const other = material.other || {};
  const sourceTerms = getMaterialSourceEntries(material).map((entry) => entry.text);
  return [
    material.name,
    material.id,
    classification.category_en,
    classification.category_ja,
    classification.subcategory_en,
    classification.subcategory_ja,
    other.condition,
    other.validation_tier,
    other.product_form,
    Object.keys(properties).join(" "),
    Object.keys(properties.linear_elastic || {}).join(" "),
    Object.keys(properties.orthotropic_elastic || {}).join(" "),
    Object.keys(properties.orthotropic_elastic_partial || {}).join(" "),
    Object.keys(properties.strength_data || {}).join(" "),
    Object.keys(properties.nonlinear_models || {}).join(" "),
    Object.keys(other).join(" "),
    ...sourceTerms,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function filterMaterialsBySearch(materials) {
  if (!searchQuery) return [...materials];
  const tokens = searchQuery.toLowerCase().split(/\s+/u).filter(Boolean);
  return materials.filter((material) => {
    const blob = getSearchBlob(material);
    return tokens.every((token) => blob.includes(token));
  });
}

function getPrimaryYoungsModulus(material) {
  const properties = material.properties || {};
  return (
    properties.linear_elastic?.youngs_modulus_pa ??
    properties.orthotropic_elastic?.E_x_pa ??
    properties.orthotropic_elastic_partial?.E_x_pa ??
    null
  );
}

function getPrimaryDensity(material) {
  const properties = material.properties || {};
  return (
    properties.linear_elastic?.density_kg_m3 ??
    properties.orthotropic_elastic?.density_kg_m3 ??
    properties.orthotropic_elastic_partial?.density_kg_m3 ??
    null
  );
}

function getPrimaryYieldStrength(material) {
  const strength = material.properties?.strength_data || {};
  if (strength.yield_strength_pa != null) return strength.yield_strength_pa;
  if (Array.isArray(strength.yield_strength_by_thickness_pa)) {
    return strength.yield_strength_by_thickness_pa.reduce((maxValue, entry) => {
      if (entry.value == null) return maxValue;
      return maxValue == null ? entry.value : Math.max(maxValue, entry.value);
    }, null);
  }
  return null;
}

function compareNullableNumbers(aValue, bValue, descending) {
  const aMissing = aValue == null;
  const bMissing = bValue == null;
  if (aMissing && bMissing) return 0;
  if (aMissing) return 1;
  if (bMissing) return -1;
  return descending ? bValue - aValue : aValue - bValue;
}

function sortMaterials(materials) {
  const recentIndexMap = new Map(recentIds.map((id, index) => [id, index]));
  return [...materials].sort((a, b) => {
    let delta = 0;
    switch (sortKey) {
      case "name_desc":
        delta = compareStrings(b.name, a.name);
        break;
      case "category_name":
        delta =
          compareStrings(catLabel(a), catLabel(b)) ||
          compareStrings(subcatLabel(a), subcatLabel(b)) ||
          compareStrings(a.name, b.name);
        break;
      case "youngs_desc":
        delta = compareNullableNumbers(getPrimaryYoungsModulus(a), getPrimaryYoungsModulus(b), true);
        break;
      case "density_desc":
        delta = compareNullableNumbers(getPrimaryDensity(a), getPrimaryDensity(b), true);
        break;
      case "yield_desc":
        delta = compareNullableNumbers(getPrimaryYieldStrength(a), getPrimaryYieldStrength(b), true);
        break;
      case "recent_desc":
        delta = compareNullableNumbers(recentIndexMap.get(a.id), recentIndexMap.get(b.id), false);
        break;
      case "name_asc":
      default:
        delta = compareStrings(a.name, b.name);
        break;
    }
    return delta || compareStrings(a.id, b.id);
  });
}

function getFilteredMaterials() {
  return sortMaterials(filterMaterialsBySearch(getScopedMaterials()));
}

function buildUrlFromState() {
  const params = new URLSearchParams();
  if (lang !== "ja") params.set("lang", lang);
  if (activeCollection !== "all") params.set("col", activeCollection);
  if (selectedCategory) params.set("cat", selectedCategory);
  if (selectedSubcategory) params.set("sub", selectedSubcategory);
  if (searchQuery) params.set("q", searchQuery);
  if (sortKey !== "name_asc") params.set("sort", sortKey);
  if (selectedMaterialId) params.set("id", selectedMaterialId);
  if (compareIds.length) params.set("compare", compareIds.join(","));
  const query = params.toString();
  return `${window.location.pathname}${query ? `?${query}` : ""}`;
}

function syncUrlState() {
  history.replaceState(null, "", buildUrlFromState());
}

function readUrlState() {
  const params = new URLSearchParams(window.location.search);
  const nextLang = params.get("lang");
  const nextCollection = params.get("col");
  const nextSort = params.get("sort");
  lang = nextLang === "en" ? "en" : "ja";
  activeCollection = ["all", "favorites", "recent"].includes(nextCollection) ? nextCollection : "all";
  selectedCategory = params.get("cat") || null;
  selectedSubcategory = params.get("sub") || null;
  searchQuery = params.get("q") || "";
  sortKey = sortOptions.some((option) => option.value === nextSort) ? nextSort : "name_asc";
  selectedMaterialId = params.get("id") || null;
  compareIds = (params.get("compare") || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

function readStoredArray(key) {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function writeStoredArray(key, values) {
  try {
    localStorage.setItem(key, JSON.stringify(values));
  } catch (error) {
    // Ignore storage write errors.
  }
}

function loadLocalState() {
  favoriteIds = new Set(readStoredArray(STORAGE_KEYS.favorites));
  recentIds = readStoredArray(STORAGE_KEYS.recent);
}

function persistLocalState() {
  writeStoredArray(STORAGE_KEYS.favorites, [...favoriteIds]);
  writeStoredArray(STORAGE_KEYS.recent, recentIds);
}

function sanitizeState() {
  favoriteIds = new Set(uniqueValidIds([...favoriteIds]));
  recentIds = uniqueValidIds(recentIds).slice(0, MAX_RECENT_ITEMS);
  compareIds = uniqueValidIds(compareIds).slice(0, MAX_COMPARE_ITEMS);

  if (!["all", "favorites", "recent"].includes(activeCollection)) {
    activeCollection = "all";
  }

  const collectionMaterials = getCollectionMaterials();
  const categorySet = new Set(collectionMaterials.map((material) => material.classification?.category_en || "Other"));
  if (selectedCategory && !categorySet.has(selectedCategory)) {
    selectedCategory = null;
    selectedSubcategory = null;
  }

  const subcategorySet = new Set(
    collectionMaterials
      .filter((material) => {
        const category = material.classification?.category_en || "Other";
        return !selectedCategory || category === selectedCategory;
      })
      .map((material) => material.classification?.subcategory_en || "Other")
  );
  if (selectedSubcategory && !subcategorySet.has(selectedSubcategory)) {
    selectedSubcategory = null;
  }

  if (selectedMaterialId && !getMaterialById(selectedMaterialId)) {
    selectedMaterialId = null;
  }

  persistLocalState();
}

function closeMobileSidebar() {
  if (window.innerWidth <= 768) {
    document.getElementById("sidebar").classList.remove("open");
  }
}

function updateMaterialCount(filteredCount, scopedCount) {
  const baseCount = searchQuery ? scopedCount : allMaterials.length;
  document.getElementById("materialCount").textContent =
    `${filteredCount} / ${baseCount} ${t("materialsUnit")}`;
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.remove("hidden");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.add("hidden");
    toastTimer = null;
  }, 2200);
}

function fallbackCopyText(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

async function copyText(text, message) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      fallbackCopyText(text);
    }
    showToast(message);
  } catch (error) {
    fallbackCopyText(text);
    showToast(message);
  }
}

function addToRecent(id) {
  recentIds = [id, ...recentIds.filter((recentId) => recentId !== id)].slice(0, MAX_RECENT_ITEMS);
  persistLocalState();
}

function toggleFavorite(id) {
  if (favoriteIds.has(id)) {
    favoriteIds.delete(id);
  } else {
    favoriteIds.add(id);
  }
  persistLocalState();
  refreshApp();
}

function toggleCompare(id) {
  if (compareIds.includes(id)) {
    compareIds = compareIds.filter((compareId) => compareId !== id);
  } else {
    if (compareIds.length >= MAX_COMPARE_ITEMS) {
      showToast(t("compareLimit"));
      return;
    }
    compareIds = [...compareIds, id];
  }
  refreshApp();
}

function clearCompare() {
  compareIds = [];
  if (comparePanelOpen) closeComparePanel({ syncUrl: false });
  refreshApp();
}

/* ===== Static UI ===== */
function renderSortOptions() {
  const select = document.getElementById("sortSelect");
  select.innerHTML = sortOptions
    .map(
      (option) =>
        `<option value="${esc(option.value)}"${option.value === sortKey ? " selected" : ""}>${esc(option.label[lang])}</option>`
    )
    .join("");
}

function applyLanguageToStaticText() {
  document.documentElement.lang = lang;
  document.title = t("pageTitle");
  document.getElementById("pageTitle").textContent = t("pageTitle");
  document.getElementById("searchInput").placeholder = t("searchPlaceholder");
  document.getElementById("collectionHeading").textContent = t("collectionHeading");
  document.getElementById("categoryHeading").textContent = t("categoryHeading");
  document.getElementById("subcategoryHeading").textContent = t("subcategoryHeading");
  document.getElementById("sortLabel").textContent = t("sortLabel");
  document.getElementById("copyViewLinkBtn").textContent = t("shareView");
  document.getElementById("compareButtonText").textContent = t("compare");
  document.getElementById("compareBarTitle").textContent = t("compareTrayTitle");
  document.getElementById("compareBarOpenBtn").textContent = t("openCompare");
  document.getElementById("compareBarClearBtn").textContent = t("clear");
  document.getElementById("langLabel").textContent = lang === "ja" ? "EN" : "JA";
  document.getElementById("langToggle").title = t("langTitle");
  document.getElementById("themeToggle").title = t("themeTitle");
  renderSortOptions();
}

/* ===== Filters ===== */
function renderCollectionList() {
  const collectionList = document.getElementById("collectionList");
  const items = [
    { key: "all", label: t("collectionAll"), count: allMaterials.length },
    { key: "favorites", label: t("collectionFavorites"), count: [...favoriteIds].length },
    { key: "recent", label: t("collectionRecent"), count: recentIds.length },
  ];

  collectionList.innerHTML = items
    .map(
      (item) => `<li class="category-item ${activeCollection === item.key ? "active" : ""}" data-collection="${esc(item.key)}">
        <div class="category-item-inner"><span class="category-label">${esc(item.label)}</span></div>
        <span class="category-count">${item.count}</span>
      </li>`
    )
    .join("");

  collectionList.querySelectorAll(".category-item").forEach((item) => {
    item.addEventListener("click", () => {
      const nextCollection = item.dataset.collection || "all";
      if (nextCollection === activeCollection) return;
      if (activeCollection !== "recent" && nextCollection === "recent" && sortKey === "name_asc") {
        sortKey = "recent_desc";
      } else if (activeCollection === "recent" && nextCollection !== "recent" && sortKey === "recent_desc") {
        sortKey = "name_asc";
      }
      activeCollection = nextCollection;
      closeMobileSidebar();
      refreshApp();
    });
  });
}

function buildFilters() {
  const collectionMaterials = getCollectionMaterials();
  const categories = {};
  const subcategories = {};

  collectionMaterials.forEach((material) => {
    const classification = material.classification || {};
    const categoryEn = classification.category_en || "Other";
    const categoryJa = classification.category_ja || categoryEn;
    const subcategoryEn = classification.subcategory_en || "Other";
    const subcategoryJa = classification.subcategory_ja || subcategoryEn;

    if (!categories[categoryEn]) {
      categories[categoryEn] = { en: categoryEn, ja: categoryJa, count: 0 };
    }
    categories[categoryEn].count += 1;

    const subKey = `${categoryEn}::${subcategoryEn}`;
    if (!subcategories[subKey]) {
      subcategories[subKey] = {
        en: subcategoryEn,
        ja: subcategoryJa,
        catEn: categoryEn,
        count: 0,
      };
    }
    subcategories[subKey].count += 1;
  });

  renderCategoryList(categories, collectionMaterials.length);
  renderSubcategoryList(subcategories);
}

function renderCategoryList(categories, totalCount) {
  const categoryList = document.getElementById("categoryList");
  const sorted = Object.values(categories).sort((a, b) => b.count - a.count || compareStrings(a.en, b.en));

  let html = `<li class="category-item ${selectedCategory === null ? "active" : ""}" data-cat="">
    <div class="category-item-inner"><span class="category-label">${esc(t("collectionAll"))}</span></div>
    <span class="category-count">${totalCount}</span>
  </li>`;

  sorted.forEach((category) => {
    const label = lang === "ja" ? category.ja : category.en;
    html += `<li class="category-item ${catClass(category.en)} ${selectedCategory === category.en ? "active" : ""}" data-cat="${esc(category.en)}">
      <div class="category-item-inner">
        <span class="category-dot" style="background:var(--cat-color, var(--accent))"></span>
        <span class="category-label">${esc(label)}</span>
      </div>
      <span class="category-count">${category.count}</span>
    </li>`;
  });

  categoryList.innerHTML = html;

  categoryList.querySelectorAll(".category-item").forEach((item) => {
    item.addEventListener("click", () => {
      selectedCategory = item.dataset.cat || null;
      selectedSubcategory = null;
      closeMobileSidebar();
      refreshApp();
    });
  });
}

function renderSubcategoryList(subcategories) {
  const subcategoryList = document.getElementById("subcategoryList");
  let filtered = Object.values(subcategories);
  if (selectedCategory) {
    filtered = filtered.filter((subcategory) => subcategory.catEn === selectedCategory);
  }
  filtered.sort((a, b) => b.count - a.count || compareStrings(a.en, b.en));

  if (filtered.length === 0) {
    subcategoryList.innerHTML = `<li class="category-item" style="color:var(--text-secondary);cursor:default;font-size:0.8rem">${esc(t("selectCategory"))}</li>`;
    return;
  }

  let html = `<li class="category-item ${selectedSubcategory === null ? "active" : ""}" data-sub="">
    <div class="category-item-inner"><span class="category-label">${esc(t("collectionAll"))}</span></div>
    <span class="category-count">${filtered.reduce((sum, item) => sum + item.count, 0)}</span>
  </li>`;

  filtered.forEach((subcategory) => {
    const label = lang === "ja" ? subcategory.ja : subcategory.en;
    html += `<li class="category-item ${catClass(subcategory.catEn)} ${selectedSubcategory === subcategory.en ? "active" : ""}" data-sub="${esc(subcategory.en)}">
      <div class="category-item-inner"><span class="category-label">${esc(label)}</span></div>
      <span class="category-count">${subcategory.count}</span>
    </li>`;
  });

  subcategoryList.innerHTML = html;

  subcategoryList.querySelectorAll(".category-item").forEach((item) => {
    item.addEventListener("click", () => {
      selectedSubcategory = item.dataset.sub || null;
      closeMobileSidebar();
      refreshApp();
    });
  });
}

/* ===== Material List ===== */
function getEmptyStateMessage() {
  if (activeCollection === "favorites" && favoriteIds.size === 0) return t("noFavorites");
  if (activeCollection === "recent" && recentIds.length === 0) return t("noRecent");
  return t("noResults");
}

function renderMaterials() {
  const container = document.getElementById("materialList");
  const scopedMaterials = getScopedMaterials();
  const filteredMaterials = sortMaterials(filterMaterialsBySearch(scopedMaterials));
  updateMaterialCount(filteredMaterials.length, scopedMaterials.length);

  if (filteredMaterials.length === 0) {
    container.innerHTML = `<div class="no-results">${esc(getEmptyStateMessage())}</div>`;
    return;
  }

  container.innerHTML = filteredMaterials
    .map((material) => {
      const classification = material.classification || {};
      const properties = material.properties || {};
      const linearElastic = properties.linear_elastic || {};
      const orthotropic = properties.orthotropic_elastic || properties.orthotropic_elastic_partial || {};
      const isFavorite = favoriteIds.has(material.id);
      const isCompared = compareIds.includes(material.id);
      const categoryClass = catClass(classification.category_en);

      let propertyHtml = "";
      if (linearElastic.youngs_modulus_pa != null) {
        propertyHtml += `<div class="card-prop"><span class="card-prop-label">E</span><span class="card-prop-value">${formatStress(linearElastic.youngs_modulus_pa)}</span></div>`;
      } else if (orthotropic.E_x_pa != null) {
        propertyHtml += `<div class="card-prop"><span class="card-prop-label">E<sub>x</sub></span><span class="card-prop-value">${formatStress(orthotropic.E_x_pa)}</span></div>`;
      }
      if (linearElastic.poissons_ratio != null) {
        propertyHtml += `<div class="card-prop"><span class="card-prop-label">&nu;</span><span class="card-prop-value">${linearElastic.poissons_ratio}</span></div>`;
      }
      if (getPrimaryDensity(material) != null) {
        propertyHtml += `<div class="card-prop"><span class="card-prop-label">&rho;</span><span class="card-prop-value">${formatDensity(getPrimaryDensity(material))}</span></div>`;
      }

      return `<div class="material-card ${categoryClass}" data-id="${esc(material.id)}">
        <div class="card-actions">
          <button type="button" class="icon-btn card-favorite-btn ${isFavorite ? "active" : ""}" data-id="${esc(material.id)}" title="${esc(t(isFavorite ? "unfavorite" : "favorite"))}">${isFavorite ? "★" : "☆"}</button>
          <button type="button" class="icon-btn card-compare-btn ${isCompared ? "active" : ""}" data-id="${esc(material.id)}" title="${esc(t(isCompared ? "removeFromCompare" : "addToCompare"))}">⇄</button>
        </div>
        <div class="card-header">
          <div class="card-name">${esc(material.name)}</div>
          <div class="card-badges">
            <span class="badge ${categoryClass}">${esc(catLabel(material))}</span>
            <span class="badge">${esc(subcatLabel(material))}</span>
          </div>
        </div>
        <div class="card-props">${propertyHtml}</div>
      </div>`;
    })
    .join("");

  container.querySelectorAll(".material-card").forEach((card) => {
    card.addEventListener("click", () => {
      const material = getMaterialById(card.dataset.id);
      if (material) openDetail(material);
    });
  });

  container.querySelectorAll(".card-favorite-btn").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleFavorite(button.dataset.id);
    });
  });

  container.querySelectorAll(".card-compare-btn").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleCompare(button.dataset.id);
    });
  });
}

/* ===== Detail Panel ===== */
function buildDetailMarkup(material) {
  const classification = material.classification || {};
  const categoryClass = catClass(classification.category_en);
  const properties = material.properties || {};
  const other = material.other || {};
  const sourceEntries = getMaterialSourceEntries(material);
  const isFavorite = favoriteIds.has(material.id);
  const isCompared = compareIds.includes(material.id);

  let html = `<button class="detail-close" id="detailClose" type="button">&times;</button>`;
  html += `<div class="detail-name">${esc(material.name)}</div>`;
  html += `<div class="detail-meta">
    <span class="badge ${categoryClass}">${esc(catLabel(material))}</span>
    <span class="badge">${esc(subcatLabel(material))}</span>
    ${other.condition ? `<span class="badge">${esc(other.condition)}</span>` : ""}
    ${other.validation_tier ? `<span class="badge">${esc(other.validation_tier)}</span>` : ""}
  </div>`;

  html += `<div class="detail-actions">
    <button class="detail-action-btn ${isFavorite ? "active" : ""}" id="detailFavoriteBtn" type="button">${isFavorite ? "★" : "☆"} ${esc(t(isFavorite ? "unfavorite" : "favorite"))}</button>
    <button class="detail-action-btn ${isCompared ? "active" : ""}" id="detailCompareBtn" type="button">${esc(t(isCompared ? "removeFromCompare" : "addToCompare"))}</button>
    <button class="detail-action-btn" id="detailCopyLinkBtn" type="button">${esc(t("detailCopyLink"))}</button>
    <button class="detail-action-btn" id="detailCopyJsonBtn" type="button">${esc(t("detailCopyJson"))}</button>
    ${sourceEntries.length ? `<button class="detail-action-btn" id="detailCopySourcesBtn" type="button">${esc(t("detailCopySources"))}</button>` : ""}
  </div>`;

  if (properties.linear_elastic) {
    html += renderLinearElastic(properties.linear_elastic);
  }
  if (properties.orthotropic_elastic) {
    html += renderOrthotropicElastic(
      properties.orthotropic_elastic,
      lang === "ja" ? "直交異方性弾性" : "Orthotropic Elastic"
    );
  }
  if (properties.orthotropic_elastic_partial) {
    html += renderOrthotropicElastic(
      properties.orthotropic_elastic_partial,
      lang === "ja" ? "直交異方性弾性 (部分)" : "Orthotropic Elastic (Partial)"
    );
  }
  if (properties.strength_data) {
    html += renderStrengthData(properties.strength_data);
  }
  if (properties.nonlinear_models) {
    html += renderNonlinearModels(properties.nonlinear_models);
  }

  ["ansys_mapping", "abaqus_mapping", "dolfinx_mapping", "lsdyna_mapping"].forEach((key) => {
    if (other[key]) {
      html += renderSolverMapping(other[key], key.replace("_mapping", "").toUpperCase());
    }
  });

  const skipOtherKeys = new Set([
    "condition",
    "validation_tier",
    "notes",
    "ansys_mapping",
    "abaqus_mapping",
    "dolfinx_mapping",
    "lsdyna_mapping",
  ]);

  const otherKeyLabels = {
    thermal_properties: { ja: "熱特性", en: "Thermal Properties" },
    physical_properties: { ja: "物理特性", en: "Physical Properties" },
    additional_properties: { ja: "追加特性", en: "Additional Properties" },
    beam_reference_design_values: { ja: "梁設計基準値", en: "Beam Reference Design Values" },
    column_reference_design_values: { ja: "柱設計基準値", en: "Column Reference Design Values" },
    panel_reference_design_values: { ja: "パネル設計基準値", en: "Panel Reference Design Values" },
    panel_reference_test_values: { ja: "パネル試験基準値", en: "Panel Reference Test Values" },
    product_form: { ja: "製品形態", en: "Product Form" },
    electrical_properties: { ja: "電気特性", en: "Electrical Properties" },
    equivalent_linear_beam_material: { ja: "等価線形梁材料", en: "Equivalent Linear Beam Material" },
    equivalent_linear_beam_column_material: {
      ja: "等価線形梁柱材料",
      en: "Equivalent Linear Beam-Column Material",
    },
    equivalent_plate_properties: { ja: "等価板特性", en: "Equivalent Plate Properties" },
    panel_grade_requirements: { ja: "パネル等級要件", en: "Panel Grade Requirements" },
    dimensional_tolerances: { ja: "寸法公差", en: "Dimensional Tolerances" },
    chemical_resistance: { ja: "耐薬品性", en: "Chemical Resistance" },
    environmental_reference_data: { ja: "環境参考データ", en: "Environmental Reference Data" },
    durability_reference_data: { ja: "耐久性参考データ", en: "Durability Reference Data" },
    tribology_reference_data: { ja: "トライボロジー参考データ", en: "Tribology Reference Data" },
  };

  Object.entries(other).forEach(([key, value]) => {
    if (skipOtherKeys.has(key) || value == null) return;
    const label = otherKeyLabels[key];
    const title = label ? label[lang] : key.replace(/_/g, " ");
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      html += `<div class="detail-section">
        <div class="detail-section-title">${esc(title)}</div>
        <p style="font-size:0.85rem">${formatScalarValue(key, value)}</p>
      </div>`;
    } else if (typeof value === "object") {
      html += renderKeyValueSection(value, title);
    }
  });

  if (other.notes && other.notes.length) {
    html += `<div class="detail-section">
      <div class="detail-section-title">${lang === "ja" ? "備考" : "Notes"}</div>
      <ul class="detail-notes">${other.notes.map((note) => `<li>${esc(note)}</li>`).join("")}</ul>
    </div>`;
  }

  if (sourceEntries.length) {
    html += `<div class="detail-section">
      <div class="detail-section-title">${lang === "ja" ? "出典" : "Sources"}</div>
      <ul class="detail-notes">${sourceEntries
        .map((source) => `<li>${
          source.url
            ? `<a class="detail-source-link" href="${esc(source.url)}" target="_blank" rel="noreferrer">${esc(source.label)}</a>`
            : esc(source.label)
        }</li>`)
        .join("")}</ul>
    </div>`;
  }

  return html;
}

function attachDetailListeners(material) {
  const closeButton = document.getElementById("detailClose");
  if (closeButton) closeButton.addEventListener("click", () => closeDetail());

  const favoriteButton = document.getElementById("detailFavoriteBtn");
  if (favoriteButton) favoriteButton.addEventListener("click", () => toggleFavorite(material.id));

  const compareButton = document.getElementById("detailCompareBtn");
  if (compareButton) compareButton.addEventListener("click", () => toggleCompare(material.id));

  const copyLinkButton = document.getElementById("detailCopyLinkBtn");
  if (copyLinkButton) {
    copyLinkButton.addEventListener("click", () => {
      const previousId = selectedMaterialId;
      selectedMaterialId = material.id;
      copyText(`${window.location.origin}${buildUrlFromState()}`, t("copiedMaterialLink"));
      selectedMaterialId = previousId;
    });
  }

  const copyJsonButton = document.getElementById("detailCopyJsonBtn");
  if (copyJsonButton) {
    copyJsonButton.addEventListener("click", () => {
      copyText(JSON.stringify(material, null, 2), t("copiedMaterialJson"));
    });
  }

  const copySourcesButton = document.getElementById("detailCopySourcesBtn");
  if (copySourcesButton) {
    copySourcesButton.addEventListener("click", () => {
      const text = getMaterialSourceEntries(material)
        .map((source) => (source.url ? `${source.label} - ${source.url}` : source.label))
        .join("\n");
      copyText(text, t("copiedSources"));
    });
  }
}

function renderDetailPanel(material, options = {}) {
  const { openIfNeeded = false } = options;
  const panel = document.getElementById("materialDetail");
  panel.innerHTML = buildDetailMarkup(material);
  attachDetailListeners(material);

  if (openIfNeeded && panel.classList.contains("hidden")) {
    panel.classList.remove("hidden");
    requestAnimationFrame(() => {
      panel.classList.add("open");
      document.getElementById("overlay").classList.remove("hidden");
      document.getElementById("overlay").classList.add("open");
    });
  }
}

function openDetail(material, options = {}) {
  const { syncUrl = true, skipRecent = false } = options;
  if (comparePanelOpen) closeComparePanel({ syncUrl: false });
  selectedMaterialId = material.id;
  if (!skipRecent) addToRecent(material.id);
  renderDetailPanel(material, { openIfNeeded: true });
  renderCollectionList();
  if (sortKey === "recent_desc" || activeCollection === "recent") {
    buildFilters();
    renderMaterials();
  }
  if (syncUrl) syncUrlState();
}

function closeDetail(options = {}) {
  const { syncUrl = true } = options;
  selectedMaterialId = null;
  const panel = document.getElementById("materialDetail");
  const overlay = document.getElementById("overlay");
  panel.classList.remove("open");
  overlay.classList.remove("open");
  setTimeout(() => {
    panel.classList.add("hidden");
    overlay.classList.add("hidden");
  }, 300);
  if (syncUrl) syncUrlState();
}

/* ===== Compare Panel ===== */
function summarizeNonlinearModels(material) {
  const nonlinearModels = material.properties?.nonlinear_models || {};
  const names = Object.entries(nonlinearModels).map(([name, model]) =>
    model?.recommended ? `${name} ★` : name
  );
  return names.length ? names : ["-"];
}

function summarizeSolverMappings(material) {
  const other = material.other || {};
  const lines = ["ansys_mapping", "abaqus_mapping", "dolfinx_mapping", "lsdyna_mapping"]
    .map((key) => {
      if (!other[key]) return null;
      const label = key.replace("_mapping", "").toUpperCase();
      const subKeys = Object.keys(other[key]);
      return `${label}: ${subKeys.length ? subKeys.join(", ") : "-"}`;
    })
    .filter(Boolean);
  return lines.length ? lines : ["-"];
}

function buildCompareSections(materials) {
  return [
    {
      title: t("compareSectionIdentity"),
      rows: [
        { label: t("compareId"), values: materials.map((material) => material.id) },
        { label: t("compareCategory"), values: materials.map((material) => catLabel(material) || "-") },
        { label: t("compareSubcategory"), values: materials.map((material) => subcatLabel(material) || "-") },
        {
          label: t("compareCondition"),
          values: materials.map((material) => material.other?.condition || "-"),
        },
        {
          label: t("compareValidation"),
          values: materials.map((material) => material.other?.validation_tier || "-"),
        },
        {
          label: t("compareProductForm"),
          values: materials.map((material) => material.other?.product_form || "-"),
        },
      ],
    },
    {
      title: t("compareSectionElastic"),
      rows: [
        {
          label: t("compareYoungs"),
          values: materials.map((material) => {
            const value = getPrimaryYoungsModulus(material);
            return value != null ? formatStress(value) : "-";
          }),
        },
        {
          label: t("comparePoisson"),
          values: materials.map((material) => material.properties?.linear_elastic?.poissons_ratio ?? "-"),
        },
        {
          label: t("compareDensity"),
          values: materials.map((material) => {
            const value = getPrimaryDensity(material);
            return value != null ? formatDensity(value) : "-";
          }),
        },
        {
          label: t("compareShear"),
          values: materials.map((material) => {
            const value = material.properties?.linear_elastic?.shear_modulus_pa;
            return value != null ? formatStress(value) : "-";
          }),
        },
        {
          label: t("compareBulk"),
          values: materials.map((material) => {
            const value = material.properties?.linear_elastic?.bulk_modulus_pa;
            return value != null ? formatStress(value) : "-";
          }),
        },
      ],
    },
    {
      title: t("compareSectionStrength"),
      rows: [
        {
          label: t("compareYield"),
          values: materials.map((material) => {
            const value = getPrimaryYieldStrength(material);
            return value != null ? formatStress(value) : "-";
          }),
        },
        {
          label: t("compareUltimate"),
          values: materials.map((material) => {
            const value = material.properties?.strength_data?.ultimate_tensile_strength_pa;
            return value != null ? formatStress(value) : "-";
          }),
        },
        {
          label: t("compareCompressive"),
          values: materials.map((material) => {
            const value = material.properties?.strength_data?.compressive_strength_pa;
            return value != null ? formatStress(value) : "-";
          }),
        },
        {
          label: t("compareFlexural"),
          values: materials.map((material) => {
            const value = material.properties?.strength_data?.flexural_strength_pa;
            return value != null ? formatStress(value) : "-";
          }),
        },
        {
          label: t("compareElongation"),
          values: materials.map((material) => {
            const value = material.properties?.strength_data?.elongation_min_percent;
            return value != null ? `${value}%` : "-";
          }),
        },
      ],
    },
    {
      title: t("compareSectionModels"),
      rows: [
        {
          label: t("compareNonlinear"),
          values: materials.map((material) => summarizeNonlinearModels(material)),
        },
      ],
    },
    {
      title: t("compareSectionReferences"),
      rows: [
        {
          label: t("compareMappings"),
          values: materials.map((material) => summarizeSolverMappings(material)),
        },
        {
          label: t("compareSources"),
          values: materials.map((material) => String(getMaterialSourceEntries(material).length)),
        },
      ],
    },
  ];
}

function renderCompareCellValue(value) {
  if (Array.isArray(value)) {
    return `<div class="compare-cell-list">${value.map((item) => `<span>${esc(item)}</span>`).join("")}</div>`;
  }
  return esc(value == null ? "-" : value);
}

function renderComparePanel() {
  const panel = document.getElementById("comparePanel");
  const materials = compareIds.map((id) => getMaterialById(id)).filter(Boolean);
  if (materials.length < 2) {
    return "";
  }

  const sections = buildCompareSections(materials);
  const columnCount = materials.length + 1;

  let html = `<div class="compare-panel-inner">
    <div class="compare-header">
      <div>
        <div class="compare-title">${esc(t("compareTitle"))}</div>
        <div class="compare-subtitle">${esc(t("compareSubtitle"))}</div>
      </div>
      <div class="compare-header-actions">
        <button class="toolbar-btn" id="compareCopyLinkBtn" type="button">${esc(t("shareView"))}</button>
        <button class="toolbar-btn subtle" id="compareCloseBtn" type="button">${esc(t("close"))}</button>
      </div>
    </div>
    <div class="compare-table-wrap">
      <table class="compare-table">
        <thead>
          <tr>
            <th>${esc(t("propertyLabel"))}</th>`;

  materials.forEach((material) => {
    const categoryClass = catClass(material.classification?.category_en);
    html += `<th>
      <div class="compare-card-heading">
        <div>
          <div class="compare-card-name">${esc(material.name)}</div>
          <div class="compare-card-meta">
            <span class="badge ${categoryClass}">${esc(catLabel(material))}</span>
            <span class="badge">${esc(subcatLabel(material))}</span>
          </div>
        </div>
        <button class="compare-remove-btn" data-id="${esc(material.id)}" type="button">&times;</button>
      </div>
    </th>`;
  });

  html += `</tr></thead><tbody>`;

  sections.forEach((section) => {
    html += `<tr class="compare-section-row"><td colspan="${columnCount}">${esc(section.title)}</td></tr>`;
    section.rows.forEach((row) => {
      const hasValue = row.values.some((value) => {
        if (Array.isArray(value)) return value.some((item) => item && item !== "-");
        return value && value !== "-";
      });
      if (!hasValue) return;
      html += `<tr><td>${esc(row.label)}</td>${row.values.map((value) => `<td>${renderCompareCellValue(value)}</td>`).join("")}</tr>`;
    });
  });

  html += `</tbody></table></div></div>`;
  panel.innerHTML = html;

  const compareCloseButton = document.getElementById("compareCloseBtn");
  if (compareCloseButton) compareCloseButton.addEventListener("click", () => closeComparePanel());

  const compareCopyLinkButton = document.getElementById("compareCopyLinkBtn");
  if (compareCopyLinkButton) {
    compareCopyLinkButton.addEventListener("click", () => {
      copyText(`${window.location.origin}${buildUrlFromState()}`, t("copiedViewLink"));
    });
  }

  panel.querySelectorAll(".compare-remove-btn").forEach((button) => {
    button.addEventListener("click", () => {
      compareIds = compareIds.filter((id) => id !== button.dataset.id);
      if (compareIds.length < 2) {
        closeComparePanel({ syncUrl: false });
      }
      refreshApp();
    });
  });

  return html;
}

function openComparePanel() {
  if (compareIds.length < 2) {
    showToast(t("compareNeedMore"));
    return;
  }
  if (selectedMaterialId) closeDetail({ syncUrl: false });
  comparePanelOpen = true;
  renderComparePanel();
  const panel = document.getElementById("comparePanel");
  const overlay = document.getElementById("compareOverlay");
  panel.classList.remove("hidden");
  overlay.classList.remove("hidden");
  requestAnimationFrame(() => {
    panel.classList.add("open");
    overlay.classList.add("open");
  });
}

function closeComparePanel(options = {}) {
  const { syncUrl = true } = options;
  comparePanelOpen = false;
  const panel = document.getElementById("comparePanel");
  const overlay = document.getElementById("compareOverlay");
  panel.classList.remove("open");
  overlay.classList.remove("open");
  setTimeout(() => {
    panel.classList.add("hidden");
    overlay.classList.add("hidden");
  }, 250);
  if (syncUrl) syncUrlState();
}

function renderCompareBar() {
  const bar = document.getElementById("compareBar");
  const chipList = document.getElementById("compareChipList");
  const count = compareIds.length;

  document.getElementById("compareCount").textContent = String(count);
  document.getElementById("compareButtonText").textContent = t("compare");
  document.getElementById("compareBarTitle").textContent = t("compareTrayTitle");
  document.getElementById("compareBarOpenBtn").textContent = t("openCompare");
  document.getElementById("compareBarClearBtn").textContent = t("clear");

  const openButtons = [document.getElementById("openCompareBtn"), document.getElementById("compareBarOpenBtn")];
  openButtons.forEach((button) => {
    button.disabled = count < 2;
  });

  if (count === 0) {
    bar.classList.add("hidden");
    chipList.innerHTML = "";
    return;
  }

  chipList.innerHTML = compareIds
    .map((id) => getMaterialById(id))
    .filter(Boolean)
    .map(
      (material) => `<span class="compare-chip">
        <span class="compare-chip-label">${esc(material.name)}</span>
        <button class="compare-chip-remove" type="button" data-id="${esc(material.id)}">&times;</button>
      </span>`
    )
    .join("");

  chipList.querySelectorAll(".compare-chip-remove").forEach((button) => {
    button.addEventListener("click", () => {
      compareIds = compareIds.filter((id) => id !== button.dataset.id);
      if (compareIds.length < 2 && comparePanelOpen) {
        closeComparePanel({ syncUrl: false });
      }
      refreshApp();
    });
  });

  bar.classList.remove("hidden");
}

/* ===== Section Renderers ===== */
function renderLinearElastic(linearElastic) {
  let rows = "";
  if (linearElastic.youngs_modulus_pa != null) {
    rows += `<tr><td>Young's Modulus (E)</td><td>${formatStress(linearElastic.youngs_modulus_pa)}</td></tr>`;
  }
  if (linearElastic.poissons_ratio != null) {
    rows += `<tr><td>Poisson's Ratio (&nu;)</td><td>${linearElastic.poissons_ratio}</td></tr>`;
  }
  if (linearElastic.density_kg_m3 != null) {
    rows += `<tr><td>Density (&rho;)</td><td>${formatDensity(linearElastic.density_kg_m3)}</td></tr>`;
  }
  if (linearElastic.shear_modulus_pa != null) {
    rows += `<tr><td>Shear Modulus (G)</td><td>${formatStress(linearElastic.shear_modulus_pa)}</td></tr>`;
  }
  if (linearElastic.bulk_modulus_pa != null) {
    rows += `<tr><td>Bulk Modulus (K)</td><td>${formatStress(linearElastic.bulk_modulus_pa)}</td></tr>`;
  }

  const known = new Set([
    "youngs_modulus_pa",
    "poissons_ratio",
    "density_kg_m3",
    "shear_modulus_pa",
    "bulk_modulus_pa",
  ]);

  Object.entries(linearElastic).forEach(([key, value]) => {
    if (!known.has(key) && value != null) {
      rows += `<tr><td>${esc(key)}</td><td>${formatComplexValue(value, key)}</td></tr>`;
    }
  });

  return `<div class="detail-section">
    <div class="detail-section-title">${lang === "ja" ? "線形弾性" : "Linear Elastic"}</div>
    <table class="detail-table">
      <thead><tr><th>${esc(t("propertyLabel"))}</th><th>${esc(t("valueLabel"))}</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

function renderOrthotropicElastic(orthotropicElastic, title) {
  let rows = "";
  Object.entries(orthotropicElastic).forEach(([key, value]) => {
    if (value != null && typeof value !== "object") {
      rows += `<tr><td>${esc(key)}</td><td>${formatScalarValue(key, value)}</td></tr>`;
    }
  });
  if (!rows) return "";

  return `<div class="detail-section">
    <div class="detail-section-title">${esc(title)}</div>
    <table class="detail-table">
      <thead><tr><th>${esc(t("propertyLabel"))}</th><th>${esc(t("valueLabel"))}</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

function renderStrengthData(strengthData) {
  let html = `<div class="detail-section"><div class="detail-section-title">${lang === "ja" ? "強度データ" : "Strength Data"}</div>`;

  if (strengthData.yield_strength_pa != null) {
    html += `<table class="detail-table"><tbody><tr><td>${lang === "ja" ? "降伏強度" : "Yield Strength"}</td><td>${formatStress(strengthData.yield_strength_pa)}</td></tr></tbody></table>`;
  }
  if (strengthData.yield_strength_by_thickness_pa) {
    html += `<div class="detail-subsection">${lang === "ja" ? "降伏強度 (板厚別)" : "Yield Strength (by thickness)"}</div>`;
    html += `<table class="detail-table"><thead><tr><th>${lang === "ja" ? "板厚 (mm)" : "Thickness (mm)"}</th><th>${esc(t("valueLabel"))}</th></tr></thead><tbody>`;
    strengthData.yield_strength_by_thickness_pa.forEach((entry) => {
      html += `<tr><td>${entry.thickness_mm[0]} - ${entry.thickness_mm[1]}</td><td>${formatStress(entry.value)}</td></tr>`;
    });
    html += `</tbody></table>`;
  }

  if (strengthData.ultimate_tensile_strength_pa != null) {
    html += `<table class="detail-table"><tbody><tr><td>${lang === "ja" ? "引張強度" : "Ultimate Tensile Strength"}</td><td>${formatStress(strengthData.ultimate_tensile_strength_pa)}</td></tr></tbody></table>`;
  }
  if (strengthData.ultimate_tensile_strength_by_thickness_pa) {
    html += `<div class="detail-subsection">${lang === "ja" ? "引張強度 (板厚別)" : "UTS (by thickness)"}</div>`;
    html += `<table class="detail-table"><thead><tr><th>${lang === "ja" ? "板厚 (mm)" : "Thickness (mm)"}</th><th>Min</th><th>Max</th></tr></thead><tbody>`;
    strengthData.ultimate_tensile_strength_by_thickness_pa.forEach((entry) => {
      html += `<tr><td>${entry.thickness_mm[0]} - ${entry.thickness_mm[1]}</td><td>${formatStress(entry.min)}</td><td>${formatStress(entry.max)}</td></tr>`;
    });
    html += `</tbody></table>`;
  }

  if (strengthData.elongation_min_percent != null) {
    html += `<table class="detail-table"><tbody><tr><td>${lang === "ja" ? "伸び (最小)" : "Elongation (min)"}</td><td>${strengthData.elongation_min_percent}%</td></tr></tbody></table>`;
  }
  if (strengthData.compressive_strength_pa != null) {
    html += `<table class="detail-table"><tbody><tr><td>${lang === "ja" ? "圧縮強度" : "Compressive Strength"}</td><td>${formatStress(strengthData.compressive_strength_pa)}</td></tr></tbody></table>`;
  }
  if (strengthData.flexural_strength_pa != null) {
    html += `<table class="detail-table"><tbody><tr><td>${lang === "ja" ? "曲げ強度" : "Flexural Strength"}</td><td>${formatStress(strengthData.flexural_strength_pa)}</td></tr></tbody></table>`;
  }

  const known = new Set([
    "yield_strength_pa",
    "yield_strength_by_thickness_pa",
    "ultimate_tensile_strength_pa",
    "ultimate_tensile_strength_by_thickness_pa",
    "elongation_min_percent",
    "compressive_strength_pa",
    "flexural_strength_pa",
  ]);
  let extraRows = "";
  Object.entries(strengthData).forEach(([key, value]) => {
    if (!known.has(key) && value != null && typeof value !== "object") {
      extraRows += `<tr><td>${esc(key)}</td><td>${formatScalarValue(key, value)}</td></tr>`;
    }
  });
  if (extraRows) {
    html += `<table class="detail-table"><tbody>${extraRows}</tbody></table>`;
  }

  html += `</div>`;
  return html;
}

function renderNonlinearModels(nonlinearModels) {
  let html = `<div class="detail-section"><div class="detail-section-title">${lang === "ja" ? "非線形モデル" : "Nonlinear Models"}</div>`;

  Object.entries(nonlinearModels).forEach(([modelName, model]) => {
    html += `<div class="detail-subsection">${esc(modelName)}${model.recommended ? " ★" : ""}</div>`;

    if (model.variants_by_thickness_mm) {
      html += `<table class="detail-table"><thead><tr><th>${lang === "ja" ? "板厚 (mm)" : "Thickness (mm)"}</th><th>${lang === "ja" ? "降伏応力" : "Yield Stress"}</th><th>H<sub>iso</sub></th><th>E<sub>t</sub></th></tr></thead><tbody>`;
      model.variants_by_thickness_mm.forEach((variant) => {
        html += `<tr><td>${variant.thickness_mm[0]} - ${variant.thickness_mm[1]}</td><td>${formatStress(variant.yield_stress_pa)}</td><td>${formatStress(variant.isotropic_hardening_modulus_pa)}</td><td>${formatStress(variant.tangent_modulus_pa)}</td></tr>`;
      });
      html += `</tbody></table>`;
    }

    const skipKeys = new Set(["recommended", "material_model", "variants_by_thickness_mm", "notes", "source_ids"]);
    let rows = "";
    Object.entries(model).forEach(([key, value]) => {
      if (!skipKeys.has(key) && value != null && typeof value !== "object") {
        rows += `<tr><td>${esc(key)}</td><td>${formatScalarValue(key, value)}</td></tr>`;
      }
    });
    if (rows) {
      html += `<table class="detail-table"><tbody>${rows}</tbody></table>`;
    }

    if (model.notes && model.notes.length) {
      html += `<ul class="detail-notes">${model.notes.map((note) => `<li>${esc(note)}</li>`).join("")}</ul>`;
    }
  });

  html += `</div>`;
  return html;
}

function renderSolverMapping(mapping, solverName) {
  let html = `<div class="detail-section"><div class="detail-section-title">${esc(solverName)} Mapping</div>`;
  let hasContent = false;

  Object.entries(mapping).forEach(([key, value]) => {
    if (value == null) return;

    if (Array.isArray(value) && value.length > 0 && typeof value[0] === "object") {
      hasContent = true;
      html += `<div class="detail-subsection">${esc(key)}</div>`;
      const columns = Object.keys(value[0]);
      html += `<table class="detail-table"><thead><tr>${columns.map((column) => `<th>${esc(column)}</th>`).join("")}</tr></thead><tbody>`;
      value.forEach((row) => {
        html += `<tr>${columns
          .map((column) => {
            const cell = row[column];
            if (Array.isArray(cell)) return `<td>${esc(cell.join(" - "))}</td>`;
            return `<td>${formatComplexValue(cell, column)}</td>`;
          })
          .join("")}</tr>`;
      });
      html += `</tbody></table>`;
      return;
    }

    if (Array.isArray(value)) {
      hasContent = true;
      html += `<table class="detail-table"><tbody><tr><td>${esc(key)}</td><td>${formatComplexValue(value, key)}</td></tr></tbody></table>`;
      return;
    }

    if (typeof value === "object") {
      hasContent = true;
      let rows = "";
      Object.entries(value).forEach(([paramKey, paramValue]) => {
        if (paramValue == null) return;
        rows += `<tr><td>${esc(paramKey)}</td><td>${formatComplexValue(paramValue, paramKey)}</td></tr>`;
      });
      if (rows) {
        html += `<div class="detail-subsection">${esc(key)}</div>`;
        html += `<table class="detail-table"><thead><tr><th>${esc(t("propertyLabel"))}</th><th>${esc(t("valueLabel"))}</th></tr></thead><tbody>${rows}</tbody></table>`;
      }
      return;
    }

    hasContent = true;
    html += `<table class="detail-table"><tbody><tr><td>${esc(key)}</td><td>${formatScalarValue(key, value)}</td></tr></tbody></table>`;
  });

  html += `</div>`;
  return hasContent ? html : "";
}

function renderKeyValueSection(objectValue, title) {
  if (!objectValue || typeof objectValue !== "object") return "";
  let rows = "";

  function flatten(value, prefix) {
    Object.entries(value).forEach(([key, nestedValue]) => {
      const nextKey = prefix ? `${prefix}.${key}` : key;
      if (nestedValue != null && typeof nestedValue === "object" && !Array.isArray(nestedValue)) {
        flatten(nestedValue, nextKey);
      } else if (nestedValue != null) {
        rows += `<tr><td>${esc(nextKey)}</td><td>${formatComplexValue(nestedValue, nextKey)}</td></tr>`;
      }
    });
  }

  flatten(objectValue, "");
  if (!rows) return "";

  return `<div class="detail-section">
    <div class="detail-section-title">${esc(title)}</div>
    <table class="detail-table">
      <thead><tr><th>${esc(t("propertyLabel"))}</th><th>${esc(t("valueLabel"))}</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

/* ===== Theme ===== */
function initTheme() {
  const savedTheme = localStorage.getItem(STORAGE_KEYS.theme);
  if (savedTheme) {
    document.documentElement.setAttribute("data-theme", savedTheme);
  } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
    document.documentElement.setAttribute("data-theme", "dark");
  }
  updateThemeIcon();
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute("data-theme");
  const nextTheme = currentTheme === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", nextTheme);
  localStorage.setItem(STORAGE_KEYS.theme, nextTheme);
  updateThemeIcon();
}

function updateThemeIcon() {
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  document.getElementById("themeIconSun").classList.toggle("hidden", isDark);
  document.getElementById("themeIconMoon").classList.toggle("hidden", !isDark);
}

/* ===== Keyboard ===== */
function initKeyboard() {
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (comparePanelOpen) closeComparePanel();
      else closeDetail();
    }
    if ((event.key === "/" || event.key === "f") && !event.ctrlKey && !event.metaKey) {
      const active = document.activeElement;
      if (active.tagName !== "INPUT" && active.tagName !== "TEXTAREA" && active.tagName !== "SELECT") {
        event.preventDefault();
        document.getElementById("searchInput").focus();
      }
    }
  });
}

function initMobileSidebar() {
  const headerLeft = document.querySelector(".header-left");
  headerLeft.addEventListener("click", () => {
    if (window.innerWidth <= 768) {
      document.getElementById("sidebar").classList.toggle("open");
    }
  });
}

/* ===== Render Cycle ===== */
function refreshApp() {
  sanitizeState();
  renderCollectionList();
  buildFilters();
  renderSortOptions();
  renderMaterials();
  renderCompareBar();

  if (selectedMaterialId) {
    const selectedMaterial = getMaterialById(selectedMaterialId);
    if (selectedMaterial) renderDetailPanel(selectedMaterial);
  }

  if (comparePanelOpen) {
    if (compareIds.length >= 2) {
      renderComparePanel();
    } else {
      closeComparePanel({ syncUrl: false });
    }
  }

  syncUrlState();
}

function toggleLang() {
  lang = lang === "ja" ? "en" : "ja";
  applyLanguageToStaticText();
  refreshApp();
}

/* ===== Init ===== */
async function init() {
  loadLocalState();
  readUrlState();
  initTheme();
  initKeyboard();
  initMobileSidebar();
  applyLanguageToStaticText();

  document.getElementById("searchInput").value = searchQuery;

  document.getElementById("themeToggle").addEventListener("click", toggleTheme);
  document.getElementById("langToggle").addEventListener("click", toggleLang);
  document.getElementById("overlay").addEventListener("click", () => closeDetail());
  document.getElementById("compareOverlay").addEventListener("click", () => closeComparePanel());

  document.getElementById("sortSelect").addEventListener("change", (event) => {
    sortKey = event.target.value;
    refreshApp();
  });

  document.getElementById("copyViewLinkBtn").addEventListener("click", () => {
    copyText(`${window.location.origin}${buildUrlFromState()}`, t("copiedViewLink"));
  });

  document.getElementById("openCompareBtn").addEventListener("click", () => openComparePanel());
  document.getElementById("compareBarOpenBtn").addEventListener("click", () => openComparePanel());
  document.getElementById("compareBarClearBtn").addEventListener("click", () => clearCompare());

  document.getElementById("searchInput").addEventListener("input", (event) => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      searchQuery = event.target.value.trim();
      refreshApp();
    }, 180);
  });

  const container = document.getElementById("materialList");
  container.innerHTML = `<div class="loading">${lang === "ja" ? "読み込み中" : "Loading"}</div>`;

  try {
    const response = await fetch("materials_db.json");
    dbData = await response.json();
    allMaterials = dbData.materials || [];
    sanitizeState();
    refreshApp();

    if (selectedMaterialId) {
      const selectedMaterial = getMaterialById(selectedMaterialId);
      if (selectedMaterial) openDetail(selectedMaterial, { syncUrl: false, skipRecent: true });
    }
  } catch (error) {
    container.innerHTML = `<div class="no-results">Failed to load data: ${esc(error.message)}</div>`;
  }
}

init();
