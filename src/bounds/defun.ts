import * as vscode from "vscode";
import { ThingBoundsBase } from "./base";

export class DefunBounds extends ThingBoundsBase {
  constructor() {
    super("defun");
  }

  async getRangeAtPosition(editor: vscode.TextEditor, position: vscode.Position): Promise<vscode.Range | null> {
    const { document } = editor;
    const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
      "vscode.executeDocumentSymbolProvider",
      document.uri
    );
    if (!symbols) return null;

    const findEnclosingFunction = (syms: vscode.DocumentSymbol[]): vscode.DocumentSymbol | null => {
      for (const sym of syms) {
        if ([vscode.SymbolKind.Function, vscode.SymbolKind.Method, vscode.SymbolKind.Class].includes(sym.kind)) {
          if (sym.range.contains(position)) {
            const child = findEnclosingFunction(sym.children);
            return child || sym;
          }
        }
        const child = findEnclosingFunction(sym.children);
        if (child) return child;
      }
      return null;
    };

    const sym = findEnclosingFunction(symbols);
    return sym?.range ?? null;
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
