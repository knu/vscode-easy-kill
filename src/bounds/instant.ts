import * as vscode from "vscode";
import { ThingBounds } from "../types";

export const bufferFileNameBounds: ThingBounds = {
  type: "buffer-file-name",
  async getNewSelection(editor: vscode.TextEditor, currentSelection, delta?) {
    return null;
  },
  async getNextEnd(editor: vscode.TextEditor, position: vscode.Position, arg?: string) {
    return null;
  },
  async getPreviousStart(editor: vscode.TextEditor, position: vscode.Position, arg?: string) {
    return null;
  },
  async getNextStart(editor: vscode.TextEditor, position: vscode.Position, arg?: string) {
    return null;
  },
  async getPreviousEnd(editor: vscode.TextEditor, position: vscode.Position, arg?: string) {
    return null;
  },
  async instantCopy(editor: vscode.TextEditor, position: vscode.Position) {
    return editor.document.uri.fsPath || null;
  },
};

export const defunNameBounds: ThingBounds = {
  type: "defun-name",
  async getNewSelection(editor: vscode.TextEditor, currentSelection, delta?) {
    return null;
  },
  async getNextEnd(editor: vscode.TextEditor, position: vscode.Position, arg?: string) {
    return null;
  },
  async getPreviousStart(editor: vscode.TextEditor, position: vscode.Position, arg?: string) {
    return null;
  },
  async getNextStart(editor: vscode.TextEditor, position: vscode.Position, arg?: string) {
    return null;
  },
  async getPreviousEnd(editor: vscode.TextEditor, position: vscode.Position, arg?: string) {
    return null;
  },
  async instantCopy(editor: vscode.TextEditor, position: vscode.Position) {
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
    return sym?.name ?? null;
  },
};
