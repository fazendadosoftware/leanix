# vite-plugin-lxr

A Vite plugin for developing LeanIX Custom Reports.

## Get Started

1. Install vite and this plugin with your favorite package manager, here use npm as example:

```bash
npm install vite vite-plugin-lxr
```

2. Create a `vite.config.ts` file in your project root to config vite to actually use this plugin:
```ts
   import { defineConfig } from 'vite'
   import leanix from 'vite-plugin-lxr'
   import { fileURLToPath, URL } from 'node:url'

   export default defineConfig({
     plugins: [leanix()],
     resolve: {
       alias: {
         '@': fileURLToPath(new URL('./src', import.meta.url))
       }
     },
     build: {
       rollupOptions: {
         input: {
           app: './index.html'
         }
       }
     }
   })
```

3. Create an `./index.html` file that will be the entry point to you app:
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Vite App</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
```

4. Create an `./src/main.js` file that you can use to add some behavior to your HTML page and/or import a framework such as Vue, React, etc.

5. Add the following commands to the "script" section of your `package.json` file:
```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "upload": "vite build --mode upload"
  }
}
```

6. Create a new section in the package.json file as follows:
```json
{
  "leanixReport": {
    "id": "<your report id in dot notation, e.g. leanix.net.report.demo>",
    "title": "Your Report Title",
    "defaultConfig": {}
  }
}
```

7. Finally add a `lxr.json` file into your project root folder with the following contents:
```json
{
  "host": "<your workspace instance here, e.g. demo-eu.leanix.net>",
  "apitoken": "<your workspace api token here>"
}
```

8. You are now ready to start developing your report by issuing the following command
```bash
npm run dev
```