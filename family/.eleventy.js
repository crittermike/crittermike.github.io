module.exports = function(eleventyConfig) {
  // Copy shared CSS to output so all pages can link it.
  // Source is in _includes (gitignored from output by default), so copy explicitly.
  eleventyConfig.addPassthroughCopy({ "src/_includes/shared.css": "shared.css" });

  // Copy static image assets (e.g. the 4th of July flag background) to output.
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });

  // Set directories
  return {
    dir: {
      input: "src",
      output: ".",  // Output directly to family/ directory for GitHub Pages
      includes: "_includes",
      data: "_data"
    },
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk",
    templateFormats: ["html", "njk", "md", "11ty.js"]
  };
};
