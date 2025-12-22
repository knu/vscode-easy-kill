import * as assert from "assert";
import * as vscode from "vscode";
import { nextWordEnd, previousWordStart, forwardWordRange, backwardWordRange } from "./extension";

// Mock TextDocument for testing
class MockTextDocument implements vscode.TextDocument {
  constructor(private content: string) {}

  get uri(): vscode.Uri {
    return vscode.Uri.file("/test.txt");
  }

  get fileName(): string {
    return "/test.txt";
  }

  get isUntitled(): boolean {
    return false;
  }

  get languageId(): string {
    return "plaintext";
  }

  get version(): number {
    return 1;
  }

  get isDirty(): boolean {
    return false;
  }

  get isClosed(): boolean {
    return false;
  }

  save(): Thenable<boolean> {
    return Promise.resolve(true);
  }

  get eol(): vscode.EndOfLine {
    return vscode.EndOfLine.LF;
  }

  get lineCount(): number {
    return this.content.split("\n").length;
  }

  lineAt(line: number | vscode.Position): vscode.TextLine {
    const lineNumber = typeof line === "number" ? line : line.line;
    const lines = this.content.split("\n");
    const text = lines[lineNumber] || "";

    return {
      lineNumber,
      text,
      range: new vscode.Range(lineNumber, 0, lineNumber, text.length),
      rangeIncludingLineBreak: new vscode.Range(lineNumber, 0, lineNumber + 1, 0),
      firstNonWhitespaceCharacterIndex: text.search(/\S/),
      isEmptyOrWhitespace: text.trim().length === 0,
    };
  }

  offsetAt(position: vscode.Position): number {
    const lines = this.content.split("\n");
    let offset = 0;
    for (let i = 0; i < position.line; i++) {
      offset += lines[i].length + 1; // +1 for newline
    }
    return offset + position.character;
  }

  positionAt(offset: number): vscode.Position {
    const lines = this.content.split("\n");
    let currentOffset = 0;
    for (let line = 0; line < lines.length; line++) {
      const lineLength = lines[line].length;
      if (currentOffset + lineLength >= offset) {
        return new vscode.Position(line, offset - currentOffset);
      }
      currentOffset += lineLength + 1; // +1 for newline
    }
    return new vscode.Position(lines.length - 1, lines[lines.length - 1].length);
  }

  getText(range?: vscode.Range): string {
    if (!range) {
      return this.content;
    }
    const start = this.offsetAt(range.start);
    const end = this.offsetAt(range.end);
    return this.content.substring(start, end);
  }

  getWordRangeAtPosition(position: vscode.Position, regex?: RegExp): vscode.Range | undefined {
    const line = this.lineAt(position.line);
    const text = line.text;

    // Default word pattern: sequences of word characters
    const wordPattern = regex || /\w+/g;

    let match: RegExpExecArray | null;
    while ((match = wordPattern.exec(text)) !== null) {
      const start = match.index;
      const end = start + match[0].length;

      if (position.character >= start && position.character <= end) {
        return new vscode.Range(
          position.line,
          start,
          position.line,
          end
        );
      }
    }

    return undefined;
  }

  validateRange(range: vscode.Range): vscode.Range {
    return range;
  }

  validatePosition(position: vscode.Position): vscode.Position {
    return position;
  }

  get encoding(): string {
    return "utf-8";
  }

  notebook: vscode.NotebookDocument | undefined = undefined;
}

// Helper to create position
function pos(line: number, character: number): vscode.Position {
  return new vscode.Position(line, character);
}

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

suite("Sentence Navigation Tests", () => {
  suite("Basic sentence detection", () => {
    test("single sentence with period", async () => {
      const doc = new MockTextDocument("This is a sentence.");
      const { sentenceBounds } = await import("./extension");

      const range = await sentenceBounds.getRange(
        { document: doc } as any,
        pos(0, 5)
      );

      assert.ok(range);
      assert.strictEqual(doc.getText(range), "This is a sentence.");
    });

    test("multiple sentences", async () => {
      const doc = new MockTextDocument("First sentence.  Second sentence.");
      const { sentenceBounds } = await import("./extension");

      const firstRange = await sentenceBounds.getRange(
        { document: doc } as any,
        pos(0, 5)
      );
      assert.ok(firstRange);
      assert.strictEqual(doc.getText(firstRange), "First sentence.");

      const secondRange = await sentenceBounds.getRange(
        { document: doc } as any,
        pos(0, 20)
      );
      assert.ok(secondRange);
      assert.strictEqual(doc.getText(secondRange), "Second sentence.");
    });

    test("question mark", async () => {
      const doc = new MockTextDocument("Is this a question?");
      const { sentenceBounds } = await import("./extension");

      const range = await sentenceBounds.getRange(
        { document: doc } as any,
        pos(0, 5)
      );

      assert.ok(range);
      assert.strictEqual(doc.getText(range), "Is this a question?");
    });

    test("exclamation mark", async () => {
      const doc = new MockTextDocument("What a day!");
      const { sentenceBounds } = await import("./extension");

      const range = await sentenceBounds.getRange(
        { document: doc } as any,
        pos(0, 5)
      );

      assert.ok(range);
      assert.strictEqual(doc.getText(range), "What a day!");
    });
  });

  suite("getNextEnd", () => {
    test("finds next sentence end", async () => {
      const doc = new MockTextDocument("First.  Second.");
      const { sentenceBounds } = await import("./extension");

      const end = await sentenceBounds.getNextEnd(
        { document: doc } as any,
        pos(0, 0)
      );

      assert.ok(end);
      assert.strictEqual(end.character, 8);
    });

    test("finds second sentence end", async () => {
      const doc = new MockTextDocument("First.  Second.");
      const { sentenceBounds } = await import("./extension");

      const end = await sentenceBounds.getNextEnd(
        { document: doc } as any,
        pos(0, 8)
      );

      assert.ok(end);
      assert.strictEqual(end.character, 15);
    });

    test("returns null at end", async () => {
      const doc = new MockTextDocument("Only one.");
      const { sentenceBounds } = await import("./extension");

      const end = await sentenceBounds.getNextEnd(
        { document: doc } as any,
        pos(0, 9)
      );

      assert.strictEqual(end, null);
    });
  });

  suite("getPreviousBeginning", () => {
    test("finds sentence beginning", async () => {
      const doc = new MockTextDocument("First.  Second.");
      const { sentenceBounds } = await import("./extension");

      const begin = await sentenceBounds.getPreviousBeginning(
        { document: doc } as any,
        pos(0, 12)
      );

      assert.ok(begin);
      assert.strictEqual(begin.character, 8);
    });

    test("returns 0 at document start", async () => {
      const doc = new MockTextDocument("First sentence.");
      const { sentenceBounds } = await import("./extension");

      const begin = await sentenceBounds.getPreviousBeginning(
        { document: doc } as any,
        pos(0, 5)
      );

      assert.ok(begin);
      assert.strictEqual(begin.character, 0);
    });
  });

  suite("Japanese sentences", () => {
    test("Japanese period (。)", async () => {
      const doc = new MockTextDocument("これは文です。");
      const { sentenceBounds } = await import("./extension");

      const range = await sentenceBounds.getRange(
        { document: doc } as any,
        pos(0, 3)
      );

      assert.ok(range);
      assert.strictEqual(doc.getText(range), "これは文です。");
    });

    test("multiple Japanese sentences", async () => {
      const doc = new MockTextDocument("最初の文。二番目の文。");
      const { sentenceBounds } = await import("./extension");

      const firstRange = await sentenceBounds.getRange(
        { document: doc } as any,
        pos(0, 2)
      );
      assert.ok(firstRange);
      assert.strictEqual(doc.getText(firstRange), "最初の文。");

      const secondRange = await sentenceBounds.getRange(
        { document: doc } as any,
        pos(0, 8)
      );
      assert.ok(secondRange);
      assert.strictEqual(doc.getText(secondRange), "二番目の文。");
    });
  });

  suite("Emacs compatibility tests", () => {
    test("forward-sentence behavior", async () => {
      const doc = new MockTextDocument("First sentence. Second sentence.");
      const { sentenceBounds } = await import("./extension");

      const end1 = await sentenceBounds.getNextEnd(
        { document: doc } as any,
        pos(0, 0)
      );
      assert.ok(end1);
      assert.strictEqual(end1.character, 16);

      const end2 = await sentenceBounds.getNextEnd(
        { document: doc } as any,
        end1
      );
      assert.ok(end2);
      assert.strictEqual(end2.character, 32);
    });

    test("backward-sentence behavior", async () => {
      const doc = new MockTextDocument("First sentence. Second sentence.");
      const { sentenceBounds } = await import("./extension");

      const begin = await sentenceBounds.getPreviousBeginning(
        { document: doc } as any,
        pos(0, 32)
      );
      assert.ok(begin);
      assert.strictEqual(begin.character, 16);
    });
  });
});
