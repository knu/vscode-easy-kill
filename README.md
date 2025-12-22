# Easy Kill

Select & Copy Things Easily in VS Code - a port of [easy-kill](https://github.com/leoliu/easy-kill) for Emacs.

## Features

- **Drop-in replacement for standard copy** (`cmd+c` / `ctrl+c`) - works with existing selections or triggers intelligent selection when no text is selected
- **Quick copying/selecting** with intelligent selection
- **30+ selection types**: subword, word, line, sentence, paragraph, sexp, defun, function, block, string, parentheses, brackets, curlies (with/without delimiters), buffer, filename, URL, email, character search, and more
- **Interactive expansion/shrinking** of selections
- **Emacs-like workflow** for efficient text manipulation

## Usage

### Commands

**Selection Commands:**
- **Easy Kill: Copy** (`ctrl+c` / `cmd+c`) - Copy text at point with intelligent selection.  If text is already selected, performs standard copy.
- **Easy Kill: Select** (`alt+shift+2`) - Select text at point

**Movement Commands:**
- **Easy Kill: Forward Subword** (`alt+right` / `ctrl+alt+right`) - Move forward by subword (camelCase/snake_case aware)
- **Easy Kill: Backward Subword** (`alt+left` / `ctrl+alt+left`) - Move backward by subword
- **Easy Kill: Forward Word** (`ctrl+alt+right` / `ctrl+right`) - Move forward by word
- **Easy Kill: Backward Word** (`ctrl+alt+left` / `ctrl+left`) - Move backward by word
- **Easy Kill: Forward Sentence** - Move forward by sentence
- **Easy Kill: Backward Sentence** - Move backward by sentence

Note: Movement commands support selection when invoked with shift key.

### Interactive Selection

After triggering a command, you can interactively adjust the selection:

- **Confirm** (Enter) - Confirm current selection
- **Expand** (+/=) - Expand selection
- **Shrink** (-/_) - Shrink selection
- **Cycle** (Space) - Cycle through selection types
- **Add to Count** (1-9) - Add N to current count (e.g., pressing `4` when count is 1 expands to 5 instances; pressing `4` when count is -1 expands to 3 instances)
- **Reset** (0) - Reset to initial size (count = 1)
- **Change Type** (letter keys) - Switch to specific selection type (see Selection Types below)

### Selection Types

Available selection types (default key bindings shown in parentheses, customizable via settings):

**Text Objects:**
- **Subword** (w) - camelCase/snake_case aware word part
- **Word** (W/s) - "word" (symbol in Emacs / WORD in Vim)
- **Line** (l) - Current line with newline
- **Sentence** (.) - Sentence ending with punctuation
- **Paragraph** (p) - Text between blank lines

**Code Structures:**
- **Sexp** (e) - S-expression or balanced expression
- **Defun** (d) - Enclosing function/method/class definition
- **Defun Name** (D) - Name of enclosing function only
- **Function** (f) - Alias for defun
- **Block** (b) - Alias for sexp

**Delimited Regions:**
- **String** (q) - String at cursor (language-aware)
- **String Universal** (Q) - String with any quote type
- **Parentheses** (() - Text including parentheses
- **Parentheses Content** ()) - Text inside parentheses
- **Brackets** ([) - Text including brackets
- **Brackets Content** (]) - Text inside brackets
- **Curlies** ({) - Text including braces
- **Curlies Content** (}) - Text inside braces

**Buffer Regions:**
- **Buffer** (a) - Entire buffer content
- **Buffer Before** (<) - From buffer start to cursor
- **Buffer After** (>) - From cursor to buffer end

**Special:**
- **Filename** (/) - File path at cursor
- **Buffer File Name** (n) - Current file's full path
- **URL** (u) - URL at cursor (auto-prefixes protocol)
- **Email** (@) - Email address at cursor
- **Backward Line Edge** (^) - From line start/indent to cursor
- **Forward Line Edge** ($) - From cursor to line end

**Character Search:**
- **To Char Forward** (f) - From cursor to character (inclusive)
- **Up To Char Forward** (t) - From cursor to before character
- **To Char Backward** (F) - From character to cursor (inclusive)
- **Up To Char Backward** (T) - From after character to cursor

## How It Works

### Copy Mode (`cmd+c` / `ctrl+c`)

1. If text is selected, performs standard copy
2. If no selection, triggers easy-kill (copy) mode:
   - Extension selects text starting from smallest match (word)
   - Text is immediately copied to clipboard
   - Adjust selection using quick pick menu
   - Clipboard updates as you modify selection

### Select Mode (`alt+shift+2`)

1. Trigger the command
2. Extension selects text starting from smallest match (word)
3. Adjust selection using quick pick menu
4. On confirm, text is selected in editor (not copied)

## Inspiration

This extension is a port of [easy-kill](https://github.com/leoliu/easy-kill) and [easy-kill-extras](https://github.com/knu/easy-kill-extras.el) for Emacs, bringing their intelligent selection and manipulation capabilities to VS Code.

## License

Copyright (c) 2025 Akinori Musha

MIT License - see [LICENSE](LICENSE) file for details.

## Repository

https://github.com/knu/vscode-easy-kill
