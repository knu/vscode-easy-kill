import * as vscode from "vscode";
import { ThingBoundsBase } from "./base";
import { Selection } from "../types";

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
    const range = new vscode.Range(new vscode.Position(0, 0), position);
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
}

export const bufferBounds = new BufferBounds();
export const bufferBeforeBounds = new BufferBeforeBounds();
export const bufferAfterBounds = new BufferAfterBounds();
