//! `/api/vm/*` + Proxmox LXC subsystem (plan Step 13).
//! initializeWebVM/getExistingVmids/terminateUserVm/cleanupAllEphemeralVms
//! over russh exec with exact argv/env/cwd parity. Status: stub.

#![allow(dead_code)]

pub struct Vm;

impl Vm {
    pub fn placeholder() -> Self {
        Self
    }
}
