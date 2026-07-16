#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const databasePath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(scriptDirectory, "../materials_db.json");

const errors = [];

function fail(location, message) {
  errors.push(`${location}: ${message}`);
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requireNonEmptyString(value, location) {
  if (typeof value !== "string" || value.trim() === "") {
    fail(location, "must be a non-empty string");
  }
}

function walk(value, location, visitor) {
  visitor(value, location);
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, `${location}[${index}]`, visitor));
    return;
  }
  if (isObject(value)) {
    Object.entries(value).forEach(([key, item]) =>
      walk(item, `${location}.${key}`, visitor),
    );
  }
}

let database;
try {
  database = JSON.parse(fs.readFileSync(databasePath, "utf8"));
} catch (error) {
  console.error(`Unable to read ${databasePath}: ${error.message}`);
  process.exit(1);
}

if (!isObject(database)) {
  fail("database", "root must be an object");
}

requireNonEmptyString(database.schema_version, "schema_version");
if (
  typeof database.schema_version === "string" &&
  !/^\d+\.\d+\.\d+$/.test(database.schema_version)
) {
  fail("schema_version", "must use semantic-version notation");
}

requireNonEmptyString(database.created_at, "created_at");
if (
  typeof database.created_at === "string" &&
  !/^\d{4}-\d{2}-\d{2}$/.test(database.created_at)
) {
  fail("created_at", "must use YYYY-MM-DD notation");
}

if (!isObject(database.sources)) {
  fail("sources", "must be an object keyed by source id");
}
if (!Array.isArray(database.materials)) {
  fail("materials", "must be an array");
}
if (!isObject(database.solver_parameter_templates)) {
  fail("solver_parameter_templates", "must be an object");
}

const sourceEntries = isObject(database.sources)
  ? Object.entries(database.sources)
  : [];
const sourceIds = new Set(sourceEntries.map(([sourceId]) => sourceId));

for (const [sourceId, source] of sourceEntries) {
  const location = `sources.${sourceId}`;
  if (!/^[a-z0-9][a-z0-9_]*$/.test(sourceId)) {
    fail(location, "source id must contain lowercase letters, digits, and underscores only");
  }
  if (!isObject(source)) {
    fail(location, "must be an object");
    continue;
  }
  requireNonEmptyString(source.title, `${location}.title`);
  requireNonEmptyString(source.publisher, `${location}.publisher`);
  requireNonEmptyString(source.url, `${location}.url`);
  if (typeof source.url === "string" && !/^https?:\/\//.test(source.url)) {
    fail(`${location}.url`, "must be an HTTP(S) URL");
  }
  requireNonEmptyString(source.accessed_at, `${location}.accessed_at`);
  if (
    typeof source.accessed_at === "string" &&
    !/^\d{4}-\d{2}-\d{2}$/.test(source.accessed_at)
  ) {
    fail(`${location}.accessed_at`, "must use YYYY-MM-DD notation");
  }
  if (
    !Array.isArray(source.info_used) ||
    source.info_used.length === 0 ||
    source.info_used.some((item) => typeof item !== "string" || item.trim() === "")
  ) {
    fail(`${location}.info_used`, "must be a non-empty array of strings");
  }
}

for (const [templateId, template] of Object.entries(
  database.solver_parameter_templates ?? {},
)) {
  const location = `solver_parameter_templates.${templateId}`;
  if (!isObject(template)) {
    fail(location, "must be an object");
    continue;
  }
  requireNonEmptyString(template.status, `${location}.status`);
  if (
    !Array.isArray(template.source_ids) ||
    template.source_ids.length === 0 ||
    template.source_ids.some((sourceId) => typeof sourceId !== "string")
  ) {
    fail(`${location}.source_ids`, "must be a non-empty array of source-id strings");
  }
}

const hashinRequired =
  database.solver_parameter_templates?.abaqus_hashin_damage_initiation
    ?.required_strength_parameters;
if (
  !Array.isArray(hashinRequired) ||
  !hashinRequired.includes("SL") ||
  !hashinRequired.includes("ST")
) {
  fail(
    "solver_parameter_templates.abaqus_hashin_damage_initiation.required_strength_parameters",
    "must distinguish Abaqus longitudinal shear SL and transverse shear ST",
  );
}

const expectedCategories = new Set([
  "Adhesive",
  "Ceramics",
  "Composite",
  "Concrete and Grout",
  "Elastomer",
  "Foam",
  "Glass",
  "Metal",
  "Polymer",
  "Soil",
  "Wood",
]);
const categoryCounts = new Map();
const materialIds = new Set();
const materialNames = new Set();

for (const [index, material] of (database.materials ?? []).entries()) {
  const location = `materials[${index}]`;
  if (!isObject(material)) {
    fail(location, "must be an object");
    continue;
  }

  requireNonEmptyString(material.id, `${location}.id`);
  if (typeof material.id === "string") {
    if (!/^[a-z0-9][a-z0-9_]*$/.test(material.id)) {
      fail(`${location}.id`, "must contain lowercase letters, digits, and underscores only");
    }
    if (materialIds.has(material.id)) {
      fail(`${location}.id`, `duplicate id ${material.id}`);
    }
    materialIds.add(material.id);
  }

  requireNonEmptyString(material.name, `${location}.name`);
  if (typeof material.name === "string") {
    if (materialNames.has(material.name)) {
      fail(`${location}.name`, `duplicate display name ${material.name}`);
    }
    materialNames.add(material.name);
  }

  if (!isObject(material.classification)) {
    fail(`${location}.classification`, "must be an object");
  } else {
    for (const field of [
      "category_ja",
      "category_en",
      "subcategory_ja",
      "subcategory_en",
    ]) {
      requireNonEmptyString(
        material.classification[field],
        `${location}.classification.${field}`,
      );
    }
    const category = material.classification.category_en;
    if (typeof category === "string") {
      if (!expectedCategories.has(category)) {
        fail(`${location}.classification.category_en`, `unknown category ${category}`);
      }
      categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
    }
  }

  if (!isObject(material.properties) || Object.keys(material.properties).length === 0) {
    fail(`${location}.properties`, "must be a non-empty object");
  }
  if (!isObject(material.other)) {
    fail(`${location}.other`, "must be an object");
  }
  if (
    !isObject(material.sources) ||
    !Array.isArray(material.sources.source_ids) ||
    material.sources.source_ids.length === 0
  ) {
    fail(`${location}.sources.source_ids`, "must be a non-empty array");
  }

  const linearElastic = material.properties?.linear_elastic;
  if (isObject(linearElastic)) {
    if (
      "density_kg_m3" in linearElastic &&
      !(typeof linearElastic.density_kg_m3 === "number" && linearElastic.density_kg_m3 > 0)
    ) {
      fail(`${location}.properties.linear_elastic.density_kg_m3`, "must be positive");
    }
    if (
      "youngs_modulus_pa" in linearElastic &&
      !(typeof linearElastic.youngs_modulus_pa === "number" && linearElastic.youngs_modulus_pa > 0)
    ) {
      fail(`${location}.properties.linear_elastic.youngs_modulus_pa`, "must be positive");
    }
    if (
      "poissons_ratio" in linearElastic &&
      !(
        typeof linearElastic.poissons_ratio === "number" &&
        linearElastic.poissons_ratio > -1 &&
        linearElastic.poissons_ratio < 0.5
      )
    ) {
      fail(
        `${location}.properties.linear_elastic.poissons_ratio`,
        "must be between -1 and 0.5 for an isotropic elastic model",
      );
    }
  }

  const nonlinearModels = material.properties?.nonlinear_models;
  if (isObject(nonlinearModels)) {
    for (const [modelName, model] of Object.entries(nonlinearModels)) {
      if (!isObject(model)) continue;
      const modelLocation = `${location}.properties.nonlinear_models.${modelName}`;
      if (model.model_family_recommended === true) {
        if (typeof model.solver_ready !== "boolean") {
          fail(`${modelLocation}.solver_ready`, "must be boolean when model_family_recommended is true");
        }
        requireNonEmptyString(model.usage_level, `${modelLocation}.usage_level`);
      }
    }
  }

  for (const orthotropicKey of [
    "orthotropic_elastic",
    "orthotropic_elastic_partial",
  ]) {
    const orthotropic = material.properties?.[orthotropicKey];
    if (!isObject(orthotropic)) continue;
    for (const [key, value] of Object.entries(orthotropic)) {
      if (/^(?:E[123XYZ]|G(?:12|13|23|XY|XZ|YZ))_pa$/.test(key)) {
        if (!(typeof value === "number" && value > 0)) {
          fail(`${location}.properties.${orthotropicKey}.${key}`, "must be positive");
        }
      }
      if (/_density_kg_m3$/.test(key)) {
        if (!(typeof value === "number" && value > 0)) {
          fail(`${location}.properties.${orthotropicKey}.${key}`, "must be positive");
        }
      }
    }
  }
}

for (const category of expectedCategories) {
  if (!categoryCounts.has(category)) {
    fail("materials", `category ${category} has no records`);
  }
}

walk(database, "database", (value, location) => {
  if (typeof value === "number" && !Number.isFinite(value)) {
    fail(location, "must be a finite number");
  }
  if (
    location.endsWith(".source_ids") &&
    (!Array.isArray(value) || value.some((sourceId) => typeof sourceId !== "string"))
  ) {
    fail(location, "must be an array of source-id strings");
  }
  if (location.endsWith(".source_ids") && Array.isArray(value)) {
    for (const sourceId of value) {
      if (typeof sourceId === "string" && !sourceIds.has(sourceId)) {
        fail(location, `references missing source ${sourceId}`);
      }
    }
  }
});

if (errors.length > 0) {
  console.error(`Validation failed with ${errors.length} error(s):`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

const nonlinearModelCount = database.materials.filter(
  (material) =>
    isObject(material.properties?.nonlinear_models) &&
    Object.keys(material.properties.nonlinear_models).length > 0,
).length;
const solverMappingCount = database.materials.filter((material) =>
  Object.keys(material.other ?? {}).some((key) => /_mapping$/.test(key)),
).length;

console.log(`Validated ${path.relative(process.cwd(), databasePath) || databasePath}`);
console.log(`Schema: ${database.schema_version} (${database.created_at})`);
console.log(`Materials: ${database.materials.length}`);
console.log(`Sources: ${sourceEntries.length}`);
console.log(`Nonlinear/constitutive references: ${nonlinearModelCount}`);
console.log(`Materials with solver mappings: ${solverMappingCount}`);
console.log("Categories:");
for (const [category, count] of [...categoryCounts.entries()].sort(([a], [b]) =>
  a.localeCompare(b),
)) {
  console.log(`- ${category}: ${count}`);
}
