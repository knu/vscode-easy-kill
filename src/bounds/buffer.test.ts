import * as assert from "assert";
import * as vscode from "vscode";
import { bufferBounds, bufferBeforeBounds, bufferAfterBounds } from "./buffer";
import { withEditor, pos } from "../test-helpers";
import { Selection } from "../types";

suite("Buffer Bounds Tests", () => {
  suite("BufferBounds", () => {
    test("gets entire buffer range", async () => {
      await withEditor("first line\nsecond line\nthird line", async (editor) => {
        const range = await bufferBounds.getRangeAtPosition(editor, pos(1, 5));

        assert.ok(range);
        assert.strictEqual(editor.document.getText(range), "first line\nsecond line\nthird line");
        assert.strictEqual(range.start.line, 0);
        assert.strictEqual(range.start.character, 0);
      });
    });

    test("handles single line", async () => {
      await withEditor("only line", async (editor) => {
        const range = await bufferBounds.getRangeAtPosition(editor, pos(0, 3));

        assert.ok(range);
        assert.strictEqual(editor.document.getText(range), "only line");
      });
    });

    test("range from any position returns entire buffer", async () => {
      await withEditor("first\nsecond\nthird", async (editor) => {
        const range1 = await bufferBounds.getRangeAtPosition(editor, pos(0, 0));
        const range2 = await bufferBounds.getRangeAtPosition(editor, pos(2, 5));

        assert.ok(range1);
        assert.ok(range2);
        assert.strictEqual(editor.document.getText(range1), editor.document.getText(range2));
      });
    });
  });

  suite("BufferBeforeBounds", () => {
    test("gets buffer from start to position", async () => {
      await withEditor("first line\nsecond line\nthird line", async (editor) => {
        const initialSelection: Selection = {
          type: "buffer-before",
          range: new vscode.Range(pos(1, 7), pos(1, 7)),
          initialPosition: pos(1, 7),
          text: "",
        };

        const selection = await bufferBeforeBounds.getNewSelection(editor, initialSelection);

        assert.ok(selection);
        assert.strictEqual(editor.document.getText(selection.range), "first line\nsecond ");
      });
    });

    test("includes current line on expand", async () => {
      await withEditor("first line\nsecond line\nthird line", async (editor) => {
        const initialSelection: Selection = {
          type: "buffer-before",
          range: new vscode.Range(pos(1, 7), pos(1, 7)),
          initialPosition: pos(1, 7),
          text: "",
        };

        const selection = await bufferBeforeBounds.getNewSelection(editor, initialSelection, 1);

        assert.ok(selection);
        assert.strictEqual(editor.document.getText(selection.range), "first line\nsecond line\n");
      });
    });

    test("excludes current line on shrink", async () => {
      await withEditor("first line\nsecond line\nthird line", async (editor) => {
        const initialSelection: Selection = {
          type: "buffer-before",
          range: new vscode.Range(pos(1, 7), pos(1, 7)),
          initialPosition: pos(1, 7),
          text: "",
        };

        const selection = await bufferBeforeBounds.getNewSelection(editor, initialSelection, -1);

        assert.ok(selection);
        assert.strictEqual(editor.document.getText(selection.range), "first line\n");
      });
    });

    test("handles position at start", async () => {
      await withEditor("first line", async (editor) => {
        const initialSelection: Selection = {
          type: "buffer-before",
          range: new vscode.Range(pos(0, 0), pos(0, 0)),
          initialPosition: pos(0, 0),
          text: "",
        };

        const selection = await bufferBeforeBounds.getNewSelection(editor, initialSelection);

        assert.ok(selection);
        assert.strictEqual(editor.document.getText(selection.range), "");
      });
    });

    test("handles position at end of line", async () => {
      await withEditor("first\nsecond", async (editor) => {
        const initialSelection: Selection = {
          type: "buffer-before",
          range: new vscode.Range(pos(1, 6), pos(1, 6)),
          initialPosition: pos(1, 6),
          text: "",
        };

        const selection = await bufferBeforeBounds.getNewSelection(editor, initialSelection);

        assert.ok(selection);
        assert.strictEqual(editor.document.getText(selection.range), "first\nsecond");
      });
    });
  });

  suite("BufferAfterBounds", () => {
    test("gets buffer from position to end", async () => {
      await withEditor("first line\nsecond line\nthird line", async (editor) => {
        const range = await bufferAfterBounds.getRangeAtPosition(editor, pos(1, 7));

        assert.ok(range);
        assert.strictEqual(editor.document.getText(range), "line\nthird line");
      });
    });

    test("includes current line on expand", async () => {
      await withEditor("first line\nsecond line\nthird line", async (editor) => {
        const initialSelection: Selection = {
          type: "buffer-after",
          range: new vscode.Range(pos(1, 7), pos(1, 7)),
          initialPosition: pos(1, 7),
          text: "",
        };

        const selection = await bufferAfterBounds.getNewSelection(editor, initialSelection, 1);

        assert.ok(selection);
        assert.strictEqual(editor.document.getText(selection.range), "second line\nthird line");
      });
    });

    test("excludes current line on shrink", async () => {
      await withEditor("first line\nsecond line\nthird line", async (editor) => {
        const initialSelection: Selection = {
          type: "buffer-after",
          range: new vscode.Range(pos(1, 7), pos(1, 7)),
          initialPosition: pos(1, 7),
          text: "",
        };

        const selection = await bufferAfterBounds.getNewSelection(editor, initialSelection, -1);

        assert.ok(selection);
        assert.strictEqual(editor.document.getText(selection.range), "third line");
      });
    });

    test("handles position at end", async () => {
      await withEditor("only line", async (editor) => {
        const range = await bufferAfterBounds.getRangeAtPosition(editor, pos(0, 9));

        assert.ok(range);
        assert.strictEqual(editor.document.getText(range), "");
      });
    });

    test("handles position at start", async () => {
      await withEditor("first\nsecond", async (editor) => {
        const range = await bufferAfterBounds.getRangeAtPosition(editor, pos(0, 0));

        assert.ok(range);
        assert.strictEqual(editor.document.getText(range), "first\nsecond");
      });
    });

    test("handles middle of multiline document", async () => {
      await withEditor("line1\nline2\nline3\nline4", async (editor) => {
        const range = await bufferAfterBounds.getRangeAtPosition(editor, pos(1, 2));

        assert.ok(range);
        assert.strictEqual(editor.document.getText(range), "ne2\nline3\nline4");
      });
    });
  });
});
