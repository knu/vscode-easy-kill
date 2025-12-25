import * as vscode from "vscode";
import { ThingBoundsBase } from "./base";
import { Selection } from "../types";

export class LineBounds extends ThingBoundsBase {
  constructor() {
    super("line");
  }

  async getRangeAtPosition(editor: vscode.TextEditor, position: vscode.Position): Promise<vscode.Range | null> {
    const { range, rangeIncludingLineBreak } = editor.document.lineAt(position.line);
    return new vscode.Range(range.start, rangeIncludingLineBreak.end);
  }

  async getNextEnd(editor: vscode.TextEditor, position: vscode.Position): Promise<vscode.Position | null> {
    const { document } = editor;
    const line = document.lineAt(position.line);

    if (position.isAfter(line.range.end) || position.isEqual(line.rangeIncludingLineBreak.end)) {
      if (position.line >= document.lineCount - 1) return null;
      return document.lineAt(position.line + 1).rangeIncludingLineBreak.end;
    }

    return line.rangeIncludingLineBreak.end;
  }

  async getPreviousStart(editor: vscode.TextEditor, position: vscode.Position): Promise<vscode.Position | null> {
    const { document } = editor;
    if (position.line <= 0) return null;
    return document.lineAt(position.line - 1).range.start;
  }
}

class BackwardLineEdgeBounds extends ThingBoundsBase {
  constructor(private getCurrentSelection: () => Selection | null) {
    super("backward-line-edge");
  }

  async getNewSelection(
    editor: vscode.TextEditor,
    currentSelection: Selection,
    delta?: number
  ): Promise<Selection | null> {
    const { document } = editor;
    const position = currentSelection.initialRange?.end || editor.selection.active;
    const line = document.lineAt(position.line);
    const text = line.text;
    const firstNonWhitespace = text.search(/\S/);
    const indentPos =
      firstNonWhitespace >= 0 ? new vscode.Position(position.line, firstNonWhitespace) : line.range.start;

    if (currentSelection.count === 0 || delta === undefined) {
      if (position.character <= indentPos.character) {
        const range = new vscode.Range(line.range.start, position);
        const initialRange = new vscode.Range(position, position);
        return { type: this.type, range, initialRange, text: document.getText(range), count: 1 };
      }

      const currentSel = this.getCurrentSelection();
      if (currentSel && currentSel.type === "backward-line-edge") {
        if (currentSel.range.start.isEqual(indentPos) && !indentPos.isEqual(line.range.start)) {
          const range = new vscode.Range(line.range.start, position);
          return {
            type: this.type,
            range,
            initialRange: currentSelection.initialRange,
            text: document.getText(range),
            count: 2,
          };
        }
      }

      const range = new vscode.Range(indentPos, position);
      const initialRange = new vscode.Range(position, position);
      return { type: this.type, range, initialRange, text: document.getText(range), count: 1 };
    }

    const newCount = delta !== undefined ? currentSelection.count + delta : currentSelection.count;
    if (newCount === 1) {
      const range = new vscode.Range(indentPos, position);
      return {
        type: this.type,
        range,
        initialRange: currentSelection.initialRange,
        text: document.getText(range),
        count: 1,
      };
    } else if (newCount === 2) {
      const range = new vscode.Range(line.range.start, position);
      return {
        type: this.type,
        range,
        initialRange: currentSelection.initialRange,
        text: document.getText(range),
        count: 2,
      };
    } else if (newCount <= 0) {
      return null;
    }

    return null;
  }
}

export function createBackwardLineEdgeBounds(getCurrentSelection: () => Selection | null) {
  return new BackwardLineEdgeBounds(getCurrentSelection);
}

class ForwardLineEdgeBounds extends ThingBoundsBase {
  constructor() {
    super("forward-line-edge");
  }

  async getRangeAtPosition(editor: vscode.TextEditor, position: vscode.Position): Promise<vscode.Range | null> {
    const line = editor.document.lineAt(position.line);
    return new vscode.Range(position, line.range.end);
  }
}

export const forwardLineEdgeBounds = new ForwardLineEdgeBounds();
