//! Admin VM management — vm-requests GET (9936), deny-vm (9950),
//! terminate-vm (9971), restore-vm (10004), approve-vm (9886),
//! lxc-attach-sshd-hook (10040). The data-layer mutations are ported exactly;
//! the Proxmox executors (cloneUserVm/createLxcContainer/stopUserVm/
//! powerUserVm/attachSshdHookToLxc/getExistingVmids) land in Step 13 with
//! russh — until then they return a structured failure like an unreachable
//! cluster would.

use super::{AdminCtx, Resp};
use crate::state::AppState;
use axum::http::{HeaderMap, Method};
use axum::response::Response;
use serde_json::{json, Value};
use std::sync::Arc;

const PVE_VMID_MIN: i64 = 100;
const PVE_VMID_MAX: i64 = 999999999;

pub fn handle(
    state: &Arc<AppState>,
    method: &Method,
    path: &str,
    _headers: &HeaderMap,
    body: &Value,
    ctx: &AdminCtx,
) -> Resp {
    // GET /api/admin/vm-requests (admins only).
    if path == "/api/admin/vm-requests" && *method == Method::GET {
        if state.rate_limit_check(&ctx.ip, "anon", path).is_some() {
            return Some(json_response(
                429,
                json!({ "error": "Too many requests, slow down" }),
            ));
        }
        if !valid_id(&ctx.sid, state) || !ctx.is_admin(state) {
            return Some(json_response(401, json!({ "error": "unauthorized" })));
        }
        let data = state
            .store
            .read_document(&state.cfg.data_dir.join("vm_apps.json"), json!({}));
        let mut requests = data;
        if let Some(map) = requests.as_object_mut() {
            for (_key, app) in map.iter_mut() {
                if mitch_lib::auth::is_admin_email(
                    &state.store,
                    app.get("email").and_then(|v| v.as_str()).unwrap_or(""),
                ) {
                    app["billing"] = json!("admin_comped");
                    app["priceUsd"] = json!(0);
                }
            }
        }
        return Some(json_response(
            200,
            json!({ "success": true, "requests": requests }),
        ));
    }

    // POST /api/admin/deny-vm.
    if path == "/api/admin/deny-vm" && *method == Method::POST {
        if state.rate_limit_check(&ctx.ip, "anon", path).is_some() {
            return Some(json_response(
                429,
                json!({ "error": "Too many requests, slow down" }),
            ));
        }
        if !valid_id(&ctx.sid, state) || !ctx.is_admin(state) {
            return Some(json_response(401, json!({ "error": "unauthorized" })));
        }
        let target_email = body
            .get("email")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_lowercase()
            .trim()
            .to_string();
        if target_email.is_empty() {
            return Some(json_response(
                400,
                json!({ "error": "Valid email required." }),
            ));
        }
        let file = state.cfg.data_dir.join("vm_apps.json");
        let mut data = state.store.read_document(&file, json!({}));
        let norm = mitch_lib::auth::normalize_email(&target_email);
        if !data.get(norm.as_str()).is_some() {
            return Some(json_response(
                400,
                json!({ "error": "No VM application found." }),
            ));
        }
        if let Some(obj) = data.get_mut(norm.as_str()).and_then(|v| v.as_object_mut()) {
            obj.insert("status".into(), json!("denied"));
            obj.insert("deniedAt".into(), json!(now_millis()));
        }
        let _ = state.store.write_document(&file, &data);
        return Some(json_response(
            200,
            json!({ "success": true, "message": format!("VM request for {target_email} denied.") }),
        ));
    }

    // POST /api/admin/terminate-vm (soft delete; Proxmox stop stubbed).
    if path == "/api/admin/terminate-vm" && *method == Method::POST {
        if state.rate_limit_check(&ctx.ip, "anon", path).is_some() {
            return Some(json_response(
                429,
                json!({ "error": "Too many requests, slow down" }),
            ));
        }
        if !valid_id(&ctx.sid, state) || !ctx.is_admin(state) {
            return Some(json_response(401, json!({ "error": "unauthorized" })));
        }
        let target_email = body
            .get("email")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_lowercase()
            .trim()
            .to_string();
        if target_email.is_empty() {
            return Some(json_response(
                400,
                json!({ "error": "Valid email required." }),
            ));
        }
        let file = state.cfg.data_dir.join("vm_apps.json");
        let data = state.store.read_document(&file, json!({}));
        let norm = mitch_lib::auth::normalize_email(&target_email);
        let has_vmid = data
            .get(norm.as_str())
            .and_then(|app| app.get("vmid"))
            .is_some();
        if !has_vmid {
            return Some(json_response(
                400,
                json!({ "error": "No active/approved VM found for this user." }),
            ));
        }
        // Proxmox stop lands in Step 13 (stopUserVm).
        return Some(json_response(
            500,
            json!({ "error": "Proxmox API is not reachable from this environment." }),
        ));
    }

    // POST /api/admin/restore-vm.
    if path == "/api/admin/restore-vm" && *method == Method::POST {
        if state.rate_limit_check(&ctx.ip, "anon", path).is_some() {
            return Some(json_response(
                429,
                json!({ "error": "Too many requests, slow down" }),
            ));
        }
        if !valid_id(&ctx.sid, state) || !ctx.is_admin(state) {
            return Some(json_response(401, json!({ "error": "unauthorized" })));
        }
        let target_email = body
            .get("email")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_lowercase()
            .trim()
            .to_string();
        if target_email.is_empty() {
            return Some(json_response(
                400,
                json!({ "error": "Valid email required." }),
            ));
        }
        let file = state.cfg.data_dir.join("vm_apps.json");
        let data = state.store.read_document(&file, json!({}));
        let norm = mitch_lib::auth::normalize_email(&target_email);
        let app = data.get(norm.as_str()).cloned();
        let app_ok = app
            .as_ref()
            .map(|app| {
                app.get("status").and_then(|v| v.as_str()) == Some("deleted")
                    && app.get("vmid").is_some()
            })
            .unwrap_or(false);
        if !app_ok {
            return Some(json_response(
                400,
                json!({ "error": "No restorable VM found for this user." }),
            ));
        }
        let app = app.unwrap_or(json!({}));
        let deleted_at = app.get("deletedAt").and_then(|v| v.as_i64()).unwrap_or(0);
        if now_millis() - deleted_at >= 7 * 24 * 3600 * 1000 {
            return Some(json_response(
                400,
                json!({ "error": "Restore period of 7 days has expired. VM has been purged." }),
            ));
        }
        // Proxmox start lands in Step 13 (powerUserVm).
        return Some(json_response(
            500,
            json!({ "error": "Proxmox API is not reachable from this environment." }),
        ));
    }

    // POST /api/admin/approve-vm.
    if path == "/api/admin/approve-vm" && *method == Method::POST {
        if state.rate_limit_check(&ctx.ip, "anon", path).is_some() {
            return Some(json_response(
                429,
                json!({ "error": "Too many requests, slow down" }),
            ));
        }
        if !valid_id(&ctx.sid, state) || !ctx.is_admin(state) {
            return Some(json_response(401, json!({ "error": "unauthorized" })));
        }
        let target_email = body
            .get("email")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_lowercase()
            .trim()
            .to_string();
        let vmid = body
            .get("vmid")
            .and_then(|v| v.as_str())
            .and_then(|s| s.parse::<i64>().ok())
            .unwrap_or(0);
        if target_email.is_empty() || !vmid_in_range(vmid) {
            return Some(json_response(
                400,
                json!({ "error": format!("Valid email and VMID ({PVE_VMID_MIN}-{PVE_VMID_MAX}) are required.") }),
            ));
        }
        let file = state.cfg.data_dir.join("vm_apps.json");
        let data = state.store.read_document(&file, json!({}));
        let norm = mitch_lib::auth::normalize_email(&target_email);
        let Some(app) = data.get(norm.as_str()).cloned() else {
            return Some(json_response(
                400,
                json!({ "error": "No VM application found for this user." }),
            ));
        };
        if app.get("status").and_then(|v| v.as_str()) != Some("pending") {
            return Some(json_response(
                409,
                json!({ "error": "Only pending VM requests can be approved." }),
            ));
        }
        // Proxmox provision lands in Step 13 (cloneUserVm/createLxcContainer
        // + getExistingVmids + password generation). Until then, fail like an
        // unreachable cluster would instead of writing fake approval data.
        return Some(json_response(
            500,
            json!({ "error": "Proxmox API is not reachable from this environment." }),
        ));
    }

    // POST /api/admin/lxc-attach-sshd-hook (Step 13 with russh).
    if path == "/api/admin/lxc-attach-sshd-hook" && *method == Method::POST {
        if state.rate_limit_check(&ctx.ip, "anon", path).is_some() {
            return Some(json_response(
                429,
                json!({ "error": "Too many requests, slow down" }),
            ));
        }
        if !valid_id(&ctx.sid, state) {
            return Some(json_response(401, json!({ "error": "unauthorized" })));
        }
        if !ctx.is_admin(state) {
            return Some(json_response(403, json!({ "error": "forbidden" })));
        }
        let vmid = body
            .get("vmid")
            .and_then(|v| v.as_str())
            .and_then(|s| s.parse::<i64>().ok())
            .unwrap_or(0);
        if !vmid_in_range(vmid) {
            return Some(json_response(
                400,
                json!({ "error": format!("vmid must be in [{PVE_VMID_MIN}, {PVE_VMID_MAX}]") }),
            ));
        }
        return Some(json_response(
            502,
            json!({ "success": false, "error": "LXC sshd hook attach is not yet available in the Rust build (Step 13 port)." }),
        ));
    }

    None
}

fn json_response(code: u16, obj: Value) -> Response {
    crate::errors::json_resp(code, obj)
}

fn now_millis() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

fn valid_id(sid: &str, state: &Arc<AppState>) -> bool {
    !sid.is_empty() && mitch_lib::auth::valid_id(sid, &state.id_secret)
}

fn vmid_in_range(vmid: i64) -> bool {
    (PVE_VMID_MIN..=PVE_VMID_MAX).contains(&vmid)
}
