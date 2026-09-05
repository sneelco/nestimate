import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

export default tseslint.config(
  {
    ignores: ["dist", "node_modules", ".wrangler", "worker-configuration.d.ts", "migrations", "dev-dist"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/client/**/*.{ts,tsx,js,jsx}"],
    languageOptions: { globals: globals.browser },
    plugins: { "react-hooks": reactHooks, "react-refresh": reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
    },
  },
  {
    files: ["src/server/**/*.ts", "src/shared/**/*.{ts,js}", "test/**/*.ts"],
    languageOptions: { globals: { ...globals.serviceworker, ...globals.node } },
  },
  {
    // Legacy localStorage/download helpers kept for the pre-Outpost plan format.
    files: ["src/shared/nestimate/storage.js"],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ["*.config.{js,ts}", "auth.config.ts"],
    languageOptions: { globals: globals.node },
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
);
