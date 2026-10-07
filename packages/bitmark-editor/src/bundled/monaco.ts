// The Monaco half of `/bundled` (PLAN-022 D4): loaded only when a session
// starts, so a lazy page pays nothing before its trigger (D12).
// Monaco 0.57 module paths (its "exports" map `monaco-editor/*` to `esm/vs/*`).
//
// First, and statically: Monaco's editor features (internal/common/workers.js
// imports them all, CodeLens and drop-into-editor among them). Monaco takes
// its services once, when it first initialises (the language registrations
// below do that). The JSON language loads this module lazily, after
// initialisation, so without this import the late features' services are
// missing, and those features fail when Monaco creates them once the page is
// idle ("depends on UNKNOWN service ICodeLensCache"). The code is in the
// bundle either way; this only runs it before initialisation.
import 'monaco-editor/internal/common/workers';
import 'monaco-editor/languages/definitions/html/register';
import 'monaco-editor/languages/definitions/xml/register';
import 'monaco-editor/editor/contrib/suggest/browser/suggestController';
import 'monaco-editor/editor/contrib/hover/browser/hoverContribution';
import 'monaco-editor/features/codicon/register';

import * as api from 'monaco-editor/editor/editor.api';
import * as json from 'monaco-editor/language/json/monaco.contribution';

import type { Monaco } from '../monaco/types.js';

/** The editor API with the JSON language's defaults at `monaco.json`, as 0.55+ has them. */
export const monaco = { ...api, json } as unknown as Monaco;
