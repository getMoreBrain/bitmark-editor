// The sidebar, in reading order ("Previous" and "Next" follow it).
export default [
  {
    title: 'Introduction',
    items: [
      { title: 'Overview', url: '/' },
      { title: 'Getting started', url: '/getting-started/' },
    ],
  },
  {
    title: 'Guides',
    items: [
      { title: 'Static site (/bundled)', url: '/guides/static-site/' },
      { title: 'A host with Monaco', url: '/guides/host-with-monaco/' },
      { title: 'React', url: '/guides/react/' },
      { title: 'Angular', url: '/guides/angular/' },
      { title: 'Custom elements', url: '/guides/elements/' },
      { title: 'Panes', url: '/guides/panes/' },
      { title: 'The session', url: '/guides/session/' },
      { title: 'The parser', url: '/guides/parser/' },
      { title: 'Theming', url: '/guides/theming/' },
      { title: 'Content Security Policy', url: '/guides/csp/' },
    ],
  },
  {
    title: 'Demos',
    items: [
      { title: 'Try it', url: '/demos/try-it/' },
      { title: 'Injected parser', url: '/demos/injected-parser/' },
      { title: 'Example apps', url: '/demos/example-apps/' },
    ],
  },
  {
    title: 'Reference',
    items: [
      { title: 'API reference', url: '/api/', external: true },
      { title: 'Tested versions', url: '/reference/tested-versions/' },
      { title: 'Sizes', url: '/reference/sizes/' },
      { title: 'Changelog', url: '/reference/changelog/' },
    ],
  },
];
