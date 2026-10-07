// Only while the guides aren't public (site.js): then the overview has the root.
export default {
  eleventyComputed: {
    permalink: (data) => (data.site.guidesPublic ? false : '/'),
  },
};
