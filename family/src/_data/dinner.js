/**
 * Tonight's dinner — single source of truth: wiki/state/weekly-meal-plan.json
 *
 * Resolves the meal for the current weekday from the most recent weekly plan,
 * then enriches it with full recipe content from the recipes data layer
 * (which already merges concepts/recipe-*.md). If today is past the week boundary
 * we still use the plan (Mike updates it weekly anyway and we don't want a blank
 * card on rollover lag).
 *
 * Returns:
 *   {
 *     name, protein_g, cal, effort, note,
 *     recipe: <recipe object from recipes.js or null>
 *   }
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const PLAN_FILE = path.join(os.homedir(), '.hermes', 'workspace', 'wiki', 'state', 'weekly-meal-plan.json');
const recipesLoader = require('./recipes.js');

const DOW = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80);
}

module.exports = function () {
  if (!fs.existsSync(PLAN_FILE)) return null;

  let plan;
  try {
    plan = JSON.parse(fs.readFileSync(PLAN_FILE, 'utf8'));
  } catch (e) {
    console.warn(`[dinner] failed to parse meal plan: ${e.message}`);
    return null;
  }

  const today = new Date();
  const dow = DOW[today.getDay()];
  const meal = plan.meals && plan.meals[dow];
  if (!meal || !meal.name) return null;

  // Resolve to a full recipe if we have one.
  // We match by slug-of-meal-name OR by aliases on the recipe.
  const recipes = recipesLoader();
  const mealSlug = slugify(meal.name);
  let recipe = null;

  // Direct slug match
  recipe = recipes.find(r => r.slug === mealSlug) || null;

  // Alias match
  if (!recipe) {
    recipe = recipes.find(r => (r.aliases || []).some(a => slugify(a) === mealSlug)) || null;
  }

  // Loose name match (substring against recipe name)
  if (!recipe) {
    const lower = meal.name.toLowerCase();
    recipe = recipes.find(r => lower.includes(r.name.toLowerCase()) || r.name.toLowerCase().includes(lower)) || null;
  }

  return {
    name: meal.name,
    protein_g: meal.protein_g || null,
    cal: meal.cal || null,
    effort: meal.effort || null,
    note: meal._note || meal.note || '',
    recipe,
  };
};
