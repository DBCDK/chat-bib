import assert from "node:assert/strict";
import { test } from "node:test";
import { storageBrowser } from "./test-utils.mjs";

function harness() {
  const browser = storageBrowser();
  const tab = browser.tab();
  return { browser, files: tab.files(), db: browser.database("chatbib-files") };
}

test("existing original attachment blobs can still be saved, loaded and deleted", async () => {
  const h = harness();
  await h.files.saveFileBlob("original", new Blob(["document"]));
  assert.equal(
    await (await h.files.loadFileBlob("original")).text(),
    "document",
  );
  await h.files.deleteFileBlob("original");
  assert.equal(await h.files.loadFileBlob("original"), null);
});

for (const outcome of ["error", "throw"]) {
  test(`file storage retries an open after ${outcome}`, async () => {
    const h = harness();
    h.db.openResults.push(outcome);
    await assert.rejects(h.files.saveFileBlob("first", new Blob(["first"])));
    await h.files.saveFileBlob("retry", new Blob(["retry"]));
    assert.equal(await h.db.data.get("retry").text(), "retry");
    assert.equal(h.db.opens, 2);
  });
}

test("a timed-out file open can retry and its late connection is closed", async () => {
  const h = harness();
  h.db.openResults.push("pending");
  const saving = h.files.saveFileBlob("first", new Blob(["first"]));
  h.browser.expireTimers();
  await assert.rejects(saving);
  await h.files.saveFileBlob("retry", new Blob(["retry"]));
  h.db.pendingOpens.shift()();
  assert.equal(h.db.closes, 1);
  assert.equal(await h.db.data.get("retry").text(), "retry");
  assert.equal(h.browser.timerCount(), 0);
});

test("a file save rejects when its transaction aborts", async () => {
  const h = harness();
  h.db.writeResults.push("abort");
  await assert.rejects(h.files.saveFileBlob("file", new Blob(["unsaved"])));
  assert.equal(h.db.data.has("file"), false);
});

test("a closed file connection reopens once", async () => {
  const h = harness();
  h.db.transactionThrows = 1;
  await h.files.saveFileBlob("file", new Blob(["document"]));
  assert.equal(await h.db.data.get("file").text(), "document");
  assert.equal(h.db.opens, 2);
});

test("ordinary file cleanup remains best effort, but delete-all reports failure", async () => {
  const h = harness();
  h.db.writeResults.push("abort", "abort");
  await assert.doesNotReject(h.files.deleteFileBlob("file"));
  await assert.rejects(h.files.clearFileBlobs(123));
});

test("delete-all prevents an old tab's first upload from resurrecting a file", async () => {
  const h = harness();
  const old = h.browser.tab().files();
  old.setFileDeletionTime(100);
  await h.files.clearFileBlobs(123);
  await assert.rejects(old.saveFileBlob("old", new Blob(["old document"])));
  assert.equal(h.db.data.has("old"), false);
  const fresh = h.browser.tab().files();
  fresh.setFileDeletionTime(123);
  await fresh.saveFileBlob("new", new Blob(["new document"]));
  assert.equal(await h.db.data.get("new").text(), "new document");
});

test("a delete-all broadcast blocks a pending tab from saving files", async () => {
  const h = harness();
  h.files.stopFileSaves();
  await assert.rejects(h.files.saveFileBlob("late", new Blob(["document"])));
  assert.equal(h.db.data.has("late"), false);
});
