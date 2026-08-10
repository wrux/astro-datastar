/**
 * Default client entrypoint: the vendored Datastar 1.0.2 full bundle (the
 * engine applies attributes on import) plus replace-url. Injected on every
 * page by the integration unless `entrypoint` points at an app-local module.
 */
import './plugins/replace-url';

export * from './engine';
