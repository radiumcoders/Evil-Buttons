//! # Evil Buttons for GPUI
//!
//! Playful, highly animated, slightly evil buttons for [GPUI](https://gpui.rs),
//! ported from the [Evil Buttons](https://www.evilbuttons.com) React registry.
//! Live demos run in the browser at <https://gpui.evilbuttons.com>.
//!
//! Every button is a stateless builder (`RenderOnce`) that keeps its animation
//! state in GPUI's keyed element state, so you can drop one into any `render`:
//!
//! ```ignore
//! use evilbuttons::{HoldButton, MinimalButton};
//!
//! div()
//!     .child(MinimalButton::new("continue", "Continue").on_click(|_, _, _| {}))
//!     .child(HoldButton::new("delete").on_confirm(|_, _| delete_account()))
//! ```
//!
//! Give each button an id that is unique among its siblings; its animation
//! state is keyed by it.

// Shared building blocks.
mod icons;
mod interaction;
pub mod motion;
mod surface;

pub use interaction::ClickHandler;
pub use surface::PRESS_SCALE;

// One module per button; each re-exports its public types at the crate root.
mod aqua;
pub use aqua::*;
mod ash_burst;
pub use ash_burst::*;
mod brutal;
pub use brutal::*;
mod chrome;
pub use chrome::*;
mod click_powerup;
pub use click_powerup::*;
mod command;
pub use command::*;
mod confetti;
pub use confetti::*;
mod cooldown;
pub use cooldown::*;
mod copy;
pub use copy::*;
mod demonic;
pub use demonic::*;
mod dither;
pub use dither::*;
mod doubt;
pub use doubt::*;
mod evil_eye;
pub use evil_eye::*;
mod frame;
pub use frame::*;
mod glitch;
pub use glitch::*;
mod highlight;
pub use highlight::*;
mod hold;
pub use hold::*;
mod minecraft;
pub use minecraft::*;
mod minimal;
pub use minimal::*;
mod morph_status;
pub use morph_status::*;
mod movie_pass;
pub use movie_pass::*;
mod realistic_switch;
pub use realistic_switch::*;
mod reveal;
pub use reveal::*;
mod shiny;
pub use shiny::*;
mod slide_to_detonate;
pub use slide_to_detonate::*;
mod sticky;
pub use sticky::*;
mod stretchy;
pub use stretchy::*;
mod three_d;
pub use three_d::*;
mod thruster;
pub use thruster::*;
mod troll;
pub use troll::*;
