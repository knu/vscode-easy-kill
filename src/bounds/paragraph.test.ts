import * as assert from "assert";
import { ParagraphBounds } from "./paragraph";
import { withEditor, pos } from "../test-helpers";

suite("Paragraph Navigation Tests", () => {
  const paragraphBounds = new ParagraphBounds();

  suite("Basic behavior", () => {
    test("returns null on blank line", async () => {
      await withEditor("First.\n\nSecond.", async (editor) => {
        const range = await paragraphBounds.getRangeAtPosition(editor, pos(1, 0));

        assert.strictEqual(range, null);
      });
    });
  });
});
