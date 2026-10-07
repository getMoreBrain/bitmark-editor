---
title: Example apps
lead: Three small, complete apps, one per kind of host. Start from the one that matches yours.
---

| App | Shows |
|---|---|
| [Plain TypeScript]({{ site.repo }}/tree/main/examples/vanilla-ts) | Vite and the core: `createBitmarkSession` and panes, with the app's own Monaco 0.57 and its workers |
| [React]({{ site.repo }}/tree/main/examples/react) | React 19 on Vite: `<BitmarkSession>` and `<BitmarkPane>`, with the document in React state |
| [Angular]({{ site.repo }}/tree/main/examples/angular) | A zoneless Angular 21 app: `provideBitmarkEditor`, `bm-session` as a form control, Monaco loaded on first use |

Each has a theme switcher (Auto, Light, Dark) that keeps the bitmark colours
and Monaco's theme together, a Reset button, and a short README pointing at
the lines that matter.

## Running them

From a clone of the [repository]({{ site.repo }}):

{% highlight "sh" %}
npm ci && npm run build
npm run install:angular && npm run build:angular
npm run pack:examples && npm run install:examples

npm run start:example:vanilla-ts   # http://localhost:5173
npm run start:example:react        # http://localhost:5174
npm run start:example:angular      # http://localhost:4200
{% endhighlight %}

The apps install the packages from `npm pack` tarballs of the current build,
exactly what npm would publish. CI builds all three on every change and checks
each one in a browser: highlighting, a typed edit, Reset, and the themes.
