import * as assert from "assert";
import * as vscode from "vscode";
import { LineBounds, createBackwardLineEdgeBounds, forwardLineEdgeBounds } from "./line";
import { MockTextDocument, pos } from "../test-helpers";
import { Selection } from "../types";

suite("Line Navigation Tests", () => {
  const lineBounds = new LineBounds();

  function createMockEditor(doc: vscode.TextDocument): vscode.TextEditor {
    return {
      document: doc,
      selection: new vscode.Selection(0, 0, 0, 0),
    } as vscode.TextEditor;
  }

  suite("LineBounds", () => {
    test("gets line range at position", async () => {
      const doc = new MockTextDocument("first line\nsecond line");
      const editor = createMockEditor(doc);

      const range = await lineBounds.getRangeAtPosition(editor, pos(0, 5));

      assert.ok(range);
      assert.strictEqual(doc.getText(range), "first line\n");
    });

    test("gets last line without trailing newline", async () => {
      const doc = new MockTextDocument("first\nsecond");
      const editor = createMockEditor(doc);

      const range = await lineBounds.getRangeAtPosition(editor, pos(1, 3));

      assert.ok(range);
      assert.strictEqual(range.end.line, 2);
    });

    test("getNextEnd finds next line end", async () => {
      const doc = new MockTextDocument("first\nsecond\nthird");
      const editor = createMockEditor(doc);

      const end = await lineBounds.getNextEnd(editor, pos(0, 3));

      assert.ok(end);
      assert.strictEqual(end.line, 1);
      assert.strictEqual(end.character, 0);
    });

    test("navigates across multiple lines", async () => {
      const doc = new MockTextDocument("first\nsecond\nthird");
      const editor = createMockEditor(doc);

      const end1 = await lineBounds.getNextEnd(editor, pos(0, 0));
      assert.ok(end1);
      assert.strictEqual(end1.line, 1);

      const end2 = await lineBounds.getNextEnd(editor, end1);
      assert.ok(end2);
      assert.strictEqual(end2.line, 2);

      const start = await lineBounds.getPreviousStart(editor, end2);
      assert.ok(start);
      assert.strictEqual(start.line, 1);
    });

    test("getPreviousStart finds previous line start", async () => {
      const doc = new MockTextDocument("first\nsecond");
      const editor = createMockEditor(doc);

      const start = await lineBounds.getPreviousStart(editor, pos(1, 3));

      assert.ok(start);
      assert.strictEqual(start.line, 0);
      assert.strictEqual(start.character, 0);
    });

    test("getPreviousStart returns null at first line", async () => {
      const doc = new MockTextDocument("only line");
      const editor = createMockEditor(doc);

      const start = await lineBounds.getPreviousStart(editor, pos(0, 5));

      assert.strictEqual(start, null);
    });
  });

  suite("BackwardLineEdgeBounds", () => {
    test("progressive selection from cursor to indent, then to beginning", async () => {
      const doc = new MockTextDocument("  hello world");
      const editor = createMockEditor(doc);
      let currentSel: Selection | null = null;
      const bounds = createBackwardLineEdgeBounds(() => currentSel);

      const initialSelection: Selection = {
        type: "backward-line-edge",
        range: new vscode.Range(pos(0, 13), pos(0, 13)),
        initialPosition: pos(0, 13),
        text: "",
      };

      const selection1 = await bounds.getNewSelection(editor, initialSelection);
      assert.ok(selection1);
      assert.strictEqual(doc.getText(selection1.range), "hello world");

      currentSel = selection1;
      const selection2 = await bounds.getNewSelection(editor, selection1, 1);
      assert.ok(selection2);
      assert.strictEqual(doc.getText(selection2.range), "  hello world");
    });

    test("handles position at beginning of line", async () => {
      const doc = new MockTextDocument("  hello world");
      const editor = createMockEditor(doc);
      const currentSel: Selection | null = null;
      const bounds = createBackwardLineEdgeBounds(() => currentSel);

      const initialSelection: Selection = {
        type: "backward-line-edge",
        range: new vscode.Range(pos(0, 0), pos(0, 0)),
        initialPosition: pos(0, 0),
        text: "",
      };

      const selection = await bounds.getNewSelection(editor, initialSelection);

      assert.ok(selection);
      assert.strictEqual(doc.getText(selection.range), "");
    });

    test("handles line with no indent", async () => {
      const doc = new MockTextDocument("hello world");
      const editor = createMockEditor(doc);
      const currentSel: Selection | null = null;
      const bounds = createBackwardLineEdgeBounds(() => currentSel);

      const initialSelection: Selection = {
        type: "backward-line-edge",
        range: new vscode.Range(pos(0, 5), pos(0, 5)),
        initialPosition: pos(0, 5),
        text: "",
      };

      const selection = await bounds.getNewSelection(editor, initialSelection);

      assert.ok(selection);
      assert.strictEqual(doc.getText(selection.range), "hello");
    });
  });

  suite("ForwardLineEdgeBounds", () => {
    test("gets range from position to end of line", async () => {
      const doc = new MockTextDocument("hello world");
      const editor = createMockEditor(doc);

      const range = await forwardLineEdgeBounds.getRangeAtPosition(editor, pos(0, 6));

      assert.ok(range);
      assert.strictEqual(doc.getText(range), "world");
    });

    test("gets empty range at end of line", async () => {
      const doc = new MockTextDocument("hello");
      const editor = createMockEditor(doc);

      const range = await forwardLineEdgeBounds.getRangeAtPosition(editor, pos(0, 5));

      assert.ok(range);
      assert.strictEqual(doc.getText(range), "");
    });

    test("gets range from beginning of line", async () => {
      const doc = new MockTextDocument("hello world");
      const editor = createMockEditor(doc);

      const range = await forwardLineEdgeBounds.getRangeAtPosition(editor, pos(0, 0));

      assert.ok(range);
      assert.strictEqual(doc.getText(range), "hello world");
    });
  });
});
