import fs from 'fs'
import path from 'path'
import type { Manifest, Plugin, ResolvedConfig } from 'vite'
import createDebugger from 'debug'

import { CSS_EXTENSIONS_REGEX, KNOWN_CSS_EXTENSIONS } from './constants'
import { ResolvedVitePluginShopifyOptions } from './options'

const debug = createDebugger('vite-plugin-shopify:html')

// Plugin for generating vite-tag liquid theme snippet with entry points for JS and CSS assets
export default function shopifyHTML (options: ResolvedVitePluginShopifyOptions): Plugin {
  let config: ResolvedConfig
  let modulesPath = ''

  const viteTagSnippetPath = path.resolve(options.themeRoot, 'snippets/vite-tag.liquid')
  const viteClientSnippetPath = path.resolve(options.themeRoot, 'snippets/vite-client.liquid')

  return {
    name: 'vite-plugin-shopify-html',
    enforce: 'post',
    configResolved (resolvedConfig) {
      // Store reference to resolved config
      config = resolvedConfig

      // Check for alias generated by vite-plugin-shopify-modules
      const modulesAlias = config.resolve.alias.find((value) => value.find === '@modules')
      if (modulesAlias != null) {
        // Store relative path to modules directory
        modulesPath = path.relative(options.entrypointsDir, modulesAlias.replacement)
      }
    },
    configureServer () {
      const protocol = config.server?.https === true ? 'https:' : 'http:'
      const host = typeof config.server?.host === 'string' ? config.server.host : 'localhost'
      const port = typeof config.server?.port !== 'undefined' ? config.server.port : 5173

      const assetHost = `${protocol}//${host}:${port}`

      debug({ assetHost })

      const viteTagSnippetContent = viteTagDisclaimer + viteTagEntryPath(config.resolve.alias, options.entrypointsDir) + viteTagSnippetDev(assetHost, options.entrypointsDir, modulesPath)
      const viteClientSnippetContent = viteClientSnippetDev(assetHost)

      // Write vite-tag snippet for development server
      fs.writeFileSync(viteTagSnippetPath, viteTagSnippetContent)

      // Wirte vite-client snippet for development server
      fs.writeFileSync(viteClientSnippetPath, viteClientSnippetContent)
    },
    closeBundle () {
      const manifestFilePath = path.resolve(options.themeRoot, 'assets/manifest.json')

      if (!fs.existsSync(manifestFilePath)) {
        return
      }

      const assetTags: string[] = []
      const manifest = JSON.parse(
        fs.readFileSync(manifestFilePath, 'utf8')
      ) as Manifest

      Object.keys(manifest).forEach((src) => {
        const { file, isEntry, css, imports } = manifest[src]
        const ext = path.extname(src)

        // Generate tags for JS and CSS entry points
        if (isEntry === true) {
          const entryName = path.relative(options.entrypointsDir, src)
          const entryPaths = [entryName]
          const tagsForEntry = []

          if (ext.match(CSS_EXTENSIONS_REGEX) !== null) {
            // Render style tag for CSS entry
            tagsForEntry.push(stylesheetTag(file))
          } else {
            // Render script tag for JS entry
            tagsForEntry.push(scriptTag(file))

            if (typeof css !== 'undefined' && css.length > 0) {
              css.forEach((cssFileName: string) => {
                // Render style tag for imported CSS file
                tagsForEntry.push(stylesheetTag(cssFileName))
              })
            }

            if (typeof imports !== 'undefined' && imports.length > 0) {
              imports.forEach((importFilename: string) => {
                const chunk = manifest[importFilename]
                // Render preload tags for JS imports
                tagsForEntry.push(preloadTag(chunk.file, 'script'))
              })
            }

            // Add shorthand path for theme module entries
            if (modulesPath !== '' && !path.relative(modulesPath, entryName).includes('..')) {
              entryPaths.push(path.dirname(entryName))
            }
          }

          assetTags.push(viteEntryTag(entryPaths, tagsForEntry.join('\n  '), assetTags.length === 0))
        }

        // Generate entry tag for bundled "style.css" file when cssCodeSplit is false
        if (src === 'style.css' && !config.build.cssCodeSplit) {
          assetTags.push(viteEntryTag([src], stylesheetTag(file), false))
        }
      })

      const viteTagSnippetContent = viteTagDisclaimer + viteTagEntryPath(config.resolve.alias, options.entrypointsDir) + assetTags.join('\n') + '\n{% endif %}\n'

      // Write vite-tag snippet for production build
      fs.writeFileSync(viteTagSnippetPath, viteTagSnippetContent)

      // Wirte vite-client snippet for production build
      fs.writeFileSync(viteClientSnippetPath, viteTagDisclaimer)
    }
  }
}

const viteTagDisclaimer = '{% comment %}\n  IMPORTANT: This snippet is automatically generated by vite-plugin-shopify.\n  Do not attempt to modify this file directly, as any changes will be overwritten by the next build.\n{% endcomment %}\n'

// Generate liquid variable with resolved path by replacing aliases
const viteTagEntryPath = (
  resolveAlias: Array<{ find: string | RegExp, replacement: string }>,
  entrypointsDir: string
): string => {
  const replacements: Array<[string, string]> = []

  resolveAlias.forEach((alias) => {
    if (typeof alias.find === 'string') {
      replacements.push([alias.find, path.relative(entrypointsDir, alias.replacement)])
    }
  })

  return `{% assign path = vite-tag | ${replacements.map(([from, to]) => `replace: '${from}/', '${to}/'`).join(' | ')} %}\n`
}

// Generate conditional statement for entry tag
const viteEntryTag = (entryPaths: string[], tag: string, isFirstEntry = false): string =>
  `{% ${!isFirstEntry ? 'els' : ''}if ${entryPaths.map((entryName) => `path == "${entryName}"`).join(' or ')} %}\n  ${tag}`

// Generate a preload link tag for a script or style asset
const preloadTag = (fileName: string, as: 'script' | 'style'): string =>
  `<link rel="${as === 'script' ? 'modulepreload' : 'preload'}" href="{{ '${fileName}' | asset_url }}" as="${as}">`

// Generate a production script tag for a script asset
const scriptTag = (fileName: string): string =>
  `<script src="{{ '${fileName}' | asset_url }}" type="module" crossorigin="anonymous"></script>`

// Generate a production stylesheet link tag for a style asset
const stylesheetTag = (fileName: string): string =>
  `{{ '${fileName}' | asset_url | stylesheet_tag }}`

// Generate vite-tag snippet for development
const viteTagSnippetDev = (assetHost = 'http://localhost:5173', entrypointsDir = 'frontend/entrypoints', modulesPath = ''): string =>
  `{% liquid
  assign file_url = path | prepend: '${assetHost}/${entrypointsDir}/'
  assign file_name = path | split: '/' | last
  if file_name contains '.'
    assign file_extension = file_name | split: '.' | last
  endif
  assign css_extensions = '${KNOWN_CSS_EXTENSIONS.join('|')}' | split: '|'
  assign is_css = false
  if css_extensions contains file_extension
    assign is_css = true
  endif
  assign modules_path = '${modulesPath}'
  if file_extension == blank and modules_path != blank and file_url contains modules_path
    assign module_name = path | split: '/' | last
    assign file_url = file_url | append: '/' | append: module_name | append: '.js'
  endif
%}
{% if is_css == true %}
  {{ file_url | stylesheet_tag }}
{% else %}
  <script src="{{ file_url }}" type="module" crossorigin="anonymous"></script>
{% endif %}
`
const viteClientSnippetDev = (assetHost = 'http://localhost:5173'): string =>
  `${viteTagDisclaimer}<script src="${assetHost}/@vite/client" type="module"></script>\n`
