#!/usr/bin/env bash
#
# mitch-sshd-bootstrap.sh — Proxmox hookscript for student/premium LXC containers.
#
# Runs during pre-start on the Proxmox host (not inside the LXC). Writes a
# single sshd_config drop-in that overrides the distros' default
# `PermitRootLogin prohibit-password` so that root can actually log in
# with the password Proxmox stored at create time.
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

# Only run during pre-start, only for LXC.
if [ "$phase" != "pre-start" ]; then
  exit 0
fi
if [ "$vtype" != "lxc" ]; then
  exit 0
fi

case "$vmid" in
  ''|*[!0-9]*) log "skipping: invalid vmid '$vmid'"; exit 0 ;;
esac

ROOTFS="/var/lib/lxc/${vmid}/rootfs"
if [ ! -d "$ROOTFS" ]; then
  log "skipping: rootfs not present at $ROOTFS"
  exit 0
fi

# Drop-in overrides the distros' default PermitRootLogin prohibit-password
# so root password auth works. /etc/ssh/sshd_config.d/ Include is on
# by default on Debian 12 and Ubuntu 22.04+. The drop-in is small and
# idempotent — always rewrite.
install -d -m 0755 "${ROOTFS}/etc/ssh/sshd_config.d"
cat > "${ROOTFS}/etc/ssh/sshd_config.d/99-mitch.conf" <<'EOF'
# Managed by mitch.pro — do not edit by hand.
PermitRootLogin yes
EOF
chmod 0644 "${ROOTFS}/etc/ssh/sshd_config.d/99-mitch.conf"

log "sshd PermitRootLogin override installed for LXC ${vmid}"
exit 0
