import * as assert from "assert";
import * as vscode from "vscode";
import { charSearchBoundsArray } from "./char";
import { MockTextDocument, pos } from "../test-helpers";
import { Selection } from "../types";

suite("Character Search Tests", () => {
  function createMockEditor(doc: vscode.TextDocument): vscode.TextEditor {
    return {
      document: doc,
      selection: new vscode.Selection(0, 0, 0, 0),
    } as vscode.TextEditor;
  }

  // Get bounds by type
  const forwardInclusiveBounds = charSearchBoundsArray.find((b) => b.type === "string-to-char-forward")!;
  const forwardExclusiveBounds = charSearchBoundsArray.find((b) => b.type === "string-up-to-char-forward")!;
  const backwardInclusiveBounds = charSearchBoundsArray.find((b) => b.type === "string-to-char-backward")!;

  suite("f/F (forward/backward inclusive) navigation", () => {
    test("f SPC, f, F, F, F, f, t, t, F sequence", async () => {
      // "aa bb cc dd ee ff" with cursor at 'd' (offset 9, position 0:9)
      const doc = new MockTextDocument("aa bb cc dd ee ff");
      const editor = createMockEditor(doc);
      const initialPos = pos(0, 9); // 'd' in "dd"
      const spaceChar = " ";

      // Initial selection at cursor position with arg already set
      let currentSel: Selection = {
        type: "string-to-char-forward",
        range: new vscode.Range(initialPos, initialPos),
        initialPosition: initialPos,
        text: "",
        arg: spaceChar,
      };

      // Step 1: f SPC -> "dd "
      let sel = await forwardInclusiveBounds.getNewSelection(editor, currentSel, undefined);
      assert.ok(sel, "f SPC should find space");
      assert.strictEqual(doc.getText(sel.range), "dd ", "f SPC should select 'dd '");
      currentSel = sel;

      // Step 2: f -> "dd ee "
      sel = await forwardInclusiveBounds.getNewSelection(editor, currentSel, 1);
      assert.ok(sel, "f should expand to next space");
      assert.strictEqual(doc.getText(sel.range), "dd ee ", "f should select 'dd ee '");
      currentSel = sel;

      // Step 3: F (type change to backward) -> "dd "
      sel = await backwardInclusiveBounds.getNewSelection(editor, currentSel, undefined);
      assert.ok(sel, "F type change should succeed");
      assert.strictEqual(doc.getText(sel.range), "dd ", "F should shrink back to 'dd '");
      currentSel = sel;

      // Step 4: F (expand backward) -> " " (space before dd)
      sel = await backwardInclusiveBounds.getNewSelection(editor, currentSel, 1);
      assert.ok(sel, "F should expand backward to previous space");
      assert.strictEqual(doc.getText(sel.range), " ", "F should select space before dd");
      currentSel = sel;

      // Step 5: F (expand backward) -> " cc " (space before cc, through cc, to space after cc which is before dd)
      sel = await backwardInclusiveBounds.getNewSelection(editor, currentSel, 1);
      assert.ok(sel, "F should expand further backward");
      assert.strictEqual(doc.getText(sel.range), " cc ", "F should select ' cc '");
      currentSel = sel;

      // Step 6: f (type change to forward) -> " " (shrink to just the space before dd)
      sel = await forwardInclusiveBounds.getNewSelection(editor, currentSel, undefined);
      assert.ok(sel, "f type change should succeed");
      assert.strictEqual(doc.getText(sel.range), " ", "f should shrink to space before dd");
      assert.strictEqual(sel.range.start.character, 8, "range should start at offset 8");
      assert.strictEqual(sel.range.end.character, 9, "range should end at offset 9 (initialPosition)");
      currentSel = sel;

      // Step 7: t (type change to exclusive forward) -> "dd"
      // Note: The range is currently " " (8-9), expanded left from initialPosition (9)
      // When switching to forward exclusive 't', we need to find next space from initialPosition
      sel = await forwardExclusiveBounds.getNewSelection(editor, currentSel, undefined);
      assert.ok(sel, "t type change should succeed");
      assert.strictEqual(doc.getText(sel.range), "dd", "t should select 'dd' (exclusive of space)");
      assert.strictEqual(sel.range.start.character, 9, "range should start at initialPosition");
      assert.strictEqual(sel.range.end.character, 11, "range should end before next space");
      currentSel = sel;

      // Step 8: t (expand exclusive forward) -> "dd ee"
      sel = await forwardExclusiveBounds.getNewSelection(editor, currentSel, 1);
      assert.ok(sel, "t should expand to next space (exclusive)");
      assert.strictEqual(doc.getText(sel.range), "dd ee", "t should select 'dd ee' (exclusive)");
      currentSel = sel;

      // Step 9: F (type change to backward inclusive) -> "dd "
      sel = await backwardInclusiveBounds.getNewSelection(editor, currentSel, undefined);
      assert.ok(sel, "F type change should succeed");
      assert.strictEqual(doc.getText(sel.range), "dd ", "F should select 'dd ' (inclusive of space)");
      currentSel = sel;
    });
  });

  suite("Basic character search", () => {
    test("forward inclusive finds character", async () => {
      const doc = new MockTextDocument("hello world");
      const editor = createMockEditor(doc);
      const initialPos = pos(0, 0);

      const currentSel: Selection = {
        type: "string-to-char-forward",
        range: new vscode.Range(initialPos, initialPos),
        initialPosition: initialPos,
        text: "",
        arg: "o",
      };

      const sel = await forwardInclusiveBounds.getNewSelection(editor, currentSel, undefined);
      assert.ok(sel);
      assert.strictEqual(doc.getText(sel.range), "hello");
    });

    test("forward exclusive finds character", async () => {
      const doc = new MockTextDocument("hello world");
      const editor = createMockEditor(doc);
      const initialPos = pos(0, 0);

      const currentSel: Selection = {
        type: "string-up-to-char-forward",
        range: new vscode.Range(initialPos, initialPos),
        initialPosition: initialPos,
        text: "",
        arg: "o",
      };

      const sel = await forwardExclusiveBounds.getNewSelection(editor, currentSel, undefined);
      assert.ok(sel);
      assert.strictEqual(doc.getText(sel.range), "hell");
    });
  });
});
