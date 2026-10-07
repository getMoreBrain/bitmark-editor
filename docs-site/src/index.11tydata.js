// The overview: the root once the guides are public (site.js), /overview/ until then.
export default {
  eleventyComputed: {
    permalink: (data) => data.site.home,
  },
};
