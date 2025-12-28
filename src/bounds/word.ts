import * as vscode from "vscode";
import { ThingBoundsBase, nextPosition, previousPosition } from "./base";
import { preserveSelection } from "../extension";

export function nextWordEnd(document: vscode.TextDocument, position: vscode.Position): vscode.Position | null {
  let pos = position;

  while (true) {
    const next = nextPosition(document, pos);
    if (next === null) return null;
    pos = next;

    const range = document.getWordRangeAtPosition(pos);
    if (range !== undefined) return range.end;
  }
}

export function previousWordStart(document: vscode.TextDocument, position: vscode.Position): vscode.Position | null {
  let pos = position;

  while (true) {
    const prev = previousPosition(document, pos);
    if (prev === null) return null;
    pos = prev;

    const range = document.getWordRangeAtPosition(pos);
    if (range !== undefined) return range.start;
  }
}

export class WordBounds extends ThingBoundsBase {
  constructor() {
    super("word");
  }

  async getNextEnd(editor: vscode.TextEditor, position: vscode.Position): Promise<vscode.Position | null> {
    return nextWordEnd(editor.document, position);
  }

  async getPreviousStart(editor: vscode.TextEditor, position: vscode.Position): Promise<vscode.Position | null> {
    return previousWordStart(editor.document, position);
  }
}

export class SubwordBounds extends ThingBoundsBase {
  constructor() {
    super("subword");
  }

  async getNextEnd(editor: vscode.TextEditor, position: vscode.Position): Promise<vscode.Position | null> {
    const { document } = editor;
    const wordEnd = nextWordEnd(document, position);
    const wordRange = wordEnd && document.getWordRangeAtPosition(wordEnd);
    if (!wordRange) return null;

    return preserveSelection(editor, async () => {
      const startPos = position.isAfter(wordRange.start) ? position : wordRange.start;
      editor.selection = new vscode.Selection(startPos, startPos);
      await vscode.commands.executeCommand("cursorWordPartRight");
      return editor.selection.active;
    });
  }

  async getPreviousStart(editor: vscode.TextEditor, position: vscode.Position): Promise<vscode.Position | null> {
    const { document } = editor;
    const wordStart = previousWordStart(document, position);
    const wordRange = wordStart && document.getWordRangeAtPosition(wordStart);
    if (!wordRange) return null;

    return preserveSelection(editor, async () => {
      const startPos = position.isBefore(wordRange.end) ? position : wordRange.end;
      editor.selection = new vscode.Selection(startPos, startPos);
      await vscode.commands.executeCommand("cursorWordPartLeft");
      return editor.selection.active;
    });
  }
}
