import * as vscode from "vscode";
import { ThingBoundsBase } from "./base";

export class ParagraphBounds extends ThingBoundsBase {
  constructor() {
    super("paragraph");
  }

  async getRangeAtPosition(editor: vscode.TextEditor, position: vscode.Position): Promise<vscode.Range | null> {
    const { document } = editor;

    if (document.lineAt(position.line).text.trim() === "") {
      return null;
    }

    const nextEnd = await this.getNextEnd(editor, position);
    if (!nextEnd) {
      return null;
    }

    const prevBeginning = await this.getPreviousStart(editor, nextEnd);
    if (!prevBeginning) {
      return null;
    }

    const range = new vscode.Range(prevBeginning, nextEnd);
    if (range.contains(position) || range.start.isEqual(position)) {
      return range;
    }

    return null;
  }

  async getNextEnd(editor: vscode.TextEditor, position: vscode.Position): Promise<vscode.Position | null> {
    const { document } = editor;
    let searchLine = position.line + 1;

    while (searchLine < document.lineCount && document.lineAt(searchLine).text.trim() === "") {
      searchLine++;
    }

    if (searchLine >= document.lineCount) return null;

    const range = await this.getRangeAtPosition(editor, new vscode.Position(searchLine, 0));
    return range?.end ?? null;
  }

  async getPreviousStart(editor: vscode.TextEditor, position: vscode.Position): Promise<vscode.Position | null> {
    const range = await this.getRangeAtPosition(editor, new vscode.Position(Math.max(0, position.line - 1), 0));
    return range?.start.isBefore(position) ? range.start : null;
  }
}
