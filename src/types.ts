import * as vscode from "vscode";

export type ThingType =
  | "subword" // subword (camelCase aware)
  | "word" // "word" (symbol in Emacs / WORD in Vim)
  | "line"
  | "sentence"
  | "paragraph"
  | "sexp"
  | "defun"
  | "defun-name"
  | "function"
  | "block"
  | "string"
  | "string-universal"
  | "parentheses"
  | "parentheses-content"
  | "brackets"
  | "brackets-content"
  | "curlies"
  | "curlies-content"
  | "buffer"
  | "buffer-before"
  | "buffer-after"
  | "filename"
  | "buffer-file-name"
  | "url"
  | "email"
  | "backward-line-edge"
  | "forward-line-edge"
  | "string-to-char-forward"
  | "string-up-to-char-forward"
  | "string-to-char-backward"
  | "string-up-to-char-backward";

export interface Selection {
  type: ThingType;
  range: vscode.Range;
  initialRange: vscode.Range;
  text: string;
  count: number;
  arg?: string;
}

export interface ThingBounds {
  readonly type: ThingType;
  getNewSelection(editor: vscode.TextEditor, currentSelection: Selection, delta?: number): Promise<Selection | null>;
  getNextEnd(editor: vscode.TextEditor, position: vscode.Position, arg?: string): Promise<vscode.Position | null>;
  getPreviousStart(editor: vscode.TextEditor, position: vscode.Position, arg?: string): Promise<vscode.Position | null>;
  instantCopy?(editor: vscode.TextEditor, position: vscode.Position): Promise<string | null>;
  readArgument?(editor: vscode.TextEditor, position: vscode.Position): Promise<string | null>;
}
