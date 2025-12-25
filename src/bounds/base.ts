import * as vscode from "vscode";
import { ThingType, ThingBounds, Selection } from "../types";

export abstract class ThingBoundsBase implements ThingBounds {
  readonly type: ThingType;

  constructor(type: ThingType) {
    this.type = type;
  }

  async getNextEnd(
    editor: vscode.TextEditor,
    position: vscode.Position,
    arg?: string
  ): Promise<vscode.Position | null> {
    return null;
  }

  async getPreviousStart(
    editor: vscode.TextEditor,
    position: vscode.Position,
    arg?: string
  ): Promise<vscode.Position | null> {
    return null;
  }

  async getRangeAtPosition(
    editor: vscode.TextEditor,
    position: vscode.Position,
    arg?: string
  ): Promise<vscode.Range | null> {
    const forwardEnd = await this.getNextEnd(editor, position);
    if (!forwardEnd) return null;

    const backwardStart = await this.getPreviousStart(editor, forwardEnd);
    if (!backwardStart) return null;

    return backwardStart.isBeforeOrEqual(position) ? new vscode.Range(backwardStart, forwardEnd) : null;
  }

  async getNewSelection(
    editor: vscode.TextEditor,
    currentSelection: Selection,
    delta?: number
  ): Promise<Selection | null> {
    const { document } = editor;
    const { initialRange, count, arg } = currentSelection;

    if (count === 0 || (count === 1 && delta === undefined)) {
      const position = initialRange.start;
      const range = await this.getRangeAtPosition(editor, position, arg);
      if (!range) return null;
      const text = document.getText(range);
      return { type: this.type, range, initialRange: range, text, count: 1, arg };
    }

    const newCount = delta !== undefined ? count + delta : count;
    let newRange: vscode.Range | null = null;

    if (newCount === 1) {
      const range = await this.getRangeAtPosition(editor, initialRange.start, arg);
      if (!range) return null;
      const text = document.getText(range);
      return { type: this.type, range, initialRange: range, text, count: 1, arg };
    }

    if (newCount > 0) {
      let endPos = initialRange.end;
      for (let i = 1; i < newCount; i++) {
        const nextEnd = await this.getNextEnd(editor, endPos, arg);
        if (nextEnd) {
          endPos = nextEnd;
        } else {
          break;
        }
      }
      newRange = new vscode.Range(initialRange.start, endPos);
    } else {
      let startPos = initialRange.start;
      for (let i = 0; i < 1 - newCount; i++) {
        const prevBegin = await this.getPreviousStart(editor, startPos, arg);
        if (prevBegin) {
          startPos = prevBegin;
        } else {
          break;
        }
      }
      newRange = new vscode.Range(startPos, initialRange.end);
    }

    if (!newRange) return null;
    const text = document.getText(newRange);
    return { type: this.type, range: newRange, initialRange, text, count: newCount, arg };
  }
}
