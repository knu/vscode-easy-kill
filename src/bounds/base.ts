import * as vscode from "vscode";
import { ThingType, ThingBounds, Selection } from "../types";

export function nextPosition(
  document: vscode.TextDocument,
  position: vscode.Position
): vscode.Position | null {
  const line = document.lineAt(position.line);

  if (position.character < line.range.end.character) {
    return position.translate(0, 1);
  }
  if (position.line < document.lineCount - 1) {
    return new vscode.Position(position.line + 1, 0);
  }
  return null;
}

export function previousPosition(
  document: vscode.TextDocument,
  position: vscode.Position
): vscode.Position | null {
  if (position.character > 0) {
    return position.translate(0, -1);
  }
  if (position.line > 0) {
    const prevLine = document.lineAt(position.line - 1);
    return prevLine.range.end;
  }
  return null;
}

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

  async getNextStart(
    editor: vscode.TextEditor,
    position: vscode.Position,
    arg?: string
  ): Promise<vscode.Position | null> {
    const currentRange = await this.getRangeAtPosition(editor, position, arg);
    const basePos = currentRange?.start.isBeforeOrEqual(position) ? currentRange.end : position;

    const nextEnd = await this.getNextEnd(editor, basePos, arg);
    if (!nextEnd) return null;

    return await this.getPreviousStart(editor, nextEnd, arg);
  }

  async getPreviousEnd(
    editor: vscode.TextEditor,
    position: vscode.Position,
    arg?: string
  ): Promise<vscode.Position | null> {
    const currentRange = await this.getRangeAtPosition(editor, position, arg);
    const basePos = currentRange?.start.isBeforeOrEqual(position) ? currentRange.start : position;

    const prevStart = await this.getPreviousStart(editor, basePos, arg);
    if (!prevStart) return null;

    const prevEnd = await this.getNextEnd(editor, prevStart, arg);
    if (prevEnd?.isBefore(position)) return prevEnd;

    // prevEnd is not before position, search further back
    const furtherPrevStart = await this.getPreviousStart(editor, prevStart, arg);
    if (!furtherPrevStart) return null;

    return await this.getNextEnd(editor, furtherPrevStart, arg);
  }

  async getRangeAtPosition(
    editor: vscode.TextEditor,
    position: vscode.Position,
    arg?: string
  ): Promise<vscode.Range | null> {
    const forwardEnd = await this.getNextEnd(editor, position);

    if (!forwardEnd) {
      // No forward range, check if position is at the end of a range
      const prev = previousPosition(editor.document, position);
      const prevEnd = prev ? await this.getNextEnd(editor, prev) : null;
      if (!prevEnd?.isEqual(position)) return null;
      const prevStart = await this.getPreviousStart(editor, prevEnd);
      return prevStart ? new vscode.Range(prevStart, prevEnd) : null;
    }

    const backwardStart = await this.getPreviousStart(editor, forwardEnd);
    if (!backwardStart) return null;

    const range = new vscode.Range(backwardStart, forwardEnd);

    // If position is inside or at the start of the forward range, return it
    if (position.isAfterOrEqual(range.start)) return range;

    // position < range.start, check if position is at the end of a previous range
    const prev = previousPosition(editor.document, position);
    const prevEnd = prev ? await this.getNextEnd(editor, prev) : null;
    if (!prevEnd?.isEqual(position)) return null;
    const prevStart = await this.getPreviousStart(editor, prevEnd);
    return prevStart ? new vscode.Range(prevStart, prevEnd) : null;
  }

  async getNewSelection(
    editor: vscode.TextEditor,
    currentSelection: Selection,
    delta?: number
  ): Promise<Selection | null> {
    const { document } = editor;
    const { initialPosition, range, arg } = currentSelection;

    const initialRange = await this.getRangeAtPosition(editor, initialPosition, arg);
    if (!initialRange) return null;

    if (delta === undefined) {
      const text = document.getText(initialRange);
      return { type: this.type, range: initialRange, initialPosition, text, arg };
    }

    if (delta === 0) return currentSelection;

    let { start: startPos, end: endPos } = range;

    if (delta > 0) {
      let count = delta;
      while (count > 0 && startPos.isBefore(initialRange.start)) {
        const nextStart = await this.getNextStart(editor, startPos, arg);
        if (!nextStart) break;
        startPos = nextStart;
        count--;
      }
      while (count > 0) {
        const nextEnd = await this.getNextEnd(editor, endPos, arg);
        if (!nextEnd) break;
        endPos = nextEnd;
        count--;
      }
    } else {
      let count = -delta;
      while (count > 0 && endPos.isAfter(initialRange.end)) {
        const previousEnd = await this.getPreviousEnd(editor, endPos, arg);
        if (!previousEnd?.isBefore(endPos)) break;
        endPos = previousEnd;
        count--;
      }
      while (count > 0) {
        const previousStart = await this.getPreviousStart(editor, startPos, arg);
        if (!previousStart) break;
        startPos = previousStart;
        count--;
      }
    }

    const newRange = new vscode.Range(startPos, endPos);
    const text = document.getText(newRange);
    return { type: this.type, range: newRange, initialPosition, text, arg };
  }
}
