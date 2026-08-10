/**
 * Re-export of the vendored Datastar 1.0.2 engine API for plugin authors
 * (this package's own plugins and component-coupled ones like the ui
 * Select). Importing this module ALSO boots the full official plugin set:
 * the vendored bundle registers its attributes/actions/watchers and applies
 * them to the document as a side effect of being loaded.
 */
export {
  action,
  actions,
  attribute,
  beginBatch,
  computed,
  effect,
  endBatch,
  filtered,
  getPath,
  mergePatch,
  mergePaths,
  root,
  signal,
  startPeeking,
  stopPeeking,
  watcher,
} from '../vendor/datastar.js';

export type {
  ActionContext,
  ActionPlugin,
  AttributeContext,
  AttributePlugin,
  HTMLOrSVG,
  Modifiers,
  Requirement,
} from '../vendor/datastar.js';
