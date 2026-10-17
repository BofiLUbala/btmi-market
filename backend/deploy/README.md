# Production server (Oracle Cloud Always Free)

TBK runs on one free Oracle Cloud VM: the whole `docker-compose.yml` stack plus
Caddy for HTTPS. Pushing to `main` redeploys it (`.github/workflows/deploy-server.yml`).

## 1. Create the VM (once, in the Oracle console)

1. Sign up at <https://signup.cloud.oracle.com> (a card is asked for identity
   only; Always Free resources are never billed). Pick a home region near your
   users — it cannot be changed later.
2. **Compute → Instances → Create instance**
   - Image: **Canonical Ubuntu 24.04**
   - Shape: **Ampere → VM.Standard.A1.Flex**, 4 OCPU, 24 GB RAM (all free).
     If it says "Out of capacity", try another availability domain or retry later.
   - Networking: keep "Assign a public IPv4 address".
   - SSH keys: download the generated private key (keep it safe).
   - Boot volume: 100 GB (free up to 200 GB).
3. **Networking → Virtual cloud networks → your VCN → Security → Default
   security list → Add ingress rules**: source `0.0.0.0/0`, TCP, destination
   ports `80,443`.

## 2. Set up the server (once)

```bash
ssh -i <downloaded-key> ubuntu@<public-ip>
curl -fsSL https://raw.githubusercontent.com/BofiLUbala/btmi-market/main/backend/deploy/setup-server.sh | bash
```

Then follow what it prints:

1. `nano /opt/btmi-market/backend/.env` — fill `SMTP_USER`, `SMTP_PASSWORD`
   and any optional keys you use (Moko, VAPID, OpenWA…). DB password, JWT
   secret and `SITE_DOMAIN` are already generated.
2. GitHub → repo **Settings → Secrets and variables → Actions**, add
   `SERVER_HOST` (public IP), `SERVER_USER` (`ubuntu`), `SERVER_SSH_KEY`
   (output of `cat ~/.ssh/github_deploy`). The old `AWS_*` secrets can be deleted.
3. Log out, log back in, and start the stack the first time:

   ```bash
   cd /opt/btmi-market/backend && docker compose --profile edge up -d --build
   ```

4. Create the super admin:

   ```bash
   docker compose exec api ./create-superadmin -name "Your Name" -email you@example.com -password '<strong password>'
   ```

The site is at `https://<ip-with-dashes>.sslip.io`, the API at
`https://<ip-with-dashes>.sslip.io/api/v1`. To use your own domain later, point
its DNS A record to the IP, set `SITE_DOMAIN` and `FRONTEND_URL` in `.env`, and
run `docker compose --profile edge up -d`.

## 3. Point the mobile app at it

In expo.dev → project → **Environment variables → production**, set
`EXPO_PUBLIC_API_URL=https://<ip-with-dashes>.sslip.io/api/v1`, then push to
`main` (or run the EAS production update workflow) so phones get it over the air.

## Day to day

- Logs: `cd /opt/btmi-market/backend && docker compose logs -f api`
- Manual redeploy: GitHub → Actions → *Deploy TBK to the server* → Run workflow.
- Database backup: `docker compose exec postgres pg_dump -U btmi_user btmi_market > backup.sql`
