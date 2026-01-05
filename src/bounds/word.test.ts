import * as assert from "assert";
import { nextWordEnd, previousWordStart } from "./word";
import { withEditor, pos } from "../test-helpers";

suite("Word Navigation Tests", () => {
  suite("nextWordEnd", () => {
    test("finds end of current word", async () => {
      await withEditor("foo bar", async (editor) => {
        const doc = editor.document;
        assert.strictEqual(nextWordEnd(doc, pos(0, 0))?.character, 3);
        assert.strictEqual(nextWordEnd(doc, pos(0, 1))?.character, 3);
      });
    });

    test("finds end of next word from space", async () => {
      await withEditor("foo bar", async (editor) => {
        const doc = editor.document;
        assert.strictEqual(nextWordEnd(doc, pos(0, 3))?.character, 7);
      });
    });

    test("returns null at end of document", async () => {
      await withEditor("foo", async (editor) => {
        const doc = editor.document;
        assert.strictEqual(nextWordEnd(doc, pos(0, 3)), null);
      });
    });

    test("crosses lines", async () => {
      await withEditor("foo\nbar", async (editor) => {
        const doc = editor.document;
        const result = nextWordEnd(doc, pos(0, 3));
        assert.strictEqual(result?.line, 1);
        assert.strictEqual(result?.character, 3);
      });
    });

    test("crosses empty lines", async () => {
      await withEditor("foo\n\n\nbar", async (editor) => {
        const doc = editor.document;
        const result = nextWordEnd(doc, pos(0, 3));
        assert.strictEqual(result?.line, 3);
        assert.strictEqual(result?.character, 3);
      });
    });

    test("position invariant: result always after input", async () => {
      await withEditor("one two three", async (editor) => {
        const doc = editor.document;
        for (let i = 0; i < doc.lineAt(0).text.length; i++) {
          const result = nextWordEnd(doc, pos(0, i));
          if (result) {
            assert.ok(result.isAfter(pos(0, i)));
          }
        }
      });
    });
  });

  suite("previousWordStart", () => {
    test("finds start of current word from middle", async () => {
      await withEditor("foo bar", async (editor) => {
        const doc = editor.document;
        assert.strictEqual(previousWordStart(doc, pos(0, 5))?.character, 4);
        assert.strictEqual(previousWordStart(doc, pos(0, 6))?.character, 4);
      });
    });

    test("finds start of previous word from space", async () => {
      await withEditor("foo bar", async (editor) => {
        const doc = editor.document;
        assert.strictEqual(previousWordStart(doc, pos(0, 4))?.character, 0);
      });
    });

    test("returns null at start of document", async () => {
      await withEditor("foo", async (editor) => {
        const doc = editor.document;
        assert.strictEqual(previousWordStart(doc, pos(0, 0)), null);
      });
    });

    test("crosses lines", async () => {
      await withEditor("foo\nbar", async (editor) => {
        const doc = editor.document;
        const result = previousWordStart(doc, pos(1, 0));
        assert.strictEqual(result?.line, 0);
        assert.strictEqual(result?.character, 0);
      });
    });

    test("crosses empty lines", async () => {
      await withEditor("foo\n\n\nbar", async (editor) => {
        const doc = editor.document;
        const result = previousWordStart(doc, pos(3, 0));
        assert.strictEqual(result?.line, 0);
        assert.strictEqual(result?.character, 0);
      });
    });

    test("position invariant: result always before input", async () => {
      await withEditor("one two three", async (editor) => {
        const doc = editor.document;
        for (let i = 1; i < doc.lineAt(0).text.length; i++) {
          const result = previousWordStart(doc, pos(0, i));
          if (result) {
            assert.ok(result.isBefore(pos(0, i)));
          }
        }
      });
    });
  });

  suite("forwardWordRange", () => {
    test("gets current word range", async () => {
      await withEditor("fooBar baz", async (editor) => {
        const doc = editor.document;
        const wordEnd1 = nextWordEnd(doc, pos(0, 0));
        const fromStart = wordEnd1 && doc.getWordRangeAtPosition(wordEnd1);
        const wordEnd2 = nextWordEnd(doc, pos(0, 3));
        const fromMiddle = wordEnd2 && doc.getWordRangeAtPosition(wordEnd2);

        assert.ok(fromStart);
        assert.strictEqual(doc.getText(fromStart), "fooBar");
        assert.ok(fromMiddle);
        assert.strictEqual(doc.getText(fromMiddle), "fooBar");
      });
    });

    test("returns null at end of word", async () => {
      await withEditor("foo", async (editor) => {
        const doc = editor.document;
        const wordEnd = nextWordEnd(doc, pos(0, 3));
        const range = wordEnd && doc.getWordRangeAtPosition(wordEnd);
        assert.strictEqual(range, null);
      });
    });
  });

  suite("backwardWordRange", () => {
    test("gets previous word range", async () => {
      await withEditor("foo bar", async (editor) => {
        const doc = editor.document;
        const wordStart = previousWordStart(doc, pos(0, 4));
        const result = wordStart && doc.getWordRangeAtPosition(wordStart);
        assert.ok(result);
        assert.strictEqual(doc.getText(result), "foo");
      });
    });

    test("gets current word range from end", async () => {
      await withEditor("foo bar", async (editor) => {
        const doc = editor.document;
        const wordStart = previousWordStart(doc, pos(0, 7));
        const result = wordStart && doc.getWordRangeAtPosition(wordStart);
        assert.ok(result);
        assert.strictEqual(doc.getText(result), "bar");
      });
    });

    test("returns null at start of document", async () => {
      await withEditor("foo", async (editor) => {
        const doc = editor.document;
        const wordStart = previousWordStart(doc, pos(0, 0));
        const range = wordStart && doc.getWordRangeAtPosition(wordStart);
        assert.strictEqual(range, null);
      });
    });
  });

  suite("Word boundaries", () => {
    test("forward and backward symmetry", async () => {
      await withEditor("fooBar", async (editor) => {
        const doc = editor.document;

        const wordEnd = nextWordEnd(doc, pos(0, 0));
        const forward = wordEnd && doc.getWordRangeAtPosition(wordEnd);
        const wordStart = previousWordStart(doc, pos(0, 6));
        const backward = wordStart && doc.getWordRangeAtPosition(wordStart);

        assert.ok(forward);
        assert.ok(backward);
        assert.strictEqual(doc.getText(forward), "fooBar");
        assert.strictEqual(doc.getText(backward), "fooBar");
      });
    });

    test("at word boundaries", async () => {
      await withEditor("foo bar", async (editor) => {
        const doc = editor.document;

        assert.strictEqual(nextWordEnd(doc, pos(0, 0))?.character, 3);
        assert.strictEqual(nextWordEnd(doc, pos(0, 3))?.character, 7);
        assert.strictEqual(nextWordEnd(doc, pos(0, 7)), null);

        assert.strictEqual(previousWordStart(doc, pos(0, 0)), null);
        assert.strictEqual(previousWordStart(doc, pos(0, 3))?.character, 0);
        assert.strictEqual(previousWordStart(doc, pos(0, 7))?.character, 4);
      });
    });
  });
});
