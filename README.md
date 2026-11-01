# SkoleGPT / ChatBib – DBCs NextChat-fork

Chat-bib is a fork of [NextChat](https://github.com/ChatGPTNextWeb/NextChat), one of the most popular AI-Chat frontends.

It is used for 
- https://chat.skolegpt.dk
- https://chatbib.dk
- Internal chat-documentation tool

<small>**Why fork?** Development of NextChat has halted, and misses security fixes. And our use case is also slightly different:  we use it for deploying different customized chat solutions on top of a single openai-api-compatible inference endpoint, where the original NextChat was more targeted towards being a tool for using different inference endpoints.</small>

Current version is very specific to the ChatBib and SkoleGPT, but the more different deployments we make, the more general it will become.

## Getting started developing

Create a new `.env.local` like:

```bash
APP=skolegpt
LLMTOKEN=...
```

Then run:

```bash
npm install
npm run build:styles
npm run dev
```

Now the development server starts, and the app can be opened <http://localhost:3000> in your browser, and will update as the source changes.

The development server is slightly different from deployment. To run the deployed version do:

```bash
npm run build
npm start
```

## Browser storage

Chats (including newly sent messages and replies), assistants, prompts, app
settings, access settings and update state use the shared Zustand persistence
adapter in `app/utils/idb-migration.ts`. They are stored in the existing
`keyval-store` IndexedDB database, with their existing keys and JSON format.
Original attachment blobs remain in the separate `chatbib-files` database;
small preferences and chat drafts that access localStorage directly are unchanged.

On first load, an existing localStorage value takes precedence over an older
IndexedDB value. The local copy is removed only after the IndexedDB transaction
commits. Subsequent writes use IndexedDB, with ordered writes per store and a
localStorage fallback if IndexedDB cannot be written. Failed reads or invalid
JSON block saving for that store so defaults cannot overwrite unread data. The
app waits for persisted stores before opening chats or applying URL actions.
Migration establishes the local recovery flag before committing state to
IndexedDB. If that bookkeeping fails, loading stops with the local copy intact.
If a previously saved database disappears while its local recovery flag survives,
normal opens abort creation of an empty database, including on repeated reloads.
An explicit “Slet alle data” can recreate it. This cannot detect eviction that
also removes localStorage.
Where the browser supports Web Locks, each store's writes and fallback handling
also run in order across tabs. A shared lock covers the entire operation;
delete-all takes that same lock exclusively. Other browsers retain per-tab
ordering only: concurrent localStorage fallback and deletion across tabs are
best-effort. Simultaneous edits from different tabs are not merged.

“Slet alle data” clears both databases and localStorage. Other tabs are notified,
and transaction generation checks reject stale IndexedDB saves when suspended
tabs resume. A storage failure is shown to the user; after a failed deletion,
reload before continuing because saving is stopped.
If deletion stops after files were cleared, a persistent pending marker blocks
normal startup until “Slet alle data” is retried successfully. The newest local
chat copy is retained until the IndexedDB state deletion commits.

The adapter does not depend on document formats or model requests. Later document
features can extend attachment processing and message data without redesigning
this migration. Changes to binary file storage, if needed by those features,
belong in their own pull requests.

Export important chats before downgrading to a version that uses localStorage.
Automatic rollback is not guaranteed: localStorage has a smaller quota, and the
old migration may overwrite newer local data if only some stores migrated.
The existing JSON backup contains chat/state data, not original attachment blobs;
keep separate copies of files before using “Slet alle data”.

Run the storage regression tests and production checks with:

```bash
npm run test:storage
npm run build
```
