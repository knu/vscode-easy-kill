import * as vscode from "vscode";
import { ThingBounds, ThingType, Selection } from "../types";
import { withAwaitingArgument } from "../extension";

type CharSearchType =
  | "string-to-char-forward"
  | "string-up-to-char-forward"
  | "string-to-char-backward"
  | "string-up-to-char-backward";

interface CharSearchProperties {
  forward: boolean;
  inclusive: boolean;
}

// Master table: type → properties
const charSearchPropertiesTable: Record<CharSearchType, CharSearchProperties> = {
  "string-to-char-forward": { forward: true, inclusive: true },
  "string-up-to-char-forward": { forward: true, inclusive: false },
  "string-to-char-backward": { forward: false, inclusive: true },
  "string-up-to-char-backward": { forward: false, inclusive: false },
};

function getCharSearchType(forward: boolean, inclusive: boolean): CharSearchType {
  for (const [type, props] of Object.entries(charSearchPropertiesTable)) {
    if (props.forward === forward && props.inclusive === inclusive) {
      return type as CharSearchType;
    }
  }
  throw new Error(`Invalid char search properties: forward=${forward}, inclusive=${inclusive}`);
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

let lastChar: string | null = null;

function isCharSearchType(type: ThingType): type is CharSearchType {
  return type in charSearchBoundsTable;
}

function createCharSearchBounds(forward: boolean, inclusive: boolean): ThingBounds {
  const type = getCharSearchType(forward, inclusive);

  async function getRangeAtPosition(editor: vscode.TextEditor, position: vscode.Position, arg?: string) {
    const char = arg ?? lastChar;
    if (!char) return null;

    const { document } = editor;
    const result = findCharInText(document.getText(), char, document.offsetAt(position), forward, inclusive);
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
    async getNextStart(editor: vscode.TextEditor, position: vscode.Position, arg?: string) {
      const char = arg ?? lastChar;
      if (!char) return null;

      const { document } = editor;
      const nextCharOffset = document.getText().indexOf(char, document.offsetAt(position) + 1);
      if (nextCharOffset === -1) return null;

      return document.positionAt(forward || inclusive ? nextCharOffset : nextCharOffset + 1);
    },
    async getPreviousEnd(editor: vscode.TextEditor, position: vscode.Position, arg?: string) {
      const char = arg ?? lastChar;
      if (!char) return null;

      const { document } = editor;
      let offset = document.offsetAt(position);

      const currentRange = await getRangeAtPosition(editor, position, arg);
      if (currentRange && position.isAfter(currentRange.start)) offset = document.offsetAt(currentRange.start);

      const prevCharOffset = document.getText().lastIndexOf(char, offset - 1);
      if (prevCharOffset === -1) return null;

      return document.positionAt(forward && inclusive ? prevCharOffset + 1 : prevCharOffset);
    },
    async getNewSelection(
      editor: vscode.TextEditor,
      currentSelection: Selection,
      delta?: number
    ): Promise<Selection | null> {
      const { document } = editor;
      const { initialPosition, range, arg } = currentSelection;

      if (!isCharSearchType(currentSelection.type) || !arg) {
        const searchChar = await bounds.readArgument!(editor, initialPosition);
        if (!searchChar) return null;

        const newRange = await getRangeAtPosition(editor, initialPosition, searchChar);
        if (!newRange) return null;
        const text = document.getText(newRange);
        return { type, range: newRange, initialPosition, text, arg: searchChar };
      }

      if (delta === undefined) {
        const rangeStartOffset = document.offsetAt(range.start);
        const rangeEndOffset = document.offsetAt(range.end);
        const initialOffset = document.offsetAt(initialPosition);

        if (rangeStartOffset === rangeEndOffset && rangeStartOffset === initialOffset) {
          const newRange = await getRangeAtPosition(editor, initialPosition, arg);
          if (!newRange) return null;
          const text = document.getText(newRange);
          return { type, range: newRange, initialPosition, text, arg };
        }

        const { forward: oldForward, inclusive: oldInclusive } =
          charSearchPropertiesTable[currentSelection.type as CharSearchType];

        if (oldForward !== forward) {
          const charOffset =
            rangeEndOffset > initialOffset
              ? oldInclusive
                ? rangeEndOffset - 1
                : rangeEndOffset
              : oldInclusive
                ? rangeStartOffset
                : rangeStartOffset - 1;

          const text = document.getText();
          const newCharOffset =
            rangeEndOffset > initialOffset ? text.lastIndexOf(arg, charOffset - 1) : text.indexOf(arg, charOffset + 1);

          if (newCharOffset === -1) return currentSelection;

          const [newStart, newEnd] =
            newCharOffset >= initialOffset
              ? [initialOffset, inclusive ? newCharOffset + 1 : newCharOffset]
              : [inclusive ? newCharOffset : newCharOffset + 1, initialOffset];

          const newRange = new vscode.Range(document.positionAt(newStart), document.positionAt(newEnd));
          return { type, range: newRange, initialPosition, text: document.getText(newRange), arg };
        }

        if ((forward && rangeStartOffset < initialOffset) || (!forward && rangeEndOffset > initialOffset)) {
          const newRange = await getRangeAtPosition(editor, initialPosition, arg);
          if (!newRange) return null;
          return { type, range: newRange, initialPosition, text: document.getText(newRange), arg };
        }

        const charOffset =
          rangeEndOffset > initialOffset
            ? oldInclusive
              ? rangeEndOffset - 1
              : rangeEndOffset
            : oldInclusive
              ? rangeStartOffset
              : rangeStartOffset - 1;

        const [newStart, newEnd] =
          charOffset >= initialOffset
            ? [initialOffset, inclusive ? charOffset + 1 : charOffset]
            : [inclusive ? charOffset : charOffset + 1, initialOffset];

        const newRange = new vscode.Range(document.positionAt(newStart), document.positionAt(newEnd));
        return { type, range: newRange, initialPosition, text: document.getText(newRange), arg };
      }

      if (delta === 0) return currentSelection;

      const text = document.getText();
      const initialOffset = document.offsetAt(initialPosition);
      const { forward: currentForward, inclusive: currentInclusive } =
        charSearchPropertiesTable[currentSelection.type as CharSearchType];

      const rangeStartOffset = document.offsetAt(range.start);
      const rangeEndOffset = document.offsetAt(range.end);

      const charOffset =
        rangeEndOffset > initialOffset
          ? currentInclusive
            ? rangeEndOffset - 1
            : rangeEndOffset
          : currentForward
            ? rangeStartOffset
            : currentInclusive
              ? rangeStartOffset
              : rangeStartOffset - 1;

      const moveRight = forward ? delta > 0 : delta < 0;
      let newCharOffset = charOffset;

      for (let i = Math.abs(delta); i > 0; i--) {
        const pos = moveRight ? text.indexOf(arg, newCharOffset + 1) : text.lastIndexOf(arg, newCharOffset - 1);
        if (pos === -1) break;
        newCharOffset = pos;
      }

      const [newStart, newEnd] =
        newCharOffset >= initialOffset
          ? [initialOffset, inclusive ? newCharOffset + 1 : newCharOffset]
          : [inclusive ? newCharOffset : newCharOffset + 1, initialOffset];

      const newRange = new vscode.Range(document.positionAt(newStart), document.positionAt(newEnd));
      return { type, range: newRange, initialPosition, text: document.getText(newRange), arg };
    },
    async readArgument(editor: vscode.TextEditor, position: vscode.Position) {
      const char = await withAwaitingArgument<string>(type, () => {
        vscode.window.setStatusBarMessage(`$(search) ${forward ? "Find" : "Reverse find"} character...`, 5000);
      });

      if (char) lastChar = char;

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
