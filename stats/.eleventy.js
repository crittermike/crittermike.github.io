module.exports = function(eleventyConfig) {
  return {
    dir: {
      input: "src",
      output: ".",
      includes: "_includes",
      data: "_data"
    },
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk",
    templateFormats: ["html", "njk", "md"]
  };
};
