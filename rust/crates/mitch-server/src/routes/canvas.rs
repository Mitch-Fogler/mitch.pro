//! `/api/canvas/*` — 24 endpoints, r/place clone (plan Step 10).
//! Self-contained state (`canvasPixels`/`canvasChunks`) as bounded maps +
//! periodic flush; preserve exact pixel/binary response formats. Status: stub.

#![allow(dead_code)]

pub struct Canvas;

impl Canvas {
    pub fn placeholder() -> Self {
        Self
    }
}
