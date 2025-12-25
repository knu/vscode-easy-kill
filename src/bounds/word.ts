import * as vscode from "vscode";
import { ThingBoundsBase } from "./base";
import { preserveSelection } from "../extension";

export function nextWordEnd(document: vscode.TextDocument, position: vscode.Position): vscode.Position | null {
  let pos = position;

  while (true) {
    if (
      pos.line >= document.lineCount ||
      (pos.line === document.lineCount - 1 && pos.character >= document.lineAt(pos.line).text.length)
    ) {
      return null;
    }

    const range = document.getWordRangeAtPosition(pos);
    if (range?.end.isAfter(position)) {
      return range.end;
    }

    pos =
      pos.character < document.lineAt(pos.line).text.length
        ? pos.translate(0, 1)
        : new vscode.Position(pos.line + 1, 0);
  }
}

export function previousWordStart(document: vscode.TextDocument, position: vscode.Position): vscode.Position | null {
  let pos = position;

  while (true) {
    if (pos.line === 0 && pos.character === 0) {
      return null;
    }

    pos =
      pos.character > 0
        ? pos.translate(0, -1)
        : new vscode.Position(pos.line - 1, document.lineAt(pos.line - 1).text.length);

    const range = document.getWordRangeAtPosition(pos);
    if (range?.start.isBefore(position)) {
      return range.start;
    }
  }
}

export function forwardWordRange(document: vscode.TextDocument, position: vscode.Position): vscode.Range | null {
  const wordEnd = nextWordEnd(document, position);
  return (wordEnd && document.getWordRangeAtPosition(wordEnd.translate(0, -1))) ?? null;
}

export function backwardWordRange(document: vscode.TextDocument, position: vscode.Position): vscode.Range | null {
  const wordStart = previousWordStart(document, position);
  return (wordStart && document.getWordRangeAtPosition(wordStart)) ?? null;
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
    const wordRange = forwardWordRange(document, position);
    if (!wordRange) return null;

    return preserveSelection(editor, async () => {
      const startPos = wordRange.start.isBeforeOrEqual(position) ? position : wordRange.start;
      editor.selection = new vscode.Selection(startPos, startPos);
      await vscode.commands.executeCommand("cursorWordPartRight");
      return editor.selection.active;
    });
  }

  async getPreviousStart(editor: vscode.TextEditor, position: vscode.Position): Promise<vscode.Position | null> {
    const { document } = editor;
    const wordRange = backwardWordRange(document, position);
    if (!wordRange) return null;

    return preserveSelection(editor, async () => {
      const startPos = position.isBeforeOrEqual(wordRange.end) ? position : wordRange.end;
      editor.selection = new vscode.Selection(startPos, startPos);
      await vscode.commands.executeCommand("cursorWordPartLeft");
      return editor.selection.active;
    });
  }
}
