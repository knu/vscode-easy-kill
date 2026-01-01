import * as vscode from "vscode";
import { ThingBoundsBase } from "./base";
import { Selection } from "../types";

function getLineIndentPosition(line: vscode.TextLine): vscode.Position {
  const text = line.text;
  const trimmedStart = text.trimStart();
  const firstNonWhitespace = trimmedStart.length === 0 && text.length > 0 ? -1 : text.length - trimmedStart.length;
  return firstNonWhitespace >= 0 ? new vscode.Position(line.lineNumber, firstNonWhitespace) : line.range.start;
}

function getLineLastNonWhitespacePosition(line: vscode.TextLine): vscode.Position {
  const text = line.text;
  let lastNonWhitespacePos = text.trimEnd().length;
  if (lastNonWhitespacePos === 0 && text.length > 0) {
    lastNonWhitespacePos = line.range.end.character;
  }
  return new vscode.Position(line.lineNumber, lastNonWhitespacePos);
}

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
    const position = currentSelection.initialPosition;
    const line = document.lineAt(position.line);
    const indentPos = getLineIndentPosition(line);

    if (delta === undefined) {
      // Initial selection: start from indent position if cursor is after it
      if (position.character <= indentPos.character) {
        const range = new vscode.Range(line.range.start, position);
        return { type: this.type, range, initialPosition: position, text: document.getText(range) };
      }

      // Check if we should expand from indent to line start
      const currentSel = this.getCurrentSelection();
      if (currentSel && currentSel.type === "backward-line-edge") {
        if (currentSel.range.start.isEqual(indentPos) && !indentPos.isEqual(line.range.start)) {
          const range = new vscode.Range(line.range.start, position);
          return {
            type: this.type,
            range,
            initialPosition: currentSelection.initialPosition,
            text: document.getText(range),
          };
        }
      }

      const range = new vscode.Range(indentPos, position);
      return { type: this.type, range, initialPosition: position, text: document.getText(range) };
    }

    // Handle delta: shrink/expand
    if (delta > 0) {
      // Expand: if at indent, go to line start
      if (currentSelection.range.start.isEqual(indentPos)) {
        const range = new vscode.Range(line.range.start, position);
        return {
          type: this.type,
          range,
          initialPosition: currentSelection.initialPosition,
          text: document.getText(range),
        };
      }
    } else if (delta < 0) {
      // Shrink: if at line start, go to indent
      if (currentSelection.range.start.isEqual(line.range.start)) {
        const range = new vscode.Range(indentPos, position);
        return {
          type: this.type,
          range,
          initialPosition: currentSelection.initialPosition,
          text: document.getText(range),
        };
      }
    }

    return currentSelection;
  }
}

export function createBackwardLineEdgeBounds(getCurrentSelection: () => Selection | null) {
  return new BackwardLineEdgeBounds(getCurrentSelection);
}

class ForwardLineEdgeBounds extends ThingBoundsBase {
  constructor(private getCurrentSelection: () => Selection | null) {
    super("forward-line-edge");
  }

  async getRangeAtPosition(editor: vscode.TextEditor, position: vscode.Position): Promise<vscode.Range | null> {
    const line = editor.document.lineAt(position.line);
    const lastNonWhitespaceEnd = getLineLastNonWhitespacePosition(line);
    const endPos = position.character >= lastNonWhitespaceEnd.character ? line.range.end : lastNonWhitespaceEnd;
    return new vscode.Range(position, endPos);
  }

  async getNewSelection(
    editor: vscode.TextEditor,
    currentSelection: Selection,
    delta?: number
  ): Promise<Selection | null> {
    const { document } = editor;
    const position = currentSelection.initialPosition;
    const line = document.lineAt(position.line);
    const lastNonWhitespaceEnd = getLineLastNonWhitespacePosition(line);

    if (delta === undefined) {
      // Initial selection: stop at last non-whitespace if cursor is before it
      if (position.character >= lastNonWhitespaceEnd.character) {
        const range = new vscode.Range(position, line.range.end);
        return { type: this.type, range, initialPosition: position, text: document.getText(range) };
      }

      // Check if we should expand from last non-whitespace to line end
      const currentSel = this.getCurrentSelection();
      if (currentSel && currentSel.type === "forward-line-edge") {
        if (currentSel.range.end.isEqual(lastNonWhitespaceEnd) && !lastNonWhitespaceEnd.isEqual(line.range.end)) {
          const range = new vscode.Range(position, line.range.end);
          return {
            type: this.type,
            range,
            initialPosition: currentSelection.initialPosition,
            text: document.getText(range),
          };
        }
      }

      const range = new vscode.Range(position, lastNonWhitespaceEnd);
      return { type: this.type, range, initialPosition: position, text: document.getText(range) };
    }

    // Handle delta: shrink/expand
    if (delta > 0) {
      // Expand: if at last non-whitespace, go to line end
      if (currentSelection.range.end.isEqual(lastNonWhitespaceEnd)) {
        const range = new vscode.Range(position, line.range.end);
        return {
          type: this.type,
          range,
          initialPosition: currentSelection.initialPosition,
          text: document.getText(range),
        };
      }
    } else if (delta < 0) {
      // Shrink: if at line end, go to last non-whitespace
      if (currentSelection.range.end.isEqual(line.range.end)) {
        const range = new vscode.Range(position, lastNonWhitespaceEnd);
        return {
          type: this.type,
          range,
          initialPosition: currentSelection.initialPosition,
          text: document.getText(range),
        };
      }
    }

    return currentSelection;
  }
}

export function createForwardLineEdgeBounds(getCurrentSelection: () => Selection | null) {
  return new ForwardLineEdgeBounds(getCurrentSelection);
}
