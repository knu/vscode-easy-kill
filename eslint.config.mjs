import tseslint from "typescript-eslint";

export default [
  {
    ignores: ["out/**", "node_modules/**", ".vscode-test/**"],
  },
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: ["src/**/*.ts"],
  })),
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          args: "none",
        },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
];
