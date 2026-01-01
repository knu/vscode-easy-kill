import * as vscode from "vscode";
import { SubwordBounds, WordBounds } from "./bounds/word";
import { LineBounds, createBackwardLineEdgeBounds, createForwardLineEdgeBounds } from "./bounds/line";
import { SentenceBounds } from "./bounds/sentence";
import { ParagraphBounds } from "./bounds/paragraph";
import { SexpBounds } from "./bounds/sexp";
import { DefunBounds } from "./bounds/defun";
import { bufferBounds, bufferBeforeBounds, bufferAfterBounds } from "./bounds/buffer";
import { createPairBounds, stringBounds, stringUniversalBounds } from "./bounds/pair";
import { createPatternBounds, urlBounds } from "./bounds/pattern";
import { bufferFileNameBounds, defunNameBounds } from "./bounds/instant";
import { ThingType, ThingBounds, Selection } from "./types";
import { charSearchBoundsArray } from "./bounds/char";
import { debug } from "./debug";

const thingBoundsTable: Record<ThingType, ThingBounds> = {} as Record<ThingType, ThingBounds>;

function isThingType(value: string): value is ThingType {
  return value in thingBoundsTable;
}

let currentSelection: Selection | null = null;
let isActive = false;
let isSelectMode = false;
let statusBarItem: vscode.StatusBarItem;
let lastCopiedText: string | null = null;
let copiedMessageDisposable: vscode.Disposable | null = null;
let initialCursorPosition: vscode.Position | null = null;
let awaitingArgument: { type: ThingType; resolve: (arg: string | null) => void } | null = null;
let cancelCallback: (() => void) | null = null;
let globalTypeDisposable: vscode.Disposable | null = null;
let globalChangeDisposable: vscode.Disposable | null = null;
let globalSelectionDisposable: vscode.Disposable | null = null;
let isInternalSelectionChange = false;

export async function preserveSelection<T>(editor: vscode.TextEditor, fn: () => Promise<T>): Promise<T> {
  const originalSelection = editor.selection;
  const wasInternal = isInternalSelectionChange;
  isInternalSelectionChange = true;
  try {
    return await fn();
  } finally {
    isInternalSelectionChange = wasInternal;
    editor.selection = originalSelection;
  }
}

export function withAwaitingArgument<T>(
  type: ThingType,
  fn: (resolve: (value: T | null) => void) => void
): Promise<T | null> {
  return new Promise<T | null>((resolve) => {
    awaitingArgument = { type, resolve: resolve as (arg: string | null) => void };
    fn(resolve);
  }).finally(() => {
    awaitingArgument = null;
  });
}

async function changeSelection(editor: vscode.TextEditor, selection: vscode.Selection) {
  const wasInternal = isInternalSelectionChange;
  isInternalSelectionChange = true;
  try {
    editor.selection = selection;
  } finally {
    isInternalSelectionChange = wasInternal;
  }
}

export function activate(context: vscode.ExtensionContext) {
  debug.enabled = process.env.EASY_KILL_DEBUG === "true" || context.extensionMode === vscode.ExtensionMode.Development;

  debug("[Easy Kill] Activating extension");
  debug(
    "[Easy Kill] Extension mode:",
    context.extensionMode === 1 ? "Production" : context.extensionMode === 2 ? "Development" : "Test"
  );

  initializeThingBoundsTable();
  debug("[Easy Kill] Initialized bounds:", Object.keys(thingBoundsTable).sort().join(", "));

  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  context.subscriptions.push(statusBarItem);

  context.subscriptions.push(
    vscode.commands.registerCommand("easyKill.copy", async () => {
      const editor = vscode.window.activeTextEditor;
      if (editor && !editor.selection.isEmpty) {
        const text = editor.document.getText(editor.selection);
        await vscode.commands.executeCommand("editor.action.clipboardCopyAction");
        showCopiedMessage(text);
        return;
      }
      return startEasyKill(false);
    })
  );

  context.subscriptions.push(vscode.commands.registerCommand("easyKill.select", () => startEasyKill(true)));

  context.subscriptions.push(
    vscode.commands.registerCommand("easyKill.cancel", () => {
      if (cancelCallback) {
        cancelCallback();
      }
    })
  );

  const thingTypes: Array<{ type: ThingType; name: string }> = [
    { type: "subword", name: "Subword" },
    { type: "word", name: "Word" },
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
      vscode.commands.registerCommand(`easyKill.copy${name}`, () => startEasyKill(false, [type]))
    );

    context.subscriptions.push(
      vscode.commands.registerCommand(`easyKill.select${name}`, () => startEasyKill(true, [type]))
    );
  }

  const createMovementCommand = (
    thingType: ThingType,
    getPosition: (
      bounds: ThingBounds,
      editor: vscode.TextEditor,
      position: vscode.Position
    ) => Promise<vscode.Position | null>
  ) => {
    return async (args?: { select?: boolean }) => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;

      const select = args?.select ?? false;
      const position = editor.selection.active;
      const bounds = thingBoundsTable[thingType];
      const newPosition = await getPosition(bounds, editor, position);

      if (newPosition) {
        const anchor = select ? editor.selection.anchor : newPosition;
        editor.selection = new vscode.Selection(anchor, newPosition);
        editor.revealRange(new vscode.Range(newPosition, newPosition));
      }
    };
  };

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "easyKill.forwardSubword",
      createMovementCommand("subword", (bounds, editor, pos) => bounds.getNextEnd(editor, pos))
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "easyKill.backwardSubword",
      createMovementCommand("subword", (bounds, editor, pos) => bounds.getPreviousStart(editor, pos))
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "easyKill.forwardWord",
      createMovementCommand("word", (bounds, editor, pos) => bounds.getNextEnd(editor, pos))
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "easyKill.backwardWord",
      createMovementCommand("word", (bounds, editor, pos) => bounds.getPreviousStart(editor, pos))
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "easyKill.forwardSentence",
      createMovementCommand("sentence", (bounds, editor, pos) => bounds.getNextEnd(editor, pos))
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "easyKill.backwardSentence",
      createMovementCommand("sentence", (bounds, editor, pos) => bounds.getPreviousStart(editor, pos))
    )
  );

  context.subscriptions.push(vscode.commands.registerCommand("easyKill.duplicateAfter", () => startDuplicate(true)));

  context.subscriptions.push(vscode.commands.registerCommand("easyKill.duplicateBefore", () => startDuplicate(false)));
}

function initializeThingBoundsTable() {
  const allBounds: ThingBounds[] = [
    new SubwordBounds(),
    new WordBounds(),
    new LineBounds(),
    new SentenceBounds(),
    new ParagraphBounds(),
    new SexpBounds(),
    new DefunBounds(),
    defunNameBounds,
    bufferBounds,
    bufferBeforeBounds,
    bufferAfterBounds,
    stringBounds,
    stringUniversalBounds,
    createPairBounds("parentheses", ["("], [")"], false),
    createPairBounds("parentheses-content", ["("], [")"], true),
    createPairBounds("brackets", ["["], ["]"], false),
    createPairBounds("brackets-content", ["["], ["]"], true),
    createPairBounds("curlies", ["{"], ["}"], false),
    createPairBounds("curlies-content", ["{"], ["}"], true),
    createPatternBounds("filename", [/[./~][\w\-./]+/g, /[A-Z]:[\w\-\\/.]+/g]),
    bufferFileNameBounds,
    urlBounds,
    createPatternBounds("email", [
      /[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+/g,
    ]),
    createBackwardLineEdgeBounds(() => currentSelection),
    createForwardLineEdgeBounds(() => currentSelection),
    ...charSearchBoundsArray,
  ];

  for (const bounds of allBounds) {
    thingBoundsTable[bounds.type] = bounds;
  }

  // Aliases
  thingBoundsTable["function"] = thingBoundsTable["defun"];
  thingBoundsTable["block"] = thingBoundsTable["sexp"];
}

async function tryInstantCopy(
  editor: vscode.TextEditor,
  position: vscode.Position,
  type: ThingType,
  selectMode: boolean
): Promise<boolean> {
  const bounds = thingBoundsTable[type];
  if (!bounds.instantCopy) {
    return false;
  }

  if (selectMode) {
    vscode.window.showInformationMessage(`${type} is only available in copy mode`);
    return false;
  }

  isActive = true;
  vscode.commands.executeCommand("setContext", "easyKillActive", true);
  let tempDisposable: vscode.Disposable | null = null;

  tempDisposable = vscode.commands.registerCommand("type", async (args) => {
    if (awaitingArgument) {
      awaitingArgument.resolve(args.text);
      return;
    }
    return vscode.commands.executeCommand("default:type", args);
  });

  const text = await bounds.instantCopy(editor, position);

  tempDisposable?.dispose();

  if (!text) {
    isActive = false;
    vscode.commands.executeCommand("setContext", "easyKillActive", false);
    vscode.window.showInformationMessage(`No ${type}`);
    return false;
  }

  const initialSelection: Selection = {
    type,
    range: new vscode.Range(position, position),
    initialPosition: position,
    text: "",
    arg: undefined,
  };

  const selection = await bounds.getNewSelection(editor, initialSelection);
  if (!selection) {
    isActive = false;
    vscode.commands.executeCommand("setContext", "easyKillActive", false);
    copyTextToClipboard(text);
    vscode.window.showInformationMessage(`Copied: ${type}`);
    return true;
  }

  if (selection.range.isEmpty) {
    isActive = false;
    vscode.commands.executeCommand("setContext", "easyKillActive", false);
    vscode.window.showInformationMessage(`No ${type}`);
    return false;
  }

  selection.text = text;
  currentSelection = selection;
  isSelectMode = selectMode;

  updateSelection(editor, selection, selectMode);
  return true;
}

async function tryThingType(
  editor: vscode.TextEditor,
  position: vscode.Position,
  type: ThingType,
  selectMode: boolean
): Promise<boolean> {
  if (await tryInstantCopy(editor, position, type, selectMode)) {
    return true;
  }

  const bounds = thingBoundsTable[type];
  let arg: string | undefined;

  if (bounds.readArgument) {
    isActive = true;
    vscode.commands.executeCommand("setContext", "easyKillActive", true);

    let tempDisposable: vscode.Disposable | null = null;
    tempDisposable = vscode.commands.registerCommand("type", async (args) => {
      if (awaitingArgument) {
        awaitingArgument.resolve(args.text);
        return;
      }
      return vscode.commands.executeCommand("default:type", args);
    });

    arg = (await bounds.readArgument(editor, position)) ?? undefined;

    tempDisposable?.dispose();

    if (!arg) {
      isActive = false;
      vscode.commands.executeCommand("setContext", "easyKillActive", false);
      vscode.window.showInformationMessage(`No ${type}`);
      return false;
    }
  }

  const newSelection = await bounds.getNewSelection(editor, {
    type,
    range: new vscode.Range(position, position),
    initialPosition: position,
    text: "",
    arg,
  });

  if (newSelection && !newSelection.range.isEmpty) {
    if (!isActive) {
      isActive = true;
      vscode.commands.executeCommand("setContext", "easyKillActive", true);
    }

    currentSelection = newSelection;
    isSelectMode = selectMode;

    updateSelection(editor, newSelection, selectMode);
    return true;
  }

  if (isActive) {
    isActive = false;
    vscode.commands.executeCommand("setContext", "easyKillActive", false);
  }
  return false;
}

async function startEasyKill(selectMode: boolean, initialTypeList?: ThingType[]) {
  const editor = vscode.window.activeTextEditor;
  if (!editor || isActive) return;

  const position = editor.selection.active;
  initialCursorPosition = position;

  currentSelection = null;
  editor.selection = new vscode.Selection(position, position);

  let things: ThingType[];
  if (initialTypeList) {
    things = initialTypeList;
  } else {
    const config = vscode.workspace.getConfiguration("easyKill");
    const configKey = selectMode ? "objectTypeOrderForSelect" : "objectTypeOrderForCopy";
    things = config.get(configKey, ["subword", "word", "line", "paragraph"]);
  }

  for (const type of things) {
    if (await tryThingType(editor, position, type, selectMode)) {
      return;
    }
  }

  if (initialTypeList && initialTypeList.length === 1) {
    vscode.window.showInformationMessage(`No ${initialTypeList[0]}`);
  }
}

async function startDuplicate(after: boolean, savedInitialPosition?: vscode.Position | null) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  const selection = editor.selection;
  let range: vscode.Range | null = null;
  let thingType: ThingType = "line";

  if (selection.isEmpty) {
    const config = vscode.workspace.getConfiguration("easyKill");
    const things: ThingType[] = config.get("objectTypeOrderForDuplicate", ["line"]);
    for (const type of things) {
      const bounds = thingBoundsTable[type];
      if (bounds.getRangeAtPosition) {
        range = await bounds.getRangeAtPosition(editor, selection.active);
        if (range && !range.isEmpty) {
          thingType = type;
          break;
        }
      }
    }
  } else {
    range = selection;
  }

  if (!range || range.isEmpty) {
    vscode.window.showInformationMessage("No object found to duplicate");
    return;
  }

  const text = editor.document.getText(range);

  globalChangeDisposable?.dispose();
  globalChangeDisposable = null;

  await editor.edit((editBuilder) => {
    editBuilder.insert(after ? range.end : range.start, text);
  });

  // Select the original, adjusting for shift when copy is inserted before
  const startOffset = editor.document.offsetAt(range.start);
  const shift = after ? 0 : text.length;
  const newStart = editor.document.positionAt(startOffset + shift);
  const newEnd = editor.document.positionAt(startOffset + shift + text.length);

  const originalPosition = savedInitialPosition ?? selection.active;
  const originalOffset = editor.document.offsetAt(originalPosition);
  initialCursorPosition =
    originalOffset >= startOffset && shift > 0 ? editor.document.positionAt(originalOffset + shift) : originalPosition;
  isActive = true;
  isSelectMode = true;
  vscode.commands.executeCommand("setContext", "easyKillActive", true);

  currentSelection = {
    type: thingType,
    range: new vscode.Range(newStart, newEnd),
    initialPosition: initialCursorPosition,
    text,
  };

  updateSelection(editor, currentSelection, true);
}

async function updateSelection(editor: vscode.TextEditor, selection: Selection, selectMode: boolean) {
  await changeSelection(editor, new vscode.Selection(selection.range.start, selection.range.end));
  updateStatusBar(selection);
  if (!selectMode) {
    await copySelectionToClipboard(editor);
  }

  globalTypeDisposable?.dispose();
  globalChangeDisposable?.dispose();
  globalSelectionDisposable?.dispose();

  const cleanup = (resetCursor: boolean = false) => {
    if (!isActive) return;

    awaitingArgument?.resolve(null);
    awaitingArgument = null;

    if (resetCursor && initialCursorPosition) {
      editor.selection = new vscode.Selection(initialCursorPosition, initialCursorPosition);
    }

    statusBarItem.hide();
    isActive = false;
    vscode.commands.executeCommand("setContext", "easyKillActive", false);
    isSelectMode = false;
    currentSelection = null;
    initialCursorPosition = null;
    cancelCallback = null;

    globalTypeDisposable?.dispose();
    globalChangeDisposable?.dispose();
    globalSelectionDisposable?.dispose();
    globalTypeDisposable = null;
    globalChangeDisposable = null;
    globalSelectionDisposable = null;
  };

  cancelCallback = () => cleanup(true);

  globalTypeDisposable = vscode.commands.registerCommand("type", async (args) => {
    if (!isActive || !currentSelection) {
      return vscode.commands.executeCommand("default:type", args);
    }

    const char = args.text;

    if (awaitingArgument) {
      awaitingArgument.resolve(char);
      return;
    }

    const config = vscode.workspace.getConfiguration("easyKill");
    const typeMap: Record<string, string> = config.get("keyBindings", {});

    if (char in typeMap) {
      const value = typeMap[char];
      if (!value) return;

      switch (value) {
        case "accept":
          cleanup(false);
          return;
        case "cancel":
          cleanup(true);
          return;
        case "expand":
          await expandSelection(editor, 1);
          return;
        case "shrink":
          await shrinkSelection(editor, 1);
          return;
        case "reset":
          await resetSelection(editor);
          return;
        case "cycle":
          await cycleSelection(editor);
          return;
        case "expand-by-1":
          await expandSelection(editor, 1);
          return;
        case "expand-by-2":
          await expandSelection(editor, 2);
          return;
        case "expand-by-3":
          await expandSelection(editor, 3);
          return;
        case "expand-by-4":
          await expandSelection(editor, 4);
          return;
        case "expand-by-5":
          await expandSelection(editor, 5);
          return;
        case "expand-by-6":
          await expandSelection(editor, 6);
          return;
        case "expand-by-7":
          await expandSelection(editor, 7);
          return;
        case "expand-by-8":
          await expandSelection(editor, 8);
          return;
        case "expand-by-9":
          await expandSelection(editor, 9);
          return;
        case "duplicate-after": {
          const savedInitialPosition = initialCursorPosition;
          cleanup(false);
          await startDuplicate(true, savedInitialPosition);
          return;
        }
        case "duplicate-before": {
          const savedInitialPosition = initialCursorPosition;
          cleanup(false);
          await startDuplicate(false, savedInitialPosition);
          return;
        }
        default:
          if (isThingType(value)) {
            if (currentSelection.type === value) {
              await expandSelection(editor, 1);
            } else {
              await changeSelectionType(editor, value);
            }
          } else {
            vscode.window.showInformationMessage(`Unknown command or type: ${value}`);
          }
          return;
      }
    }

    const unmappedBehavior = config.get<string>("unmappedKeyBehavior", "error");
    switch (unmappedBehavior) {
      case "error":
        vscode.window.showInformationMessage(`No thing type bound to key: ${char}`);
        break;
      default:
        cleanup(false);
        await vscode.commands.executeCommand("default:type", args);
        break;
    }
  });

  globalChangeDisposable = vscode.workspace.onDidChangeTextDocument((e) => {
    if (isActive && e.document === editor.document && e.contentChanges.length > 0) {
      cleanup(false);
    }
  });

  globalSelectionDisposable = vscode.window.onDidChangeTextEditorSelection((e) => {
    if (isInternalSelectionChange || e.kind === undefined) {
      return;
    }
    if (isActive && e.textEditor === editor && e.kind !== vscode.TextEditorSelectionChangeKind.Command) {
      cleanup(false);
    }
  });
}

async function changeSelectionType(editor: vscode.TextEditor, type: ThingType) {
  if (!currentSelection || !initialCursorPosition) return;

  const bounds = thingBoundsTable[type];

  if (bounds.instantCopy) {
    if (isSelectMode) {
      vscode.window.showInformationMessage(`${type} is only available in copy mode`);
      return;
    }

    const text = await bounds.instantCopy(editor, initialCursorPosition);
    if (!text) {
      vscode.window.showInformationMessage(`No ${type}`);
      return;
    }

    const newSelection = await bounds.getNewSelection(editor, {
      type,
      range: new vscode.Range(initialCursorPosition, initialCursorPosition),
      initialPosition: initialCursorPosition,
      text: "",
      arg: undefined,
    });

    if (newSelection) {
      currentSelection = newSelection;
      await updateSelection(editor, currentSelection, isSelectMode);
      return;
    }

    copyTextToClipboard(text);
    vscode.window.showInformationMessage(`Copied: ${type}`);
    return;
  }

  debug("[changeSelectionType] from:", currentSelection.type, "to:", type);
  const newSelection = await bounds.getNewSelection(editor, currentSelection);
  if (newSelection) {
    currentSelection = newSelection;
    await updateSelection(editor, currentSelection, isSelectMode);
  } else {
    vscode.window.showInformationMessage(`No ${type}`);
  }
}

async function expandSelection(editor: vscode.TextEditor, delta: number) {
  if (!currentSelection) return;

  const { type } = currentSelection;
  const bounds = thingBoundsTable[type];
  const newSelection = await bounds.getNewSelection(editor, currentSelection, delta);

  if (newSelection) {
    currentSelection = newSelection;
    await updateSelection(editor, currentSelection, isSelectMode);
  }
}

async function shrinkSelection(editor: vscode.TextEditor, delta: number) {
  if (!currentSelection) return;

  const { type } = currentSelection;
  const bounds = thingBoundsTable[type];
  const newSelection = await bounds.getNewSelection(editor, currentSelection, -delta);

  if (newSelection) {
    currentSelection = newSelection;
    await updateSelection(editor, currentSelection, isSelectMode);
  }
}

async function resetSelection(editor: vscode.TextEditor) {
  if (!currentSelection) return;

  const { type } = currentSelection;
  const bounds = thingBoundsTable[type];
  const newSelection = await bounds.getNewSelection(editor, currentSelection, undefined);

  if (newSelection) {
    currentSelection = newSelection;
    await updateSelection(editor, currentSelection, isSelectMode);
  }
}

async function cycleSelection(editor: vscode.TextEditor) {
  if (!currentSelection) return;

  const config = vscode.workspace.getConfiguration("easyKill");
  const things: ThingType[] = config.get("objectTypeOrderForCopy", ["subword", "word", "line", "paragraph"]);
  const currentIndex = things.indexOf(currentSelection.type);
  const nextType = things[(currentIndex + 1) % things.length];
  await changeSelectionType(editor, nextType);
}

function showCopiedMessage(text: string) {
  if (text !== lastCopiedText) {
    copiedMessageDisposable?.dispose();
    const preview = /^.{0,50}$/.test(text) ? text : text.slice(0, 50) + "...";
    copiedMessageDisposable = vscode.window.setStatusBarMessage(`$(clippy) Copied: ${preview}`, 2000);
    lastCopiedText = text;
  }
}

async function copyTextToClipboard(text: string) {
  await vscode.env.clipboard.writeText(text);
  showCopiedMessage(text);
}

async function copySelectionToClipboard(editor: vscode.TextEditor) {
  const text = editor.document.getText(editor.selection);
  await vscode.commands.executeCommand("editor.action.clipboardCopyAction");
  showCopiedMessage(text);
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
