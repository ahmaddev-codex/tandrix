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
      "**/.expo/**",
      "docs/**",
      "packages/ui/src/generated/**",
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
    files: ["apps/**/*.{ts,tsx}", "packages/**/*.{ts,tsx}"],
    ignores: ["packages/ui/**", "**/*.test.{ts,tsx}"],
    rules: { "no-restricted-syntax": ["error", rawColour, rawColourInTemplate] },
  },
);
