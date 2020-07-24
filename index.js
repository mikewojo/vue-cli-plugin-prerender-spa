"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _fs = require("fs");

var _path = require("path");

var _prerenderSpaPlugin = _interopRequireWildcard(require("prerender-spa-plugin"));

function _getRequireWildcardCache() { if (typeof WeakMap !== "function") return null; var cache = new WeakMap(); _getRequireWildcardCache = function () { return cache; }; return cache; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

//@ts-check
const Renderer = _prerenderSpaPlugin.PuppeteerRenderer;
const CONFIG_OBJ_PATH = "pluginOptions.prerenderSpa";
var _default = entry;
exports.default = _default;
module.exports = entry;

function entry(api, projectOptions) {
  api.chainWebpack(chain(api, projectOptions));
}

function chain(api, projectOptions) {
  return config => {
    const options = createPluginOptions(api, projectOptions);
    if (!options || options.disable) return; // If there aren't any options or disabled, don't run

    if (options.onlyProduction && process.env.NODE_ENV !== "production") {
      return;
    }

    const renderer = createRenderer(api, projectOptions);
    const paths = resolvePaths(api, projectOptions.outputDir, projectOptions.assetsDir);
    const prerenderOptions = { ...paths,
      routes: options.renderRoutes,
      renderer,
      postProcess: renderedRoute => {
        const route = renderedRoute.route;

        if (route[route.length - 1] !== "/" && (0, _path.extname)(route) === "") {
          renderedRoute.outputPath = (0, _path.join)(paths.outputDir || paths.staticDir, `${route}.html`);
        }

        const userPostProcess = options.postProcess && typeof options.postProcess === "function" ? options.postProcess : noop;
        return userPostProcess(renderedRoute);
      }
    };
    config.plugin("pre-render").use(_prerenderSpaPlugin.default, [prerenderOptions]);

    if (process.env.NODE_ENV === "production") {
      config.plugin("html-app").tap(args => {
        args[0].template = api.resolve("public/index.html");
        args[0].filename = "app.html";
        return args;
      });
    }
  };
}

function createRenderer(api, projectOptions) {
  const rendererConfig = createRendererConfig(api, projectOptions);
  const renderer = new Renderer(rendererConfig);

  renderer.preServer = Prerenderer => {
    const publicPath = projectOptions.publicPath || projectOptions.baseUrl;

    if (publicPath) {
      const prefix = publicPath;
      const server = Prerenderer._server._expressServer;
      server.use((req, res, next) => {
        if (req.url.indexOf(prefix) === 0) {
          req.url = req.url.slice(prefix.length - 1);
        }

        next();
      });
    }

    if (projectOptions.pages) {
      const server = Prerenderer._server._expressServer;
      server.get("*", (req, res, next) => {
        if (!(0, _path.extname)(req.url)) {
          const filePath = api.resolve(`${projectOptions.outputDir}${req.url}${(0, _path.basename)(req.url) ? ".html" : "index.html"}`);
          (0, _fs.exists)(filePath, exists => exists ? res.sendFile(filePath) : next());
          return;
        }

        next();
      });
    }
  };

  return renderer;
}

function createRendererConfig(api, projectOptions) {
  let options = createPluginOptions(api, projectOptions);
  let rendererConfig = {
    headless: options.headless,
    maxConcurrentRoutes: options.parallel ? 4 : 1
  };

  if (options.useRenderEvent) {
    rendererConfig["renderAfterDocumentEvent"] = "x-app-rendered";
  }

  if (options.customRendererConfig) {
    Object.assign(rendererConfig, options.customRendererConfig);
  }

  return rendererConfig;
}

function createPluginOptions(api, projectOptions) {
  let options = {}; // Fixes Object.assign error if there's no 'pluginOptions.prerenderSpa' in vue.config.js

  let oldConfigPath = api.resolve(".prerender-spa.json");

  try {
    options = pickle(projectOptions, CONFIG_OBJ_PATH);

    if ((0, _fs.existsSync)(oldConfigPath)) {
      Object.assign(options, JSON.parse((0, _fs.readFileSync)(oldConfigPath).toString("utf-8")));
    }
  } catch (_unused) {
    if ((0, _fs.existsSync)(oldConfigPath)) {
      options = JSON.parse((0, _fs.readFileSync)(oldConfigPath).toString("utf-8"));
    }
  }

  if (Object.entries(options).length === 0) return undefined; // No options at all, therefore don't return any options.
  // return options; // TODO: Fix #16 permanently

  return Object.assign(options, {
    onlyProduction: true
  }); // Force disable on development build, workaround for #16
}

function resolvePaths(api, baseUrl, assetsDir) {
  return {
    outputDir: api.resolve(baseUrl),
    staticDir: api.resolve(baseUrl),
    assetsDir: api.resolve((0, _path.join)(baseUrl, assetsDir)),
    indexPath: api.resolve((0, _path.join)(baseUrl, process.env.NODE_ENV === "production" ? "app.html" : "index.html"))
  };
}

function pickle(object, path) {
  const keys = path.split(".");

  for (const key of keys) {
    object = object[key];
  }

  return object;
}

function noop(arg) {
  return arg;
}