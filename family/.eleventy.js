module.exports = function(eleventyConfig) {
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