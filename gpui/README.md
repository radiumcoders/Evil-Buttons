# Evil Buttons for GPUI

Playful, highly animated, slightly evil buttons for [GPUI](https://gpui.rs), Zed's Rust UI
framework. They're ported from the [Evil Buttons](https://www.evilbuttons.com) React registry.

**Live demos: [gpui.evilbuttons.com](https://gpui.evilbuttons.com).** Every preview there is the
real Rust component, compiled to WebAssembly and rendered by GPUI's browser platform.

```sh
cargo add evilbuttons
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

## Repo layout

```
crates/evilbuttons   the published crate
crates/gallery        demo host: native window (all demos) or wasm (one demo per iframe);
                      one file per button in src/demos, fonts in assets/fonts
site/                 gpui.evilbuttons.com: a fork of the evilbuttons.com site with the
                      GPUI demos, cargo install blocks and live DialKit Props panels
scripts/              wasm + Vercel build scripts
```

## Develop

```sh
cargo run -p evilbuttons-gallery                 # every demo in a native window
cargo run -p evilbuttons-gallery -- --theme light --demo hold-button --variant fast

# browser demos (needs: rustup target add wasm32-unknown-unknown; wasm-bindgen-cli 0.2.129)
./scripts/build-wasm.sh                           # -> site/public/demo
cd site && pnpm install && pnpm dev
```

The wasm build is single-threaded (`WebPlatform::new(false)`), so it runs on stable Rust and
needs no COOP/COEP headers. It prefers WebGPU and falls back to WebGL2.

## Deploy (gpui.evilbuttons.com)

1. Create a Vercel project from this repo with **Root Directory** set to `site`.
   `site/vercel.json` runs `scripts/vercel-build.sh`, which installs Rust and wasm-bindgen,
   builds the demo bundle and then builds the site.
2. Add the domain `gpui.evilbuttons.com` to that project and create the DNS record Vercel
   asks for (a `CNAME` for `gpui` pointing to `cname.vercel-dns.com`).

## Adding a button

1. Port it to `crates/evilbuttons/src/<name>.rs` and export it from `lib.rs`.
2. Add its demos (and a `"live"` arm for the Props panel) in `crates/gallery/src/demos/`.
3. Add its docs page in `site/content/docs/` and its DialKit config in
   `site/components/gpui-dials.ts`.

## License

Apache-2.0
