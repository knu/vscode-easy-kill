import * as assert from "assert";
import * as vscode from "vscode";
import { SentenceBounds } from "./sentence";
import { MockTextDocument, pos } from "../test-helpers";

suite("Sentence Navigation Tests", () => {
  const sentenceBounds = new SentenceBounds();

  async function getRange(document: vscode.TextDocument, position: vscode.Position) {
    return sentenceBounds.getRangeAtPosition({ document } as vscode.TextEditor, position);
  }

  suite("Basic sentence detection", () => {
    test("single sentence with period", async () => {
      const doc = new MockTextDocument("This is a sentence.");

      const range = await getRange(doc, pos(0, 5));

      assert.ok(range);
      assert.strictEqual(doc.getText(range), "This is a sentence.");
    });

    test("multiple sentences", async () => {
      const doc = new MockTextDocument("First sentence.  Second sentence.");

      const firstRange = await getRange(doc, pos(0, 5));
      assert.ok(firstRange);
      assert.strictEqual(doc.getText(firstRange), "First sentence.");

      const secondRange = await getRange(doc, pos(0, 20));
      assert.ok(secondRange);
      assert.strictEqual(doc.getText(secondRange), "Second sentence.");
    });

    test("question mark", async () => {
      const doc = new MockTextDocument("Is this a question?");

      const range = await getRange(doc, pos(0, 5));

      assert.ok(range);
      assert.strictEqual(doc.getText(range), "Is this a question?");
    });

    test("exclamation mark", async () => {
      const doc = new MockTextDocument("What a day!");

      const range = await getRange(doc, pos(0, 5));

      assert.ok(range);
      assert.strictEqual(doc.getText(range), "What a day!");
    });
  });

  suite("getNextEnd", () => {
    test("finds next sentence end", async () => {
      const doc = new MockTextDocument("First.  Second.");

      const end = await sentenceBounds.getNextEnd({ document: doc } as unknown as vscode.TextEditor, pos(0, 0));

      assert.ok(end);
      assert.strictEqual(end.character, 8);
    });

    test("finds second sentence end", async () => {
      const doc = new MockTextDocument("First.  Second.");

      const end = await sentenceBounds.getNextEnd({ document: doc } as unknown as vscode.TextEditor, pos(0, 8));

      assert.ok(end);
      assert.strictEqual(end.character, 15);
    });

    test("returns null at end", async () => {
      const doc = new MockTextDocument("Only one.");

      const end = await sentenceBounds.getNextEnd({ document: doc } as unknown as vscode.TextEditor, pos(0, 9));

      assert.strictEqual(end, null);
    });
  });

  suite("getPreviousStart", () => {
    test("finds sentence beginning", async () => {
      const doc = new MockTextDocument("First.  Second.");

      const begin = await sentenceBounds.getPreviousStart(
        { document: doc } as unknown as vscode.TextEditor,
        pos(0, 12)
      );

      assert.ok(begin);
      assert.strictEqual(begin.character, 8);
    });

    test("returns 0 at document start", async () => {
      const doc = new MockTextDocument("First sentence.");

      const begin = await sentenceBounds.getPreviousStart({ document: doc } as unknown as vscode.TextEditor, pos(0, 5));

      assert.ok(begin);
      assert.strictEqual(begin.character, 0);
    });
  });

  suite("Japanese sentences", () => {
    test("Japanese period (。)", async () => {
      const doc = new MockTextDocument("これは文です。");

      const range = await getRange(doc, pos(0, 3));

      assert.ok(range);
      assert.strictEqual(doc.getText(range), "これは文です。");
    });

    test("multiple Japanese sentences", async () => {
      const doc = new MockTextDocument("最初の文。二番目の文。");

      const firstRange = await getRange(doc, pos(0, 2));
      assert.ok(firstRange);
      assert.strictEqual(doc.getText(firstRange), "最初の文。");

      const secondRange = await getRange(doc, pos(0, 8));
      assert.ok(secondRange);
      assert.strictEqual(doc.getText(secondRange), "二番目の文。");
    });
  });

  suite("Emacs compatibility tests", () => {
    test("forward-sentence behavior", async () => {
      const doc = new MockTextDocument("First sentence. Second sentence.");

      const end1 = await sentenceBounds.getNextEnd({ document: doc } as unknown as vscode.TextEditor, pos(0, 0));
      assert.ok(end1);
      assert.strictEqual(end1.character, 16);

      const end2 = await sentenceBounds.getNextEnd({ document: doc } as unknown as vscode.TextEditor, end1);
      assert.ok(end2);
      assert.strictEqual(end2.character, 32);
    });

    test("backward-sentence behavior", async () => {
      const doc = new MockTextDocument("First sentence. Second sentence.");

      const begin = await sentenceBounds.getPreviousStart(
        { document: doc } as unknown as vscode.TextEditor,
        pos(0, 32)
      );
      assert.ok(begin);
      assert.strictEqual(begin.character, 16);
    });
  });
});
