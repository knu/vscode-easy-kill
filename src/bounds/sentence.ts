import * as vscode from "vscode";
import { ThingBoundsBase } from "./base";

export class SentenceBounds extends ThingBoundsBase {
  constructor() {
    super("sentence");
  }

  async getNextEnd(editor: vscode.TextEditor, position: vscode.Position): Promise<vscode.Position | null> {
    const { document } = editor;
    const text = document.getText();
    const offset = document.offsetAt(position);

    const sentenceEnd = /[.?!…‽][)\]"'"'"}»›]*[ \t\n]*|[。．？！]+[ \t\n]*/g;
    sentenceEnd.lastIndex = offset;

    const match = sentenceEnd.exec(text);
    if (!match) return null;

    return document.positionAt(match.index + match[0].length);
  }

  async getPreviousStart(editor: vscode.TextEditor, position: vscode.Position): Promise<vscode.Position | null> {
    const { document } = editor;
    const text = document.getText();
    const offset = document.offsetAt(position);

    const sentenceEnd = /[.?!…‽][)\]"'"'"}»›]*[ \t\n]*|[。．？！]+[ \t\n]*/g;

    let lastEnd = 0;
    let match;
    sentenceEnd.lastIndex = 0;

    while ((match = sentenceEnd.exec(text)) !== null) {
      const matchEnd = match.index + match[0].length;

      if (matchEnd >= offset) {
        break;
      }
      lastEnd = matchEnd;
    }

    return document.positionAt(lastEnd);
  }

  async getRangeAtPosition(editor: vscode.TextEditor, position: vscode.Position): Promise<vscode.Range | null> {
    const { document } = editor;
    const text = document.getText();
    const offset = document.offsetAt(position);

    const sentenceEnd = /[.?!…‽][)\]"'"'"}»›]*|[。．？！]+/g;
    sentenceEnd.lastIndex = offset;

    const match = sentenceEnd.exec(text);
    if (!match) return null;

    const endPos = match.index + match[0].length;

    sentenceEnd.lastIndex = 0;
    let lastEnd = 0;
    let m;

    while ((m = sentenceEnd.exec(text)) !== null) {
      const mEnd = m.index + m[0].length;
      if (mEnd >= endPos) {
        break;
      }
      let nextPos = mEnd;
      while (nextPos < text.length && /[ \t\n]/.test(text[nextPos])) {
        nextPos++;
      }
      lastEnd = nextPos;
    }

    const range = new vscode.Range(document.positionAt(lastEnd), document.positionAt(endPos));
    if (range.contains(position) || range.start.isEqual(position)) {
      return range;
    }

    return null;
  }
}
