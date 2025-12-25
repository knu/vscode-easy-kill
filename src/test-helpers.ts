import * as vscode from "vscode";

export class MockTextDocument implements vscode.TextDocument {
  constructor(private content: string) {}

  get uri(): vscode.Uri {
    return vscode.Uri.file("/test.txt");
  }

  get fileName(): string {
    return "/test.txt";
  }

  get isUntitled(): boolean {
    return false;
  }

  get languageId(): string {
    return "plaintext";
  }

  get version(): number {
    return 1;
  }

  get isDirty(): boolean {
    return false;
  }

  get isClosed(): boolean {
    return false;
  }

  save(): Thenable<boolean> {
    return Promise.resolve(true);
  }

  get eol(): vscode.EndOfLine {
    return vscode.EndOfLine.LF;
  }

  get lineCount(): number {
    return this.content.split("\n").length;
  }

  lineAt(line: number | vscode.Position): vscode.TextLine {
    const lineNumber = typeof line === "number" ? line : line.line;
    const lines = this.content.split("\n");
    const text = lines[lineNumber] || "";

    return {
      lineNumber,
      text,
      range: new vscode.Range(lineNumber, 0, lineNumber, text.length),
      rangeIncludingLineBreak: new vscode.Range(lineNumber, 0, lineNumber + 1, 0),
      firstNonWhitespaceCharacterIndex: text.search(/\S/),
      isEmptyOrWhitespace: text.trim().length === 0,
    };
  }

  offsetAt(position: vscode.Position): number {
    const lines = this.content.split("\n");
    let offset = 0;
    for (let i = 0; i < position.line; i++) {
      offset += lines[i].length + 1;
    }
    return offset + position.character;
  }

  positionAt(offset: number): vscode.Position {
    const lines = this.content.split("\n");
    let currentOffset = 0;
    for (let line = 0; line < lines.length; line++) {
      const lineLength = lines[line].length;
      if (currentOffset + lineLength >= offset) {
        return new vscode.Position(line, offset - currentOffset);
      }
      currentOffset += lineLength + 1;
    }
    return new vscode.Position(lines.length - 1, lines[lines.length - 1].length);
  }

  getText(range?: vscode.Range): string {
    if (!range) {
      return this.content;
    }
    const start = this.offsetAt(range.start);
    const end = this.offsetAt(range.end);
    return this.content.substring(start, end);
  }

  getWordRangeAtPosition(position: vscode.Position, regex?: RegExp): vscode.Range | undefined {
    const line = this.lineAt(position.line);
    const text = line.text;

    const wordPattern = regex || /\w+/g;

    let match: RegExpExecArray | null;
    while ((match = wordPattern.exec(text)) !== null) {
      const start = match.index;
      const end = start + match[0].length;

      if (position.character >= start && position.character <= end) {
        return new vscode.Range(position.line, start, position.line, end);
      }
    }

    return undefined;
  }

  validateRange(range: vscode.Range): vscode.Range {
    return range;
  }

  validatePosition(position: vscode.Position): vscode.Position {
    return position;
  }

  get encoding(): string {
    return "utf-8";
  }

  notebook: vscode.NotebookDocument | undefined = undefined;
}

export function pos(line: number, character: number): vscode.Position {
  return new vscode.Position(line, character);
}
