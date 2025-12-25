import * as assert from "assert";
import * as vscode from "vscode";
import { bufferBounds, bufferBeforeBounds, bufferAfterBounds } from "./buffer";
import { MockTextDocument, pos } from "../test-helpers";
import { Selection } from "../types";

suite("Buffer Bounds Tests", () => {
  function createMockEditor(doc: vscode.TextDocument): vscode.TextEditor {
    return {
      document: doc,
      selection: new vscode.Selection(0, 0, 0, 0),
    } as vscode.TextEditor;
  }

  suite("BufferBounds", () => {
    test("gets entire buffer range", async () => {
      const doc = new MockTextDocument("first line\nsecond line\nthird line");
      const editor = createMockEditor(doc);

      const range = await bufferBounds.getRangeAtPosition(editor, pos(1, 5));

      assert.ok(range);
      assert.strictEqual(doc.getText(range), "first line\nsecond line\nthird line");
      assert.strictEqual(range.start.line, 0);
      assert.strictEqual(range.start.character, 0);
    });

    test("handles single line", async () => {
      const doc = new MockTextDocument("only line");
      const editor = createMockEditor(doc);

      const range = await bufferBounds.getRangeAtPosition(editor, pos(0, 3));

      assert.ok(range);
      assert.strictEqual(doc.getText(range), "only line");
    });

    test("range from any position returns entire buffer", async () => {
      const doc = new MockTextDocument("first\nsecond\nthird");
      const editor = createMockEditor(doc);

      const range1 = await bufferBounds.getRangeAtPosition(editor, pos(0, 0));
      const range2 = await bufferBounds.getRangeAtPosition(editor, pos(2, 5));

      assert.ok(range1);
      assert.ok(range2);
      assert.strictEqual(doc.getText(range1), doc.getText(range2));
    });
  });

  suite("BufferBeforeBounds", () => {
    test("gets buffer from start to position", async () => {
      const doc = new MockTextDocument("first line\nsecond line\nthird line");
      const editor = createMockEditor(doc);

      const initialSelection: Selection = {
        type: "buffer-before",
        range: new vscode.Range(pos(1, 7), pos(1, 7)),
        initialRange: new vscode.Range(pos(1, 7), pos(1, 7)),
        text: "",
        count: 0,
      };

      const selection = await bufferBeforeBounds.getNewSelection(editor, initialSelection);

      assert.ok(selection);
      assert.strictEqual(doc.getText(selection.range), "first line\nsecond ");
    });

    test("handles position at start", async () => {
      const doc = new MockTextDocument("first line");
      const editor = createMockEditor(doc);

      const initialSelection: Selection = {
        type: "buffer-before",
        range: new vscode.Range(pos(0, 0), pos(0, 0)),
        initialRange: new vscode.Range(pos(0, 0), pos(0, 0)),
        text: "",
        count: 0,
      };

      const selection = await bufferBeforeBounds.getNewSelection(editor, initialSelection);

      assert.ok(selection);
      assert.strictEqual(doc.getText(selection.range), "");
    });

    test("handles position at end of line", async () => {
      const doc = new MockTextDocument("first\nsecond");
      const editor = createMockEditor(doc);

      const initialSelection: Selection = {
        type: "buffer-before",
        range: new vscode.Range(pos(1, 6), pos(1, 6)),
        initialRange: new vscode.Range(pos(1, 6), pos(1, 6)),
        text: "",
        count: 0,
      };

      const selection = await bufferBeforeBounds.getNewSelection(editor, initialSelection);

      assert.ok(selection);
      assert.strictEqual(doc.getText(selection.range), "first\nsecond");
    });
  });

  suite("BufferAfterBounds", () => {
    test("gets buffer from position to end", async () => {
      const doc = new MockTextDocument("first line\nsecond line\nthird line");
      const editor = createMockEditor(doc);

      const range = await bufferAfterBounds.getRangeAtPosition(editor, pos(1, 7));

      assert.ok(range);
      assert.strictEqual(doc.getText(range), "line\nthird line");
    });

    test("handles position at end", async () => {
      const doc = new MockTextDocument("only line");
      const editor = createMockEditor(doc);

      const range = await bufferAfterBounds.getRangeAtPosition(editor, pos(0, 9));

      assert.ok(range);
      assert.strictEqual(doc.getText(range), "");
    });

    test("handles position at start", async () => {
      const doc = new MockTextDocument("first\nsecond");
      const editor = createMockEditor(doc);

      const range = await bufferAfterBounds.getRangeAtPosition(editor, pos(0, 0));

      assert.ok(range);
      assert.strictEqual(doc.getText(range), "first\nsecond");
    });

    test("handles middle of multiline document", async () => {
      const doc = new MockTextDocument("line1\nline2\nline3\nline4");
      const editor = createMockEditor(doc);

      const range = await bufferAfterBounds.getRangeAtPosition(editor, pos(1, 2));

      assert.ok(range);
      assert.strictEqual(doc.getText(range), "ne2\nline3\nline4");
    });
  });
});
