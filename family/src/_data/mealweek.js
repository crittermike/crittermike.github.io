/**
 * Full week of meals from wiki/state/weekly-meal-plan.json, with recipes resolved.
 *
 * Returns an array of 7 entries in calendar order (Sun..Sat), each:
 *   { dow, dow_short, name, isToday, recipe }
 *
 * recipe is null when no match. Used by dashboard's "This Week" card.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const PLAN_FILE = path.join(os.homedir(), '.hermes', 'workspace', 'wiki', 'state', 'weekly-meal-plan.json');
const recipesLoader = require('./recipes.js');

const DOW = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const DOW_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80);
}

function findRecipe(recipes, name) {
  if (!name) return null;
  const mealSlug = slugify(name);
  let recipe = recipes.find(r => r.slug === mealSlug);
  if (recipe) return recipe;
  recipe = recipes.find(r => (r.aliases || []).some(a => slugify(a) === mealSlug));
  if (recipe) return recipe;
  const lower = name.toLowerCase();
  recipe = recipes.find(r => lower.includes(r.name.toLowerCase()) || r.name.toLowerCase().includes(lower));
  return recipe || null;
}

module.exports = function () {
  if (!fs.existsSync(PLAN_FILE)) return [];

  let plan;
  try {
    plan = JSON.parse(fs.readFileSync(PLAN_FILE, 'utf8'));
  } catch (e) {
    console.warn(`[mealweek] failed to parse meal plan: ${e.message}`);
    return [];
  }

  const recipes = recipesLoader();
  const todayDow = DOW[new Date().getDay()];

  return DOW.map((dow, i) => {
    const meal = (plan.meals && plan.meals[dow]) || {};
    return {
      dow,
      dow_short: DOW_SHORT[i],
      name: meal.name || 'TBD',
      isToday: dow === todayDow,
      recipe: findRecipe(recipes, meal.name),
    };
  });
};
