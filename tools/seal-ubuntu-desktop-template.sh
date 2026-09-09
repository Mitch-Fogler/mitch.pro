#!/usr/bin/env bash
set -euo pipefail

# Run on the Proxmox host after the desktop build has been visually verified.
TEMPLATE_ID="${1:-9010}"
BUILD_DIR="/var/lib/vz/desktop-template-build"
KEY="$BUILD_DIR/build-access"
[[ "$TEMPLATE_ID" =~ ^9[0-9]{3}$ ]] || { echo 'Use a template VMID between 9000 and 9999.'; exit 1; }
qm status "$TEMPLATE_ID" | grep -q 'running' || { echo "VM $TEMPLATE_ID must be running."; exit 1; }
[[ -f "$KEY" ]] || { echo 'Temporary build key not found.'; exit 1; }

GUEST_IP="$(qm guest cmd "$TEMPLATE_ID" network-get-interfaces \
  | jq -r '.[] | ."ip-addresses"[]? | select(."ip-address-type" == "ipv4" and (."ip-address" | startswith("127.") | not)) | ."ip-address"' \
  | head -n 1)"
[[ -n "$GUEST_IP" ]] || { echo 'Guest Agent did not report an IPv4 address.'; exit 1; }

ssh -o BatchMode=yes -o StrictHostKeyChecking=no -i "$KEY" "ubuntu@$GUEST_IP" 'sudo bash -s' <<'GUEST'
set -euo pipefail
install -d -m 0755 /etc/dconf/profile /etc/dconf/db/gdm.d /etc/dconf/db/local.d /etc/systemd/logind.conf.d
cat >/etc/dconf/profile/gdm <<'EOF'
user-db:user
system-db:gdm
file-db:/usr/share/gdm/greeter-dconf-defaults
EOF
cat >/etc/dconf/db/gdm.d/00-cloud-desktop <<'EOF'
[org/gnome/desktop/session]
idle-delay=uint32 0
[org/gnome/desktop/screensaver]
lock-enabled=false
[org/gnome/settings-daemon/plugins/power]
sleep-inactive-ac-type='nothing'
EOF
cat >/etc/dconf/db/local.d/00-cloud-desktop <<'EOF'
[org/gnome/desktop/session]
idle-delay=uint32 0
EOF
cat >/etc/systemd/logind.conf.d/10-cloud-desktop.conf <<'EOF'
[Login]
IdleAction=ignore
HandleLidSwitch=ignore
HandleLidSwitchExternalPower=ignore
EOF
dconf update
install -d -o root -g root -m 0755 /etc/skel/.config
touch /etc/skel/.config/gnome-initial-setup-done
passwd -l ubuntu >/dev/null
rm -f /home/ubuntu/.ssh/authorized_keys
rm -f /root/.bash_history /home/ubuntu/.bash_history
rm -f /etc/ssh/ssh_host_*
apt-get clean
cloud-init clean --logs --machine-id
sync
shutdown -h now
GUEST

for _ in $(seq 1 90); do
  qm status "$TEMPLATE_ID" | grep -q 'stopped' && break
  sleep 2
done
qm status "$TEMPLATE_ID" | grep -q 'stopped' || { echo 'Guest did not shut down in time.'; exit 1; }
qm set "$TEMPLATE_ID" --delete sshkeys
qm template "$TEMPLATE_ID"
rm -rf -- "$BUILD_DIR"
echo "Template $TEMPLATE_ID sealed successfully."
