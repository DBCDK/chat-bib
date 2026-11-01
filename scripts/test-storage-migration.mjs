import assert from "node:assert/strict";
import { test } from "node:test";
import { storageBrowser, flush } from "./test-utils.mjs";

const key = "chat-next-web-store";
const saved = (messages) => JSON.stringify({ state: { messages }, version: 1 });

test("cross-tab writes keep an earlier fallback from hiding a newer committed message", async () => {
  const h = harness();
  h.browser.webLocks = true;
  const other = h.browser.tab().storage().migrationAwareStorage;
  await h.storage.getItem(key);
  await other.getItem(key);
  h.db.writeResults.push("abort", "pending");
  const earlier = h.storage.setItem(key, saved(["earlier fallback"]));
  const newer = other.setItem(key, saved(["newer committed reply"]));
  await earlier;
  await flush();
  assert.equal(h.browser.local.get(key), saved(["earlier fallback"]));
  assert.equal(h.db.pendingCommits.length, 1);
  h.db.pendingCommits.shift()();
  await newer;
  assert.equal(h.browser.local.has(key), false);
  assert.equal(
    await h.browser.tab().storage().migrationAwareStorage.getItem(key),
    saved(["newer committed reply"]),
  );
});

test("a timed-out cross-tab lock reports an unsaved change without writing an unsafe fallback", async () => {
  const h = harness();
  h.browser.webLocks = true;
  await h.storage.getItem(key);
  await h.storage.setItem(key, saved(["existing"]));
  let release;
  const held = h.browser.locks.request(
    `chatbib-storage:${key}`,
    {},
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  await flush();
  const saving = h.storage.setItem(key, saved(["cannot acquire lock"]));
  await flush();
  h.browser.expireTimers();
  await saving;
  await flush();
  assert.equal(h.tab.notices.length, 1);
  assert.equal(h.db.data.get(key), saved(["existing"]));
  assert.equal(h.browser.local.has(key), false);
  release();
  await held;
  await h.storage.setItem(key, saved(["later successful save"]));
  assert.equal(h.db.data.get(key), saved(["later successful save"]));
});

test("delete-all drains queued stream saves after one held-lock timeout", async () => {
  const h = harness();
  h.browser.webLocks = true;
  await h.storage.getItem(key);
  await h.storage.setItem(key, saved(["existing"]));
  let release;
  const held = h.browser.locks.request(
    `chatbib-storage:${key}`,
    {},
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  await flush();
  const saves = Array.from({ length: 4 }, (_, n) =>
    h.storage.setItem(key, saved(["queued reply", n])),
  );
  await flush();
  let deleted = false;
  const deleting = h.api.clearChatStorage().then(() => {
    deleted = true;
  });
  await flush();
  try {
    h.browser.expireTimers();
    for (let n = 0; n < 5; n++) await flush();
    assert.equal(deleted, true);
    assert.equal(h.db.data.has(key), false);
    assert.equal(h.browser.local.has(key), false);
  } finally {
    release();
    await held;
    await Promise.all([...saves, deleting]);
  }
});

test("concurrent delete-all operations keep the file and chat generations aligned", async () => {
  const h = harness();
  h.browser.webLocks = true;
  h.browser.broadcasts = false;
  const other = h.browser.tab().storage();
  await h.storage.getItem(key);
  await other.migrationAwareStorage.getItem(key);
  h.db.openResults.push("pending");
  const first = h.api.clearChatStorage();
  await flush();
  assert.equal(h.db.pendingOpens.length, 1);
  const second = other.clearChatStorage();
  await flush();
  h.db.pendingOpens.shift()();
  await Promise.all([first, second]);
  assert.equal(
    h.db.data.get("deleted"),
    h.browser.database("chatbib-files").data.get(":deleted"),
  );
  const fresh = h.browser.tab();
  await fresh.storage().migrationAwareStorage.getItem(key);
  await fresh.files().saveFileBlob("new", new Blob(["fresh file"]));
  assert.equal(
    await h.browser.database("chatbib-files").data.get("new").text(),
    "fresh file",
  );
});

function harness() {
  const browser = storageBrowser();
  const tab = browser.tab();
  const api = tab.storage();
  return {
    browser,
    tab,
    api,
    storage: api.migrationAwareStorage,
    db: browser.database("keyval-store"),
  };
}

test("migration preserves the current localStorage chat instead of a stale legacy IndexedDB copy", async () => {
  const h = harness();
  h.db.data.set(key, saved(["older"]));
  h.browser.local.set(key, saved(["current"]));
  assert.equal(await h.storage.getItem(key), saved(["current"]));
  assert.equal(h.db.data.get(key), saved(["current"]));
  assert.equal(h.browser.local.has(key), false);
});

test("migration keeps its local copy until IndexedDB commits", async () => {
  const h = harness();
  h.browser.local.set(key, saved(["original"]));
  h.db.writeResults.push("pending");
  const loading = h.storage.getItem(key);
  await flush();
  assert.equal(h.browser.local.get(key), saved(["original"]));
  assert.equal(h.db.data.has(key), false);
  assert.equal(h.db.pendingCommits.length, 1);
  h.db.pendingCommits.shift()();
  assert.equal(await loading, saved(["original"]));
  assert.equal(h.db.data.get(key), saved(["original"]));
  assert.equal(h.browser.local.has(key), false);
});

for (const outcome of ["abort", "error"]) {
  test(`failed migration (${outcome}) retains the only current local copy`, async () => {
    const h = harness();
    h.browser.local.set(key, saved(["current"]));
    h.db.data.set(key, saved(["stale"]));
    h.db.writeResults.push(outcome);
    assert.equal(await h.storage.getItem(key), saved(["current"]));
    assert.equal(h.browser.local.get(key), saved(["current"]));
    assert.equal(h.db.data.get(key), saved(["stale"]));
  });
}

test("a failed migration preserves the downgrade guard until the current local chat is committed", async () => {
  const h = harness();
  h.browser.local.set(key, saved(["current local chat"]));
  h.browser.local.set("idb-to-localstorage-migrated", "1");
  h.db.data.set(key, saved(["older IDB chat"]));
  h.db.writeResults.push("abort");

  assert.equal(await h.storage.getItem(key), saved(["current local chat"]));
  assert.equal(h.browser.local.get("idb-to-localstorage-migrated"), "1");
  assert.equal(h.db.data.get(key), saved(["older IDB chat"]));

  const fresh = h.browser.tab().storage().migrationAwareStorage;
  assert.equal(await fresh.getItem(key), saved(["current local chat"]));
  assert.equal(h.db.data.get(key), saved(["current local chat"]));
  assert.equal(h.browser.local.has("idb-to-localstorage-migrated"), false);
  assert.equal(h.browser.local.has(key), false);
});

test("new messages are written to IndexedDB and read after a new page load", async () => {
  const h = harness();
  assert.equal(await h.storage.getItem(key), null);
  await h.storage.setItem(key, saved(["new question", "new answer"]));
  assert.equal(h.browser.local.has(key), false);
  const reloaded = h.browser.tab().storage().migrationAwareStorage;
  assert.equal(
    await reloaded.getItem(key),
    saved(["new question", "new answer"]),
  );
});

test("rapid streaming saves preserve their order even when an earlier transaction fails", async () => {
  const h = harness();
  await h.storage.getItem(key);
  h.db.writeResults.push("abort", "complete", "complete");
  await Promise.all([
    h.storage.setItem(key, saved(["H"])),
    h.storage.setItem(key, saved(["Hej"])),
    h.storage.setItem(key, saved(["Hej verden"])),
  ]);
  assert.equal(h.db.data.get(key), saved(["Hej verden"]));
  assert.equal(h.browser.local.has(key), false);
  assert.equal(
    await h.browser.tab().storage().migrationAwareStorage.getItem(key),
    saved(["Hej verden"]),
  );
});

test("ordinary saves reuse the IndexedDB connection", async () => {
  const h = harness();
  await h.storage.getItem(key);
  for (let n = 0; n < 20; n++) await h.storage.setItem(key, saved([n]));
  assert.equal(h.db.opens, 1);
  assert.equal(h.db.data.get(key), saved([19]));
});

test("a failed IndexedDB read cannot be overwritten by an empty default store", async () => {
  const h = harness();
  h.db.data.set(key, saved(["valuable history"]));
  h.db.readErrors.add(key);
  await assert.rejects(h.storage.getItem(key));
  await h.storage.setItem(key, saved([]));
  assert.equal(h.db.data.get(key), saved(["valuable history"]));
  assert.equal(h.browser.local.has(key), false);
});

test("the real persisted store writes new messages to IndexedDB after hydration", async () => {
  const h = harness();
  h.browser.local.set(key, saved(["existing"]));
  const { createPersistStore, hydrated } = h.tab.load("app/utils/store.ts");
  const store = createPersistStore(
    { messages: [] },
    (set, get) => ({
      append: (text) => set({ messages: [...get().messages, text] }),
    }),
    { name: key, version: 1 },
  );
  await hydrated(store);
  assert.deepEqual(store.getState().messages, ["existing"]);
  store.getState().append("new message");
  await flush();
  assert.deepEqual(JSON.parse(h.db.data.get(key)).state.messages, [
    "existing",
    "new message",
  ]);
  assert.equal(h.browser.local.has(key), false);
});

test("a corrupt store fails real hydration and cannot be overwritten with defaults", async () => {
  const h = harness();
  h.db.data.set(key, "{broken JSON");
  const { createPersistStore } = h.tab.load("app/utils/store.ts");
  const store = createPersistStore(
    { messages: [] },
    (set) => ({ clear: () => set({ messages: [] }) }),
    { name: key, version: 1 },
  );
  await flush();
  assert.equal(store.persist.hasHydrated(), false);
  assert.equal(h.api.loadFailed(key), true);
  store.getState().clear();
  await flush();
  assert.equal(h.db.data.get(key), "{broken JSON");
});

for (const failure of ["localGetterFails", "localReadFails"]) {
  test(`unreadable localStorage (${failure}) fails hydration instead of selecting stale IndexedDB data`, async () => {
    const h = harness();
    h.db.data.set(key, saved(["stale legacy copy"]));
    h.browser.local.set(key, saved(["current local history"]));
    h.browser[failure] = true;
    const { createPersistStore } = h.tab.load("app/utils/store.ts");
    const store = createPersistStore(
      { messages: [] },
      (set) => ({ clear: () => set({ messages: [] }) }),
      { name: key, version: 1 },
    );
    await flush();
    assert.equal(store.persist.hasHydrated(), false);
    assert.equal(h.api.loadFailed(key), true);
    assert(h.tab.errors.length > 0);
    store.getState().clear();
    await flush();
    assert.equal(h.db.data.get(key), saved(["stale legacy copy"]));
    assert.equal(h.browser.local.get(key), saved(["current local history"]));

    // Once localStorage can be read again, reloading should load the latest copy.
    h.browser[failure] = false;
    assert.equal(
      await h.browser.tab().storage().migrationAwareStorage.getItem(key),
      saved(["current local history"]),
    );
  });
}

test("when IndexedDB is unavailable, existing local data and new messages still persist", async () => {
  const h = harness();
  h.browser.available = false;
  h.browser.local.set(key, saved(["old"]));
  assert.equal(await h.storage.getItem(key), saved(["old"]));
  await h.storage.setItem(key, saved(["old", "new"]));
  assert.equal(h.browser.local.get(key), saved(["old", "new"]));
});

test("a failed open does not pretend previously stored IndexedDB chats are empty", async () => {
  const h = harness();
  await h.storage.getItem(key);
  await h.storage.setItem(key, saved(["saved in IndexedDB"]));
  h.db.openResults.push("error");
  const other = h.browser.tab().storage().migrationAwareStorage;
  await assert.rejects(other.getItem(key));
  await other.setItem(key, saved([]));
  assert.equal(h.db.data.get(key), saved(["saved in IndexedDB"]));
  assert.equal(h.browser.local.has(key), false);
});

test("a failed save falls back locally and migrates back on a later successful save", async () => {
  const h = harness();
  await h.storage.getItem(key);
  h.db.writeResults.push("abort");
  await h.storage.setItem(key, saved(["fallback"]));
  assert.equal(h.browser.local.get(key), saved(["fallback"]));
  await h.storage.setItem(key, saved(["recovered"]));
  assert.equal(h.db.data.get(key), saved(["recovered"]));
  assert.equal(h.browser.local.has(key), false);
});

test("failure in both persistence backends produces one visible warning", async () => {
  const h = harness();
  await h.storage.getItem(key);
  h.browser.localWriteFails = true;
  h.db.writeResults.push("abort", "abort");
  await h.storage.setItem(key, saved(["unsaved"]));
  await h.storage.setItem(key, saved(["still unsaved"]));
  await flush();
  assert.equal(h.tab.notices.length, 1);
});

test("delete-all clears app state and pre-existing original file blobs", async () => {
  const h = harness();
  await h.storage.getItem(key);
  await h.storage.setItem(key, saved(["old"]));
  const files = h.browser.database("chatbib-files");
  files.data.set("old-file", new Blob(["original document"]));
  h.browser.local.set("app-config", "settings");
  await h.api.clearChatStorage();
  assert.equal(h.db.data.has(key), false);
  assert.equal(files.data.has("old-file"), false);
  assert.equal(h.browser.local.has("app-config"), false);
  await h.storage.setItem(key, saved(["late stream update"]));
  assert.equal(h.db.data.has(key), false);
  assert.equal(h.browser.local.has(key), false);
});

test("an old tab cannot resurrect deleted chats before a broadcast arrives", async () => {
  const h = harness();
  h.browser.broadcasts = false;
  await h.storage.getItem(key);
  await h.storage.setItem(key, saved(["old"]));
  const oldTab = h.browser.tab();
  const old = oldTab.storage().migrationAwareStorage;
  await old.getItem(key);
  await h.api.clearChatStorage();
  await old.setItem(key, saved(["old", "late reply"]));
  assert.equal(h.db.data.has(key), false);
  assert.equal(h.browser.local.has(key), false);
  assert(oldTab.reloads() > 0);
  const fresh = h.browser.tab().storage().migrationAwareStorage;
  await fresh.getItem(key);
  await fresh.setItem(key, saved(["new after deletion"]));
  assert.equal(h.db.data.get(key), saved(["new after deletion"]));
});

for (const reconnect of [false, true]) {
  test(`a fallback-only tab cannot resurrect deleted chats ${reconnect ? "after reconnecting" : "during its open cooldown"}`, async () => {
    const h = harness();
    h.browser.broadcasts = false;
    h.browser.local.set(key, saved(["old"]));
    h.db.openResults.push("error");
    assert.equal(await h.storage.getItem(key), saved(["old"]));
    assert.equal(h.db.data.has(key), false);

    const deleting = h.browser.tab().storage();
    await deleting.migrationAwareStorage.getItem(key);
    await deleting.clearChatStorage();
    if (reconnect) h.browser.advanceTime(6000);
    await h.storage.setItem(key, saved(["old", "late reply"]));
    assert.equal(h.db.data.has(key), false);
    assert.equal(h.browser.local.has(key), false);
    assert(h.tab.reloads() > 0);
  });
}

test("failed file deletion preserves chats and files so a reload can recover and upload again", async () => {
  const h = harness();
  await h.storage.getItem(key);
  await h.storage.setItem(key, saved(["keep this chat"]));
  h.browser.local.set(key, saved(["newer fallback chat"]));
  h.browser.local.set("app-config", "keep these settings");
  const files = h.browser.database("chatbib-files");
  files.data.set("original", new Blob(["document"]));
  files.writeResults.push("abort");
  await assert.rejects(h.api.clearChatStorage());
  assert.equal(await files.data.get("original").text(), "document");
  assert.equal(h.db.data.get(key), saved(["keep this chat"]));
  assert.equal(h.browser.local.get(key), saved(["newer fallback chat"]));
  assert.equal(h.browser.local.get("app-config"), "keep these settings");

  const fresh = h.browser.tab();
  assert.equal(
    await fresh.storage().migrationAwareStorage.getItem(key),
    saved(["newer fallback chat"]),
  );
  await fresh.files().saveFileBlob("new", new Blob(["new document"]));
  assert.equal(await files.data.get("new").text(), "new document");
  await fresh.storage().clearChatStorage();
  assert.equal(h.db.data.has(key), false);
  assert.equal(files.data.has("original"), false);
  assert.equal(files.data.has("new"), false);
});

test("failed state deletion preserves the latest fallback and blocks hydration until deletion is retried", async () => {
  const h = harness();
  await h.storage.getItem(key);
  await h.storage.setItem(key, saved(["older saved chat"]));
  h.browser.local.set(key, saved(["latest fallback chat"]));
  const files = h.browser.database("chatbib-files");
  files.data.set("original", new Blob(["document"]));
  h.db.writeResults.push("abort");

  await assert.rejects(h.api.clearChatStorage());
  assert.equal(h.db.data.get(key), saved(["older saved chat"]));
  assert.equal(h.browser.local.get(key), saved(["latest fallback chat"]));
  assert.equal(files.data.has("original"), false);

  const fresh = h.browser.tab();
  const recovery = fresh.storage();
  await assert.rejects(recovery.migrationAwareStorage.getItem(key));
  await recovery.migrationAwareStorage.setItem(key, saved([]));
  assert.equal(h.browser.local.get(key), saved(["latest fallback chat"]));
  await recovery.clearChatStorage();
  assert.equal(h.db.data.has(key), false);
  assert.equal(h.browser.local.has(key), false);

  const recovered = h.browser.tab();
  assert.equal(
    await recovered.storage().migrationAwareStorage.getItem(key),
    null,
  );
  await recovered.files().saveFileBlob("new", new Blob(["new document"]));
  assert.equal(await files.data.get("new").text(), "new document");
});

test("delete-all cannot erase data if its cross-tab deletion marker cannot be saved", async () => {
  const h = harness();
  h.browser.broadcasts = false;
  h.browser.local.set(key, saved(["current fallback"]));
  h.db.openResults.push("error");
  await h.storage.getItem(key);
  const deleting = h.browser.tab().storage();
  await deleting.migrationAwareStorage.getItem(key);
  const files = h.browser.database("chatbib-files");
  files.data.set("original", new Blob(["document"]));
  h.browser.localWriteFails = true;

  await assert.rejects(deleting.clearChatStorage());
  assert.equal(h.db.data.get(key), saved(["current fallback"]));
  assert.equal(await files.data.get("original").text(), "document");
  assert.equal(h.browser.local.has("chatbib-deleted"), false);

  h.browser.localWriteFails = false;
  const recovered = h.browser.tab();
  assert.equal(
    await recovered.storage().migrationAwareStorage.getItem(key),
    saved(["current fallback"]),
  );
  await recovered.files().saveFileBlob("new", new Blob(["new document"]));
  assert.equal(await files.data.get("new").text(), "new document");
});

test("failed local cleanup keeps deletion pending across reload and a later retry finishes", async () => {
  const h = harness();
  await h.storage.getItem(key);
  await h.storage.setItem(key, saved(["old chat"]));
  h.browser.local.set(key, saved(["latest fallback"]));
  h.browser.localRemoveFails = true;

  await assert.rejects(h.api.clearChatStorage());
  assert.equal(h.db.data.has(key), false);
  assert.equal(h.browser.local.get(key), saved(["latest fallback"]));
  const recovery = h.browser.tab().storage();
  await assert.rejects(recovery.migrationAwareStorage.getItem(key));

  h.browser.localRemoveFails = false;
  await recovery.clearChatStorage();
  assert.equal(h.browser.local.has(key), false);
  assert.equal(
    await h.browser.tab().storage().migrationAwareStorage.getItem(key),
    null,
  );
});

test("a failed file deletion during recovery retains the earlier incomplete-delete marker", async () => {
  const h = harness();
  await h.storage.getItem(key);
  await h.storage.setItem(key, saved(["old chat"]));
  h.db.writeResults.push("abort");
  await assert.rejects(h.api.clearChatStorage());
  const marker = h.browser.local.get("chatbib-deleted");

  const recovery = h.browser.tab().storage();
  h.browser.database("chatbib-files").writeResults.push("abort");
  await assert.rejects(recovery.clearChatStorage());
  assert.equal(h.browser.local.get("chatbib-deleted"), marker);
  await assert.rejects(
    h.browser.tab().storage().migrationAwareStorage.getItem(key),
  );
});

test("repeated delete-all in the same millisecond still invalidates tabs opened between deletions", async () => {
  const h = harness();
  h.browser.broadcasts = false;
  await h.storage.getItem(key);
  await h.api.clearChatStorage();
  const second = h.browser.tab();
  const secondStorage = second.storage().migrationAwareStorage;
  await secondStorage.getItem(key);
  await secondStorage.setItem(key, saved(["created after first deletion"]));

  const suspended = h.browser.tab();
  const suspendedStorage = suspended.storage().migrationAwareStorage;
  await suspendedStorage.getItem(key);
  // Both deletions use the same clock time.
  await second.storage().clearChatStorage();
  await suspendedStorage.setItem(key, saved(["late reply"]));
  await assert.rejects(
    suspended.files().saveFileBlob("late", new Blob(["late upload"])),
  );
  assert.equal(h.db.data.has(key), false);
  assert.equal(h.browser.local.has(key), false);
  assert.equal(h.browser.database("chatbib-files").data.has("late"), false);
  assert(suspended.reloads() > 0);
});

test("legacy object records and independently named stores remain readable", async () => {
  const h = harness();
  h.db.data.set("mask-store", {
    state: { masks: { one: { name: "My assistant" } } },
    version: 1,
  });
  h.browser.local.set(
    "prompt-store",
    JSON.stringify({ state: { prompts: ["Saved prompt"] }, version: 1 }),
  );
  const masks = JSON.parse(await h.storage.getItem("mask-store"));
  assert.equal(masks.state.masks.one.name, "My assistant");
  const prompts = await h.storage.getItem("prompt-store");
  assert.equal(h.db.data.get("prompt-store"), prompts);
  assert.equal(h.browser.local.has("prompt-store"), false);
});

test("a timed-out read aborts without letting defaults replace an existing chat", async () => {
  const h = harness();
  h.db.data.set(key, saved(["existing"]));
  h.db.readResults.push("pending");
  const loading = h.storage.getItem(key);
  await flush();
  assert.equal(h.db.pendingCommits.length, 1);
  h.browser.expireTimers();
  await assert.rejects(loading);
  await h.storage.setItem(key, saved([]));
  h.db.pendingCommits.shift()();
  assert.equal(h.db.data.get(key), saved(["existing"]));
});

test("removing a persisted store removes both copies and survives a reload", async () => {
  const h = harness();
  await h.storage.getItem(key);
  await h.storage.setItem(key, saved(["remove me"]));
  h.browser.local.set(key, saved(["fallback"]));
  await h.storage.removeItem(key);
  assert.equal(h.db.data.has(key), false);
  assert.equal(h.browser.local.has(key), false);
  assert.equal(
    await h.browser.tab().storage().migrationAwareStorage.getItem(key),
    null,
  );
});

test("an unexpectedly recreated IndexedDB keeps failing hydration across reloads until explicit recovery", async () => {
  const h = harness();
  await h.storage.getItem(key);
  await h.storage.setItem(key, saved(["important history"]));
  assert.equal(h.browser.local.has(key), false);
  assert.equal(h.browser.local.get("saved-in-indexeddb"), "1");

  // Remove the database but leave its localStorage flag. Opening it again
  // must not silently replace it with an empty one.
  h.db.data.clear();
  h.db.openResults.push("fresh");
  for (let n = 0; n < 3; n++) {
    const other = h.browser.tab().storage().migrationAwareStorage;
    await assert.rejects(other.getItem(key));
    await other.setItem(key, saved([]));
    assert.equal(h.db.data.has(key), false);
  }

  // Choosing "delete all data" must still allow a fresh database to be created.
  await h.browser.tab().storage().clearChatStorage();
  const fresh = h.browser.tab();
  const freshStorage = fresh.storage().migrationAwareStorage;
  assert.equal(await freshStorage.getItem(key), null);
  await freshStorage.setItem(key, saved(["new chat after recovery"]));
  await fresh.files().saveFileBlob("new-file", new Blob(["new file"]));
  assert.equal(h.db.data.get(key), saved(["new chat after recovery"]));
  assert.equal(
    await h.browser.database("chatbib-files").data.get("new-file").text(),
    "new file",
  );
});

test("marker quota failure blocks migration before newer replies can diverge from the retained local backup", async () => {
  const h = harness();
  h.browser.local.set(key, saved(["legacy chats"]));
  h.db.data.set(key, saved(["older legacy IDB copy"]));
  h.browser.localWriteFailsFor.add("saved-in-indexeddb");
  await assert.rejects(h.storage.getItem(key));
  await h.storage.setItem(key, saved(["legacy chats", "reply"]));
  assert.equal(h.db.data.get(key), saved(["older legacy IDB copy"]));
  assert.equal(h.browser.local.get(key), saved(["legacy chats"]));
  assert.equal(h.browser.local.has("saved-in-indexeddb"), false);

  h.browser.localWriteFailsFor.clear();
  const recovered = h.browser.tab().storage().migrationAwareStorage;
  assert.equal(await recovered.getItem(key), saved(["legacy chats"]));
  await recovered.setItem(key, saved(["legacy chats", "new reply"]));
  assert.equal(
    await h.browser.tab().storage().migrationAwareStorage.getItem(key),
    saved(["legacy chats", "new reply"]),
  );
});

test("marker quota failure is visible to real hydration and cannot save empty defaults", async () => {
  const h = harness();
  h.browser.local.set(key, saved(["valuable legacy chat"]));
  h.browser.localWriteFailsFor.add("saved-in-indexeddb");
  const { createPersistStore } = h.tab.load("app/utils/store.ts");
  const store = createPersistStore(
    { messages: [] },
    (set) => ({ clear: () => set({ messages: [] }) }),
    { name: key, version: 1 },
  );
  await flush();
  assert.equal(store.persist.hasHydrated(), false);
  assert.equal(h.api.loadFailed(key), true);
  store.getState().clear();
  await flush();
  assert.equal(h.browser.local.get(key), saved(["valuable legacy chat"]));
  assert.equal(h.db.data.has(key), false);
});

test("a new chat can fall back locally when its authority marker cannot be stored", async () => {
  const h = harness();
  await h.storage.getItem(key);
  h.browser.localWriteFailsFor.add("saved-in-indexeddb");
  await h.storage.setItem(key, saved(["new question", "new reply"]));
  assert.equal(h.browser.local.get(key), saved(["new question", "new reply"]));
  assert.equal(h.db.data.has(key), false);
  h.browser.localWriteFailsFor.clear();
  assert.equal(
    await h.browser.tab().storage().migrationAwareStorage.getItem(key),
    saved(["new question", "new reply"]),
  );
});

test("failed migration cleanup blocks hydration without erasing the recoverable local copy", async () => {
  const h = harness();
  h.browser.local.set(key, saved(["legacy chat"]));
  h.browser.localRemoveFails = true;
  await assert.rejects(h.storage.getItem(key));
  await h.storage.setItem(key, saved([]));
  assert.equal(h.browser.local.get(key), saved(["legacy chat"]));
  h.browser.localRemoveFails = false;
  assert.equal(
    await h.browser.tab().storage().migrationAwareStorage.getItem(key),
    saved(["legacy chat"]),
  );
});

test("failed cleanup after an IDB commit replaces the old local fallback with the newest reply", async () => {
  const h = harness();
  await h.storage.getItem(key);
  await h.storage.setItem(key, saved(["initial chat"]));
  h.db.writeResults.push("abort");
  await h.storage.setItem(key, saved(["previous fallback"]));
  h.browser.localRemoveFails = true;
  await h.storage.setItem(key, saved(["newest reply"]));
  assert.equal(h.browser.local.get(key), saved(["newest reply"]));
  h.browser.localRemoveFails = false;
  assert.equal(
    await h.browser.tab().storage().migrationAwareStorage.getItem(key),
    saved(["newest reply"]),
  );
});

test("fallback hydration after a completed deletion permits uploads and a later state reconnect", async () => {
  const h = harness();
  await h.storage.getItem(key);
  await h.api.clearChatStorage();
  h.db.openResults.push("error");
  const fresh = h.browser.tab();
  const storage = fresh.storage().migrationAwareStorage;
  assert.equal(await storage.getItem(key), null);
  await fresh.files().saveFileBlob("first", new Blob(["first upload"]));
  h.browser.advanceTime(6000);
  await storage.setItem(key, saved(["new chat"]));
  await fresh.files().saveFileBlob("second", new Blob(["second upload"]));
  assert.equal(h.db.data.get(key), saved(["new chat"]));
  const files = h.browser.database("chatbib-files");
  assert.equal(await files.data.get("first").text(), "first upload");
  assert.equal(await files.data.get("second").text(), "second upload");
});

test("delete-all waits for another tab's entire save before removing any files", async () => {
  const h = harness();
  h.browser.webLocks = true;
  h.browser.broadcasts = false;
  await h.storage.getItem(key);
  await h.storage.setItem(key, saved(["old chat"]));
  const deleting = h.browser.tab().storage();
  await deleting.migrationAwareStorage.getItem(key);
  const files = h.browser.database("chatbib-files");
  files.data.set("original", new Blob(["original document"]));

  h.db.writeResults.push("pending");
  const saving = h.storage.setItem(key, saved(["old chat", "pending reply"]));
  await flush();
  assert.equal(h.db.pendingCommits.length, 1);
  const clearing = deleting.clearChatStorage();
  await flush();
  assert.equal(await files.data.get("original").text(), "original document");
  assert.equal(h.browser.local.has("chatbib-deleted"), false);
  h.db.pendingCommits.shift()();
  await Promise.all([saving, clearing]);
  assert.equal(h.db.data.has(key), false);
  assert.equal(files.data.has("original"), false);
  assert.equal(h.browser.local.has(key), false);
  assert.equal(
    await h.browser.tab().storage().migrationAwareStorage.getItem(key),
    null,
  );
});

test("ordinary operations on different stores can share the deletion lock", async () => {
  const h = harness();
  h.browser.webLocks = true;
  await h.storage.getItem(key);
  const otherKey = "prompt-store";
  await h.storage.getItem(otherKey);
  let release;
  const held = h.browser.locks.request(
    `chatbib-storage:${key}`,
    {},
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  await flush();
  const blocked = h.storage.setItem(key, saved(["waiting"]));
  await flush();
  try {
    await h.storage.setItem(otherKey, saved(["independent save"]));
    assert.equal(h.db.data.get(otherKey), saved(["independent save"]));
    assert.equal(h.db.data.has(key), false);
  } finally {
    release();
    await Promise.all([held, blocked]);
  }
});

test("a locked newer commit removes an old fallback even when the initial local snapshot was stale", async () => {
  const h = harness();
  h.browser.webLocks = true;
  const newerTab = h.browser.tab();
  const newer = newerTab.storage().migrationAwareStorage;
  await h.storage.getItem(key);
  await newer.getItem(key);
  h.db.writeResults.push("abort");
  await h.storage.setItem(key, saved(["older fallback"]));
  // After a tab gets the lock, Chromium may still return an older localStorage value.
  let stale = true;
  newerTab.localHooks.read = (name, value) => {
    if (name === key && stale) {
      stale = false;
      return null;
    }
    return value;
  };
  await newer.setItem(key, saved(["newer committed reply"]));
  assert.equal(h.browser.local.has(key), false);
  assert.equal(
    await h.browser.tab().storage().migrationAwareStorage.getItem(key),
    saved(["newer committed reply"]),
  );
});

test("without Web Locks cleanup retains a newer fallback written during an IDB commit", async () => {
  const h = harness();
  await h.storage.getItem(key);
  h.browser.local.set(key, saved(["previous fallback"]));
  h.db.writeResults.push("pending");
  const saving = h.storage.setItem(key, saved(["committing reply"]));
  await flush();
  h.browser.local.set(key, saved(["newer fallback from another tab"]));
  h.db.pendingCommits.shift()();
  await saving;
  assert.equal(
    h.browser.local.get(key),
    saved(["newer fallback from another tab"]),
  );
  assert.equal(
    await h.browser.tab().storage().migrationAwareStorage.getItem(key),
    saved(["newer fallback from another tab"]),
  );
});
