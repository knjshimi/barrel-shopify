# Setup

## Development setup

To begin development, first install the theme's dependencies by running `pnpm install`.

Once dependencies are installed, you can use one of the following commands to run the local theme server:

- `npm run dev`: Runs the Vite development server and the Shopify CLI theme server in parallel.
- `npm run dev:sync`: Same as `dev` command, but with the `--theme-editor-sync` argument enabled for the Shopify CLI to sync content and settings from the remote development theme.
- `npm run start`: Builds the theme for production, then starts the Shopify CLI theme server.
- `npm run start:sync`: Same as `start` command, with Theme Editor Sync enabled for Shopify CLI

The following workflow commands are also available:

- `npm run vite:serve`: Runs only the Vite development server.
- `npm run vite:build`: Runs the Vite production build.
- `npm run shopify:serve`: Runs only the Shopify CLI theme server.
- `npm run shopify:push`: Deploys the theme to an existing instance with "safe" settings (excluding theme JSON to avoid overwriting content changes)
- `npm run shopify:push:unsafe`: Deploys the theme with "unsafe" settings (pushing all files, including theme JSON)
- `npm run shopify:push:new`: Deploys a new instance of the theme
- `npm run shopify:pull`: Syncs the local theme with a deployed instance by downloading all files, including theme JSON

## Theme structure

The theme follows the recommended Shopify file structure, including the standard folders:

- `assets` - Compiled front-end assets. This folder is excluded from git and its contents should not be modified directly.
- `config` - Theme settings schema and data. Do not modify the `settings_schema.json` file directly. (See `config/src` below.)
- `layout` - Liquid layout files
- `locales` - JSON language files
- `sections` - Liquid section files
- `snippets` - Liquid snippet files
- `templates` - Liquid and JSON template files

Additionally, there are some folders which are used for development but are excluded from Shopify theme deployments:

- `config/src` - Source files for `settings_schema.json`. Instead of modifying the schema file directly, we manage settings sections as individual JSON files under the `config/src` subdirectory.
- `frontend` - Source front-end assets. Entry points are located under `frontend/entrypoints`, and other front-end assets can be organized in subfolders under `frontend`. Assets must be imported from one of the entrypoint files to be included in the compiled output.
- `modules` - Modular theme components. This is used for convenience to organize Liquid files alongside relevant JS and CSS. See the [Modules doc](./03_MODULES.md) for more information on the usage of this folder.

## Vite build

The theme uses Vite.js to compile front-end assets such as JS and CSS for development and production.

When running in development mode, assets are served directly from the Vite server on localhost. For production, Vite compiles assets to static files and outputs them to the theme's `assets` folder.

The `vite-tag` liquid snippet is generated by the Vite server and used to render script and style tags for the specified entry point. See the Vite Shopify docs for more information.