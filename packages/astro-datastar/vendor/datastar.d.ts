/**
 * Hand-written types for the vendored Datastar v1.0.2 bundle
 * (https://github.com/starfederation/datastar, bundles/datastar.js at tag
 * v1.0.2, MIT). Covers the subset of the exported JS API our plugins use;
 * extend as needed.
 */

export type HTMLOrSVG = HTMLElement | SVGElement;

export type Modifiers = Map<string, Set<string>>;

export type RequirementValue = 'allowed' | 'must' | 'denied' | 'exclusive';

export type Requirement =
  | RequirementValue
  | { key?: RequirementValue; value?: RequirementValue };

export interface AttributeContext {
  el: HTMLOrSVG;
  /** The part after `data-<name>:`, if any. */
  key: string | undefined;
  /** The raw attribute value string. */
  value: string;
  rawKey: string;
  mods: Modifiers;
  /** Evaluates the attribute expression (requires `returnsValue: true` to
   * produce a value). */
  rx: (...args: unknown[]) => unknown;
  error: (reason: string, metadata?: Record<string, unknown>) => Error;
}

export interface AttributePlugin {
  name: string;
  requirement?: Requirement;
  returnsValue?: boolean;
  argNames?: string[];
  apply(ctx: AttributeContext): void | (() => void);
}

export interface ActionContext {
  el: HTMLOrSVG;
  evt?: Event;
  error: (reason: string, metadata?: Record<string, unknown>) => Error;
}

export interface ActionPlugin<T = unknown> {
  name: string;
  apply(ctx: ActionContext, ...args: never[]): T;
}

/** Register a custom `data-<name>` attribute plugin. */
export declare function attribute(plugin: AttributePlugin): void;
/** Register a custom `@<name>()` action plugin. */
export declare function action<T>(plugin: ActionPlugin<T>): void;
export declare function watcher(plugin: {
  name: string;
  apply(ctx: unknown, argsRaw: Record<string, string>): void;
}): void;

/** Reactive effect over signal reads; returns a cleanup function. */
export declare function effect(fn: () => void): () => void;
export declare function computed<T>(fn: () => T): () => T;
export declare function signal<T>(initial: T): {
  (): T;
  set(value: T): void;
};

/** Read a signal value by dotted path (reactive inside effects). */
export declare function getPath(path: string): unknown;
/** Set signal values by [path, value] pairs. */
export declare function mergePaths(pairs: [string, unknown][]): void;
/** Deep-merge an object into the signal root. */
export declare function mergePatch(
  patch: Record<string, unknown>,
  options?: { ifMissing?: boolean },
): void;
/** Snapshot of signals matching include/exclude regexes. */
export declare function filtered(options?: {
  include?: RegExp;
  exclude?: RegExp;
}): Record<string, unknown>;

export declare function beginBatch(): void;
export declare function endBatch(): void;
export declare function startPeeking(): void;
export declare function stopPeeking(): void;

export declare const root: Record<string, unknown>;
export declare const actions: Record<
  string,
  (ctx: ActionContext, ...args: unknown[]) => unknown
>;
