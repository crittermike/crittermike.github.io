/**
 * Recipes data layer.
 *
 * Single source of truth lives in ~/.hermes/workspace/wiki/:
 *   - concepts/recipe-<slug>.md          — full recipes with frontmatter, ingredients, steps
 *   - state/data/dinner-rotation.json    — meal rotation (used by meal-planning crons)
 *
 * We merge both sources into one normalized array so Eleventy can paginate
 * detail pages and the index page can filter/search across everything.
 *
 * Normalized shape:
 *   {
 *     slug, name, source, hasFullRecipe,
 *     tags: [...],
 *     effort, kid_friendly, protein_g, cal, servings, prep_min, cook_min,
 *     ingredient_groups: [{ heading, items: [...] }],
 *     all_ingredients: [string],   // flat list, for global ingredient search
 *     steps: [string],             // numbered method
 *     notes, instructions,         // raw fallback prose
 *     body_html: string            // full markdown body rendered (for prose-heavy recipes)
 *   }
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const matter = require('gray-matter');
const MarkdownIt = require('markdown-it');

const md = new MarkdownIt({ html: true, linkify: true, breaks: false });

const WIKI_BASE = path.join(os.homedir(), '.hermes', 'workspace', 'wiki');
const RECIPE_DIR = path.join(WIKI_BASE, 'concepts');
const ROTATION_FILE = path.join(WIKI_BASE, 'state', 'data', 'dinner-rotation.json');

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80);
}

/**
 * Parse a recipe markdown body into structured ingredient groups + steps.
 * Handles both:
 *   ## Ingredients
 *   - thing
 *   - other thing
 * and:
 *   ## Ingredients
 *   ### Group A
 *   - thing
 *   ### Group B
 *   - other
 */
function parseRecipeMarkdown(body) {
  const lines = body.split(/\r?\n/);
  const ingredient_groups = [];
  const steps = [];
  let mode = null;              // 'ingredients' | 'steps' | 'notes' | null
  let currentGroup = null;
  const notesLines = [];
  const toppingsLines = [];
  let toppingsMode = false;

  function flushGroup() {
    if (currentGroup && currentGroup.items.length) {
      ingredient_groups.push(currentGroup);
    }
    currentGroup = null;
  }

  for (const raw of lines) {
    const line = raw.trimEnd();

    // H2 headings reset mode
    const h2 = line.match(/^##\s+(.+)$/);
    if (h2) {
      flushGroup();
      toppingsMode = false;
      const heading = h2[1].toLowerCase();
      if (/ingredient/i.test(heading)) {
        mode = 'ingredients';
        currentGroup = { heading: null, items: [] };
      } else if (/^(step|method|direction|instruction)/i.test(heading)) {
        mode = 'steps';
      } else if (/topping/i.test(heading)) {
        mode = 'ingredients';
        toppingsMode = true;
        currentGroup = { heading: 'Toppings', items: [] };
      } else if (/note|pitfall|kid reaction|morning prep|assembly/i.test(heading)) {
        mode = 'notes';
        notesLines.push(`### ${h2[1]}`);
      } else {
        mode = null;
      }
      continue;
    }

    // H3 inside ingredients = subgroup
    const h3 = line.match(/^###\s+(.+)$/);
    if (h3 && mode === 'ingredients') {
      flushGroup();
      currentGroup = { heading: h3[1].trim(), items: [] };
      continue;
    }
    if (h3 && mode === 'notes') {
      notesLines.push(line);
      continue;
    }

    if (mode === 'ingredients') {
      const li = line.match(/^[-*]\s+(.+)$/);
      if (li) {
        if (!currentGroup) currentGroup = { heading: null, items: [] };
        currentGroup.items.push(li[1].trim());
      }
    } else if (mode === 'steps') {
      // Numbered list OR bullet list both work
      const numbered = line.match(/^\d+\.\s+(.+)$/);
      const bullet = line.match(/^[-*]\s+(.+)$/);
      if (numbered) steps.push(numbered[1].trim());
      else if (bullet) steps.push(bullet[1].trim());
      else if (line.trim() && steps.length) {
        // Continuation line — append to last step
        steps[steps.length - 1] += ' ' + line.trim();
      }
    } else if (mode === 'notes' && line.trim()) {
      notesLines.push(line);
    }
  }
  flushGroup();

  return { ingredient_groups, steps, notes_md: notesLines.join('\n').trim() };
}

function loadMarkdownRecipes() {
  if (!fs.existsSync(RECIPE_DIR)) return [];
  const files = fs.readdirSync(RECIPE_DIR).filter(f => /^recipe-.+\.md$/.test(f));
  const out = [];
  for (const file of files) {
    const slug = file.replace(/^recipe-/, '').replace(/\.md$/, '');
    const full = path.join(RECIPE_DIR, file);
    let parsed;
    try {
      parsed = matter(fs.readFileSync(full, 'utf8'));
    } catch (e) {
      console.warn(`[recipes] skip ${file}: ${e.message}`);
      continue;
    }
    const fm = parsed.data || {};
    const body = parsed.content || '';

    // Title: prefer frontmatter title, strip "Recipe — " prefix, else first H1
    let name = fm.title || '';
    name = name.replace(/^recipe\s*[—–-]\s*/i, '').trim();
    if (!name) {
      const h1 = body.match(/^#\s+(.+)$/m);
      if (h1) name = h1[1].trim();
    }
    if (!name) name = slug;

    const { ingredient_groups, steps, notes_md } = parseRecipeMarkdown(body);
    const all_ingredients = ingredient_groups.flatMap(g => g.items);

    out.push({
      slug,
      name,
      source: 'markdown',
      hasFullRecipe: true,
      tags: Array.isArray(fm.tags) ? fm.tags : [],
      aliases: Array.isArray(fm.aliases) ? fm.aliases : [],
      effort: fm.effort || null,
      kid_friendly: fm.kid_friendly !== false,
      protein_g: fm.protein_g || fm.protein_per_serving || null,
      cal: fm.cal || fm.calories_per_serving || null,
      servings: fm.servings || null,
      prep_min: fm.prep_min || null,
      cook_min: fm.cook_min || null,
      ingredient_groups,
      all_ingredients,
      steps,
      notes: notes_md ? md.render(notes_md) : '',
      body_html: md.render(body),
      last_reviewed: fm.last_reviewed || null,
    });
  }
  return out;
}

function loadRotationRecipes() {
  if (!fs.existsSync(ROTATION_FILE)) return [];
  let rotation;
  try {
    rotation = JSON.parse(fs.readFileSync(ROTATION_FILE, 'utf8'));
  } catch (e) {
    console.warn(`[recipes] failed to parse rotation: ${e.message}`);
    return [];
  }
  return (rotation.meals || []).map(meal => {
    const slug = slugify(meal.name);
    const ingredients = (meal.ingredients || []).map(s => String(s));
    return {
      slug,
      name: meal.name,
      source: 'rotation',
      hasFullRecipe: !!(meal.instructions || meal.notes),
      tags: ['dinner'],
      effort: meal.effort || null,
      kid_friendly: meal.kid_friendly !== false,
      protein_g: meal.protein_g || meal.protein_per_serving || null,
      cal: meal.cal || meal.calories_per_serving || null,
      servings: meal.servings || null,
      prep_min: meal.prep_min || null,
      cook_min: meal.cook_min || null,
      ingredient_groups: ingredients.length ? [{ heading: null, items: ingredients }] : [],
      all_ingredients: ingredients,
      steps: meal.instructions
        ? meal.instructions.split(/\.\s+(?=[A-Z])/).map(s => s.trim()).filter(Boolean)
        : [],
      notes: meal.notes || meal._note || '',
      body_html: '',
      recipe_file: meal.recipe_file || null,
    };
  });
}

module.exports = function () {
  const mdRecipes = loadMarkdownRecipes();
  const rotationRecipes = loadRotationRecipes();

  // Merge: markdown wins on slug collision. Also merge metadata from rotation
  // (calories, protein, effort) INTO matching markdown recipes when missing.
  const bySlug = new Map();
  for (const r of mdRecipes) bySlug.set(r.slug, r);

  // Build alias index for matching rotation entries to markdown recipes
  // when slugs differ slightly (e.g. "Korean ground beef + broccoli bowls" vs "korean-beef-broccoli-bowls").
  const aliasIndex = new Map();
  for (const r of mdRecipes) {
    for (const a of r.aliases) aliasIndex.set(a, r.slug);
    // Match on recipe_file pointer too
    aliasIndex.set(`recipe-${r.slug}.md`, r.slug);
  }

  for (const rot of rotationRecipes) {
    // Try to match this rotation entry to an existing markdown recipe
    let mdSlug = null;
    if (rot.recipe_file) {
      // recipe_file looks like "wiki/concepts/recipe-foo.md"
      const m = rot.recipe_file.match(/recipe-(.+?)\.md/);
      if (m && bySlug.has(m[1])) mdSlug = m[1];
    }
    if (!mdSlug && bySlug.has(rot.slug)) mdSlug = rot.slug;

    if (mdSlug) {
      // Merge missing metadata from rotation into markdown recipe
      const existing = bySlug.get(mdSlug);
      existing.protein_g = existing.protein_g || rot.protein_g;
      existing.cal = existing.cal || rot.cal;
      existing.effort = existing.effort || rot.effort;
      existing.servings = existing.servings || rot.servings;
      if (!existing.tags.includes('dinner')) existing.tags.push('dinner');
    } else {
      // Standalone rotation entry, no markdown counterpart
      // Make sure its slug doesn't collide
      let finalSlug = rot.slug;
      let i = 2;
      while (bySlug.has(finalSlug)) {
        finalSlug = `${rot.slug}-${i++}`;
      }
      rot.slug = finalSlug;
      bySlug.set(finalSlug, rot);
    }
  }

  const all = Array.from(bySlug.values());

  // Sort: full recipes first, then alphabetical
  all.sort((a, b) => {
    if (a.hasFullRecipe !== b.hasFullRecipe) return a.hasFullRecipe ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return all;
};
