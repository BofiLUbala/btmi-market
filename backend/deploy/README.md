# Production server

TBK runs on one Akamai (Linode) VM: the whole `docker-compose.yml` stack plus
Caddy for HTTPS. Pushing to `main` redeploys it (`.github/workflows/deploy-server.yml`).

| | |
|---|---|
| Server | Linode `tbk-prod`, Linode 8 GB (4 CPU, 8 GB RAM), Frankfurt |
| IP | `139.162.131.34` (SSH as `root`, key only) |
| Website | <https://139-162-131-34.sslip.io> |
| API | <https://139-162-131-34.sslip.io/api/v1> |
| Admin | <https://139-162-131-34.sslip.io/admin> |
| Code on the server | `/opt/btmi-market` (settings in `backend/.env`) |

`<ip-with-dashes>.sslip.io` is a free hostname that always resolves to the IP,
so Caddy can get a Let's Encrypt certificate without a domain of our own.

## Day to day

```bash
ssh root@139.162.131.34
cd /opt/btmi-market/backend
docker compose --profile edge ps          # what is running
docker compose logs -f api                # API logs
docker compose exec postgres pg_dump -U btmi_user btmi_market > backup.sql
```

- Manual redeploy: GitHub → Actions → *Deploy TBK to the server* → Run workflow.
- Phone update without a code change: GitHub → Actions → *TBK Production OTA
  Update* → Run workflow.

## Moving to a new server

1. Create an Ubuntu 24.04 server with at least 8 GB RAM and your SSH key, and
   allow ports 22, 80 and 443 in any provider firewall.
2. Run the setup script on it, then follow what it prints (fill `SMTP_*` in
   `.env`, start the stack):

   ```bash
   curl -fsSL https://raw.githubusercontent.com/BofiLUbala/btmi-market/main/backend/deploy/setup-server.sh | bash
   ```

3. Create the super admin (or move it with `-update` if one exists):

   ```bash
   docker compose exec api ./create-superadmin -name "Your Name" -email you@example.com -password '<strong password>'
   ```

4. Update the GitHub secrets `SERVER_HOST`, `SERVER_USER` and `SERVER_SSH_KEY`
   (`cat ~/.ssh/github_deploy` on the server).
5. Set `EXPO_PUBLIC_API_URL=https://<ip-with-dashes>.sslip.io/api/v1` in the
   EAS `production` and `preview` environments, run both OTA update workflows,
   and update the address in this file.

To use your own domain later, point its DNS A record to the IP, set
`SITE_DOMAIN` and `FRONTEND_URL` in `.env`, and run
`docker compose --profile edge up -d`.
