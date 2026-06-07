/**
 * Recipes data layer.
 *
 * Single source of truth: ~/.hermes/workspace/wiki/concepts/recipe-*.md
 *
 * Frontmatter fields used:
 *   title, aliases[], tags[], in_rotation (bool), kid_friendly (bool),
 *   effort, protein_g, cal, servings, prep_min, cook_min, source,
 *   last_reviewed
 *
 * Body convention:
 *   # Title
 *   <optional notes paragraph>
 *   ## Ingredients
 *   ### Optional Subgroup
 *   - item
 *   ## Steps
 *   1. step
 *   ## Toppings (optional, treated as ingredients subgroup)
 *   ## Notes / Pitfalls / etc. (optional, captured into notes_md)
 *
 * Rotation meals = recipes with `in_rotation: true`. Filter with
 * `recipes | rotation` in templates (filter defined in .eleventy.js).
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const matter = require('gray-matter');
const MarkdownIt = require('markdown-it');

const md = new MarkdownIt({ html: true, linkify: true, breaks: false });

const WIKI_BASE = path.join(os.homedir(), '.hermes', 'workspace', 'wiki');
const RECIPE_DIR = path.join(WIKI_BASE, 'concepts');

/**
 * Parse a recipe markdown body into structured ingredient groups + steps.
 */
function parseRecipeMarkdown(body) {
  const lines = body.split(/\r?\n/);
  const ingredient_groups = [];
  const steps = [];
  let mode = null;
  let currentGroup = null;
  const notesLines = [];

  function flushGroup() {
    if (currentGroup && currentGroup.items.length) {
      ingredient_groups.push(currentGroup);
    }
    currentGroup = null;
  }

  for (const raw of lines) {
    const line = raw.trimEnd();

    const h2 = line.match(/^##\s+(.+)$/);
    if (h2) {
      flushGroup();
      const heading = h2[1].toLowerCase();
      if (/ingredient/i.test(heading)) {
        mode = 'ingredients';
        currentGroup = { heading: null, items: [] };
      } else if (/^(step|method|direction|instruction)/i.test(heading)) {
        mode = 'steps';
      } else if (/topping/i.test(heading)) {
        mode = 'ingredients';
        currentGroup = { heading: 'Toppings', items: [] };
      } else if (/note|pitfall|kid reaction|morning prep|assembly/i.test(heading)) {
        mode = 'notes';
        notesLines.push(`### ${h2[1]}`);
      } else {
        mode = null;
      }
      continue;
    }

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
      const numbered = line.match(/^\d+\.\s+(.+)$/);
      const bullet = line.match(/^[-*]\s+(.+)$/);
      if (numbered) steps.push(numbered[1].trim());
      else if (bullet) steps.push(bullet[1].trim());
      else if (line.trim() && steps.length) {
        steps[steps.length - 1] += ' ' + line.trim();
      }
    } else if (mode === 'notes' && line.trim()) {
      notesLines.push(line);
    }
  }
  flushGroup();

  return { ingredient_groups, steps, notes_md: notesLines.join('\n').trim() };
}

module.exports = function () {
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

    let name = fm.title || '';
    name = name.replace(/^recipe\s*[—–-]\s*/i, '').trim();
    if (!name) {
      const h1 = body.match(/^#\s+(.+)$/m);
      if (h1) name = h1[1].trim();
    }
    if (!name) name = slug;

    const { ingredient_groups, steps, notes_md } = parseRecipeMarkdown(body);
    const all_ingredients = ingredient_groups.flatMap(g => g.items);

    const tags = Array.isArray(fm.tags) ? [...fm.tags] : [];
    if (fm.in_rotation && !tags.includes('dinner')) tags.push('dinner');

    out.push({
      slug,
      name,
      source: fm.source || 'markdown',
      hasFullRecipe: steps.length > 0 || all_ingredients.length > 0,
      tags,
      aliases: Array.isArray(fm.aliases) ? fm.aliases : [],
      in_rotation: !!fm.in_rotation,
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

  // Sort: rotation meals first, then alphabetical
  out.sort((a, b) => {
    if (a.in_rotation !== b.in_rotation) return a.in_rotation ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return out;
};
