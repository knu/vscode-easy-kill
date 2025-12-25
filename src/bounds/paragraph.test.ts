import * as assert from "assert";
import * as vscode from "vscode";
import { ParagraphBounds } from "./paragraph";
import { MockTextDocument, pos } from "../test-helpers";

suite("Paragraph Navigation Tests", () => {
  const paragraphBounds = new ParagraphBounds();

  function createMockEditor(doc: vscode.TextDocument): vscode.TextEditor {
    return {
      document: doc,
      selection: new vscode.Selection(0, 0, 0, 0),
    } as vscode.TextEditor;
  }

  suite("Basic behavior", () => {
    test("returns null on blank line", async () => {
      const doc = new MockTextDocument("First.\n\nSecond.");
      const editor = createMockEditor(doc);

      const range = await paragraphBounds.getRangeAtPosition(editor, pos(1, 0));

      assert.strictEqual(range, null);
    });
  });
});
