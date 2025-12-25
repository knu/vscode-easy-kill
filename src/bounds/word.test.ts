import * as assert from "assert";
import { nextWordEnd, previousWordStart, forwardWordRange, backwardWordRange } from "./word";
import { MockTextDocument, pos } from "../test-helpers";

suite("Word Navigation Tests", () => {
  suite("nextWordEnd", () => {
    test("finds end of current word", () => {
      const doc = new MockTextDocument("foo bar");
      assert.strictEqual(nextWordEnd(doc, pos(0, 0))?.character, 3);
      assert.strictEqual(nextWordEnd(doc, pos(0, 1))?.character, 3);
    });

    test("finds end of next word from space", () => {
      const doc = new MockTextDocument("foo bar");
      assert.strictEqual(nextWordEnd(doc, pos(0, 3))?.character, 7);
    });

    test("returns null at end of document", () => {
      const doc = new MockTextDocument("foo");
      assert.strictEqual(nextWordEnd(doc, pos(0, 3)), null);
    });

    test("crosses lines", () => {
      const doc = new MockTextDocument("foo\nbar");
      const result = nextWordEnd(doc, pos(0, 3));
      assert.strictEqual(result?.line, 1);
      assert.strictEqual(result?.character, 3);
    });

    test("crosses empty lines", () => {
      const doc = new MockTextDocument("foo\n\n\nbar");
      const result = nextWordEnd(doc, pos(0, 3));
      assert.strictEqual(result?.line, 3);
      assert.strictEqual(result?.character, 3);
    });

    test("position invariant: result always after input", () => {
      const doc = new MockTextDocument("one two three");
      for (let i = 0; i < doc.lineAt(0).text.length; i++) {
        const result = nextWordEnd(doc, pos(0, i));
        if (result) {
          assert.ok(result.isAfter(pos(0, i)));
        }
      }
    });
  });

  suite("previousWordStart", () => {
    test("finds start of current word from middle", () => {
      const doc = new MockTextDocument("foo bar");
      assert.strictEqual(previousWordStart(doc, pos(0, 5))?.character, 4);
      assert.strictEqual(previousWordStart(doc, pos(0, 6))?.character, 4);
    });

    test("finds start of previous word from space", () => {
      const doc = new MockTextDocument("foo bar");
      assert.strictEqual(previousWordStart(doc, pos(0, 4))?.character, 0);
    });

    test("returns null at start of document", () => {
      const doc = new MockTextDocument("foo");
      assert.strictEqual(previousWordStart(doc, pos(0, 0)), null);
    });

    test("crosses lines", () => {
      const doc = new MockTextDocument("foo\nbar");
      const result = previousWordStart(doc, pos(1, 0));
      assert.strictEqual(result?.line, 0);
      assert.strictEqual(result?.character, 0);
    });

    test("crosses empty lines", () => {
      const doc = new MockTextDocument("foo\n\n\nbar");
      const result = previousWordStart(doc, pos(3, 0));
      assert.strictEqual(result?.line, 0);
      assert.strictEqual(result?.character, 0);
    });

    test("position invariant: result always before input", () => {
      const doc = new MockTextDocument("one two three");
      for (let i = 1; i < doc.lineAt(0).text.length; i++) {
        const result = previousWordStart(doc, pos(0, i));
        if (result) {
          assert.ok(result.isBefore(pos(0, i)));
        }
      }
    });
  });

  suite("forwardWordRange", () => {
    test("gets current word range", () => {
      const doc = new MockTextDocument("fooBar baz");
      const fromStart = forwardWordRange(doc, pos(0, 0));
      const fromMiddle = forwardWordRange(doc, pos(0, 3));

      assert.ok(fromStart);
      assert.strictEqual(doc.getText(fromStart), "fooBar");
      assert.ok(fromMiddle);
      assert.strictEqual(doc.getText(fromMiddle), "fooBar");
    });

    test("returns null at end of word", () => {
      const doc = new MockTextDocument("foo");
      assert.strictEqual(forwardWordRange(doc, pos(0, 3)), null);
    });
  });

  suite("backwardWordRange", () => {
    test("gets previous word range", () => {
      const doc = new MockTextDocument("foo bar");
      const result = backwardWordRange(doc, pos(0, 4));
      assert.ok(result);
      assert.strictEqual(doc.getText(result), "foo");
    });

    test("gets current word range from end", () => {
      const doc = new MockTextDocument("foo bar");
      const result = backwardWordRange(doc, pos(0, 7));
      assert.ok(result);
      assert.strictEqual(doc.getText(result), "bar");
    });

    test("returns null at start of document", () => {
      const doc = new MockTextDocument("foo");
      assert.strictEqual(backwardWordRange(doc, pos(0, 0)), null);
    });
  });

  suite("Word boundaries", () => {
    test("forward and backward symmetry", () => {
      const doc = new MockTextDocument("fooBar");

      const forward = forwardWordRange(doc, pos(0, 0));
      const backward = backwardWordRange(doc, pos(0, 6));

      assert.ok(forward);
      assert.ok(backward);
      assert.strictEqual(doc.getText(forward), "fooBar");
      assert.strictEqual(doc.getText(backward), "fooBar");
    });

    test("at word boundaries", () => {
      const doc = new MockTextDocument("foo bar");

      assert.strictEqual(nextWordEnd(doc, pos(0, 0))?.character, 3);
      assert.strictEqual(nextWordEnd(doc, pos(0, 3))?.character, 7);
      assert.strictEqual(nextWordEnd(doc, pos(0, 7)), null);

      assert.strictEqual(previousWordStart(doc, pos(0, 0)), null);
      assert.strictEqual(previousWordStart(doc, pos(0, 3))?.character, 0);
      assert.strictEqual(previousWordStart(doc, pos(0, 7))?.character, 4);
    });
  });
});
