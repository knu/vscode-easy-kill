import * as vscode from "vscode";

type ThingType =
  | "subword"        // subword (camelCase aware)
  | "word"           // WORD in Vim sense (non-whitespace)
  | "symbol"         // full identifier/word
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

interface Selection {
  type: ThingType;
  range: vscode.Range;
  initialRange: vscode.Range;
  text: string;
  count: number;
}

interface ThingBounds {
  getRange(editor: vscode.TextEditor, position: vscode.Position): Promise<vscode.Range | null>;
  getNextEnd(editor: vscode.TextEditor, position: vscode.Position): Promise<vscode.Position | null>;
  getPreviousBeginning(editor: vscode.TextEditor, position: vscode.Position): Promise<vscode.Position | null>;
  instantCopy?(editor: vscode.TextEditor, position: vscode.Position): Promise<string | null>;
}

const thingBoundsTable: Record<ThingType, ThingBounds> = {} as Record<ThingType, ThingBounds>;

let currentSelection: Selection | null = null;
let isActive = false;
let isSelectMode = false;
let statusBarItem: vscode.StatusBarItem;
let lastCharSearchChar: string | null = null;
let lastCharSearchForward: boolean = true;
let lastCharSearchInclusive: boolean = true;
let lastCopiedText: string | null = null;
let initialCursorPosition: vscode.Position | null = null;
let awaitingCharInput: { type: ThingType; resolve: (char: string | null) => void } | null = null;

export function activate(context: vscode.ExtensionContext) {
  initializeThingBoundsTable();

  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  context.subscriptions.push(statusBarItem);

  context.subscriptions.push(
    vscode.commands.registerCommand("easyKill.copy", async () => {
      const editor = vscode.window.activeTextEditor;
      if (editor && !editor.selection.isEmpty) {
        return vscode.commands.executeCommand("editor.action.clipboardCopyAction");
      }
      return startEasyKill(false);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("easyKill.select", () => startEasyKill(true))
  );

  const thingTypes: Array<{ type: ThingType; name: string }> = [
    { type: "subword", name: "Subword" },
    { type: "word", name: "Word" },
    { type: "symbol", name: "Symbol" },
    { type: "line", name: "Line" },
    { type: "sentence", name: "Sentence" },
    { type: "paragraph", name: "Paragraph" },
    { type: "function", name: "Function" },
    { type: "block", name: "Block" },
    { type: "sexp", name: "Sexp" },
    { type: "defun", name: "Defun" },
    { type: "string-to-char-forward", name: "ToCharForward" },
    { type: "string-up-to-char-forward", name: "UpToCharForward" },
    { type: "string-to-char-backward", name: "ToCharBackward" },
    { type: "string-up-to-char-backward", name: "UpToCharBackward" },
  ];

  for (const { type, name } of thingTypes) {
    context.subscriptions.push(
      vscode.commands.registerCommand(`easyKill.copy${name}`, () => startEasyKillWithType(false, type))
    );

    context.subscriptions.push(
      vscode.commands.registerCommand(`easyKill.select${name}`, () => startEasyKillWithType(true, type))
    );
  }

}

function initializeThingBoundsTable() {
  const subwordBounds: ThingBounds = {
    async getRange(editor, position) {
      const { document, selection: originalSelection } = editor;
      const { text } = document.lineAt(position.line);

      if (position.character >= text.length || /\W/.test(text[position.character])) {
        editor.selection = originalSelection;
        return null;
      }

      editor.selection = new vscode.Selection(position, position);
      await vscode.commands.executeCommand("cursorWordPartLeft");
      const start = editor.selection.active;

      editor.selection = new vscode.Selection(position, position);
      await vscode.commands.executeCommand("cursorWordPartRight");
      const end = editor.selection.active;

      editor.selection = originalSelection;

      return start.isEqual(end) ? null : new vscode.Range(start, end);
    },
    async getNextEnd(editor, position) {
      const { document, selection: originalSelection } = editor;
      const { text } = document.lineAt(position.line);
      const restOfLine = text.substring(position.character);
      const nonWordMatch = restOfLine.match(/^\W+/);

      const pos = nonWordMatch
        ? new vscode.Position(position.line, position.character + nonWordMatch[0].length)
        : position;

      editor.selection = new vscode.Selection(pos, pos);
      await vscode.commands.executeCommand("cursorWordPartRight");
      const result = editor.selection.active;
      editor.selection = originalSelection;
      return result;
    },
    async getPreviousBeginning(editor, position) {
      const { document, selection: originalSelection } = editor;
      const { text } = document.lineAt(position.line);
      const textBefore = text.substring(0, position.character);
      const nonWordMatch = textBefore.match(/\W+$/);

      const pos = nonWordMatch
        ? new vscode.Position(position.line, position.character - nonWordMatch[0].length)
        : position;

      editor.selection = new vscode.Selection(pos, pos);
      await vscode.commands.executeCommand("cursorWordPartLeft");
      const result = editor.selection.active;
      editor.selection = originalSelection;
      return result;
    },
  };

  const wordBounds: ThingBounds = {
    async getRange(editor, position) {
      const { selection: originalSelection } = editor;

      editor.selection = new vscode.Selection(position, position);
      await vscode.commands.executeCommand("cursorWordStartLeft");
      const start = editor.selection.active;

      editor.selection = new vscode.Selection(position, position);
      await vscode.commands.executeCommand("cursorWordEndRight");
      const end = editor.selection.active;

      editor.selection = originalSelection;

      return (start.isEqual(end) || start.isEqual(position)) ? null : new vscode.Range(start, end);
    },
    async getNextEnd(editor, position) {
      const { selection: originalSelection } = editor;

      editor.selection = new vscode.Selection(position, position);
      await vscode.commands.executeCommand("cursorWordEndRight");
      const result = editor.selection.active;

      editor.selection = originalSelection;
      return result;
    },
    async getPreviousBeginning(editor, position) {
      const { selection: originalSelection } = editor;

      editor.selection = new vscode.Selection(position, position);
      await vscode.commands.executeCommand("cursorWordStartLeft");
      const result = editor.selection.active;

      editor.selection = originalSelection;
      return result;
    },
  };

  const symbolBounds: ThingBounds = {
    async getRange(editor, position) {
      return editor.document.getWordRangeAtPosition(position) ?? null;
    },
    async getNextEnd(editor, position) {
      const { selection: originalSelection } = editor;

      editor.selection = new vscode.Selection(position, position);
      await vscode.commands.executeCommand("cursorWordRight");
      const result = editor.selection.active;

      editor.selection = originalSelection;
      return result;
    },
    async getPreviousBeginning(editor, position) {
      const { selection: originalSelection } = editor;

      editor.selection = new vscode.Selection(position, position);
      await vscode.commands.executeCommand("cursorWordLeft");
      const result = editor.selection.active;

      editor.selection = originalSelection;
      return result;
    },
  };

  const lineBounds: ThingBounds = {
    async getRange(editor, position) {
      const { range, rangeIncludingLineBreak } = editor.document.lineAt(position.line);
      return new vscode.Range(range.start, rangeIncludingLineBreak.end);
    },
    async getNextEnd(editor, position) {
      const { document } = editor;
      const nextLine = Math.min(position.line + 1, document.lineCount - 1);
      return document.lineAt(nextLine).rangeIncludingLineBreak.end;
    },
    async getPreviousBeginning(editor, position) {
      const { document } = editor;
      const prevLine = Math.max(position.line - 1, 0);
      return document.lineAt(prevLine).range.start;
    },
  };

  const sentenceBounds: ThingBounds = {
    async getRange(editor, position) {
      const { document } = editor;
      const text = document.getText();
      const offset = document.offsetAt(position);

      const sentenceEndBase = /[.?!…‽]/;
      const sentenceEndClosing = /[)\]"'"'"}»›]*/;
      const sentenceEndWithoutSpace = /[。．？！]/;

      const sentenceEnd = new RegExp(
        `(?:${sentenceEndBase.source}${sentenceEndClosing.source}(?:$|[ \\u00a0][ \\u00a0]|\\t)|` +
        `${sentenceEndWithoutSpace.source}+)[ \\u00a0\\t\\n]*`,
        'g'
      );

      let start = 0;
      let end = text.length;

      sentenceEnd.lastIndex = 0;
      let match;
      let lastEnd = 0;

      while ((match = sentenceEnd.exec(text)) !== null) {
        const matchEnd = match.index + match[0].length;
        if (matchEnd > offset) {
          end = matchEnd;
          start = lastEnd;
          break;
        }
        lastEnd = matchEnd;
      }

      if (start === 0 && end === text.length && offset > 0) {
        start = lastEnd;
      }

      while (start < text.length && /[ \t\n]/.test(text[start])) {
        start++;
      }

      return new vscode.Range(document.positionAt(start), document.positionAt(end));
    },
    async getNextEnd(editor, position) {
      const { document } = editor;
      const text = document.getText();
      const offset = document.offsetAt(position);

      const sentenceEnd = /(?:[.?!…‽][)\]"'"'"}»›]*(?:$|[ \u00a0][ \u00a0]|\t)|[。．？！]+)[ \u00a0\t\n]*/g;
      sentenceEnd.lastIndex = offset;

      const match = sentenceEnd.exec(text);
      return match ? document.positionAt(match.index + match[0].length) : null;
    },
    async getPreviousBeginning(editor, position) {
      const { document } = editor;
      const text = document.getText();
      const offset = document.offsetAt(position);

      const sentenceEnd = /(?:[.?!…‽][)\]"'"'"}»›]*(?:$|[ \u00a0][ \u00a0]|\t)|[。．？！]+)[ \u00a0\t\n]*/g;

      let lastEnd = 0;
      let match;
      sentenceEnd.lastIndex = 0;

      while ((match = sentenceEnd.exec(text)) !== null) {
        const matchEnd = match.index + match[0].length;
        if (matchEnd >= offset) {
          break;
        }
        lastEnd = matchEnd;
      }

      while (lastEnd < text.length && /[ \t\n]/.test(text[lastEnd])) {
        lastEnd++;
      }

      return document.positionAt(lastEnd);
    },
  };

  const paragraphBounds: ThingBounds = {
    async getRange(editor, position) {
      const { document } = editor;
      let startLine = position.line;
      let endLine = position.line;

      while (startLine > 0 && document.lineAt(startLine - 1).text.trim() !== "") {
        startLine--;
      }

      while (endLine < document.lineCount - 1 && document.lineAt(endLine + 1).text.trim() !== "") {
        endLine++;
      }

      return new vscode.Range(
        document.lineAt(startLine).range.start,
        document.lineAt(endLine).range.end
      );
    },
    async getNextEnd(editor, position) {
      const range = await this.getRange(editor, position);
      return range?.end ?? null;
    },
    async getPreviousBeginning(editor, position) {
      const { document } = editor;
      const range = await this.getRange(editor, new vscode.Position(Math.max(0, position.line - 1), 0));
      return range?.start.isBefore(position) ? range.start : null;
    },
  };

  const sexpBounds: ThingBounds = {
    async getRange(editor, position) {
      const { document } = editor;
      const uri = document.uri;

      try {
        const selectionRanges = await vscode.commands.executeCommand<vscode.SelectionRange[]>(
          'vscode.executeSelectionRangeProvider',
          uri,
          [position]
        );

        if (selectionRanges && selectionRanges.length > 0) {
          let currentRange: vscode.SelectionRange | undefined = selectionRanges[0];
          const wordRange = document.getWordRangeAtPosition(position);

          while (currentRange) {
            if (!wordRange || !currentRange.range.isEqual(wordRange)) {
              if (currentRange.range.contains(position) && !currentRange.range.isEmpty) {
                return currentRange.range;
              }
            }
            currentRange = currentRange.parent;
          }
        }
      } catch (e) {
      }

      return findEnclosingPair(document, position, ["(", "[", "{"], [")", "]", "}"]);
    },
    async getNextEnd(editor, position) {
      const range = await this.getRange(editor, position);
      return range?.end ?? null;
    },
    async getPreviousBeginning(editor, position) {
      const { document } = editor;
      const range = await this.getRange(editor, new vscode.Position(Math.max(0, position.line - 1), 0));
      if (range?.start.isBefore(position)) {
        return range.start;
      }
      return null;
    },
  };

  const defunBounds: ThingBounds = {
    async getRange(editor, position) {
      const { document } = editor;
      const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
        "vscode.executeDocumentSymbolProvider",
        document.uri
      );
      if (!symbols) return null;

      const findEnclosingFunction = (syms: vscode.DocumentSymbol[]): vscode.DocumentSymbol | null => {
        for (const sym of syms) {
          if ([vscode.SymbolKind.Function, vscode.SymbolKind.Method, vscode.SymbolKind.Class].includes(sym.kind)) {
            if (sym.range.contains(position)) {
              const child = findEnclosingFunction(sym.children);
              return child || sym;
            }
          }
          const child = findEnclosingFunction(sym.children);
          if (child) return child;
        }
        return null;
      };

      const sym = findEnclosingFunction(symbols);
      return sym?.range ?? null;
    },
    async getNextEnd(editor, position) {
      const range = await this.getRange(editor, position);
      return range?.end ?? null;
    },
    async getPreviousBeginning(editor, position) {
      const { document } = editor;
      const range = await this.getRange(editor, new vscode.Position(Math.max(0, position.line - 1), 0));
      if (range?.start.isBefore(position)) {
        return range.start;
      }
      return null;
    },
  };

  const bufferFileNameBounds: ThingBounds = {
    async getRange(editor, position) {
      return null;
    },
    async getNextEnd(editor, position) {
      return null;
    },
    async getPreviousBeginning(editor, position) {
      return null;
    },
    async instantCopy(editor, position) {
      return editor.document.uri.fsPath ?? null;
    },
  };

  const defunNameBounds: ThingBounds = {
    async getRange(editor, position) {
      return null;
    },
    async getNextEnd(editor, position) {
      return null;
    },
    async getPreviousBeginning(editor, position) {
      return null;
    },
    async instantCopy(editor, position) {
      const { document } = editor;
      const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
        "vscode.executeDocumentSymbolProvider",
        document.uri
      );
      if (!symbols) return null;

      const findEnclosingFunction = (syms: vscode.DocumentSymbol[]): vscode.DocumentSymbol | null => {
        for (const sym of syms) {
          if ([vscode.SymbolKind.Function, vscode.SymbolKind.Method, vscode.SymbolKind.Class].includes(sym.kind)) {
            if (sym.range.contains(position)) {
              const child = findEnclosingFunction(sym.children);
              return child || sym;
            }
          }
          const child = findEnclosingFunction(sym.children);
          if (child) return child;
        }
        return null;
      };

      const sym = findEnclosingFunction(symbols);
      return sym?.name ?? null;
    },
  };

  const stringBounds: ThingBounds = {
    async getRange(editor, position) {
      const { document } = editor;
      const uri = document.uri;

      const tokenData = await vscode.commands.executeCommand<any>(
        'vscode.executeDocumentSymbolProvider',
        uri
      );

      const tokens = await vscode.commands.executeCommand<any>(
        'vscode.provideDocumentSemanticTokens',
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
            return new vscode.Range(
              document.positionAt(tokenStart),
              document.positionAt(tokenEnd)
            );
          }
        }
      }

      const quotes = ['"', "'", '`'];
      return findEnclosingString(document, position, quotes, false);
    },
    async getNextEnd(editor, position) {
      return null;
    },
    async getPreviousBeginning(editor, position) {
      return null;
    },
  };

  const stringUniversalBounds: ThingBounds = {
    async getRange(editor, position) {
      const { document } = editor;
      const quotes = ['"', "'", "`"];
      return findEnclosingString(document, position, quotes, false);
    },
    async getNextEnd(editor, position) {
      return null;
    },
    async getPreviousBeginning(editor, position) {
      return null;
    },
  };

  const createPairBounds = (openChars: string[], closeChars: string[], content: boolean = false): ThingBounds => ({
    async getRange(editor, position) {
      const { document } = editor;
      const range = findEnclosingPair(document, position, openChars, closeChars);
      if (!content || !range) return range;
      return new vscode.Range(
        document.positionAt(document.offsetAt(range.start) + 1),
        document.positionAt(document.offsetAt(range.end) - 1)
      );
    },
    async getNextEnd(editor, position) {
      const range = await this.getRange(editor, position);
      return range?.end ?? null;
    },
    async getPreviousBeginning(editor, position) {
      const { document } = editor;
      const range = await this.getRange(editor, new vscode.Position(Math.max(0, position.line - 1), 0));
      if (range?.start.isBefore(position)) {
        return range.start;
      }
      return null;
    },
  });

  const bufferBounds: ThingBounds = {
    async getRange(editor, position) {
      const { document } = editor;
      const lastLine = document.lineAt(document.lineCount - 1);
      return new vscode.Range(new vscode.Position(0, 0), lastLine.range.end);
    },
    async getNextEnd(editor, position) {
      return null;
    },
    async getPreviousBeginning(editor, position) {
      return null;
    },
  };

  const bufferBeforeBounds: ThingBounds = {
    async getRange(editor, position) {
      return new vscode.Range(new vscode.Position(0, 0), position);
    },
    async getNextEnd(editor, position) {
      return null;
    },
    async getPreviousBeginning(editor, position) {
      return null;
    },
  };

  const bufferAfterBounds: ThingBounds = {
    async getRange(editor, position) {
      const { document } = editor;
      const lastLine = document.lineAt(document.lineCount - 1);
      return new vscode.Range(position, lastLine.range.end);
    },
    async getNextEnd(editor, position) {
      return null;
    },
    async getPreviousBeginning(editor, position) {
      return null;
    },
  };

  const backwardLineEdgeBounds: ThingBounds = {
    async getRange(editor, position) {
      const line = editor.document.lineAt(position.line);
      const text = line.text;
      const firstNonWhitespace = text.search(/\S/);

      const indentPos = firstNonWhitespace >= 0
        ? new vscode.Position(position.line, firstNonWhitespace)
        : line.range.start;

      if (position.character <= indentPos.character) {
        return new vscode.Range(line.range.start, position);
      }

      if (currentSelection && currentSelection.type === 'backward-line-edge') {
        if (currentSelection.range.start.isEqual(indentPos) && !indentPos.isEqual(line.range.start)) {
          return new vscode.Range(line.range.start, position);
        }
      }

      return new vscode.Range(indentPos, position);
    },
    async getNextEnd(editor, position) {
      return null;
    },
    async getPreviousBeginning(editor, position) {
      return null;
    },
  };

  const forwardLineEdgeBounds: ThingBounds = {
    async getRange(editor, position) {
      const line = editor.document.lineAt(position.line);
      return new vscode.Range(position, line.range.end);
    },
    async getNextEnd(editor, position) {
      return null;
    },
    async getPreviousBeginning(editor, position) {
      return null;
    },
  };

  const findCharInText = (text: string, char: string, startOffset: number, forward: boolean, inclusive: boolean): { start: number; end: number } | null => {
    let targetOffset = -1;

    if (forward) {
      targetOffset = text.indexOf(char, startOffset + 1);
    } else {
      targetOffset = text.lastIndexOf(char, startOffset - 1);
    }

    if (targetOffset === -1) return null;

    let startPos = startOffset;
    let endPos = targetOffset;

    if (forward) {
      if (inclusive) {
        endPos = targetOffset + 1;
      } else {
        endPos = targetOffset;
      }
    } else {
      if (inclusive) {
        startPos = targetOffset;
        endPos = startOffset;
      } else {
        startPos = targetOffset + 1;
        endPos = startOffset;
      }
    }

    return { start: startPos, end: endPos };
  };

  const createCharSearchBounds = (forward: boolean, inclusive: boolean): ThingBounds => ({
    async getRange(editor, position) {
      if (!lastCharSearchChar) return null;

      const { document } = editor;
      const text = document.getText();
      const offset = document.offsetAt(position);

      const result = findCharInText(text, lastCharSearchChar, offset, forward, inclusive);
      if (!result) return null;

      return new vscode.Range(
        document.positionAt(result.start),
        document.positionAt(result.end)
      );
    },
    async getNextEnd(editor, position) {
      if (!lastCharSearchChar) return null;

      const { document } = editor;
      const text = document.getText();
      const offset = document.offsetAt(position);

      if (forward) {
        const result = findCharInText(text, lastCharSearchChar, offset, true, inclusive);
        if (!result) return null;
        return document.positionAt(result.end);
      } else {
        const result = findCharInText(text, lastCharSearchChar, offset, false, inclusive);
        if (!result) return null;
        return document.positionAt(result.start);
      }
    },
    async getPreviousBeginning(editor, position) {
      if (!lastCharSearchChar) return null;

      const { document } = editor;
      const text = document.getText();
      const offset = document.offsetAt(position);

      if (forward) {
        const result = findCharInText(text, lastCharSearchChar, offset, false, inclusive);
        if (!result) return null;
        return document.positionAt(result.start);
      } else {
        const result = findCharInText(text, lastCharSearchChar, offset, true, inclusive);
        if (!result) return null;
        return document.positionAt(result.end);
      }
    },
    async instantCopy(editor, position) {
      const char = await new Promise<string | null>((resolve) => {
        const type = forward
          ? (inclusive ? 'string-to-char-forward' : 'string-up-to-char-forward')
          : (inclusive ? 'string-to-char-backward' : 'string-up-to-char-backward');
        awaitingCharInput = { type: type as ThingType, resolve };
        vscode.window.setStatusBarMessage(`$(search) ${forward ? 'Find' : 'Reverse find'} character...`, 5000);
      });

      awaitingCharInput = null;

      if (!char) return null;

      lastCharSearchChar = char;
      lastCharSearchForward = forward;
      lastCharSearchInclusive = inclusive;

      const { document } = editor;
      const text = document.getText();
      const offset = document.offsetAt(position);

      const result = findCharInText(text, char, offset, forward, inclusive);
      if (!result) return null;

      const range = new vscode.Range(
        document.positionAt(result.start),
        document.positionAt(result.end)
      );

      return document.getText(range);
    },
  });

  const createPatternBounds = (patterns: RegExp[]): ThingBounds => ({
    async getRange(editor, position) {
      const { document } = editor;
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
    },
    async getNextEnd(editor, position) {
      return null;
    },
    async getPreviousBeginning(editor, position) {
      return null;
    },
  });

  thingBoundsTable["subword"] = subwordBounds;
  thingBoundsTable["word"] = wordBounds;
  thingBoundsTable["symbol"] = symbolBounds;
  thingBoundsTable["line"] = lineBounds;
  thingBoundsTable["sentence"] = sentenceBounds;
  thingBoundsTable["paragraph"] = paragraphBounds;
  thingBoundsTable["sexp"] = sexpBounds;
  thingBoundsTable["defun"] = defunBounds;
  thingBoundsTable["defun-name"] = defunNameBounds;
  thingBoundsTable["function"] = defunBounds;
  thingBoundsTable["block"] = sexpBounds;
  thingBoundsTable["buffer"] = bufferBounds;
  thingBoundsTable["buffer-before"] = bufferBeforeBounds;
  thingBoundsTable["buffer-after"] = bufferAfterBounds;
  const urlBounds: ThingBounds = {
    async getRange(editor, position) {
      const { document } = editor;
      const links = await vscode.commands.executeCommand<vscode.DocumentLink[]>(
        'vscode.executeLinkProvider',
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
      return createPatternBounds(patterns).getRange(editor, position);
    },
    async getNextEnd(editor, position) {
      return null;
    },
    async getPreviousBeginning(editor, position) {
      return null;
    },
    async instantCopy(editor, position) {
      const range = await this.getRange(editor, position);
      if (!range) return null;

      let text = editor.document.getText(range);

      if (!/^\w+:\/\//.test(text)) {
        if (/^www\./.test(text)) {
          text = 'https://' + text;
        } else if (/^ftp\./.test(text)) {
          text = 'ftp://' + text;
        } else if (/@/.test(text)) {
          text = 'mailto:' + text;
        }
      }

      return text;
    },
  };

  thingBoundsTable["string"] = stringBounds;
  thingBoundsTable["string-universal"] = stringUniversalBounds;
  thingBoundsTable["parentheses"] = createPairBounds(["("], [")"], false);
  thingBoundsTable["parentheses-content"] = createPairBounds(["("], [")"], true);
  thingBoundsTable["brackets"] = createPairBounds(["["], ["]"], false);
  thingBoundsTable["brackets-content"] = createPairBounds(["["], ["]"], true);
  thingBoundsTable["curlies"] = createPairBounds(["{"], ["}"], false);
  thingBoundsTable["curlies-content"] = createPairBounds(["{"], ["}"], true);
  thingBoundsTable["filename"] = createPatternBounds([/[./~][\w\-./]+/g, /[A-Z]:[\w\-\\/.]+/g]);
  thingBoundsTable["buffer-file-name"] = bufferFileNameBounds;
  thingBoundsTable["url"] = urlBounds;
  thingBoundsTable["email"] = createPatternBounds([/[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+/g]);
  thingBoundsTable["backward-line-edge"] = backwardLineEdgeBounds;
  thingBoundsTable["forward-line-edge"] = forwardLineEdgeBounds;
  thingBoundsTable["string-to-char-forward"] = createCharSearchBounds(true, true);
  thingBoundsTable["string-up-to-char-forward"] = createCharSearchBounds(true, false);
  thingBoundsTable["string-to-char-backward"] = createCharSearchBounds(false, true);
  thingBoundsTable["string-up-to-char-backward"] = createCharSearchBounds(false, false);
}

async function startEasyKill(selectMode: boolean) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }

  if (isActive) {
    return;
  }

  isActive = true;
  const position = editor.selection.active;
  initialCursorPosition = position;

  const config = vscode.workspace.getConfiguration("easyKill");
  const configKey = selectMode ? "objectTypeOrderForSelect" : "objectTypeOrderForCopy";
  const things: ThingType[] = config.get(configKey, ["subword", "word", "symbol", "line", "paragraph"]);
  let selection: Selection | null = null;

  for (const thing of things) {
    const range = await getThingRange(editor, position, thing);
    if (range && !range.isEmpty) {
      const text = editor.document.getText(range);
      selection = { type: thing, range, initialRange: range, text, count: 1 };
      break;
    }
  }

  if (!selection) {
    isActive = false;
    return;
  }

  currentSelection = selection;
  isSelectMode = selectMode;

  if (!selectMode) {
    copyToClipboard(selection.text);
  }

  showSelection(editor, selection, selectMode);
}

async function startEasyKillWithType(selectMode: boolean, type: ThingType) {
  const editor = vscode.window.activeTextEditor;
  if (!editor || isActive) {
    return;
  }

  const position = editor.selection.active;
  initialCursorPosition = position;

  const bounds = thingBoundsTable[type];
  if (bounds?.instantCopy) {
    isActive = true;
    let tempDisposable: vscode.Disposable | null = null;

    tempDisposable = vscode.commands.registerCommand("type", async (args) => {
      if (awaitingCharInput) {
        awaitingCharInput.resolve(args.text);
        return;
      }
      return vscode.commands.executeCommand("default:type", args);
    });

    const text = await bounds.instantCopy(editor, position);

    tempDisposable?.dispose();

    if (!text) {
      isActive = false;
      vscode.window.showInformationMessage(`No ${type}`);
      return;
    }

    const range = await bounds.getRange(editor, position);
    if (!range || range.isEmpty) {
      isActive = false;
      vscode.window.showInformationMessage(`No ${type}`);
      return;
    }

    const selection: Selection = { type, range, initialRange: range, text, count: 1 };
    currentSelection = selection;
    isSelectMode = selectMode;

    if (!selectMode) {
      copyToClipboard(selection.text);
    }

    showSelection(editor, selection, selectMode);
    return;
  }

  const range = await getThingRange(editor, position, type);
  if (!range || range.isEmpty) {
    vscode.window.showInformationMessage(`No ${type}`);
    return;
  }

  isActive = true;
  const text = editor.document.getText(range);
  const selection: Selection = { type, range, initialRange: range, text, count: 1 };

  currentSelection = selection;
  isSelectMode = selectMode;

  if (!selectMode) {
    copyToClipboard(selection.text);
  }

  showSelection(editor, selection, selectMode);
}

async function getThingRange(editor: vscode.TextEditor, position: vscode.Position, thing: ThingType): Promise<vscode.Range | null> {
  const bounds = thingBoundsTable[thing];
  if (!bounds) return null;
  return bounds.getRange(editor, position);
}

function findEnclosingPair(
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
        return new vscode.Range(
          document.positionAt(openOffset),
          document.positionAt(i + 1)
        );
      }
      depth--;
    }
  }

  return null;
}

function findEnclosingString(
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
          return new vscode.Range(
            document.positionAt(openOffset),
            document.positionAt(i + 1)
          );
        } else {
          return new vscode.Range(
            document.positionAt(openOffset + 1),
            document.positionAt(i)
          );
        }
      }
    }
  }

  return null;
}

async function showSelection(editor: vscode.TextEditor, selection: Selection, selectMode: boolean) {
  editor.selection = new vscode.Selection(selection.range.start, selection.range.end);
  updateStatusBar(selection);

  let typeDisposable: vscode.Disposable | null = null;
  let changeDisposable: vscode.Disposable | null = null;
  let selectionDisposable: vscode.Disposable | null = null;

  const cleanup = (resetCursor: boolean = false) => {
    if (!isActive) return;

    awaitingCharInput?.resolve(null);
    awaitingCharInput = null;

    if (resetCursor && initialCursorPosition) {
      editor.selection = new vscode.Selection(initialCursorPosition, initialCursorPosition);
    }

    statusBarItem.hide();
    isActive = false;
    isSelectMode = false;
    currentSelection = null;
    initialCursorPosition = null;

    typeDisposable?.dispose();
    changeDisposable?.dispose();
    selectionDisposable?.dispose();
  };

  typeDisposable = vscode.commands.registerCommand("type", async (args) => {
    if (!isActive || !currentSelection) {
      return vscode.commands.executeCommand("default:type", args);
    }

    const char = args.text;

    if (awaitingCharInput) {
      awaitingCharInput.resolve(char);
      return;
    }

    const config = vscode.workspace.getConfiguration("easyKill");
    const typeMap: Record<string, ThingType> = config.get("keyBindings", {});

    if (char in typeMap) {
      const targetType = typeMap[char];
      if (currentSelection.type === targetType) {
        await expandSelection(editor, 1);
      } else {
        await changeSelectionType(editor, targetType);
      }
      return;
    }

    switch (char) {
      case "+":
      case "=":
        await expandSelection(editor, 1);
        return;
      case "-":
      case "_":
        await shrinkSelection(editor, 1);
        return;
      case " ":
        await cycleSelection(editor);
        return;
      case "0":
      case "1":
      case "2":
      case "3":
      case "4":
      case "5":
      case "6":
      case "7":
      case "8":
      case "9":
        const count = parseInt(char, 10);
        await updateSelectionWithCount(editor, count);
        return;
      default:
        cleanup(true);
        return vscode.commands.executeCommand("default:type", args);
    }
  });

  changeDisposable = vscode.workspace.onDidChangeTextDocument((e) => {
    if (isActive && e.document === editor.document && e.contentChanges.length > 0) {
      cleanup(false);
    }
  });

  selectionDisposable = vscode.window.onDidChangeTextEditorSelection((e) => {
    if (isActive && e.textEditor === editor && e.kind !== vscode.TextEditorSelectionChangeKind.Command) {
      cleanup(false);
    }
  });
}

async function changeSelectionType(editor: vscode.TextEditor, type: ThingType) {
  if (!currentSelection || !initialCursorPosition) return;

  // Revert cursor to initial position
  editor.selection = new vscode.Selection(initialCursorPosition, initialCursorPosition);

  const bounds = thingBoundsTable[type];
  if (bounds?.instantCopy) {
    const isCharSearch = type.startsWith('string-to-char-') || type.startsWith('string-up-to-char-');

    if (!isCharSearch && isSelectMode) {
      vscode.window.showInformationMessage("Not supported in Easy Kill: Select");
      return;
    }

    const text = await bounds.instantCopy(editor, initialCursorPosition);
    if (!text) {
      vscode.window.showInformationMessage(`No ${type}`);
      return;
    }

    const range = await bounds.getRange(editor, initialCursorPosition);
    if (!range) {
      vscode.window.showInformationMessage(`No ${type}`);
      return;
    }

    currentSelection = {
      type,
      range,
      initialRange: range,
      text,
      count: 1,
    };

    editor.selection = new vscode.Selection(range.start, range.end);
    updateStatusBar(currentSelection);

    await copyToClipboard(text);
    return;
  }

  const range = await getThingRange(editor, initialCursorPosition, type);
  if (range) {
    const text = editor.document.getText(range);
    currentSelection = {
      type,
      range,
      initialRange: range,
      text,
      count: 1,
    };
    editor.selection = new vscode.Selection(range.start, range.end);
    updateStatusBar(currentSelection);

    await copyToClipboard(text);
  } else {
    vscode.window.showInformationMessage(`No ${type}`);
  }
}

async function expandSelection(editor: vscode.TextEditor, delta: number) {
  if (!currentSelection) return;

  const newCount = currentSelection.count + delta;
  await updateSelectionWithCount(editor, newCount);
}

async function shrinkSelection(editor: vscode.TextEditor, delta: number) {
  if (!currentSelection) return;

  const newCount = currentSelection.count - delta;
  await updateSelectionWithCount(editor, newCount);
}

async function getNextEnd(editor: vscode.TextEditor, position: vscode.Position, type: ThingType): Promise<vscode.Position | null> {
  const bounds = thingBoundsTable[type];
  if (!bounds) return null;
  return bounds.getNextEnd(editor, position);
}

async function getPreviousBeginning(editor: vscode.TextEditor, position: vscode.Position, type: ThingType): Promise<vscode.Position | null> {
  const bounds = thingBoundsTable[type];
  if (!bounds) return null;
  return bounds.getPreviousBeginning(editor, position);
}

async function updateSelectionWithCount(editor: vscode.TextEditor, newCount: number) {
  if (!currentSelection) return;

  const { document } = editor;
  const { type, initialRange } = currentSelection;

  const isBackwardType = type === 'string-to-char-backward' || type === 'string-up-to-char-backward';

  let newRange: vscode.Range | null = null;

  if (newCount > 0) {
    if (isBackwardType) {
      let startPos = initialRange.start;
      for (let i = 1; i < newCount; i++) {
        const nextEnd = await getNextEnd(editor, startPos, type);
        if (nextEnd) {
          startPos = nextEnd;
        } else {
          break;
        }
      }
      newRange = new vscode.Range(startPos, initialRange.end);
    } else {
      let endPos = initialRange.end;
      for (let i = 1; i < newCount; i++) {
        const nextEnd = await getNextEnd(editor, endPos, type);
        if (nextEnd) {
          endPos = nextEnd;
        } else {
          break;
        }
      }
      newRange = new vscode.Range(initialRange.start, endPos);
    }
  } else {
    if (isBackwardType) {
      let endPos = initialRange.end;
      for (let i = 0; i < 1 - newCount; i++) {
        const prevBegin = await getPreviousBeginning(editor, endPos, type);
        if (prevBegin) {
          endPos = prevBegin;
        } else {
          break;
        }
      }
      newRange = new vscode.Range(initialRange.start, endPos);
    } else {
      let startPos = initialRange.start;
      for (let i = 0; i < 1 - newCount; i++) {
        const prevBegin = await getPreviousBeginning(editor, startPos, type);
        if (prevBegin) {
          startPos = prevBegin;
        } else {
          break;
        }
      }
      newRange = new vscode.Range(startPos, initialRange.end);
    }
  }

  if (newRange) {
    const text = document.getText(newRange);
    currentSelection = {
      ...currentSelection,
      range: newRange,
      text,
      count: newCount,
    };
    editor.selection = new vscode.Selection(newRange.start, newRange.end);
    updateStatusBar(currentSelection);

    await copyToClipboard(text);
  }
}

async function resetSelection(editor: vscode.TextEditor) {
  if (!currentSelection) return;

  await updateSelectionWithCount(editor, 1);
}

async function cycleSelection(editor: vscode.TextEditor) {
  if (!currentSelection) return;

  const config = vscode.workspace.getConfiguration("easyKill");
  const things: ThingType[] = config.get("objectTypeOrderForCopy", ["subword", "word", "symbol", "line", "paragraph"]);
  const currentIndex = things.indexOf(currentSelection.type);
  const nextType = things[(currentIndex + 1) % things.length];
  await changeSelectionType(editor, nextType);
}

async function finishSelection(editor: vscode.TextEditor, selectMode: boolean, append: boolean) {
  if (!currentSelection) return;

  if (selectMode) {
    editor.selection = new vscode.Selection(currentSelection.range.start, currentSelection.range.end);
  }

  initialCursorPosition = null;
}

async function copyToClipboard(text: string) {
  if (!isSelectMode) {
    await vscode.env.clipboard.writeText(text);
    if (text !== lastCopiedText) {
      vscode.window.setStatusBarMessage(`$(clippy) Copied: ${text.slice(0, 50)}${text.length > 50 ? '...' : ''}`, 2000);
      lastCopiedText = text;
    }
  }
}

function updateStatusBar(selection: Selection) {
  const lines = selection.text.split("\n").length;
  const chars = selection.text.length;
  statusBarItem.text = `$(clippy) ${selection.type}: ${lines} lines, ${chars} chars`;
  statusBarItem.show();
}

export function deactivate() {
  statusBarItem.dispose();
}
