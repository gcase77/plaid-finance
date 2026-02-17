const js = require("@eslint/js");
const globals = require("globals");
const reactHooks = require("eslint-plugin-react-hooks");
const reactRefresh = require("eslint-plugin-react-refresh");
const tseslint = require("typescript-eslint");

module.exports = [
  { ignores: ["dist"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...reactRefresh.configs.vite.rules
    }
  },
  {
    files: ["src/js/**/*.js"],
    languageOptions: {
      globals: {
        ...globals.browser,
        Plaid: "readonly"
      }
    }
  }
];
