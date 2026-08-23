#!/bin/bash
#
# tartarus-pct-exec-only.sh — replaces /usr/local/bin/pct-exec-only on
# tartarus (the Proxmox host). Used as the forced command for the
# existing bun-server ssh key on tartarus.
#
# Two allowed verbs:
#
#   1. pct exec <vmid> -- <command>
#      Strict allowlist for in-container exec, as before. vmid must be
#      3+ digits. Inner command must not contain shell metacharacters.
#
#   2. mitch-attach-hook <vmid>
#      New verb. Validates vmid ∈ [200, 999], then runs
#        pct set <vmid> --hookscript local:snippets/mitch-sshd-bootstrap.sh
#      The hookscript is the PermitRootLogin override that gets attached
#      to student/premium LXC containers.
#
# Install path on tartarus:
#   install -m 0755 tools/tartarus-pct-exec-only.sh \
#              /usr/local/bin/pct-exec-only
# (this overwrites the existing pct-exec-only; backup first if you have
#  a different version installed)
#
# Security note: this script is a forced command for an SSH key.
# Anything that doesn't match the two verbs above causes "Access Denied"
# and a non-zero exit, which sshd reports as a permission failure to the
# SSH client. The script never logs the requested command.
#
# We deliberately do NOT use `set -u` here: when this script runs as
# a forced command over an interactive SSH session (no command supplied
# on the command line, e.g. someone runs `ssh -i key user@host`), sshd
# invokes the script with no $SSH_ORIGINAL_COMMAND set. Under `set -u`
# that would print "SSH_ORIGINAL_COMMAND: unbound variable" and the
# connection would drop. Without `-u`, an unset $SSH_ORIGINAL_COMMAND
# is just an empty string and the Access Denied path runs cleanly.
set -eo pipefail
cmd="${SSH_ORIGINAL_COMMAND:-}"

# Verb 2: mitch-attach-hook <vmid>
# Validates the vmid is in the student/premium sandbox range, then runs
# the literal pct set command. The hookscript path is hardcoded here —
# it cannot be passed in.
if [[ "$cmd" =~ ^mitch-attach-hook[[:space:]]+([0-9]{3,})[[:space:]]*$ ]]; then
  vmid="${BASH_REMATCH[1]}"
  if (( vmid < 200 || vmid > 999 )); then
    echo "Forbidden vmid range for mitch-attach-hook: $vmid" >&2
    exit 1
  fi
  exec pct set "$vmid" --hookscript 'local:snippets/mitch-sshd-bootstrap.sh'
fi

# Verb 1: pct exec <vmid> -- <command>
# vmid must be 3+ digits. Inner command must not contain shell
# metacharacters or anything we don't want to allow to execute inside a
# container.
if [[ "$cmd" =~ ^pct[[:space:]]+exec[[:space:]]+([0-9]{3,})[[:space:]]+--[[:space:]]+(.+) ]]; then
  vmid="${BASH_REMATCH[1]}"
  inner="${BASH_REMATCH[2]}"
  # Reject any shell metacharacter in the inner command.
  if [[ "$inner" =~ [\`\$\|\;\&\<\>\(\)\{\}\!\*\?\\\"] ]]; then
    echo "Forbidden metacharacter in command" >&2
    exit 1
  fi
  # Reject well-known unsafe tokens.
  case "$inner" in
    *sudo*|*su[[:space:]]*|*'>'*|*'<'*|*'/'*|*..*|*../*)
      echo "Forbidden token in command" >&2
      exit 1
      ;;
  esac
  exec pct exec "$vmid" -- $inner
fi

echo "Access Denied" >&2
exit 1
