# Changelog

## [0.2.0] - 2025-12-27

### Added

- Special actions in `easyKill.keyBindings`: `accept`, `cancel`, `expand`, `shrink`, `reset`, `cycle`, `expand-by-N` (N: 1-9)
- `easyKill.unmappedKeyBehavior` setting to control unmapped key behavior (error/overwrite)
- Enter key support to confirm selection and exit

### Changed

- All interactive key bindings are now customizable via `easyKill.keyBindings` setting
- Unmapped keys now show error message by default instead of canceling selection (customizable)
- `_` (underscore) is now unbound by default

### Fixed

- Selection type switching now preserves initial range instead of resetting to cursor position

## [0.1.2] - 2025-12-25

### Fixed

- Fixed character search command repetition to work correctly
- Fixed forward-line-edge (^) repetition behavior

## [0.1.1] - 2025-12-24

### Fixed

- Fixed buffer-file-name and defun-name commands to properly copy content to clipboard
- Fixed character search commands (string-to-char-forward, string-up-to-char-forward, string-to-char-backward, string-up-to-char-backward) to work in both Copy and Select modes

## [0.1.0] - 2025-12-22

- Initial release
