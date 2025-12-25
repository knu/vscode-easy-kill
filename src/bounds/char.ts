import * as vscode from "vscode";
import { ThingBounds, ThingType, Selection } from "../types";
import { withAwaitingArgument } from "../extension";
import { debug } from "../debug";

type CharSearchType =
  | "string-to-char-forward"
  | "string-up-to-char-forward"
  | "string-to-char-backward"
  | "string-up-to-char-backward";

function getCharSearchType(forward: boolean, inclusive: boolean): CharSearchType {
  return forward
    ? inclusive
      ? "string-to-char-forward"
      : "string-up-to-char-forward"
    : inclusive
      ? "string-to-char-backward"
      : "string-up-to-char-backward";
}

function findCharInText(
  text: string,
  char: string,
  startOffset: number,
  forward: boolean,
  inclusive: boolean
): { start: number; end: number } | null {
  const targetOffset = forward ? text.indexOf(char, startOffset + 1) : text.lastIndexOf(char, startOffset - 1);

  if (targetOffset === -1) return null;

  if (forward) {
    return { start: startOffset, end: inclusive ? targetOffset + 1 : targetOffset };
  } else {
    return { start: inclusive ? targetOffset : targetOffset + 1, end: startOffset };
  }
}

const charSearchBoundsTable: Partial<Record<CharSearchType, ThingBounds>> = {};

function isCharSearchType(type: ThingType): type is CharSearchType {
  return type in charSearchBoundsTable;
}

function createCharSearchBounds(forward: boolean, inclusive: boolean): ThingBounds {
  let lastChar: string | null = null;

  const type = getCharSearchType(forward, inclusive);

  async function getRangeAtPosition(editor: vscode.TextEditor, position: vscode.Position, arg?: string) {
    const char = arg ?? lastChar;
    if (!char) return null;

    const { document } = editor;
    const text = document.getText();
    const offset = document.offsetAt(position);

    const result = findCharInText(text, char, offset, forward, inclusive);
    if (!result) return null;

    return new vscode.Range(document.positionAt(result.start), document.positionAt(result.end));
  }

  const bounds: ThingBounds = {
    type,
    async getNextEnd(editor: vscode.TextEditor, position: vscode.Position, arg?: string) {
      const char = arg ?? lastChar;
      if (!char) return null;

      const { document } = editor;
      const text = document.getText();
      const offset = document.offsetAt(position);

      if (forward) {
        const result = findCharInText(text, char, offset, true, inclusive);
        if (!result) return null;
        return document.positionAt(result.end);
      } else {
        const result = findCharInText(text, char, offset, false, inclusive);
        if (!result) return null;
        return document.positionAt(result.start);
      }
    },
    async getPreviousStart(editor: vscode.TextEditor, position: vscode.Position, arg?: string) {
      const char = arg ?? lastChar;
      if (!char) return null;

      const { document } = editor;
      const text = document.getText();
      const offset = document.offsetAt(position);

      if (forward) {
        const result = findCharInText(text, char, offset, false, inclusive);
        if (!result) return null;
        return document.positionAt(result.start);
      } else {
        const result = findCharInText(text, char, offset, true, inclusive);
        if (!result) return null;
        return document.positionAt(result.end);
      }
    },
    async getNewSelection(
      editor: vscode.TextEditor,
      currentSelection: Selection,
      delta?: number
    ): Promise<Selection | null> {
      const { document } = editor;
      const { initialRange, count, arg } = currentSelection;

      if (count === 0 || (delta === undefined && !isCharSearchType(currentSelection.type))) {
        let searchChar: string | undefined;
        if (!isCharSearchType(currentSelection.type)) {
          if (bounds.readArgument) {
            searchChar = (await bounds.readArgument(editor, initialRange.start)) ?? undefined;
          }
        } else {
          searchChar = arg;
          if (!searchChar && bounds.readArgument) {
            searchChar = (await bounds.readArgument(editor, initialRange.start)) ?? undefined;
          }
        }
        if (!searchChar) return null;

        const position = initialRange.start;
        const range = await getRangeAtPosition(editor, position, searchChar);
        if (!range) return null;
        const text = document.getText(range);
        const cursorRange = new vscode.Range(position, position);
        return { type, range, initialRange: cursorRange, text, count: 1, arg: searchChar };
      }

      // Char search family: handle direction change
      if (delta === undefined && isCharSearchType(currentSelection.type) && currentSelection.type !== type) {
        const currentIsForward = currentSelection.type.includes("forward");
        const newIsForward = forward;

        if (currentIsForward !== newIsForward) {
          debug("[char search direction change] from:", currentSelection.type, "to:", type, "count:", count);

          const oldBounds = charSearchBoundsTable[currentSelection.type];
          if (!oldBounds) return null;
          const shrunkSelection = await oldBounds.getNewSelection(editor, currentSelection, -1);

          if (shrunkSelection) {
            const newInitialRange = new vscode.Range(initialRange.start, initialRange.start);
            return {
              ...shrunkSelection,
              type,
              initialRange: newInitialRange,
              count: 0,
            };
          }
          return null;
        } else {
          debug("[char search same direction] type:", type, "count:", count);
        }
      }

      let newCount = count + (delta ?? 0);

      if (newCount <= 0) {
        newCount = 1 - newCount;
        debug("[count flip] oldCount:", count, "delta:", delta, "newCount after flip:", newCount);
        const flippedType = getCharSearchType(!forward, inclusive);
        const flippedBounds = charSearchBoundsTable[flippedType];
        if (!flippedBounds) return null;
        return await flippedBounds.getNewSelection(editor, { ...currentSelection, count: newCount }, 0);
      }

      const char = arg ?? "";
      const text = document.getText();

      if (newCount === 1) {
        const range = await getRangeAtPosition(editor, initialRange.start, arg);
        if (!range) return null;
        const rangeText = document.getText(range);
        return { type, range, initialRange, text: rangeText, count: 1, arg };
      }

      const cursorOffset = document.offsetAt(initialRange.start);
      let newRange: vscode.Range | null = null;

      if (forward) {
        let currentOffset = cursorOffset;
        for (let i = 0; i < newCount; i++) {
          const targetOffset = text.indexOf(char, currentOffset + 1);
          if (targetOffset === -1) break;
          currentOffset = inclusive ? targetOffset + 1 : targetOffset;
        }
        newRange = new vscode.Range(initialRange.start, document.positionAt(currentOffset));
      } else {
        let currentOffset = cursorOffset;
        for (let i = 0; i < newCount; i++) {
          const searchFrom = i === 0 ? currentOffset - 1 : currentOffset - 2;
          const targetOffset = text.lastIndexOf(char, searchFrom);
          if (targetOffset === -1) break;
          currentOffset = inclusive ? targetOffset : targetOffset + 1;
        }
        newRange = new vscode.Range(document.positionAt(currentOffset), initialRange.start);
      }

      if (!newRange) return null;
      const rangeText = document.getText(newRange);
      return { type, range: newRange, initialRange, text: rangeText, count: newCount, arg };
    },
    async readArgument(editor: vscode.TextEditor, position: vscode.Position) {
      const char = await withAwaitingArgument<string>(type, () => {
        vscode.window.setStatusBarMessage(`$(search) ${forward ? "Find" : "Reverse find"} character...`, 5000);
      });

      if (char) {
        lastChar = char;
      }

      return char;
    },
  };

  return bounds;
}

export const charSearchBoundsArray = [
  [true, true],
  [true, false],
  [false, true],
  [false, false],
].map(([forward, inclusive]) => {
  const bounds = createCharSearchBounds(forward, inclusive);
  charSearchBoundsTable[bounds.type as CharSearchType] = bounds;
  return bounds;
});
