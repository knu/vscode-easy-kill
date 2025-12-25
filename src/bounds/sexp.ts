import * as vscode from "vscode";
import { ThingBoundsBase } from "./base";
import { findEnclosingPair } from "./pair";

export class SexpBounds extends ThingBoundsBase {
  constructor() {
    super("sexp");
  }

  async getRangeAtPosition(editor: vscode.TextEditor, position: vscode.Position): Promise<vscode.Range | null> {
    const { document } = editor;
    const uri = document.uri;

    try {
      const selectionRanges = await vscode.commands.executeCommand<vscode.SelectionRange[]>(
        "vscode.executeSelectionRangeProvider",
        uri,
        [position]
      );

      if (selectionRanges && selectionRanges.length > 0) {
        let currentRange: vscode.SelectionRange | undefined = selectionRanges[0];
        const wordRange = document.getWordRangeAtPosition(position);

        while (currentRange) {
          if (!wordRange || !currentRange.range.isEqual(wordRange)) {
            if (currentRange.range.contains(position) && !currentRange.range.isEmpty) {
              return currentRange.range;
            }
          }
          currentRange = currentRange.parent;
        }
      }
    } catch {}

    return findEnclosingPair(document, position, ["(", "[", "{"], [")", "]", "}"]);
  }

  async getNextEnd(editor: vscode.TextEditor, position: vscode.Position): Promise<vscode.Position | null> {
    const { document } = editor;
    const currentRange = await this.getRangeAtPosition(editor, position);
    if (!currentRange) return null;

    const searchPos = currentRange.end;
    if (
      searchPos.line >= document.lineCount - 1 &&
      searchPos.character >= document.lineAt(searchPos.line).range.end.character
    ) {
      return null;
    }

    const nextRange = await this.getRangeAtPosition(editor, searchPos);
    return nextRange?.end ?? null;
  }

  async getPreviousStart(editor: vscode.TextEditor, position: vscode.Position): Promise<vscode.Position | null> {
    const range = await this.getRangeAtPosition(editor, new vscode.Position(Math.max(0, position.line - 1), 0));
    if (range?.start.isBefore(position)) {
      return range.start;
    }
    return null;
  }
}
