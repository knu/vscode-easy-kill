import * as assert from "assert";
import * as vscode from "vscode";
import { pos, runCommandAndWaitForDocument, runCommandAndWaitForSelection, withEditor } from "./test-helpers";

suite("Extension Command Tests", () => {
  suiteSetup(async () => {
    const extension = vscode.extensions.getExtension("knu.easy-kill");
    await extension?.activate();
  });

  suite("Selection commands", () => {
    setup(async () => {
      await vscode.commands.executeCommand("easyKill.cancel");
    });

    test("copy keeps existing selection", async () => {
      await withEditor("foo bar", async (editor) => {
        const selection = new vscode.Selection(pos(0, 0), pos(0, 3));
        editor.selection = selection;
        await vscode.commands.executeCommand("easyKill.copy");
        assert.ok(editor.selection.isEqual(selection));
      });
    });

    test("copy selects word at cursor when no selection", async () => {
      await withEditor("foo bar", async (editor) => {
        editor.selection = new vscode.Selection(pos(0, 1), pos(0, 1));
        await runCommandAndWaitForSelection(editor, "easyKill.copy");
        assert.strictEqual(editor.document.getText(editor.selection), "foo");
      });
    });

    test("select selects word at cursor when no selection", async () => {
      await withEditor("foo bar", async (editor) => {
        editor.selection = new vscode.Selection(pos(0, 1), pos(0, 1));
        await runCommandAndWaitForSelection(editor, "easyKill.select");
        assert.strictEqual(editor.document.getText(editor.selection), "foo");
      });
    });

    test("copyWord selects the current word", async () => {
      await withEditor("foo bar", async (editor) => {
        editor.selection = new vscode.Selection(pos(0, 5), pos(0, 5));
        await runCommandAndWaitForSelection(editor, "easyKill.copyWord");
        assert.strictEqual(editor.document.getText(editor.selection), "bar");
      });
    });

    test("selectWord selects the current word", async () => {
      await withEditor("foo bar", async (editor) => {
        editor.selection = new vscode.Selection(pos(0, 5), pos(0, 5));
        await runCommandAndWaitForSelection(editor, "easyKill.selectWord");
        assert.strictEqual(editor.document.getText(editor.selection), "bar");
      });
    });
  });

  suite("Movement commands", () => {
    test("forward word moves to word end", async () => {
      await withEditor("foo bar", async (editor) => {
        editor.selection = new vscode.Selection(pos(0, 0), pos(0, 0));
        await runCommandAndWaitForSelection(editor, "easyKill.forwardWord");
        assert.strictEqual(editor.selection.active.character, 3);
      });
    });

    test("backward word moves to word start", async () => {
      await withEditor("foo bar", async (editor) => {
        editor.selection = new vscode.Selection(pos(0, 7), pos(0, 7));
        await runCommandAndWaitForSelection(editor, "easyKill.backwardWord");
        assert.strictEqual(editor.selection.active.character, 4);
      });
    });

    test("forward sentence moves to sentence end", async () => {
      await withEditor("First. Second.", async (editor) => {
        editor.selection = new vscode.Selection(pos(0, 0), pos(0, 0));
        await runCommandAndWaitForSelection(editor, "easyKill.forwardSentence");
        assert.strictEqual(editor.selection.active.character, 7);
      });
    });

    test("backward sentence moves to sentence start", async () => {
      await withEditor("First. Second.", async (editor) => {
        editor.selection = new vscode.Selection(pos(0, 8), pos(0, 8));
        await runCommandAndWaitForSelection(editor, "easyKill.backwardSentence");
        assert.strictEqual(editor.selection.active.character, 7);
      });
    });
  });

  suite("Clipboard behavior", () => {
    test("does not copy to OS clipboard on intermediate selection changes", async () => {
      const commandApi = vscode.commands as unknown as {
        executeCommand: typeof vscode.commands.executeCommand;
      };
      const originalExecuteCommand = commandApi.executeCommand;
      let clipboardCopyActionCount = 0;
      const typeCommands: string[] = [];

      commandApi.executeCommand = (async (command: string, ...args: unknown[]) => {
        if (command === "editor.action.clipboardCopyAction") {
          clipboardCopyActionCount += 1;
          return Promise.resolve();
        }
        if (command === "type") {
          const textArg = args[0] as { text?: string } | undefined;
          if (textArg?.text !== undefined) {
            typeCommands.push(textArg.text);
          }
        }

        return originalExecuteCommand.call(vscode.commands, command, ...args);
      }) as typeof vscode.commands.executeCommand;

      try {
        await withEditor("foo bar", async (editor) => {
          editor.selection = new vscode.Selection(pos(0, 0), pos(0, 0));
          await vscode.commands.executeCommand("easyKill.copy");

          await vscode.commands.executeCommand("type", { text: "+" });
          await vscode.commands.executeCommand("type", { text: "+" });
          assert.deepStrictEqual(typeCommands, ["+", "+"]);
          assert.strictEqual(clipboardCopyActionCount, 0, "selection changes should not trigger clipboard copy action");

          await vscode.commands.executeCommand("type", { text: "\r" });
          assert.deepStrictEqual(typeCommands, ["+", "+", "\r"]);

          const deadline = Date.now() + 1000;
          while (Date.now() < deadline && clipboardCopyActionCount < 1) {
            await new Promise((resolve) => setTimeout(resolve, 20));
          }

          assert.ok(clipboardCopyActionCount <= 1, "final accept should not trigger more than one clipboard copy");
        });
      } finally {
        commandApi.executeCommand = originalExecuteCommand;
      }
    });
  });

  suite("Duplicate commands", () => {
    test("duplicate after inserts after current line", async () => {
      await withEditor("foo\nbar\n", async (editor) => {
        editor.selection = new vscode.Selection(pos(0, 0), pos(0, 0));
        await runCommandAndWaitForDocument(editor.document, "easyKill.duplicateAfter");
        assert.strictEqual(editor.document.getText(), "foo\nfoo\nbar\n");
      });
    });

    test("duplicate before inserts before current line", async () => {
      await withEditor("foo\nbar\n", async (editor) => {
        editor.selection = new vscode.Selection(pos(0, 0), pos(0, 0));
        await runCommandAndWaitForDocument(editor.document, "easyKill.duplicateBefore");
        assert.strictEqual(editor.document.getText(), "foo\nfoo\nbar\n");
      });
    });
  });
});
