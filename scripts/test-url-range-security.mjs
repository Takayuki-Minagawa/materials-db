import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const featuresSource = await readFile(new URL("../js/features.js", import.meta.url), "utf8");
const context = vm.createContext({ URLSearchParams });
vm.runInContext(`${featuresSource}\nglobalThis.__features = Features;`, context);

const {
  PROPERTY_DEFS,
  parseStrictFiniteNumber,
  parseRangeFilters,
  appendRangeFilters,
} = context.__features;
const allowedKeys = PROPERTY_DEFS.map(({ key }) => key);

for (const [rawValue, expected] of [
  ["0", 0],
  ["-12.5", -12.5],
  [".25", 0.25],
  ["1e3", 1000],
  [" 42 ", 42],
  ["", null],
  [" ", null],
  ["1abc", null],
  ["NaN", null],
  ["Infinity", null],
  ["-Infinity", null],
  ["1e309", null],
  ["0x10", null],
]) {
  assert.equal(parseStrictFiniteNumber(rawValue), expected, rawValue);
}

const params = new URLSearchParams();
params.append("r_youngs_modulus_min", "1e9");
params.append("r_density_max", "1200.5");
params.append("r___proto___min", "123");
params.append("r___proto___max", "124");
params.append("r_constructor_max", "456");
params.append("r_toString_min", "457");
params.append("r_hasOwnProperty_max", "458");
params.append("r_unknown_min", "789");
params.append("r_yield_strength_min", "1abc");
params.append("r_yield_strength_max", "Infinity");
params.append("r_density_min", "0x10");
params.append("r_uts_min", "5e6");

const parsed = parseRangeFilters(params, allowedKeys);

assert.equal(Object.getPrototypeOf(parsed), null);
assert.equal(Object.getPrototypeOf(parsed.youngs_modulus), null);
assert.equal(Object.getPrototypeOf(parsed.density), null);
assert.equal(parsed.youngs_modulus.min, 1e9);
assert.equal(parsed.density.max, 1200.5);
assert.equal(parsed.yield_strength, undefined);
assert.equal(parsed.uts.min, 5e6);
assert.equal(parsed.__proto__, undefined);
assert.equal(parsed.constructor, undefined);
assert.equal(parsed.toString, undefined);
assert.equal(parsed.hasOwnProperty, undefined);
assert.equal(Object.prototype.min, undefined);
assert.equal(Object.prototype.max, undefined);
assert.equal(Object.max, undefined);
assert.equal(Object.prototype.toString.min, undefined);
assert.equal(Object.prototype.hasOwnProperty.max, undefined);

const filtersToSerialize = Object.create(null);
filtersToSerialize.youngs_modulus = Object.assign(Object.create(null), {
  min: 2.1e9,
  max: Infinity,
});
filtersToSerialize.density = Object.assign(Object.create(null), { max: 950 });
filtersToSerialize.yield_strength = Object.assign(Object.create(null), { min: NaN });
filtersToSerialize.unknown = { min: 1 };
filtersToSerialize.__proto__ = { max: 2 };

const serialized = new URLSearchParams();
appendRangeFilters(serialized, filtersToSerialize, allowedKeys);

assert.equal(serialized.get("r_youngs_modulus_min"), "2100000000");
assert.equal(serialized.get("r_density_max"), "950");
assert.equal(serialized.has("r_youngs_modulus_max"), false);
assert.equal(serialized.has("r_yield_strength_min"), false);
assert.equal(serialized.has("r_unknown_min"), false);
assert.equal(serialized.has("r___proto___max"), false);

console.log("Validated URL range-filter security");
