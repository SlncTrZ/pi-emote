# pi-emote

Animated pixel-art emote widget for pi TUI. Displays a reactive avatar that changes expression based on agent activity (thinking, talking, reading, writing, tool use, etc.).

## Configuration

pi-emote uses layered configuration with deep merge. Higher-priority layers override lower ones field-by-field.

### Priority (lowest → highest)

| Layer | Path | Purpose |
|-------|------|---------|
| Extension defaults | `<ext-dir>/config.json` | Shipped defaults |
| User global | `~/.pi/agent/extensions/pi-emote/config.json` | Personal preferences |
| Project local | `.pi/extensions/pi-emote/config.json` | Project-specific overrides |

### Config Fields

```json
{
  "enabled": true,
  "debug": false,
  "size": 8,
  "readingSpeed": 4,
  "hideBelow": 80,
  "holdDuration": {
    "hi": 2000,
    "success": 1200,
    "failure": 1200
  },
  "blinkInterval": [3000, 6000],
  "talkTickMs": 120,
  "cycleMs": 500,
  "emotes": [
    { "model": "*", "emote-set": "default" }
  ],
  "terminals": [
    { "match": "zellij", "render": "ascii" },
    { "match": "tmux", "render": "ascii" },
    { "match": "screen", "render": "ascii" },
    { "match": "wezterm", "render": "iterm2" },
    { "match": "ghostty", "render": "kitty" }
  ]
}
```

- **enabled** — Toggle the widget on/off.
- **debug** — Enable debug logging to `debug.log` in the extension directory.
- **size** — Avatar width in terminal cells.
- **readingSpeed** — Words per second used to pace talk animation duration.
- **hideBelow** — Hide widget when terminal is narrower than this (columns).
- **holdDuration** — How long (ms) to display hi/success/failure before transitioning.
- **blinkInterval** — Random range `[min, max]` (ms) between idle blinks and think swaps.
- **talkTickMs** — Interval (ms) between mouth frame changes during talk.
- **cycleMs** — Frame cycle interval (ms) for read/write/tool animations.
- **emotes** — Model-to-emote-set mapping (see below).
- **terminals** — Terminal-to-renderer mapping (see below).

You only need to include fields you want to override. Unspecified fields inherit from lower-priority layers.

### Minimal Override Example

```json
{
  "size": 12,
  "holdDuration": { "hi": 3000 }
}
```

This changes only `size` and `holdDuration.hi`; all other settings keep their defaults.

## Emote Sets

Emote sets are directories containing frame images organized by state.

### Model-Based Selection

The `emotes` array maps model IDs to emote sets using glob patterns:

```json
{
  "emotes": [
    { "model": "*", "emote-set": "default" },
    { "model": "*opus*", "emote-set": "serious-avatar" },
    { "model": "*flash*", "emote-set": "speedy" }
  ]
}
```

- Patterns use glob syntax (`*` = any characters, `?` = single character).
- Matching is case-insensitive against the model `id` (e.g. `claude-opus-4.6`).
- **Last match wins** — order matters.
- If multiple non-catch-all patterns match, a warning is logged.
- The `emotes` array uses **append** semantics: entries from all config layers are concatenated (extension → user → project). Since last match wins, higher-priority layers naturally override lower ones. An empty array `[]` is treated as "not set" and skipped.

## Terminal Renderer Overrides

The `terminals` array maps detected terminal/multiplexer names to specific image renderers. This patches cases where pi-tui's auto-detection is incorrect.

### How It Works

1. **Multiplexer detection** (checked first): env vars like `ZELLIJ`, `TMUX`, `TERM=screen*` identify multiplexers.
2. **Terminal detection**: `TERM_PROGRAM`, `KITTY_WINDOW_ID`, `WEZTERM_PANE`, etc. identify the terminal emulator.
3. **Whitelist lookup**: the detected name is matched against the `terminals` array — first match wins.
4. **Fallback**: if no match, pi-tui's `getCapabilities().images` is used.

### Detected Names

| Name | Detected via |
|------|-------------|
| `zellij` | `$ZELLIJ_SESSION_NAME` or `$ZELLIJ` |
| `tmux` | `$TMUX` or `$TERM` starts with `tmux` |
| `screen` | `$TERM` starts with `screen` |
| `kitty` | `$KITTY_WINDOW_ID` or `$TERM_PROGRAM=kitty` |
| `ghostty` | `$GHOSTTY_RESOURCES_DIR` or `$TERM_PROGRAM=ghostty` |
| `wezterm` | `$WEZTERM_PANE` or `$TERM_PROGRAM=WezTerm` |
| `iterm2` | `$ITERM_SESSION_ID` or `$TERM_PROGRAM=iTerm.app` |
| `vscode` | `$TERM_PROGRAM=vscode` |
| `alacritty` | `$TERM_PROGRAM=alacritty` |
| `unknown` | Nothing matched |

### Render Values

- `"kitty"` — Kitty graphics protocol
- `"iterm2"` — iTerm2 inline image protocol
- `"ascii"` — Text-only fallback

### Shipped Defaults

```json
{
  "terminals": [
    { "match": "zellij", "render": "ascii" },
    { "match": "tmux", "render": "ascii" },
    { "match": "screen", "render": "ascii" },
    { "match": "wezterm", "render": "iterm2" },
    { "match": "ghostty", "render": "kitty" }
  ]
}
```

Multiplexers default to ASCII because image protocol passthrough is unreliable. WezTerm uses iTerm2 protocol (more reliable than Kitty on WezTerm). Terminals not listed (e.g., kitty, iterm2) fall through to pi-tui auto-detection.

### Override Example

If you have Kitty image passthrough working in tmux:

```json
{
  "terminals": [
    { "match": "tmux", "render": "kitty" }
  ]
}
```

The `terminals` array uses **merge-by-key** semantics: entries are merged by `match` key across all config layers (extension → user → project). Higher-priority layers replace entries with the same key, or append new ones. You only need to include the entries you want to override or add.

### Emote Set Lookup

When resolving an emote set name, pi-emote searches these locations in order:

1. **Project:** `.pi/extensions/pi-emote/emotes/<set-name>/`
2. **User:** `~/.pi/agent/extensions/pi-emote/emotes/<set-name>/`
3. **Extension:** `<ext-dir>/emotes/<set-name>/`
4. **Fallback:** `<ext-dir>/emotes/default/`

### Directory Structure

Each emote set directory contains state subdirectories with PNG frames:

```
emotes/<set-name>/
├── emotes.json          # Frame configuration (optional)
├── hi/
│   └── *.png
├── idle/
│   ├── idle.png
│   └── idle_blink.png
├── think/
│   ├── think.png
│   └── think_hard.png
├── talk/
│   ├── close.png
│   ├── open_small.png
│   └── open_wide.png
├── read/
│   └── *.png
├── write/
│   └── *.png
├── tool/
│   └── *.png
├── success/
│   └── *.png
├── failure/
│   └── *.png
└── compact/
    └── *.png
```

### emotes.json (per set)

Optional file inside each emote set to configure frame behavior:

```json
{
  "idle": {
    "default": "idle.png",
    "blink": "idle_blink.png"
  },
  "think": {
    "default": "think.png",
    "hard": "think_hard.png"
  },
  "talk": {
    "weights": {
      "close.png": 1,
      "open_small.png": 3,
      "open_wide.png": 1
    }
  }
}
```

### Creating a Custom Emote Set

1. Create the directory in the appropriate location:
   ```bash
   mkdir -p ~/.pi/agent/extensions/pi-emote/emotes/my-avatar/{idle,think,talk,read,write,tool,hi,success,failure,compact}
   ```

2. Add PNG frames to each state directory. Not all states are required — missing states will have no animation for that action.

3. Optionally add `emotes.json` for frame configuration.

4. Map a model to your set in config:
   ```json
   {
     "emotes": [
       { "model": "*", "emote-set": "default" },
       { "model": "*opus*", "emote-set": "my-avatar" }
     ]
   }
   ```

### Project-Wide Override

To use a single custom emote for all models in a project:

`.pi/extensions/pi-emote/config.json`:
```json
{
  "emotes": [
    { "model": "*", "emote-set": "project-mascot" }
  ]
}
```

Place the frames in `.pi/extensions/pi-emote/emotes/project-mascot/`.
