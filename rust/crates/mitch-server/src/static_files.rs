//! Webroot static serving with bounded LRU cache (plan Step 4).
//! Must reproduce bun's etag/range/cache-header semantics; 16 GiB JS cache
//! cap is aspirational — start bounded and configurable.
//! Status: stub.

#![allow(dead_code)]

pub struct StaticFiles;

impl StaticFiles {
    pub fn placeholder() -> Self {
        Self
    }
}
