#!/usr/bin/env bash
#
# mitch-sshd-bootstrap.sh — Proxmox hookscript for student/premium LXC containers.
#
# Installs openssh-server and writes the mitch.pro PermitRootLogin override
# drop-in during pre-start, before Proxmox reports the container as running.
# Idempotent: skips the apt install if openssh-server is already present,
# always rewrites the drop-in.
#
# Register this hook on a container by passing
#   hookscript: local:snippets/mitch-sshd-bootstrap.sh
# to pct create, or by adding
#   hookscript: local:snippets/mitch-sshd-bootstrap.sh
# to /etc/pve/lxc/<vmid>.conf.
#
# Install path on a Proxmox host:
#   install -m 0755 tools/proxmox-hookscript-mitch-sshd-bootstrap.sh \
#              /var/lib/vz/snippets/mitch-sshd-bootstrap.sh
#
# Proxmox invokes this script with three positional args:
#   $1 phase   — pre-start | post-start | pre-stop | post-stop
#   $2 vmid    — numeric container id
#   $3 vtype   — lxc | qemu
#
# Exit 0 on everything; failures here must NOT prevent the container from
# booting (Proxmox aborts the start on a non-zero exit). Log to stderr
# so it shows up in `pct start <vmid> --debug` output.

set -u

phase="${1:-}"
vmid="${2:-}"
vtype="${3:-}"

log() { printf '[mitch-sshd-hook] %s\n' "$*" >&2; }

# Only run during pre-start, only for LXC. Anything else: no-op.
if [ "$phase" != "pre-start" ]; then
  exit 0
fi
if [ "$vtype" != "lxc" ]; then
  exit 0
fi

# Sanity check that vmid looks numeric. vmid may be empty if Proxmox changes
# its invocation conventions; bail rather than touch /var/lib/lxc/.
case "$vmid" in
  ''|*[!0-9]*) log "skipping: invalid vmid '$vmid'"; exit 0 ;;
esac

ROOTFS="/var/lib/lxc/${vmid}/rootfs"
if [ ! -d "$ROOTFS" ]; then
  log "skipping: rootfs not present at $ROOTFS"
  exit 0
fi

# Install openssh-server if missing. apt-get needs /proc, /dev, /sys mounted
# inside the chroot; Proxmox guarantees that for pre-start hooks.
if chroot "$ROOTFS" /usr/bin/dpkg -s openssh-server >/dev/null 2>&1; then
  log "openssh-server already installed in LXC ${vmid}"
else
  log "installing openssh-server in LXC ${vmid}"
  if ! chroot "$ROOTFS" /usr/bin/apt-get update -qq; then
    log "apt-get update failed; leaving container to boot anyway"
    exit 0
  fi
  if ! chroot "$ROOTFS" /usr/bin/apt-get install -y -qq --no-install-recommends openssh-server; then
    log "apt-get install openssh-server failed; leaving container to boot anyway"
    exit 0
  fi
fi

# Idempotent drop-in. /etc/ssh/sshd_config.d/ Include is on by default on
# Debian 12 and Ubuntu 22.04+ so this overrides the distros' default
# PermitRootLogin prohibit-password without touching sshd_config itself.
install -d -m 0755 "${ROOTFS}/etc/ssh/sshd_config.d"
cat > "${ROOTFS}/etc/ssh/sshd_config.d/99-mitch.conf" <<'EOF'
# Managed by mitch.pro — do not edit by hand.
PermitRootLogin yes
PasswordAuthentication yes
PubkeyAuthentication yes
UsePAM yes
EOF
chmod 0644 "${ROOTFS}/etc/ssh/sshd_config.d/99-mitch.conf"

# Make sure host keys exist (they may not on a freshly unpacked template).
if [ -x "${ROOTFS}/usr/bin/ssh-keygen" ]; then
  chroot "$ROOTFS" /usr/bin/ssh-keygen -A 2>/dev/null || true
fi

# Ensure /var/run/sshd exists so sshd can write its pidfile on first start.
install -d -m 0755 "${ROOTFS}/var/run/sshd"

# 4. Set the root password. Proxmox's `pct create --password X` writes the
#    password into /etc/pve/lxc/<vmid>.conf as `password: <plain>` (or stored
#    hashed depending on version), but only cloud-init-aware templates honor
#    it on first boot. Standard templates (debian-12-standard, etc.) leave
#    /etc/shadow with no usable root password, which makes ssh password
#    auth fail with "Permission denied" even though sshd is listening on :22.
#
#    This hookscript reads the password line directly out of /etc/pve/ and
#    chroots into the container's rootfs to run chpasswd, so root login
#    works regardless of whether the template has cloud-init.
#
#    The /etc/pve/ tree uses Proxmox's pmxcfs (a FUSE-backed config file
#    system); the password line format we care about is exactly:
#        password: <plaintext-password>
#    Older versions of PVE may store hashed passwords here; if so, the
#    container config would be unredable to us and we'd need a different
#    transport. The user's PVE version stores plain, so chpasswd works.
CONF="/etc/pve/lxc/${vmid}.conf"
if [ -r "$CONF" ]; then
  pw="$(awk -F': ' '/^password:[[:space:]]/ {print $2; exit}' "$CONF" 2>/dev/null || true)"
  if [ -n "$pw" ] && [ "$pw" != "*" ] && ! echo "$pw" | grep -qE '^\$'; then
    # Plain password found. chpasswd expects 'user:password' on stdin.
    if chroot "$ROOTFS" /usr/sbin/chpasswd <<EOF 2>/dev/null
root:${pw}
EOF
    then
      log "root password set for LXC ${vmid}"
    else
      log "chpasswd failed for LXC ${vmid}; root password not set"
    fi
    # Best-effort: wipe the password line from the config so it doesn't sit
    # around in plaintext on the host. Proxmox will rewrite it if the user
    # edits the VM config again via the GUI/API, but until then it's gone.
    if [ -w "$CONF" ]; then
      sed -i '/^password:[[:space:]]/d' "$CONF" 2>/dev/null || true
    fi
  else
    log "no usable password in $CONF; skipping chpasswd"
  fi
else
  log "$CONF not readable; cannot set root password"
fi

log "sshd bootstrap complete for LXC ${vmid}"
exit 0
