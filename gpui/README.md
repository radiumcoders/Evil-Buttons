# Evil Buttons for GPUI

Playful, highly animated, slightly evil buttons for [GPUI](https://gpui.rs), Zed's Rust UI
framework. They're ported from the [Evil Buttons](https://www.evilbuttons.com) React registry,
which lives at the root of this repo.

**Live demos: [gpui.evilbuttons.com](https://gpui.evilbuttons.com).** Every preview there is the
real Rust component, compiled to WebAssembly and rendered by GPUI's browser platform.

```sh
cargo add evilbuttons
# or track this repo directly
cargo add evilbuttons --git https://github.com/radiumcoders/Evil-Buttons
```

```rust
use evilbuttons::{HoldButton, MinimalButton};

div()
    .child(MinimalButton::new("continue", "Continue").on_click(|_, _, _| {}))
    .child(HoldButton::new("delete").on_confirm(|_, _| delete_account()))
```

All 30 Evil Buttons are ported: 3DButton (`ThreeDButton`), AquaButton, AshBurstButton,
BrutalButton, ChromeButton, ClickPowerUp, CommandButton, ConfettiButton, CooldownButton,
CopyButton, DemonicButton, DitherButton, DoubtButton, EvilEyeButton, FrameButton,
GlitchButton, HighlightButton, HoldButton, MinecraftButton, MinimalButton,
MorphStatusButton, MoviePassButton, RealisticSwitch, RevealButton, ShinyButton,
SlideToDetonate, StickyButton, StretchyButton, ThrusterButton and TrollButton.
The WebGL, canvas and physics effects of the originals are re-created natively with
GPUI paint primitives.

The crate targets `gpui-pre` 0.3 (the published snapshot of Zed's GPUI, which includes the web
platform). Each button is a `RenderOnce` builder that keeps its animation state in GPUI's keyed
element state, so give each one an id that's unique among its siblings.

## Layout

```
gpui/Cargo.toml             Cargo workspace
gpui/crates/evilbuttons     the published crate (one module per button in src/)
gpui/rust-toolchain.toml    current stable Rust + the wasm32 target
```

CI for this folder is `.github/workflows/gpui.yml` (fmt, clippy, tests and a wasm32 build). It only
runs when something under `gpui/` changes, and the evilbuttons.com Vercel build skips commits that
only touch `gpui/`.

## Develop

```sh
cd gpui
cargo test -p evilbuttons
cargo clippy -p evilbuttons -- -D warnings
cargo build --release --target wasm32-unknown-unknown -p evilbuttons
```

The gpui.evilbuttons.com docs site and the demo gallery that runs these buttons in the browser
live in the private [Evil-Buttons-gpui](https://github.com/radiumcoders/Evil-Buttons-gpui) repo.
It builds the crate straight from this repo as a Cargo git dependency; to try local changes there,
point it at your checkout with a `[patch]` (see that repo's README).

## Adding a button

1. Port it to `gpui/crates/evilbuttons/src/<name>.rs` and export it from `lib.rs`.
2. Add its demo, docs page and Props panel config in the site repo.

## License

Apache-2.0
