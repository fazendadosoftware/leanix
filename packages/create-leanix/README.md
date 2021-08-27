# create-leanix

## Scaffolding Your First LeanIX Custom Report

> **Compatibility Note:**
> Requires [Node.js](https://nodejs.org/en/) version >=12.0.0.

With NPM:

```bash
$ npm init leanix@latest
```

With Yarn:

```bash
$ yarn create leanix
```

With PNPM:

```bash
$ pnpx create-leanix
```

Then follow the prompts!

You can also directly specify the project name and the template you want to use via additional command line options. For example, to scaffold a LeanIX Custom Report using Vue, run:

```bash
# npm 6.x
npm init leanix@latest my-custom-report --template vue

# npm 7+, extra double-dash is needed:
npm init leanix@latest my-custom-report -- --template vue

# yarn
yarn create leanix my-custom-report --template vue

# pnpm
pnpx create-leanix my-custom-report --template vue
```

Currently supported template presets include:

- `vanilla`
- `vanilla-ts`
- `vue`
- `vue-ts`
