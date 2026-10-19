import { createHash } from 'node:crypto';

/** @type {import('next').NextConfig} */
const isStatic = process.env.STATIC_EXPORT === '1';
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

function pathVariants(root) {
  const unix = String(root).replace(/\\/g, '/');
  return [unix, String(root), encodeURIComponent(unix), unix.replaceAll('/', '%2F')].filter(Boolean);
}

function relativizeIdent(id, roots) {
  if (!id) return id;
  let out = String(id);
  const variants = [];
  for (const root of roots) {
    if (!root) continue;
    variants.push(...pathVariants(root));
  }
  variants.sort((a, b) => b.length - a.length);
  for (const variant of variants) {
    if (variant && out.includes(variant)) {
      const repl = variant.includes('%') ? encodeURIComponent('.') : '.';
      out = out.split(variant).join(repl);
    }
  }
  return out.replace(/\\/g, '/');
}

function stableId(kind, ident) {
  return kind + createHash('sha1').update(`canarydrop-v7:${kind}:${ident}`).digest('hex').slice(0, 7);
}

function sortRuntimeMaps(src) {
  let out = src.replace(/\{([^{}]{8,})\}/g, (full, inner) => {
    if (!/^[A-Za-z0-9_$]+:"[a-f0-9]+"(,[A-Za-z0-9_$]+:"[a-f0-9]+")+$/.test(inner)) return full;
    return `{${inner.split(',').sort().join(',')}}`;
  });
  out = out.replace(/\[((?:"[^"]+")(?:,(?:"[^"]+"))+)\]/g, (full, inner) => {
    const parts = inner.split(',');
    if (parts.length < 2) return full;
    if (!parts.every((part) => /^"[A-Za-z0-9_./()[\]-]+"$/.test(part))) return full;
    return `[${parts.slice().sort().join(',')}]`;
  });
  return out;
}

function moduleIdent(module, compiler, roots) {
  try {
    if (typeof module.libIdent === 'function') {
      const ident = module.libIdent({ context: compiler.context });
      if (ident) return relativizeIdent(ident, roots);
    }
  } catch {
    // Some runtime modules throw on libIdent.
  }
  if (typeof module.identifier === 'function') return relativizeIdent(module.identifier(), roots);
  if (module.resource) return relativizeIdent(module.resource, roots);
  return 'unknown';
}

const config = {
  poweredByHeader: false,
  transpilePackages: ['geist'],
  productionBrowserSourceMaps: false,
  generateBuildId: async () =>
    process.env.NEXT_PUBLIC_BUILD_ID || process.env.SOURCE_DATE_EPOCH || 'canarydrop-v7',
  webpack: (config, { isServer, dir, webpack }) => {
    if (isStatic) {
      const roots = [dir, process.cwd(), process.env.HOME].filter(Boolean);
      config.optimization.moduleIds = false;
      config.optimization.chunkIds = false;
      config.optimization.realContentHash = true;
      config.cache = false;
      if (config.output) {
        config.output.hashFunction = 'xxhash64';
        config.output.hashDigest = 'hex';
        config.output.hashDigestLength = 16;
        config.output.hashSalt = 'canarydrop-v7';
        if (typeof config.output.filename === 'string') {
          config.output.filename = config.output.filename.replaceAll('[chunkhash]', '[contenthash]');
        }
        if (typeof config.output.chunkFilename === 'string') {
          config.output.chunkFilename = config.output.chunkFilename.replaceAll('[chunkhash]', '[contenthash]');
        }
      }
      if (!isServer && config.optimization.splitChunks && typeof config.optimization.splitChunks === 'object') {
        config.optimization.splitChunks.automaticNameDelimiter = '-';
        if (config.optimization.splitChunks.cacheGroups) {
          // Size based lib splits change when a module embeds a longer checkout path.
          config.optimization.splitChunks.cacheGroups.lib = false;
        }
      }
      config.plugins.push({
        apply(compiler) {
          compiler.hooks.normalModuleFactory.tap('CanarydropRelIdent', (nmf) => {
            nmf.hooks.module.tap('CanarydropRelIdent', (module) => {
              if (typeof module.libIdent !== 'function') return;
              const orig = module.libIdent.bind(module);
              module.libIdent = (options) => relativizeIdent(orig(options), roots);
            });
          });
          compiler.hooks.compilation.tap('CanarydropStableIds', (compilation) => {
            compilation.hooks.moduleIds.tap('CanarydropStableIds', (modules) => {
              const used = new Set();
              const graph = compilation.chunkGraph;
              for (const module of modules) {
                if (graph.getModuleId(module) !== null) continue;
                let id = stableId('m', moduleIdent(module, compiler, roots));
                while (used.has(id)) id = stableId('m', `${id}+`);
                used.add(id);
                graph.setModuleId(module, id);
              }
            });
            compilation.hooks.chunkIds.tap('CanarydropStableIds', (chunks) => {
              const used = new Set();
              const graph = compilation.chunkGraph;
              for (const chunk of chunks) {
                if (chunk.id !== null && chunk.id !== undefined) continue;
                let id;
                if (chunk.name) {
                  id = chunk.name;
                } else {
                  const mods = graph
                    .getChunkModules(chunk)
                    .map((module) => String(graph.getModuleId(module)))
                    .sort()
                    .join('|');
                  id = stableId('c', mods);
                }
                while (used.has(id)) id = `${id}+`;
                used.add(id);
                chunk.id = id;
                chunk.ids = [id];
              }
            });
          });
          if (!isServer) {
            compiler.hooks.compilation.tap('CanarydropStripPaths', (compilation) => {
              compilation.hooks.processAssets.tap(
                {
                  name: 'CanarydropStripPaths',
                  stage: webpack.Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_INLINE,
                },
                (assets) => {
                  for (const [name, asset] of Object.entries(assets)) {
                    if (!/\.(js|css|html|txt|json|svg)$/.test(name)) continue;
                    const raw = asset.source();
                    const src = typeof raw === 'string' ? raw : raw.toString();
                    const next = sortRuntimeMaps(relativizeIdent(src, roots));
                    if (next !== src) {
                      compilation.updateAsset(name, new webpack.sources.RawSource(next));
                    }
                  }
                },
              );
            });
          }
        },
      });
    }
    return config;
  },
  ...(isStatic
    ? {
        output: 'export',
        trailingSlash: true,
        images: { unoptimized: true },
        ...(basePath ? { basePath, assetPrefix: basePath } : {}),
      }
    : {}),
  headers: async () => {
    if (isStatic) return [];
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
        ],
      },
    ];
  },
};

export default config;
