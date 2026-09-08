//! Multi-tenant host routing (plan Step 4).
//! `mitch.pro` → `webserver/`, `rjuhsd.school` → `webserver/rjuhsd/`,
//! `sexypickleclub.com` → `webserver/sexypickleclub/`.
//! Status: stub.

#![allow(dead_code)]

pub struct Hosts;

impl Hosts {
    pub fn placeholder() -> Self {
        Self
    }
}
