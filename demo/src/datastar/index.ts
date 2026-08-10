/**
 * App-local Datastar entrypoint (integration `entrypoint` option): the
 * package client plus this app's own plugins.
 */
import '@wrux/astro-datastar/client';
import './plugins/cloak';
import './plugins/collapse';
import './plugins/combobox';
