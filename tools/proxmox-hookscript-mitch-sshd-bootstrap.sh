#!/usr/bin/env bash
#
# mitch-sshd-bootstrap.sh — Proxmox hookscript for student/premium LXC
# containers. Runs as root on the Proxmox host at pre-start.
#
# Writes /etc/ssh/sshd_config.d/99-mitch.conf inside the LXC rootfs via
# `pct push`, so the drop-in is in place before sshd inside the LXC ever
# starts. The drop-in overrides the distros' default
# `PermitRootLogin prohibit-password`, letting root log in with the
# password Proxmox stored at create time.
#
# Register this hook on a container by passing
#   hookscript: local:snippets/mitch-sshd-bootstrap.sh
# to pct create, or by adding the same line to /etc/pve/lxc/<vmid>.conf.
#
# Install path on a Proxmox host (one-time):
#   install -m 0755 tools/proxmox-hookscript-mitch-sshd-bootstrap.sh \
#              /var/lib/vz/snippets/mitch-sshd-bootstrap.sh
#
# Proxmox invokes this script with three positional args:
#   $1 phase   — pre-start | post-start | pre-stop | post-stop
#   $2 vmid    — numeric container id
#   $3 vtype   — lxc | qemu
#
# Always exit 0: a hook failure must not prevent the container from
# booting (Proxmox aborts the start on non-zero). Log to stderr so
# `pct start <vmid> --debug` surfaces it.

set -u

phase="${1:-}"
vmid="${2:-}"
vtype="${3:-}"

log() { printf '[mitch-sshd-hook] %s\n' "$*" >&2; }

# Only act during pre-start, only for LXC.
if [ "$phase" != "pre-start" ]; then
  exit 0
fi
if [ "$vtype" != "lxc" ]; then
  exit 0
fi

case "$vmid" in
  ''|*[!0-9]*) log "skipping: invalid vmid '$vmid'"; exit 0 ;;
esac

# Write the drop-in directly into the LXC rootfs via `pct push`. The
# script body is written to a temp file on the Proxmox host, then
# pushed into the LXC at /etc/ssh/sshd_config.d/99-mitch.conf. `pct push`
# is allowed at pre-start because the LXC is not running yet — PVE has
# prepared the rootfs but the container's userspace isn't up.
DROP_TMP="$(mktemp)"
trap 'rm -f "$DROP_TMP"' EXIT

cat > "$DROP_TMP" <<'DROPIN'
# Managed by mitch.pro — do not edit by hand.
PermitRootLogin yes
DROPIN

if ! pct push "$vmid" "$DROP_TMP" /etc/ssh/sshd_config.d/99-mitch.conf; then
  log "pct push failed for LXC $vmid — sshd drop-in not installed"
  exit 0
fi

log "sshd PermitRootLogin override installed for LXC ${vmid}"
exit 0