# Easy Kill

Select & Copy Things Easily in VS Code - a port of [easy-kill](https://github.com/leoliu/easy-kill) for Emacs.

## Install

- Visual Studio Marketplace: https://marketplace.visualstudio.com/items?itemName=knu.easy-kill.  Official Microsoft marketplace listing for VS Code.
- Open VSX: https://open-vsx.org/extension/knu/easy-kill.  Alternative registry used by VSCodium and other forks.

## Features

- **Drop-in replacement for standard copy** (<kbd>Cmd</kbd>+<kbd>C</kbd> / <kbd>Ctrl</kbd>+<kbd>C</kbd>) - works with existing selections or triggers intelligent selection when no text is selected
- **Quick copying/selecting** with intelligent selection
- **30+ selection types**: subword, word, line, sentence, paragraph, sexp, defun, function, block, string, parentheses, brackets, curlies (with/without delimiters), buffer, filename, URL, email, character search, and more
- **Interactive expansion/shrinking** of selections
- **Emacs-like workflow** for efficient text manipulation

## Usage

### Commands

**Selection Commands:**

- **Easy Kill: Copy** (<kbd>Ctrl</kbd>+<kbd>C</kbd> / <kbd>Cmd</kbd>+<kbd>C</kbd>) - Copy text at point with intelligent selection. If text is already selected, performs standard copy.
- **Easy Kill: Select** (<kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>2</kbd>) - Select text at point

**Movement Commands:**

- **Easy Kill: Forward Subword** (<kbd>Alt</kbd>+<kbd>→</kbd> / <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>→</kbd>) - Move forward by subword (camelCase/snake_case aware)
- **Easy Kill: Backward Subword** (<kbd>Alt</kbd>+<kbd>←</kbd> / <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>←</kbd>) - Move backward by subword
- **Easy Kill: Forward Word** (<kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>→</kbd> / <kbd>Ctrl</kbd>+<kbd>→</kbd>) - Move forward by word
- **Easy Kill: Backward Word** (<kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>←</kbd> / <kbd>Ctrl</kbd>+<kbd>←</kbd>) - Move backward by word
- **Easy Kill: Forward Sentence** - Move forward by sentence
- **Easy Kill: Backward Sentence** - Move backward by sentence

Note: Movement commands support selection when invoked with shift key.

**Duplicate Commands:**

- **Easy Kill: Duplicate After** - Insert a copy after the selection
- **Easy Kill: Duplicate Before** - Insert a copy before the selection

These commands duplicate the current selection, or if nothing is selected, the first matching object type from `easyKill.objectTypeOrderForDuplicate` (default: line).  The original text remains selected, entering Select mode so you can press <kbd>y</kbd> repeatedly to create more copies.

### Interactive Selection

After triggering a command, you can interactively adjust the selection:

- **Confirm** (<kbd>Enter</kbd>) - Confirm selection and exit
- **Cancel** (<kbd>Escape</kbd>/<kbd>Ctrl</kbd>+<kbd>G</kbd>) - Cancel and restore cursor position
- **Expand** (<kbd>+</kbd>/<kbd>=</kbd>) - Expand selection by 1
- **Shrink** (<kbd>-</kbd>) - Shrink selection by 1
- **Cycle** (<kbd>Space</kbd>) - Cycle through selection types
- **Duplicate After** (<kbd>y</kbd>) - Insert a copy after the selection
- **Add to Count** (<kbd>1</kbd>-<kbd>9</kbd>) - Add N to current count (e.g., pressing <kbd>4</kbd> when count is 1 expands to 5 instances; pressing <kbd>4</kbd> when count is -1 expands to 3 instances)
- **Reset** (<kbd>0</kbd>) - Reset to initial size (count = 1)
- **Change Type** (letter keys) - Switch to specific selection type (see Selection Types below)

All key bindings above (except Cancel) are customizable via the `easyKill.keyBindings` setting.  To customize Cancel (<kbd>Escape</kbd>/<kbd>Ctrl</kbd>+<kbd>G</kbd>), use VS Code's Keyboard Shortcuts settings for the `easyKill.cancel` command.

### Selection Types

Available selection types (default key bindings shown in parentheses, customizable via settings):

**Text Objects:**

- **Subword** (<kbd>w</kbd>) - camelCase/snake_case aware word part
- **Word** (<kbd>W</kbd>/<kbd>s</kbd>) - "word" (symbol in Emacs / WORD in Vim)
- **Line** (<kbd>l</kbd>) - Current line with newline
- **Sentence** (<kbd>.</kbd>) - Sentence ending with punctuation
- **Paragraph** (<kbd>p</kbd>) - Text between blank lines

**Code Structures:**

- **Sexp** (<kbd>e</kbd>) - S-expression or balanced expression
- **Defun** (<kbd>d</kbd>) - Enclosing function/method/class definition
- **Defun Name** (<kbd>D</kbd>) - Name of enclosing function only
- **Function** (<kbd>f</kbd>) - Alias for defun
- **Block** (<kbd>b</kbd>) - Alias for sexp

**Delimited Regions:**

- **String** (<kbd>q</kbd>) - String at cursor (language-aware)
- **String Universal** (<kbd>Q</kbd>) - String with any quote type
- **Parentheses** (<kbd>(</kbd>) - Text including parentheses
- **Parentheses Content** (<kbd>)</kbd>) - Text inside parentheses
- **Brackets** (<kbd>[</kbd>) - Text including brackets
- **Brackets Content** (<kbd>]</kbd>) - Text inside brackets
- **Curlies** (<kbd>{</kbd>) - Text including braces
- **Curlies Content** (<kbd>}</kbd>) - Text inside braces

**Buffer Regions:**

- **Buffer** (<kbd>a</kbd>) - Entire buffer content
- **Buffer Before** (<kbd><</kbd>) - From buffer start to cursor
- **Buffer After** (<kbd>></kbd>) - From cursor to buffer end

**Special:**

- **Filename** (<kbd>/</kbd>) - File path at cursor
- **Buffer File Name** (<kbd>n</kbd>) - Current file's full path
- **URL** (<kbd>u</kbd>) - URL at cursor (auto-prefixes protocol)
- **Email** (<kbd>@</kbd>) - Email address at cursor
- **Backward Line Edge** (<kbd>^</kbd>) - From line start/indent to cursor
- **Forward Line Edge** (<kbd>$</kbd>) - From cursor to line end

**Character Search:**

- **To Char Forward** (<kbd>f</kbd>) - From cursor to character (inclusive)
- **Up To Char Forward** (<kbd>t</kbd>) - From cursor to before character
- **To Char Backward** (<kbd>F</kbd>) - From character to cursor (inclusive)
- **Up To Char Backward** (<kbd>T</kbd>) - From after character to cursor

## How It Works

### Copy Mode (<kbd>Cmd</kbd>+<kbd>C</kbd> / <kbd>Ctrl</kbd>+<kbd>C</kbd>)

1. If text is selected, performs standard copy
2. If no selection, triggers easy-kill (copy) mode:
   - Extension selects text starting from smallest match (word)
   - Text is immediately copied to clipboard
   - Adjust selection using quick pick menu
   - Clipboard updates as you modify selection

### Select Mode (<kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>2</kbd>)

1. Trigger the command
2. Extension selects text starting from smallest match (word)
3. Adjust selection using quick pick menu
4. On confirm, text is selected in editor (not copied)

## Inspiration

This extension is a port of [easy-kill](https://github.com/leoliu/easy-kill) and [easy-kill-extras](https://github.com/knu/easy-kill-extras.el) for Emacs, bringing their intelligent selection and manipulation capabilities to VS Code.

## License

Copyright (c) 2025-2026 Akinori Musha

MIT License - see [LICENSE](LICENSE) file for details.

## Repository

https://github.com/knu/vscode-easy-kill
