# Frontend Architecture

The React-based web application that provides an interactive interface for exploring OpenTelemetry
component metadata.

## Overview

The ecosystem-explorer is a static web application built with React, TypeScript, and Vite. It
consumes the content-addressed database and provides search, filtering, and comparison capabilities
with offline support through IndexedDB caching.

## Technology Stack

- **Framework**: React + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS v4
- **Testing**: Vitest + React Testing Library
- **Caching**: IndexedDB via `idb`
- **Internationalization**: i18next + react-i18next
- **Deployment**: Static site hosting

### IndexedDB Cache

Persistent storage across browser sessions using `idb` library wrapper.

**Stores** (defined in `src/lib/api/idb-cache.ts`):

- `metadata`: Versions and manifests (also holds internal bookkeeping such as the last-prune marker)
- `instrumentations`: Full content-addressed component data (Java Agent instrumentations and
  Collector components)
- `configuration`: Declarative configuration schema data
- `global-configurations`: Aggregated, deduplicated configuration options across all versions

**Entry Format**:

```typescript
interface CacheEntry<T> {
  key: string;
  data: T;
  cachedAt: number; // Used for the 24h TTL and pruning
  lastAccessedAt?: number;
}
```

Entries expire after 24 hours (`CACHE_EXPIRATION_MS`) and are pruned on a 24-hour interval.

### Request Flow

```text
User requests component "aws-sdk-2.2" for version "2.24.0"
    ↓
Check IndexedDB cache
    ├─ HIT → Store in memory, return
    └─ MISS ↓
Check in-flight requests (deduplication)
    ├─ EXISTS → Wait for existing request
    └─ NEW ↓
Fetch from network
    ↓
Store in IndexedDB
    ↓
Return to caller
```

## Internationalization (i18n)

The app is localized using [i18next](https://www.i18next.com/) with the
[react-i18next](https://react.i18next.com/) bindings and the HTTP backend for lazy-loading
translation files. Runtime configuration is in `ecosystem-explorer/src/i18n/config.ts`.

### Locale files

Translation strings live in static JSON files served alongside the app:

```text
ecosystem-explorer/public/locales/{language}/{namespace}.json
```

**Supported languages**: `en` (English), `es` (Spanish)

**Namespaces** (one file per namespace per language):

| Namespace    | Covers                                                     |
| ------------ | ---------------------------------------------------------- |
| `common`     | Shared strings used across multiple features               |
| `layout`     | Header, footer, navigation, theme switcher                 |
| `home`       | Home page                                                  |
| `collector`  | Collector components pages                                 |
| `java-agent` | Java Agent instrumentation and configuration builder pages |
| `about`      | About page                                                 |
| `ecosystem`  | v1 ecosystem landing page components                       |

### Feature flag

The `I18N` feature flag (`VITE_FEATURE_FLAG_I18N`) gates the language-switcher UI and browser
language detection. When the flag is off, the app renders in English only. Locale files and
translation keys are always present regardless of the flag.

### Adding a new language

1. Copy each `ecosystem-explorer/public/locales/en/{ns}.json` to
   `ecosystem-explorer/public/locales/{new-lang}/{ns}.json` and translate the values (keep all keys
   identical).
2. Add the language code to `ecosystem-explorer/src/i18n/config.ts` if explicit language list
   configuration is needed.
3. Add the new language option to the `LanguageSwitcher` component in
   `ecosystem-explorer/src/components/layout/header.tsx`.

### Translation maintenance

**Fallback chain:** Browser language → nearest supported language → `fallbackLng: "en"`. A key
missing in `es` will silently render in English; the app never crashes on a missing key.

**Key hygiene:** `en` is the source of truth for the key set. All other language files must mirror
it exactly — same keys, same structure. If a translation is not yet available, copy the English
value verbatim as a placeholder so the file stays complete and auditable. Extra keys in a
non-English file that have no `en` counterpart are dead weight and should be removed.

**Removing strings:** When a UI string is deleted, remove its key from all locale files in the same
commit. Search for the key literal across `ecosystem-explorer/public/locales/` to catch all copies.

For developer guidance on using `useTranslation`, `Trans`, and adding namespaces, see the
Internationalization section of `ecosystem-explorer/AGENTS.md`.
