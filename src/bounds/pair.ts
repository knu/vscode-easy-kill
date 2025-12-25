import * as vscode from "vscode";
import { ThingBoundsBase } from "./base";
import { ThingType } from "../types";

export function findEnclosingPair(
  document: vscode.TextDocument,
  position: vscode.Position,
  openChars: string[],
  closeChars: string[]
): vscode.Range | null {
  const text = document.getText();
  const offset = document.offsetAt(position);
  const pairs: Record<string, string> = {};
  openChars.forEach((open, i) => (pairs[open] = closeChars[i]));

  let depth = 0;
  let openChar = "";
  let openOffset = -1;

  for (let i = offset - 1; i >= 0; i--) {
    const char = text[i];
    if (closeChars.includes(char)) {
      depth++;
    } else if (openChars.includes(char)) {
      if (depth === 0) {
        openChar = char;
        openOffset = i;
        break;
      }
      depth--;
    }
  }

  if (openOffset === -1) {
    return null;
  }

  depth = 0;
  const closeChar = pairs[openChar];
  for (let i = openOffset + 1; i < text.length; i++) {
    const char = text[i];
    if (char === openChar) {
      depth++;
    } else if (char === closeChar) {
      if (depth === 0) {
        return new vscode.Range(document.positionAt(openOffset), document.positionAt(i + 1));
      }
      depth--;
    }
  }

  return null;
}

export function findEnclosingString(
  document: vscode.TextDocument,
  position: vscode.Position,
  quotes: string[],
  includeQuotes: boolean
): vscode.Range | null {
  const text = document.getText();
  const offset = document.offsetAt(position);

  for (const quote of quotes) {
    let openOffset = -1;
    for (let i = offset - 1; i >= 0; i--) {
      if (text[i] === quote && (i === 0 || text[i - 1] !== "\\")) {
        openOffset = i;
        break;
      }
    }

    if (openOffset === -1) continue;

    for (let i = openOffset + 1; i < text.length; i++) {
      if (text[i] === quote && text[i - 1] !== "\\") {
        if (includeQuotes) {
          return new vscode.Range(document.positionAt(openOffset), document.positionAt(i + 1));
        } else {
          return new vscode.Range(document.positionAt(openOffset + 1), document.positionAt(i));
        }
      }
    }
  }

  return null;
}

class PairBounds extends ThingBoundsBase {
  constructor(
    type: ThingType,
    private openChars: string[],
    private closeChars: string[],
    private content: boolean
  ) {
    super(type);
  }

  async getRangeAtPosition(editor: vscode.TextEditor, position: vscode.Position): Promise<vscode.Range | null> {
    const { document } = editor;
    const range = findEnclosingPair(document, position, this.openChars, this.closeChars);
    if (!this.content || !range) return range;
    return new vscode.Range(
      document.positionAt(document.offsetAt(range.start) + 1),
      document.positionAt(document.offsetAt(range.end) - 1)
    );
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

export const createPairBounds = (
  type: ThingType,
  openChars: string[],
  closeChars: string[],
  content: boolean = false
) => {
  return new PairBounds(type, openChars, closeChars, content);
};

class StringBounds extends ThingBoundsBase {
  constructor() {
    super("string");
  }

  async getRangeAtPosition(editor: vscode.TextEditor, position: vscode.Position): Promise<vscode.Range | null> {
    const { document } = editor;
    const uri = document.uri;

    const tokens = await vscode.commands.executeCommand<{ data: number[] } | undefined>(
      "vscode.provideDocumentSemanticTokens",
      uri
    );

    if (tokens?.data) {
      const offset = document.offsetAt(position);
      let line = 0;
      let char = 0;

      for (let i = 0; i < tokens.data.length; i += 5) {
        const deltaLine = tokens.data[i];
        const deltaStartChar = tokens.data[i + 1];
        const length = tokens.data[i + 2];
        const tokenType = tokens.data[i + 3];

        line += deltaLine;
        if (deltaLine === 0) {
          char += deltaStartChar;
        } else {
          char = deltaStartChar;
        }

        const tokenStart = document.offsetAt(new vscode.Position(line, char));
        const tokenEnd = tokenStart + length;

        if (offset >= tokenStart && offset < tokenEnd && tokenType === 0) {
          return new vscode.Range(document.positionAt(tokenStart), document.positionAt(tokenEnd));
        }
      }
    }

    const quotes = ['"', "'", "`"];
    return findEnclosingString(document, position, quotes, false);
  }

  async getNextEnd(editor: vscode.TextEditor, position: vscode.Position): Promise<vscode.Position | null> {
    return null;
  }

  async getPreviousStart(editor: vscode.TextEditor, position: vscode.Position): Promise<vscode.Position | null> {
    return null;
  }
}

class StringUniversalBounds extends ThingBoundsBase {
  constructor() {
    super("string-universal");
  }

  async getRangeAtPosition(editor: vscode.TextEditor, position: vscode.Position): Promise<vscode.Range | null> {
    const { document } = editor;
    const quotes = ['"', "'", "`"];
    return findEnclosingString(document, position, quotes, false);
  }

  async getNextEnd(editor: vscode.TextEditor, position: vscode.Position): Promise<vscode.Position | null> {
    return null;
  }

  async getPreviousStart(editor: vscode.TextEditor, position: vscode.Position): Promise<vscode.Position | null> {
    return null;
  }
}

export const stringBounds = new StringBounds();
export const stringUniversalBounds = new StringUniversalBounds();
