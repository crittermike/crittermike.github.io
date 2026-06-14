/**
 * Single JSON dump of every data layer the dashboard consumes.
 *
 * Built into: /data.json
 *
 * Use from a local build:
 *   curl https://crittermike.github.io/family/data.json > local-data.json
 *
 * Then point your local dashboard's data layer at that file instead of the
 * live readers (CalDAV, wiki, Lunch Money, etc.) so you can iterate offline.
 */

module.exports = class {
  data() {
    return {
      permalink: '/data.json',
      eleventyExcludeFromCollections: true,
    };
  }

  render(data) {
    // Eleventy globals are exposed on `data` by key (filename minus `.js`).
    const payload = {
      generated_at: new Date().toISOString(),
      generated_by: 'crittermike.github.io/family build',
      // Each key here mirrors src/_data/<key>.js
      calendar:  data.calendar  || [],
      kids:      data.kids      || [],
      chores:    data.chores    || {},
      dinner:    data.dinner    || null,
      mealweek:  data.mealweek  || [],
      weather:   data.weather   || null,
      recipes:   data.recipes   || [],
    };
    return JSON.stringify(payload, null, 2);
  }
};
