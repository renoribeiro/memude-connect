import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "scratch", "src/integrations/supabase/types.ts"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      // Keep the stable Hooks correctness rules enabled explicitly. Version 7 of
      // eslint-plugin-react-hooks also bundles React Compiler diagnostics in its
      // recommended preset; this Vite app does not use the React Compiler yet.
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      // shadcn/ui and provider modules intentionally co-export helpers.
      "react-refresh/only-export-components": "off",
      "@typescript-eslint/no-unused-vars": "off",
      // The legacy schema and third-party payloads are intentionally non-strict.
      // Typecheck plus runtime schemas remain the release gate while this debt is
      // migrated incrementally to `unknown`.
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
);
