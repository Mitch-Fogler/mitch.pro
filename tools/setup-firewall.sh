#!/usr/bin/env bash
# tools/setup-firewall.sh
# Run this script on your Proxmox Host (tartarus) to secure and isolate the student VM subnet (10.0.0.0/24).
# It prevents student VMs (10.0.0.x) from initiating connections to your internal LAN/host networks (192.168.100.x),
# but allows LAN-to-VM traffic and outbound Internet NAT routing statefully using UFW.
#
# IMPORTANT: this script is a one-shot host bootstrap. It is not part of the app deploy.
# If you re-run it, UFW will not deduplicate identical rules but it will not error either.

set -euo pipefail

# 10.0.0.0/8 is the IANA-allocated RFC1918 block, but the student subnet lives INSIDE
# that /8. A blanket reject on 10.0.0.0/8 would also block forwarding to/from the
# student subnet itself, which is the opposite of what we want.
#
# We work around UFW's lack of negation in `route` rules by adding the explicit
# allow on the student subnet FIRST. UFW appends to the FORWARD chain in call order,
# so the more-specific allow matches before the broader /8 reject.

STUDENT_SUBNET="10.0.0.0/24"

echo "[firewall] Configuring UFW rules on Proxmox host..."

# 1. Forward Routing Isolation rules (UFW Route Filters)
# Allow local routing inside the student subnet itself (10.0.0.x local communication).
# MUST be added before the broad 10.0.0.0/8 reject below.
ufw route allow in on vmbr2 to "$STUDENT_SUBNET"

# Reject outgoing forwarding from vmbr2 to private management LAN subnets (RFC 1918).
# The student subnet is already permitted above; the broad 10.0.0.0/8 reject catches
# any other 10.x.y.z range that might be present on the host.
echo "[firewall] Blocking forwarding from vmbr2 to private networks (excluding student subnet)..."
ufw route reject in on vmbr2 to 192.168.0.0/16
ufw route reject in on vmbr2 to 172.16.0.0/12
ufw route reject in on vmbr2 to 10.0.0.0/8

# 2. Host input isolation (Protecting host ports on 10.0.0.1 directly)
echo "[firewall] Isolating hypervisor host ports from vmbr2..."
# Allow UDP DNS queries to host (so VMs can resolve addresses)
ufw allow in on vmbr2 to 10.0.0.1 port 53 proto udp
# Allow DHCP queries to host (so VMs can request IP)
ufw allow in on vmbr2 to 10.0.0.1 port 67 proto udp
# Reject all other input requests to Proxmox host from vmbr2
ufw reject in on vmbr2 to 10.0.0.1

# 3. Outbound NAT for the student subnet is handled by Proxmox's vmbr2 config
# (e.g. `post-up iptables -t nat -A POSTROUTING -s 10.0.0.0/24 -j MASQUERADE` in
# /etc/network/interfaces). UFW route rules do not touch the nat table.

echo "[firewall] Reloading UFW..."
ufw reload

echo "[firewall] UFW isolation rules applied successfully! Student containers are now isolated from the internal network."
