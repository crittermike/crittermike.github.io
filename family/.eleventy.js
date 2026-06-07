module.exports = function(eleventyConfig) {
  // Copy shared CSS to output so all pages can link it.
  // Source is in _includes (gitignored from output by default), so copy explicitly.
  eleventyConfig.addPassthroughCopy({ "src/_includes/shared.css": "shared.css" });

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
    templateFormats: ["html", "njk", "md"]
  };
};
