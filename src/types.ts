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
  initialPosition: vscode.Position;
  text: string;
  arg?: string;
}

export interface ThingBounds {
  readonly type: ThingType;

  /**
   * Returns a new selection based on the current selection and delta.
   *
   * @param delta
   *   - undefined: Initialize selection to the range at initialPosition
   *   - 0: Return currentSelection unchanged
   *   - positive: Expand selection by delta ranges
   *   - negative: Shrink selection by delta ranges
   *
   * Expansion rules:
   *   - If selection extends before initialPosition, first move start forward to initialPosition
   *   - Then expand end position forward by remaining count
   *
   * Shrinking rules:
   *   - If selection extends after initialPosition, first move end backward to initialPosition
   *   - Then shrink start position backward by remaining count
   *
   * @returns New selection, or null if operation cannot be performed
   */
  getNewSelection(editor: vscode.TextEditor, currentSelection: Selection, delta?: number): Promise<Selection | null>;

  /**
   * Returns a range where position is in [range.start, range.end] (both inclusive).
   * When position is at a boundary between two ranges, prioritizes the forward range.
   *
   * This method is optional but recommended to implement for better position-based queries.
   * The default implementation in ThingBoundsBase uses getNextEnd and getPreviousStart.
   *
   * @returns Range containing position, or null if not found
   */
  getRangeAtPosition?(editor: vscode.TextEditor, position: vscode.Position, arg?: string): Promise<vscode.Range | null>;

  /**
   * Navigation methods that return positions strictly after/before the given position, or null if not found.
   * - getNextEnd: Returns the end of the next range after position
   * - getNextStart: Returns the start of the next range after position
   * - getPreviousEnd: Returns the end of the previous range before position
   * - getPreviousStart: Returns the start of the previous range before position
   */
  getNextEnd(editor: vscode.TextEditor, position: vscode.Position, arg?: string): Promise<vscode.Position | null>;
  getNextStart(editor: vscode.TextEditor, position: vscode.Position, arg?: string): Promise<vscode.Position | null>;
  getPreviousEnd(editor: vscode.TextEditor, position: vscode.Position, arg?: string): Promise<vscode.Position | null>;
  getPreviousStart(editor: vscode.TextEditor, position: vscode.Position, arg?: string): Promise<vscode.Position | null>;

  /**
   * Optional method to get text for immediate copying without selection.
   * Used for things like buffer-file-name, url, email that can be copied instantly.
   *
   * @returns Text to copy, or null if not applicable
   */
  instantCopy?(editor: vscode.TextEditor, position: vscode.Position): Promise<string | null>;

  /**
   * Optional method to read additional argument from user input.
   * Used for parameterized selections like character search.
   *
   * @returns User-provided argument string, or null if cancelled
   */
  readArgument?(editor: vscode.TextEditor, position: vscode.Position): Promise<string | null>;
}
