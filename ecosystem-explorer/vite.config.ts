/*
 * Copyright The OpenTelemetry Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { defineConfig, lazyPlugins } from "vite-plus";
import react from "@vitejs/plugin-react";
import path from "path";
import { dataContentIdPlugin } from "./scripts/data-content-id.ts";

export default defineConfig({
  lint: {
    plugins: ["oxc", "typescript", "unicorn", "react"],
    categories: {
      correctness: "error",
    },
    ignorePatterns: ["dist"],
    options: {
      typeAware: true,
      // `tsc -b` (typecheck/build scripts) is the type check; this one also checks scripts/
      // and netlify/ files outside any tsconfig and reports errors tsc does not.
      typeCheck: false,
    },
    jsPlugins: [
      {
        name: "vite-plus",
        specifier: "vite-plus/oxlint-plugin",
      },
    ],
    // `correctness` covers most of what ESLint's js/typescript-eslint/react-hooks recommended
    // presets enabled; these are the rest of those presets, which live in other categories.
    rules: {
      "vite-plus/prefer-vite-plus-imports": "error",
      "no-array-constructor": "error",
      "no-case-declarations": "error",
      "no-empty": "error",
      "no-fallthrough": "error",
      "no-prototype-builtins": "error",
      "no-redeclare": "error",
      "no-regex-spaces": "error",
      "no-useless-assignment": "error",
      "no-var": "error",
      "preserve-caught-error": "error",
      "prefer-const": "error",
      "prefer-rest-params": "error",
      "prefer-spread": "error",
      "typescript/ban-ts-comment": "error",
      "typescript/no-empty-object-type": "error",
      "typescript/no-explicit-any": "error",
      "typescript/no-namespace": "error",
      "typescript/no-require-imports": "error",
      "typescript/no-unnecessary-type-constraint": "error",
      "typescript/no-unsafe-function-type": "error",
      // Matches react-hooks' recommended severity, and the existing suppressions assume it.
      "react/exhaustive-deps": "warn",
      "react/incompatible-library": "warn",
      "react/unsupported-syntax": "warn",
      "react/only-export-components": [
        "error",
        {
          allowConstantExport: true,
          allowCompoundComponents: true,
        },
      ],
    },
  },
  define: {
    // Netlify sets COMMIT_REF at build time; ties Faro sessions and errors to a deploy.
    __APP_VERSION__: JSON.stringify(
      process.env.COMMIT_REF?.slice(0, 12) ?? "dev",
    ),
  },
  plugins: lazyPlugins(() => [
    react(),
    dataContentIdPlugin(path.resolve(import.meta.dirname, "public/data")),
  ]),
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  build: {
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes("node_modules/react/") ||
            id.includes("node_modules/react-dom/") ||
            id.includes("node_modules/react-router/")
          ) {
            return "vendor-react";
          }
          if (id.includes("node_modules/js-yaml")) {
            return "vendor-yaml";
          }
          if (
            id.includes("node_modules/react-markdown") ||
            id.includes("node_modules/remark-gfm")
          ) {
            return "vendor-markdown";
          }
          if (id.includes("node_modules/lucide-react")) {
            return "vendor-ui";
          }
        },
      },
    },
  },
});
