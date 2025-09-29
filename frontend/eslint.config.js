import js from '@eslint/js';
import typescript from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import angular from '@angular-eslint/eslint-plugin';
import angularTemplate from '@angular-eslint/eslint-plugin-template';

export default [
  // Configuration de base pour JavaScript
  js.configs.recommended,
  
  // Configuration pour les fichiers TypeScript
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        project: './tsconfig.json',
        ecmaVersion: 2022,
        sourceType: 'module'
      }
    },
    plugins: {
      '@typescript-eslint': typescript,
      '@angular-eslint': angular
    },
    rules: {
      // Règles strictes selon spécifications
      '@typescript-eslint/no-unused-vars': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-function-return-type': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
      '@typescript-eslint/prefer-optional-chain': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      
      // Règles de qualité de code
      'no-console': 'warn',
      'no-debugger': 'error',
      'no-alert': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      'prefer-arrow-callback': 'error',
      'no-duplicate-imports': 'error',
      'no-unused-expressions': 'error',
      
      // Règles Angular spécifiques
      '@angular-eslint/component-class-suffix': 'error',
      '@angular-eslint/directive-class-suffix': 'error',
      '@angular-eslint/no-input-rename': 'error',
      '@angular-eslint/no-output-rename': 'error',
      '@angular-eslint/use-lifecycle-interface': 'error',
      
      // Règles de sécurité
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      
      // Règles de performance
      '@typescript-eslint/prefer-for-of': 'error',
      '@typescript-eslint/prefer-includes': 'error',
      '@typescript-eslint/prefer-string-starts-ends-with': 'error',
      
      // Règles de lisibilité
      'complexity': ['warn', 10],
      'max-depth': ['warn', 4],
      'max-params': ['warn', 5],
      
      // Interdictions spécifiques selon denylist
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Literal[value=/mock|placeholder|simulate|lorem/i]',
          message: 'Denylist violation: mock/placeholder/simulate/lorem patterns are forbidden'
        },
        {
          selector: 'Literal[value=/localhost|127\\.0\\.0\\.1/]',
          message: 'Denylist violation: hardcoded localhost/127.0.0.1 URLs are forbidden'
        },
        {
          selector: 'Literal[value=/\\.\\.\\.$/]',
          message: 'Denylist violation: ellipsis (...) placeholders are forbidden'
        }
      ]
    }
  },
  
  // Configuration pour les templates HTML Angular
  {
    files: ['**/*.html'],
    plugins: {
      '@angular-eslint/template': angularTemplate
    },
    rules: {
      '@angular-eslint/template/alt-text': 'error',
      '@angular-eslint/template/elements-content': 'error',
      '@angular-eslint/template/label-has-associated-control': 'error',
      '@angular-eslint/template/table-scope': 'error',
      '@angular-eslint/template/valid-aria': 'error',
      '@angular-eslint/template/click-events-have-key-events': 'error',
      '@angular-eslint/template/mouse-events-have-key-events': 'error',
      '@angular-eslint/template/no-autofocus': 'error',
      '@angular-eslint/template/no-distracting-elements': 'error',
      '@angular-eslint/template/no-positive-tabindex': 'error'
    }
  },
  
  // Configuration spéciale pour les fichiers de test
  {
    files: ['**/*.spec.ts', '**/tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      'no-console': 'off'
    }
  },
  
  // Ignorer certains fichiers
  {
    ignores: [
      'dist/**/*',
      'node_modules/**/*',
      'coverage/**/*',
      'test-results/**/*',
      'playwright-report/**/*',
      '*.config.js',
      '*.config.ts'
    ]
  }
];
