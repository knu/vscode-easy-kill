import * as vscode from "vscode";

export async function withEditor(content: string, fn: (editor: vscode.TextEditor) => Thenable<void>): Promise<void> {
  const document = await vscode.workspace.openTextDocument({
    language: "plaintext",
    content,
  });
  const editor = await vscode.window.showTextDocument(document);
  await fn(editor);
}

export async function runCommandAndWaitForDocument(
  document: vscode.TextDocument,
  command: string,
  args?: unknown
): Promise<void> {
  const changed = new Promise<void>((resolve) => {
    const subscription = vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.document !== document) return;
      subscription.dispose();
      resolve();
    });
  });

  await vscode.commands.executeCommand(command, args);
  await waitWithTimeout(changed, 1000, "Document did not change");
}

export async function runCommandAndWaitForSelection(
  editor: vscode.TextEditor,
  command: string,
  args?: unknown
): Promise<void> {
  const initialSelection = editor.selection;
  const changed = new Promise<void>((resolve) => {
    const subscription = vscode.window.onDidChangeTextEditorSelection((event) => {
      if (event.textEditor.document !== editor.document) return;
      const { selection } = event.textEditor;
      if (selection.active.isEqual(initialSelection.active) && selection.anchor.isEqual(initialSelection.anchor)) {
        return;
      }
      subscription.dispose();
      resolve();
    });
  });

  await vscode.commands.executeCommand(command, args);

  const poll = async () => {
    const deadline = Date.now() + 1000;
    while (Date.now() < deadline) {
      const { selection } = editor;
      if (!selection.active.isEqual(initialSelection.active) || !selection.anchor.isEqual(initialSelection.anchor)) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error("Selection did not change");
  };

  await Promise.race([changed, poll()]);
}

export function pos(line: number, character: number): vscode.Position {
  return new vscode.Position(line, character);
}

async function waitWithTimeout(promise: Promise<void>, timeoutMs: number, message: string): Promise<void> {
  let timeoutId: NodeJS.Timeout | undefined;
  const timeout = new Promise<void>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  try {
    await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}
