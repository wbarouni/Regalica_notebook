module.exports = {
  root: true,
  ignorePatterns: [
    "**/dist/**",
    "**/coverage/**",
    "**/node_modules/**",
    "playwright-report/**",
    "test-results/**",
    "*.min.js",
    "*.cjs"
  ],
  overrides: [
    // TypeScript (apps & libs)
    {
      files: ["*.ts"],
      parser: "@typescript-eslint/parser",
      parserOptions: {
        project: ["tsconfig.json"], // ajoute d\'autres tsconfig si monorepo
        sourceType: "module",
        ecmaVersion: "latest"
      },
      plugins: [
        "@typescript-eslint",
        "@angular-eslint/eslint-plugin"
      ],
      extends: [
        "eslint:recommended",
        "plugin:@typescript-eslint/recommended",
        "plugin:@angular-eslint/recommended"
      ],
      rules: {
        // Qualité générale
        "no-console": ["warn", { allow: ["warn", "error"] }],
        "no-debugger": "error",
        "no-var": "error",
        "prefer-const": "error",
        "no-duplicate-imports": "error",

        // Denylist robuste (placeholders & localhost) - Temporairement commenté pour débogage
        /*
        "no-restricted-syntax": [
          "error",
          {
            selector: "Literal[value=/\\b(mock|placeholder|simulate|lorem)\\b/i]",
            message: "Denylist: évite mock/placeholder/simulate/lorem dans le code."
          },
          {
            selector: "Literal[value=/^(https?:\\/\\/)?(localhost|127\\.0\\.0\\.1)([:/]|\\/|$)/i]",
            message: "Denylist: URLs localhost/127.0.0.1 interdites dans le code source."
          },
          {
            selector: "Literal[value=/\\.\\.\\.$/]",
            message: "Denylist: ellipses (...) en placeholder interdites."
          }
        ],
        */

        // Angular style
        "@angular-eslint/directive-selector": [
          "error", { type: "attribute", prefix: "app", style: "camelCase" }
        ],
        "@angular-eslint/component-selector": [
          "error", { type: "element", prefix: "app", style: "kebab-case" }
        ],
        "@angular-eslint/no-input-rename": "warn",
        "@angular-eslint/no-output-rename": "warn"
      }
    },

    // Templates HTML (fichiers .html)
    {
      files: ["*.html"],
      parser: "@angular-eslint/template-parser",
      plugins: ["@angular-eslint/eslint-plugin-template"],
      extends: [
        "plugin:@angular-eslint/template/recommended",
        "plugin:@angular-eslint/template/accessibility"
      ],
      rules: {
        // ajoute tes règles template ici si besoin
      }
    },

    // Inline templates dans .ts (component.ts avec template inline)
    {
      files: ["*.ts"],
      excludedFiles: ["*.spec.ts"],
      extends: ["plugin:@angular-eslint/template/process-inline-templates"]
    },

    // Tests
    {
      files: ["*.spec.ts"],
      rules: {
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/no-non-null-assertion": "off",
        "no-console": "off"
      }
    }
  ]
};
