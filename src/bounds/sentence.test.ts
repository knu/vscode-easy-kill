import * as assert from "assert";
import * as vscode from "vscode";
import { SentenceBounds } from "./sentence";
import { withEditor, pos } from "../test-helpers";

suite("Sentence Navigation Tests", () => {
  const sentenceBounds = new SentenceBounds();

  async function getRange(editor: vscode.TextEditor, position: vscode.Position) {
    return sentenceBounds.getRangeAtPosition(editor, position);
  }

  suite("Basic sentence detection", () => {
    test("single sentence with period", async () => {
      await withEditor("This is a sentence.", async (editor) => {
        const range = await getRange(editor, pos(0, 5));

        assert.ok(range);
        assert.strictEqual(editor.document.getText(range), "This is a sentence.");
      });
    });

    test("multiple sentences", async () => {
      await withEditor("First sentence.  Second sentence.", async (editor) => {
        const firstRange = await getRange(editor, pos(0, 5));
        assert.ok(firstRange);
        assert.strictEqual(editor.document.getText(firstRange), "First sentence.");

        const secondRange = await getRange(editor, pos(0, 20));
        assert.ok(secondRange);
        assert.strictEqual(editor.document.getText(secondRange), "Second sentence.");
      });
    });

    test("question mark", async () => {
      await withEditor("Is this a question?", async (editor) => {
        const range = await getRange(editor, pos(0, 5));

        assert.ok(range);
        assert.strictEqual(editor.document.getText(range), "Is this a question?");
      });
    });

    test("exclamation mark", async () => {
      await withEditor("What a day!", async (editor) => {
        const range = await getRange(editor, pos(0, 5));

        assert.ok(range);
        assert.strictEqual(editor.document.getText(range), "What a day!");
      });
    });
  });

  suite("getNextEnd", () => {
    test("finds next sentence end", async () => {
      await withEditor("First.  Second.", async (editor) => {
        const end = await sentenceBounds.getNextEnd(editor, pos(0, 0));

        assert.ok(end);
        assert.strictEqual(end.character, 8);
      });
    });

    test("finds second sentence end", async () => {
      await withEditor("First.  Second.", async (editor) => {
        const end = await sentenceBounds.getNextEnd(editor, pos(0, 8));

        assert.ok(end);
        assert.strictEqual(end.character, 15);
      });
    });

    test("returns null at end", async () => {
      await withEditor("Only one.", async (editor) => {
        const end = await sentenceBounds.getNextEnd(editor, pos(0, 9));

        assert.strictEqual(end, null);
      });
    });
  });

  suite("getPreviousStart", () => {
    test("finds sentence beginning", async () => {
      await withEditor("First.  Second.", async (editor) => {
        const begin = await sentenceBounds.getPreviousStart(editor, pos(0, 12));

        assert.ok(begin);
        assert.strictEqual(begin.character, 8);
      });
    });

    test("returns 0 at document start", async () => {
      await withEditor("First sentence.", async (editor) => {
        const begin = await sentenceBounds.getPreviousStart(editor, pos(0, 5));

        assert.ok(begin);
        assert.strictEqual(begin.character, 0);
      });
    });
  });

  suite("Japanese sentences", () => {
    test("Japanese period (。)", async () => {
      await withEditor("これは文です。", async (editor) => {
        const range = await getRange(editor, pos(0, 3));

        assert.ok(range);
        assert.strictEqual(editor.document.getText(range), "これは文です。");
      });
    });

    test("multiple Japanese sentences", async () => {
      await withEditor("最初の文。二番目の文。", async (editor) => {
        const firstRange = await getRange(editor, pos(0, 2));
        assert.ok(firstRange);
        assert.strictEqual(editor.document.getText(firstRange), "最初の文。");

        const secondRange = await getRange(editor, pos(0, 8));
        assert.ok(secondRange);
        assert.strictEqual(editor.document.getText(secondRange), "二番目の文。");
      });
    });
  });

  suite("Emacs compatibility tests", () => {
    test("forward-sentence behavior", async () => {
      await withEditor("First sentence. Second sentence.", async (editor) => {
        const end1 = await sentenceBounds.getNextEnd(editor, pos(0, 0));
        assert.ok(end1);
        assert.strictEqual(end1.character, 16);

        const end2 = await sentenceBounds.getNextEnd(editor, end1);
        assert.ok(end2);
        assert.strictEqual(end2.character, 32);
      });
    });

    test("backward-sentence behavior", async () => {
      await withEditor("First sentence. Second sentence.", async (editor) => {
        const begin = await sentenceBounds.getPreviousStart(editor, pos(0, 32));
        assert.ok(begin);
        assert.strictEqual(begin.character, 16);
      });
    });
  });
});
