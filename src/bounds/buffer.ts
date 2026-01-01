import * as vscode from "vscode";
import { ThingBoundsBase } from "./base";
import { Selection } from "../types";

function lineStart(line: number): vscode.Position {
  return new vscode.Position(line, 0);
}

function nextLineStartOrEnd(document: vscode.TextDocument, line: number): vscode.Position {
  if (line + 1 < document.lineCount) {
    return lineStart(line + 1);
  }

  return document.lineAt(document.lineCount - 1).range.end;
}

class BufferBounds extends ThingBoundsBase {
  constructor() {
    super("buffer");
  }

  async getRangeAtPosition(editor: vscode.TextEditor, position: vscode.Position): Promise<vscode.Range | null> {
    const { document } = editor;
    const lastLine = document.lineAt(document.lineCount - 1);
    return new vscode.Range(new vscode.Position(0, 0), lastLine.range.end);
  }
}

class BufferBeforeBounds extends ThingBoundsBase {
  constructor() {
    super("buffer-before");
  }

  async getNewSelection(
    editor: vscode.TextEditor,
    currentSelection: Selection,
    delta?: number
  ): Promise<Selection | null> {
    const { document } = editor;
    const position = currentSelection.initialPosition;
    if (delta === 0) return currentSelection;

    const end =
      delta === undefined
        ? position
        : delta > 0
          ? nextLineStartOrEnd(document, position.line)
          : lineStart(position.line);
    const range = new vscode.Range(new vscode.Position(0, 0), end);
    const text = document.getText(range);
    return { type: this.type, range, initialPosition: position, text };
  }
}

class BufferAfterBounds extends ThingBoundsBase {
  constructor() {
    super("buffer-after");
  }

  async getRangeAtPosition(editor: vscode.TextEditor, position: vscode.Position): Promise<vscode.Range | null> {
    const { document } = editor;
    const lastLine = document.lineAt(document.lineCount - 1);
    return new vscode.Range(position, lastLine.range.end);
  }

  async getNewSelection(
    editor: vscode.TextEditor,
    currentSelection: Selection,
    delta?: number
  ): Promise<Selection | null> {
    const { document } = editor;
    const position = currentSelection.initialPosition;
    if (delta === 0) return currentSelection;

    const start =
      delta === undefined
        ? position
        : delta > 0
          ? lineStart(position.line)
          : nextLineStartOrEnd(document, position.line);
    const lastLine = document.lineAt(document.lineCount - 1);
    const range = new vscode.Range(start, lastLine.range.end);
    const text = document.getText(range);
    return { type: this.type, range, initialPosition: position, text };
  }
}

export const bufferBounds = new BufferBounds();
export const bufferBeforeBounds = new BufferBeforeBounds();
export const bufferAfterBounds = new BufferAfterBounds();
