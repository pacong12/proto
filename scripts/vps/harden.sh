#!/usr/bin/env bash
# Hardening for the Goton API VPS (Ubuntu / Debian). Safe by default: without --apply it only prints
# what it would change. Re-running is harmless (idempotent).
#
#   sudo bash scripts/vps/harden.sh [--apply] [--deploy-user deploy] [--ssh-port 22]
#                                   [--cloudflare-only] [--app-dir /var/www/proto]
#
#   --cloudflare-only  allow HTTP/HTTPS only from Cloudflare IP ranges (use when every public
#                      hostname on this server is proxied through Cloudflare, orange cloud).
#
# Lock-out guards: SSH password/root login is disabled only when the deploy user already has an
# authorized key; the SSH port is allowed before the firewall is enabled; sshd config is validated
# with `sshd -t` before reload, and the current session is never dropped.
set -euo pipefail

APPLY=0
DEPLOY_USER="deploy"
SSH_PORT="22"
CLOUDFLARE_ONLY=0
APP_DIR="/var/www/proto"
while [ $# -gt 0 ]; do
  case "$1" in
    --apply) APPLY=1; shift ;;
    --deploy-user) DEPLOY_USER="$2"; shift 2 ;;
    --ssh-port) SSH_PORT="$2"; shift 2 ;;
    --cloudflare-only) CLOUDFLARE_ONLY=1; shift ;;
    --app-dir) APP_DIR="$2"; shift 2 ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
done

if [ "$(id -u)" -ne 0 ]; then echo "Run as root (sudo)." >&2; exit 2; fi
if ! command -v apt-get >/dev/null 2>&1; then echo "This script supports Debian/Ubuntu (apt) only." >&2; exit 2; fi

step() { printf '\n== %s\n' "$1"; }
run() {
  # Prints every command; executes it only with --apply.
  printf '  $ %s\n' "$*"
  if [ "$APPLY" -eq 1 ]; then "$@"; fi
}
write_file() {
  # write_file <path> <mode> <content>
  printf '  write %s (mode %s)\n' "$1" "$2"
  if [ "$APPLY" -eq 1 ]; then
    install -m "$2" /dev/null "$1"
    printf '%s\n' "$3" > "$1"
  fi
}

[ "$APPLY" -eq 1 ] && echo "Applying changes." || echo "Dry run: nothing is changed. Re-run with --apply."

step "Packages"
run apt-get update -qq
run env DEBIAN_FRONTEND=noninteractive apt-get install -y -qq ufw fail2ban unattended-upgrades

step "Automatic security updates"
write_file /etc/apt/apt.conf.d/20auto-upgrades 0644 'APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";'

step "SSH"
home="$(getent passwd "$DEPLOY_USER" | cut -d: -f6 || true)"
if [ -n "$home" ] && [ -s "$home/.ssh/authorized_keys" ]; then
  run chmod 700 "$home/.ssh"
  run chmod 600 "$home/.ssh/authorized_keys"
  run chown -R "$DEPLOY_USER:$DEPLOY_USER" "$home/.ssh"
  write_file /etc/ssh/sshd_config.d/10-goton-hardening.conf 0644 "# Managed by scripts/vps/harden.sh
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin no
PermitEmptyPasswords no
MaxAuthTries 3
LoginGraceTime 30
X11Forwarding no
AllowAgentForwarding no
ClientAliveInterval 300
ClientAliveCountMax 2"
  if [ "$APPLY" -eq 1 ]; then
    if sshd -t; then
      # reload keeps existing sessions open.
      if systemctl reload ssh 2>/dev/null || systemctl reload sshd 2>/dev/null; then
        echo "  sshd reloaded. Test a NEW session as $DEPLOY_USER before closing this one."
      else
        echo "  Could not reload sshd; run 'systemctl reload ssh' after checking the config." >&2
      fi
    else
      rm -f /etc/ssh/sshd_config.d/10-goton-hardening.conf
      echo "  sshd -t failed; hardening file removed, SSH unchanged." >&2
    fi
  fi
else
  echo "  SKIP: '$DEPLOY_USER' has no ~/.ssh/authorized_keys. Add a key and re-run; password and root"
  echo "        login stay enabled until then so you cannot lock yourself out."
fi

step "Firewall (ufw)"
run ufw default deny incoming
run ufw default allow outgoing
run ufw allow "$SSH_PORT/tcp" comment 'ssh'
run ufw limit "$SSH_PORT/tcp" comment 'ssh rate limit'
if [ "$CLOUDFLARE_ONLY" -eq 1 ]; then
  # Cloudflare publishes its proxy ranges; only they may reach the web ports.
  for range in $(curl -fsS https://www.cloudflare.com/ips-v4) $(curl -fsS https://www.cloudflare.com/ips-v6); do
    run ufw allow from "$range" to any port 80,443 proto tcp comment 'cloudflare'
  done
else
  run ufw allow 80/tcp comment 'http'
  run ufw allow 443/tcp comment 'https'
fi
run ufw --force enable
echo "  Note: Docker-published ports bypass ufw. docker-compose.yml binds API and Redis to 127.0.0.1."

step "fail2ban"
write_file /etc/fail2ban/jail.d/goton-sshd.local 0644 "[sshd]
enabled = true
port = $SSH_PORT
maxretry = 5
findtime = 10m
bantime = 1h
bantime.increment = true"
run systemctl enable --now fail2ban
run systemctl restart fail2ban

step "Kernel network hardening"
write_file /etc/sysctl.d/90-goton-hardening.conf 0644 "net.ipv4.tcp_syncookies = 1
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.default.accept_redirects = 0
net.ipv6.conf.all.accept_redirects = 0
net.ipv4.conf.all.send_redirects = 0
net.ipv4.conf.all.accept_source_route = 0
net.ipv4.icmp_echo_ignore_broadcasts = 1
kernel.kptr_restrict = 2
kernel.dmesg_restrict = 1"
run sysctl --system

step "Docker daemon"
if command -v docker >/dev/null 2>&1; then
  if [ -f /etc/docker/daemon.json ]; then
    echo "  SKIP: /etc/docker/daemon.json exists; merge these keys by hand:"
    echo '        "no-new-privileges": true, "live-restore": true,'
    echo '        "log-driver": "json-file", "log-opts": {"max-size": "10m", "max-file": "5"}'
  else
    write_file /etc/docker/daemon.json 0644 '{
  "no-new-privileges": true,
  "live-restore": true,
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "5" }
}'
    echo "  Restart docker in a maintenance window to apply: systemctl restart docker"
  fi
fi

step "Secrets"
if [ -f "$APP_DIR/.env" ]; then
  run chmod 600 "$APP_DIR/.env"
else
  echo "  SKIP: $APP_DIR/.env not found"
fi

printf '\nDone. Verify with: sudo bash scripts/vps/audit.sh --deploy-user %s\n' "$DEPLOY_USER"
