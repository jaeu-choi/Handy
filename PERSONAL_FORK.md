# Handy Personal

Personal fork of [cjpais/Handy](https://github.com/cjpais/Handy), based on release
v0.9.8, with Korean/English technical-term spelling controls.

## What changed

- Advanced → Transcription → Text replacement dictionary: add/remove spelling
  pairs such as 위스퍼 → Whisper and 머지 / 멀즈 → Merge.
- English target spellings join existing custom words as Whisper decode hints.
- The dictionary runs locally before paste, including ordinary transcription
  with AI disabled. Longer phrases win; replacements never cascade.
- Import the old SuperWhisper dictionary.json directly. Imports merge with the
  current dictionary; matching source spellings are updated.
- AI post-processing → Limit AI correction to small changes: optional
  replacement-only correction using the selected provider/model. It accepts at
  most two proposals, checks source/target lengths and English vocabulary, rejects
  number changes, and keeps dictionary output on invalid responses or a 10-second
  timeout. Ordinary editable prompts remain available when this mode is off.
  Apple Intelligence uses the ordinary prompt path.

AI correction is off by default. On builds where AI settings are hidden, enable
Handy's existing experimental features to expose the AI settings/shortcut.
For local AI correction, run Ollama, choose the Custom provider at
http://localhost:11434/v1, select an installed model, and enable limited correction.
The ordinary transcription shortcut remains the fast dictionary-only path.

## Use on macOS

The built application is named **Handy Personal** and has its own settings,
permissions, and history under com.jaeuchoe.handy.personal. It shares hf-hub's
normal model cache, so an existing Whisper Large v3 Q5_K_M download is reusable.

Quit the original Handy before using the same global shortcut in Handy Personal.
Grant microphone and Accessibility access on first launch.

Use Whisper Large v3 with Korean selected. Large v3 is appropriate when already
fast enough; Turbo reduces the decoder from 32 layers to 4 to trade a little
quality for speed. Neither guarantees English technical-term spelling in
mixed-language speech, which is why this fork adds hints and explicit replacements.

The old dictionary is usually at ~/.super-whisper/dictionary.json. In the file
picker, press Cmd+Shift+G to enter that path. Accepted formats are:

    {"위스퍼": "Whisper", "머지": "Merge"}

or an array of {"from": "...", "to": "..."} objects. User dictionaries, API keys,
recordings, and personal settings are stored locally and are not part of this repo.

## Development

Install Rust, Bun, and the macOS prerequisites in BUILD.md, then:

    bun install --frozen-lockfile
    bun run build
    bun run lint
    bun run test:dictionary
    bun run check:translations
    cd src-tauri
    cargo test --locked --lib
    cargo clippy --locked --lib
    cargo fmt -- --check

Build the optimized app with bun run tauri build --bundles app from the repo root.
Command Line Tools builds use Handy's Apple Intelligence stubs; Whisper and
Ollama/OpenAI-compatible post-processing work without full Xcode.

Upstream self-updates are disabled to preserve the fork's features. Update this
branch by reviewing and merging a newer upstream release.

## License and references

Handy's original MIT license is retained in LICENSE and bundled as
resources/LICENSE.txt. It permits personal and commercial modification with
copyright/license notices retained. Model licenses apply separately.

- [Whisper Large v3 Turbo model card](https://huggingface.co/openai/whisper-large-v3-turbo)
- [Whisper developer explanation of mixed-language limitations](https://github.com/openai/whisper/discussions/1160)
- [MIT license](https://opensource.org/license/mit)
