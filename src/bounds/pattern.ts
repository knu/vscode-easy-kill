import * as vscode from "vscode";
import { ThingBoundsBase } from "./base";
import { ThingType } from "../types";

class PatternBounds extends ThingBoundsBase {
  constructor(
    type: ThingType,
    private patterns: RegExp[]
  ) {
    super(type);
  }

  async getRangeAtPosition(editor: vscode.TextEditor, position: vscode.Position): Promise<vscode.Range | null> {
    const { document } = editor;
    const line = document.lineAt(position.line);
    const text = line.text;

    for (const pattern of this.patterns) {
      const matches = [...text.matchAll(pattern)];
      for (const match of matches) {
        const start = match.index!;
        const end = start + match[0].length;
        if (position.character >= start && position.character <= end) {
          return new vscode.Range(position.line, start, position.line, end);
        }
      }
    }
    return null;
  }

  async getNextEnd(editor: vscode.TextEditor, position: vscode.Position): Promise<vscode.Position | null> {
    return null;
  }

  async getPreviousStart(editor: vscode.TextEditor, position: vscode.Position): Promise<vscode.Position | null> {
    return null;
  }
}

export const createPatternBounds = (type: ThingType, patterns: RegExp[]) => {
  return new PatternBounds(type, patterns);
};

class UrlBounds extends ThingBoundsBase {
  constructor() {
    super("url");
  }

  async getRangeAtPosition(editor: vscode.TextEditor, position: vscode.Position): Promise<vscode.Range | null> {
    const { document } = editor;
    const links = await vscode.commands.executeCommand<vscode.DocumentLink[]>(
      "vscode.executeLinkProvider",
      document.uri
    );

    if (links) {
      for (const link of links) {
        if (link.range && link.range.contains(position)) {
          return link.range;
        }
      }
    }

    const patterns = [
      /\w+:\/\/[^\s<>"{}|\\^`\]]+/g,
      /(?:www|ftp)\.[a-zA-Z0-9][-a-zA-Z0-9.]*[a-zA-Z0-9]/g,
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    ];

    const line = document.lineAt(position.line);
    const text = line.text;

    for (const pattern of patterns) {
      const matches = [...text.matchAll(pattern)];
      for (const match of matches) {
        const start = match.index!;
        const end = start + match[0].length;
        if (position.character >= start && position.character <= end) {
          return new vscode.Range(position.line, start, position.line, end);
        }
      }
    }
    return null;
  }

  async getNextEnd(editor: vscode.TextEditor, position: vscode.Position): Promise<vscode.Position | null> {
    return null;
  }

  async getPreviousStart(editor: vscode.TextEditor, position: vscode.Position): Promise<vscode.Position | null> {
    return null;
  }

  async instantCopy(editor: vscode.TextEditor, position: vscode.Position): Promise<string | null> {
    const range = await this.getRangeAtPosition(editor, position);
    if (!range) return null;

    let text = editor.document.getText(range);

    if (!/^\w+:\/\//.test(text)) {
      if (/^www\./.test(text)) {
        text = "https://" + text;
      } else if (/^ftp\./.test(text)) {
        text = "ftp://" + text;
      } else if (/@/.test(text)) {
        text = "mailto:" + text;
      }
    }

    return text;
  }
}

export const urlBounds = new UrlBounds();
