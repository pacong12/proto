# VPS Security Runbook

The API VPS runs Docker (`api`, `redis`) behind a reverse proxy. `docker-compose.yml` binds the API
(3011) and Redis (6380) to `127.0.0.1`, so only SSH and the web ports should be reachable.

## 1. Audit (read-only)

```bash
cd /var/www/proto
sudo bash scripts/vps/audit.sh --deploy-user deploy
```

It checks SSH, firewall, exposed ports, fail2ban, automatic updates, kernel network settings, Docker
defaults and `.env` secrets, prints `PASS` / `WARN` / `FAIL`, and exits non-zero on any `FAIL`.

## 2. Prepare the deploy user (before hardening)

The GitHub deploy (`deploy-vps.yml`) logs in as `VPS_USER` (default `deploy`) with `VPS_SSH_KEY`.

```bash
sudo adduser --disabled-password --gecos "" deploy
sudo usermod -aG docker deploy
sudo install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
# paste the public key that matches the VPS_SSH_KEY secret, plus your own key:
sudo nano /home/deploy/.ssh/authorized_keys
sudo chown deploy:deploy /home/deploy/.ssh/authorized_keys && sudo chmod 600 /home/deploy/.ssh/authorized_keys
sudo chown -R deploy:deploy /var/www/proto
```

Open a **new** terminal and confirm `ssh deploy@<vps>` works before continuing. Membership in the
`docker` group is root-equivalent, so keep that key only in GitHub secrets and your own machine.

## 3. Harden

```bash
sudo bash scripts/vps/harden.sh --deploy-user deploy            # dry run: prints the plan
sudo bash scripts/vps/harden.sh --deploy-user deploy --apply    # applies it
```

Add `--cloudflare-only` when every hostname served by this VPS is proxied by Cloudflare (orange
cloud): ports 80/443 then accept only Cloudflare's IP ranges. Use `--ssh-port <n>` if SSH is not on 22.

What it changes:

| Area        | Change                                                                                 |
| ----------- | -------------------------------------------------------------------------------------- |
| SSH         | key-only login, no root login, `MaxAuthTries 3`, no X11/agent forwarding, idle timeout |
| Firewall    | ufw deny incoming; allow SSH (rate-limited) and 80/443 (optionally Cloudflare only)    |
| Brute force | fail2ban `sshd` jail with increasing ban time                                          |
| Updates     | unattended security upgrades                                                           |
| Kernel      | SYN cookies, reverse-path filter, no ICMP redirects or source routing                  |
| Docker      | `no-new-privileges`, `live-restore`, log rotation (new `daemon.json` only)             |
| Secrets     | `.env` mode 600                                                                        |

Lock-out guards: SSH login is restricted only when the deploy user already has an authorized key,
the SSH port is allowed before the firewall is enabled, and `sshd -t` must pass before sshd reloads
(existing sessions stay open). Keep your current session open until a new login works.

After `--apply`: restart Docker in a maintenance window if `daemon.json` was created
(`sudo systemctl restart docker`), then run the audit again.

## 4. Afterwards

- Set the GitHub secret `VPS_USER=deploy` (the deploy workflow no longer needs root).
- Rotate any secret that was ever stored in a world-readable `.env`.
- Review `sudo fail2ban-client status sshd` and `sudo ufw status verbose` periodically.
- If the API hostname is proxied by Cloudflare, set SSL/TLS mode to **Full (strict)**.
