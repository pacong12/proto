#!/usr/bin/env bash
# Read-only security audit for the Goton API VPS. Changes nothing; prints PASS / WARN / FAIL lines.
#
#   sudo bash scripts/vps/audit.sh [--deploy-user deploy] [--app-dir /var/www/proto]
#
# Exit code: 0 when there is no FAIL, 1 otherwise.
set -uo pipefail

DEPLOY_USER="deploy"
APP_DIR="/var/www/proto"
while [ $# -gt 0 ]; do
  case "$1" in
    --deploy-user) DEPLOY_USER="$2"; shift 2 ;;
    --app-dir) APP_DIR="$2"; shift 2 ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
done

FAILS=0
pass() { printf '  PASS  %s\n' "$1"; }
warn() { printf '  WARN  %s\n' "$1"; }
fail() { printf '  FAIL  %s\n' "$1"; FAILS=$((FAILS + 1)); }
section() { printf '\n== %s\n' "$1"; }

if [ "$(id -u)" -ne 0 ]; then
  echo "Run as root (sudo) so sshd, firewall and file permissions can be read." >&2
  exit 2
fi

sshd_value() {
  # Effective sshd setting (includes drop-in files); empty when sshd is unavailable.
  sshd -T 2>/dev/null | awk -v key="$1" '$1 == key { print $2; exit }'
}

section "SSH"
if command -v sshd >/dev/null 2>&1; then
  [ "$(sshd_value passwordauthentication)" = "no" ] && pass "password login disabled" \
    || fail "password login enabled (PasswordAuthentication yes)"
  case "$(sshd_value permitrootlogin)" in
    no) pass "root login disabled" ;;
    prohibit-password | without-password) warn "root can log in with a key (PermitRootLogin prohibit-password)" ;;
    *) fail "root can log in with a password" ;;
  esac
  [ "$(sshd_value kbdinteractiveauthentication)" = "no" ] && pass "keyboard-interactive login disabled" \
    || warn "keyboard-interactive login enabled"
  max_tries="$(sshd_value maxauthtries)"
  [ -n "$max_tries" ] && [ "$max_tries" -le 4 ] && pass "MaxAuthTries $max_tries" \
    || warn "MaxAuthTries ${max_tries:-unknown} (recommended <= 4)"
  [ "$(sshd_value x11forwarding)" = "no" ] && pass "X11 forwarding disabled" || warn "X11 forwarding enabled"
else
  warn "sshd not found"
fi

if id "$DEPLOY_USER" >/dev/null 2>&1; then
  home="$(getent passwd "$DEPLOY_USER" | cut -d: -f6)"
  if [ -s "$home/.ssh/authorized_keys" ]; then
    pass "$DEPLOY_USER has authorized SSH keys"
    perms="$(stat -c %a "$home/.ssh/authorized_keys")"
    [ "$perms" = "600" ] && pass "authorized_keys mode 600" || warn "authorized_keys mode $perms (want 600)"
  else
    fail "$DEPLOY_USER has no authorized SSH keys"
  fi
  if id -nG "$DEPLOY_USER" | tr ' ' '\n' | grep -qx docker; then
    warn "$DEPLOY_USER is in the docker group (root-equivalent); keep its key limited to CI"
  fi
else
  fail "deploy user '$DEPLOY_USER' does not exist"
fi

section "Firewall"
if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
  pass "ufw active"
  ufw status verbose | grep -qE "^Default: deny \(incoming\)" \
    && pass "incoming traffic denied by default" || warn "incoming default is not deny"
  ufw status | grep -qE "3011|6380" && fail "API (3011) or Redis (6380) port opened in ufw" \
    || pass "API and Redis ports not opened in ufw"
else
  fail "ufw not active"
fi

section "Exposed ports (listening on all interfaces)"
if command -v ss >/dev/null 2>&1; then
  public="$(ss -Htlnp 2>/dev/null | awk '{print $4}' | grep -vE '^(127\.|\[::1\]|::1)' | sed 's/.*://' | sort -un | tr '\n' ' ')"
  printf '  INFO  public TCP ports: %s\n' "${public:-none}"
  echo "$public" | grep -qwE '3011|6380|6379' && fail "API or Redis listens on a public interface" \
    || pass "API and Redis bound to localhost only"
fi

section "Intrusion protection and updates"
systemctl is-active --quiet fail2ban && pass "fail2ban running" || fail "fail2ban not running"
if command -v fail2ban-client >/dev/null 2>&1 && fail2ban-client status sshd >/dev/null 2>&1; then
  pass "fail2ban sshd jail enabled"
else
  warn "fail2ban sshd jail not enabled"
fi
if [ -f /etc/apt/apt.conf.d/20auto-upgrades ] && grep -q 'Unattended-Upgrade "1"' /etc/apt/apt.conf.d/20auto-upgrades; then
  pass "unattended security upgrades enabled"
else
  fail "unattended security upgrades disabled"
fi
if [ -f /var/run/reboot-required ]; then warn "reboot required to finish updates"; else pass "no pending reboot"; fi

section "Kernel network hardening"
check_sysctl() {
  local value
  value="$(sysctl -n "$1" 2>/dev/null)"
  [ "$value" = "$2" ] && pass "$1 = $2" || warn "$1 = ${value:-unset} (want $2)"
}
check_sysctl net.ipv4.tcp_syncookies 1
check_sysctl net.ipv4.conf.all.rp_filter 1
check_sysctl net.ipv4.conf.all.accept_redirects 0
check_sysctl net.ipv4.conf.all.send_redirects 0
check_sysctl net.ipv4.conf.all.accept_source_route 0

section "Docker"
if command -v docker >/dev/null 2>&1; then
  if [ -f /etc/docker/daemon.json ]; then
    grep -q '"no-new-privileges": *true' /etc/docker/daemon.json && pass "no-new-privileges default" \
      || warn "no-new-privileges not set in daemon.json"
    grep -q '"log-opts"' /etc/docker/daemon.json && pass "container log rotation configured" \
      || warn "container log rotation not configured"
  else
    warn "/etc/docker/daemon.json missing (no log rotation / no-new-privileges)"
  fi
  root_containers="$(docker ps --format '{{.Names}}' | while read -r c; do
    u="$(docker inspect -f '{{.Config.User}}' "$c")"
    [ -z "$u" ] || [ "$u" = "root" ] || [ "$u" = "0" ] && echo "$c"
  done | tr '\n' ' ')"
  [ -z "$root_containers" ] && pass "no container configured to run as root" \
    || warn "containers without a non-root user: $root_containers (redis image, API drops privileges in entrypoint)"
fi

section "Secrets"
if [ -f "$APP_DIR/.env" ]; then
  perms="$(stat -c %a "$APP_DIR/.env")"
  case "$perms" in 600 | 640 | 400) pass ".env mode $perms" ;; *) fail ".env mode $perms (want 600)" ;; esac
  grep -qE '^REDIS_PASSWORD=.{16,}' "$APP_DIR/.env" && pass "REDIS_PASSWORD set" || fail "REDIS_PASSWORD missing or short"
  grep -qE '^SESSION_SECRET=.{32,}' "$APP_DIR/.env" && pass "SESSION_SECRET set" || fail "SESSION_SECRET missing or short"
else
  warn "$APP_DIR/.env not found"
fi

printf '\n%s\n' "$([ "$FAILS" -eq 0 ] && echo 'Result: no FAIL findings.' || echo "Result: $FAILS FAIL finding(s).")"
[ "$FAILS" -eq 0 ]
