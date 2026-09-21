//! `/api/vm/*` + Proxmox (plan Step 13).
//!
//! Batch 2 carries the slice the `/ssh/ws` bridge needs for non-admin
//! authorization (server.js:25786-25927): the PVE configuration, the VMID
//! range gate, the VM type resolution, the per-user status/IP resolution and
//! the `activeFreeVms` registry read. The provisioning endpoints
//! (`initializeWebVm`/`terminateUserVm`/`getExistingVmids`/the free-VM
//! pruner) land with batch 3's `/api/vm/*` group over this same slice.

// The slice is intentionally unwired until batch 3 — the /ssh/ws module (this
// batch) calls into it once written; the rest stays dead until then.
#![allow(dead_code)]

use crate::state::AppState;
use axum::http::Method;
use axum::response::Response;
use mitch_lib::jsval;
use serde_json::{json, Value};
use std::sync::Arc;

// ── Proxmox configuration (server.js:25518-25522, 25787-25788) ───────────────

/// `PVE_URL` — env value first, then the tartarus default.
pub(crate) fn pve_url() -> String {
    std::env::var("PVE_URL").unwrap_or_else(|_| "https://192.168.100.1:8006/api2/json".to_string())
}

/// `PVE_TOKEN` — "PVEAPIToken=api-helper@pve!token-id=…"; empty means the
/// Proxmox surface is unconfigured (the JS gates status fetches on it).
pub(crate) fn pve_token() -> String {
    std::env::var("PVE_TOKEN").unwrap_or_default()
}

/// `PVE_NODE` — the production host.
pub(crate) fn pve_node() -> String {
    std::env::var("PVE_NODE").unwrap_or_else(|_| "tartarus".to_string())
}

/// `PVE_VMID_MIN` / `PVE_VMID_MAX` (server.js:25787-25788).
pub(crate) const PVE_VMID_MIN: f64 = 200.0;
pub(crate) const PVE_VMID_MAX: f64 = 999.0;

/// `isVmIdInRange` (server.js:25797-25799).
pub(crate) fn is_vm_id_in_range(vmid: f64) -> bool {
    vmid.is_finite() && (PVE_VMID_MIN..=PVE_VMID_MAX).contains(&vmid)
}

/// `loadJson(VM_APPS_FILE, {})` (server.js:319).
pub(crate) fn vm_applications(state: &AppState) -> Value {
    state
        .store
        .read_document(&state.data_dir().join("vm_applications.json"), json!({}))
}

/// A PVE API client: self-signed certs on the tartarus interface, so the JS
/// `tls: { rejectUnauthorized: false }` maps to `danger_accept_invalid_certs`.
fn pve_client(deadline: u64) -> reqwest::Client {
    reqwest::Client::builder()
        .danger_accept_invalid_certs(true)
        .timeout(std::time::Duration::from_millis(deadline))
        .build()
        .unwrap_or_default()
}

async fn pve_get_json(url: &str, deadline: u64) -> Result<Value, String> {
    pve_client(deadline)
        .get(url)
        .header("Authorization", pve_token())
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json::<Value>()
        .await
        .map_err(|e| e.to_string())
}

/// `getVmTypeByVmid` (server.js:25831-25849) — activeFreeVms first, then
/// vm_applications.json (premium → lxc, else qemu), then the range heuristic.
pub(crate) fn get_vm_type_by_vmid(state: &AppState, vmid: f64) -> &'static str {
    for entry in state
        .active_free_vms
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .values()
    {
        if entry.get("vmid").and_then(jsval::number) == Some(vmid) {
            return "lxc";
        }
    }
    let apps = vm_applications(state);
    if let Some(map) = apps.as_object() {
        for app in map.values() {
            if app.get("vmid").and_then(jsval::number) == Some(vmid) {
                return if jsval::string(&jsval::or(app.get("tier"), json!(""))) == "premium" {
                    "lxc"
                } else {
                    "qemu"
                };
            }
        }
    }
    if (200.0..400.0).contains(&vmid) {
        "lxc"
    } else {
        "qemu"
    }
}

/// `getUserVmStatus` (server.js:25851-25907) — returns the JS shape:
/// `{success:true, status, ip}` or `{success:false, error}`. `None` would be
/// the JS null-from-deadline case; the JS folds timeouts into the error
/// objects shown below, which is what we return too.
pub(crate) async fn get_user_vm_status(state: &AppState, vmid: f64) -> Value {
    let token = pve_token();
    if token.is_empty() {
        return json!({ "success": false, "error": "Proxmox token not configured." });
    }
    let vmid_int = if vmid >= 0.0 && vmid.fract() == 0.0 {
        vmid as i64
    } else {
        return json!({ "success": false, "error": "invalid vmid" });
    };
    let type_ = get_vm_type_by_vmid(state, vmid);
    let url = format!(
        "{}/nodes/{}/{type_}/{vmid_int}/status/current",
        pve_url(),
        pve_node()
    );
    let res = match pve_client(5000)
        .get(&url)
        .header("Authorization", &token)
        .send()
        .await
    {
        Ok(r) => r,
        Err(_) => {
            // fetchWithDeadline null → 'Proxmox status fetch timed out'.
            return json!({ "success": false, "error": "Proxmox status fetch timed out" });
        }
    };
    if !res.status().is_success() {
        return json!({
            "success": false,
            "error": format!("Failed to fetch status: {}", res.status().as_u16())
        });
    }
    let data = match res.json::<Value>().await {
        Ok(v) => v,
        Err(e) => {
            return json!({ "success": false, "error": e.to_string() });
        }
    };

    let mut ip = String::new();
    if type_ == "lxc" {
        let suffix = if vmid >= 300.0 { vmid - 200.0 } else { vmid } as i64;
        ip = format!("10.0.0.{suffix}");
    } else if data
        .get("data")
        .and_then(|d| d.get("status"))
        .and_then(|s| s.as_str())
        == Some("running")
    {
        // QEMU guest agent IP probe (3s deadline).
        let agent_url = format!(
            "{}/nodes/{}/qemu/{vmid_int}/agent/network-get-interfaces",
            pve_url(),
            pve_node()
        );
        if let Ok(agent_res) = pve_client(3000)
            .get(&agent_url)
            .header("Authorization", &token)
            .send()
            .await
        {
            if agent_res.status().is_success() {
                if let Ok(agent_data) = agent_res.json::<Value>().await {
                    let result = agent_data
                        .get("data")
                        .and_then(|d| d.get("result"))
                        .and_then(|r| r.as_array())
                        .cloned()
                        .unwrap_or_default();
                    'outer: for iface in result {
                        let addrs = iface
                            .get("ip-addresses")
                            .and_then(|a| a.as_array())
                            .cloned()
                            .unwrap_or_default();
                        for addr in addrs {
                            let is_v4 = addr.get("ip-address-type").and_then(|t| t.as_str())
                                == Some("ipv4");
                            let ip_str = addr
                                .get("ip-address")
                                .and_then(|i| i.as_str())
                                .unwrap_or("");
                            if is_v4 && ip_str.starts_with("10.0.0.") {
                                ip = ip_str.to_string();
                                break 'outer;
                            }
                        }
                    }
                }
            }
        }
    }

    let suffix = if vmid >= 300.0 { vmid - 200.0 } else { vmid } as i64;
    let fallback_ip = format!("10.0.0.{suffix}");
    let status = data
        .get("data")
        .and_then(|d| d.get("status"))
        .and_then(|s| s.as_str())
        .map(str::to_string)
        .unwrap_or_else(|| "unknown".to_string());
    json!({
        "success": true,
        "status": status,
        "ip": if ip.is_empty() { fallback_ip } else { ip }
    })
}

/// `getVmConnectionIpForEmail` (server.js:25908-25927) — resolves the SSH/VNC
/// authorization IP for a user's VM: activeFreeVms, then an approved
/// vm_applications entry; out-of-range or unassigned → '' (denied).
pub(crate) async fn get_vm_connection_ip_for_email(state: &AppState, email: &str) -> String {
    let norm = mitch_lib::auth::normalize_email(email);
    let mut vmid: Option<f64> = None;
    {
        let free = state
            .active_free_vms
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        if let Some(entry) = free.get(&norm) {
            vmid = entry.get("vmid").and_then(jsval::number);
        }
    }
    if vmid.is_none() {
        let apps = vm_applications(state);
        let app = apps.get(&norm);
        if let Some(app) = app {
            if jsval::string(&jsval::or(app.get("status"), json!(""))) == "approved" {
                let candidate = app.get("vmid").and_then(jsval::number);
                if candidate.is_some() {
                    vmid = candidate;
                }
            }
        }
    }
    let Some(vmid) = vmid.filter(|v| is_vm_id_in_range(*v)) else {
        return String::new();
    };

    // KVM guests use DHCP — resolve the real address through the guest agent
    // before authorizing the bridge; LXC keeps the deterministic fallback.
    let status = get_user_vm_status(state, vmid).await;
    let ip = status
        .get("ip")
        .and_then(|i| i.as_str())
        .unwrap_or("")
        .to_string();
    if status
        .get("success")
        .and_then(|s| s.as_bool())
        .unwrap_or(false)
        && js_is_10_ip(&ip)
    {
        return ip;
    }
    let suffix = if vmid >= 300.0 { vmid - 200.0 } else { vmid } as i64;
    format!("10.0.0.{suffix}")
}

/// `/^10\.0\.0\.\d{1,3}$/` (server.js:25922).
fn js_is_10_ip(s: &str) -> bool {
    let Some(rest) = s.strip_prefix("10.0.0.") else {
        return false;
    };
    !rest.is_empty() && rest.len() <= 3 && rest.bytes().all(|b| b.is_ascii_digit())
}

// ── batch 3 landing zone ─────────────────────────────────────────────────────

/// Placeholder so the module compiles while the `/api/vm/*` provisioning
/// group is still on the bun side; the JS keeps no `Vm` object either.
pub struct Vm;

impl Vm {
    pub fn placeholder() -> Self {
        Self
    }
}

// ── the `/api/vm/*` dispatch — filled by Step 13 batch 3 ─────────────────────

pub(crate) fn handle(
    _state: &Arc<AppState>,
    _method: &Method,
    _path: &str,
    _search: &str,
    _body: &Value,
) -> Option<Response> {
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn vmid_range() {
        assert!(is_vm_id_in_range(200.0));
        assert!(is_vm_id_in_range(999.0));
        assert!(is_vm_id_in_range(350.0));
        assert!(!is_vm_id_in_range(199.0));
        assert!(!is_vm_id_in_range(1000.0));
        assert!(!is_vm_id_in_range(f64::NAN));
        assert!(!is_vm_id_in_range(1.0 / 0.0));
    }

    #[test]
    fn vm_type_fallback_range() {
        // Outside any registry (empty state), the JS falls to the range rule:
        // 200-399 → lxc, else qemu. get_vm_type_by_vmid with no state access
        // to free-VM apps resolves through vm_applications.json ({} here).
        let dir = std::env::temp_dir().join(format!(
            "mitch-server-vm-test-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(dir.join("data")).unwrap_or_default();
        std::fs::write(dir.join("vm_applications.json"), "{}").unwrap_or_default();
        let cfg = crate::hosts::SiteConfig::load();
        let cfg = crate::hosts::SiteConfig {
            data_dir: dir.to_path_buf(),
            ..cfg
        };
        let store = Arc::new(
            mitch_lib::data::DataStore::open(&dir, &dir).unwrap_or_else(|e| {
                panic!("store: {e}");
            }),
        );
        let state = AppState::new(cfg, Arc::clone(&store));
        assert_eq!(get_vm_type_by_vmid(&state, 250.0), "lxc");
        assert_eq!(get_vm_type_by_vmid(&state, 399.0), "lxc");
        assert_eq!(get_vm_type_by_vmid(&state, 400.0), "qemu");
        assert_eq!(get_vm_type_by_vmid(&state, 900.0), "qemu");
        // activeFreeVms wins first.
        state
            .active_free_vms
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .insert("a@b".to_string(), json!({ "vmid": 900.0 }));
        assert_eq!(get_vm_type_by_vmid(&state, 900.0), "lxc");
    }

    #[test]
    fn ten_ip_regex() {
        assert!(js_is_10_ip("10.0.0.5"));
        assert!(js_is_10_ip("10.0.0.123"));
        assert!(!js_is_10_ip("10.0.0.1234"));
        assert!(!js_is_10_ip("10.0.0."));
        assert!(!js_is_10_ip("10.0.0.x"));
        assert!(!js_is_10_ip("192.168.0.5"));
        assert!(!js_is_10_ip(""));
    }
}
