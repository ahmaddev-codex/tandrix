import js from "@eslint/js";
import tseslint from "typescript-eslint";

// Design-system rule: colours come from @tandrix/ui tokens only.
const rawColour = {
  selector:
    "Literal[value=/^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$|^(?:rgb|rgba|hsl|hsla|oklch)\\(/]",
  message: "Use a @tandrix/ui token instead of a raw colour value.",
};
const rawColourInTemplate = {
  selector:
    "TemplateElement[value.raw=/#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\\b|(?:rgb|rgba|hsl|hsla)\\(/]",
  message: "Use a @tandrix/ui token instead of a raw colour value.",
};

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/.open-next/**",
      "**/.wrangler/**",
      "apps/web/next-env.d.ts",
      "**/.expo/**",
      "docs/**",
      "packages/ui/src/generated/**",
      "apps/mobile/ios/**",
      "apps/mobile/android/**",
      "apps/mobile/expo-env.d.ts",
      ".maestro/**",
      // Third-party: the Anatomy figure kit (MIT), kept as published.
      "apps/web/src/vendor/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": "error",
    },
  },
  {
    // Node-run CommonJS config files (Metro).
    files: ["**/metro.config.js"],
    languageOptions: {
      sourceType: "commonjs",
      globals: { require: "readonly", module: "writable", __dirname: "readonly" },
    },
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  {
    // Node-run helper scripts for the end-to-end flows and benches.
    files: ["apps/mobile/e2e/**/*.mjs", "fixtures/**/*.mjs"],
    languageOptions: {
      globals: {
        process: "readonly",
        fetch: "readonly",
        setTimeout: "readonly",
        console: "readonly",
        Buffer: "readonly",
      },
    },
  },
  {
    files: ["apps/**/*.{ts,tsx}", "packages/**/*.{ts,tsx}"],
    ignores: ["packages/ui/**", "**/*.test.{ts,tsx}"],
    rules: { "no-restricted-syntax": ["error", rawColour, rawColourInTemplate] },
  },
);
