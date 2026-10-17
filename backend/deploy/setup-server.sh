#!/usr/bin/env bash
# One-time setup of a fresh Ubuntu 24.04 server (ARM or x86) for TBK. Run it
# as the server's default admin user (root on Akamai/Linode):
#
#   curl -fsSL https://raw.githubusercontent.com/BofiLUbala/btmi-market/main/backend/deploy/setup-server.sh | bash
#
# It installs Docker, clones the repo to /opt/btmi-market, writes backend/.env
# with fresh secrets, opens ports 80/443 and creates the SSH key GitHub Actions
# deploys with. Safe to re-run: it keeps an existing .env and key.
set -euo pipefail

REPO_URL=https://github.com/BofiLUbala/btmi-market.git
APP_DIR=/opt/btmi-market
ENV_FILE=$APP_DIR/backend/.env
DEPLOY_KEY=$HOME/.ssh/github_deploy
export DEBIAN_FRONTEND=noninteractive

echo "==> Packages"
sudo -E apt-get update -y
sudo -E apt-get install -y git curl openssl iptables-persistent
if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sudo sh
fi
sudo usermod -aG docker "$USER"

echo "==> Swap (keeps the web build alive on small shapes)"
if ! swapon --show | grep -q /swapfile; then
  sudo fallocate -l 4G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
fi

echo "==> Firewall: allow HTTP and HTTPS"
# Some providers' Ubuntu images reject every inbound port but 22 in iptables;
# a provider-side firewall, if any, must allow 80 and 443 too.
for port in 80 443; do
  sudo iptables -C INPUT -p tcp --dport "$port" -j ACCEPT 2>/dev/null ||
    sudo iptables -I INPUT 1 -p tcp --dport "$port" -j ACCEPT
done
sudo netfilter-persistent save

echo "==> Code"
if [ ! -d "$APP_DIR/.git" ]; then
  sudo mkdir -p "$APP_DIR"
  sudo chown "$USER:$USER" "$APP_DIR"
  git clone "$REPO_URL" "$APP_DIR"
fi

PUBLIC_IP=$(curl -4 -fsS https://ifconfig.me)

echo "==> backend/.env"
set_env() { # key value: replace the line, or append it
  if grep -q "^$1=" "$ENV_FILE"; then
    sed -i "s|^$1=.*|$1=$2|" "$ENV_FILE"
  else
    echo "$1=$2" >> "$ENV_FILE"
  fi
}
if [ ! -f "$ENV_FILE" ]; then
  cp "$APP_DIR/backend/.env.example" "$ENV_FILE"
  SITE_DOMAIN=${PUBLIC_IP//./-}.sslip.io
  set_env APP_ENV production
  set_env DB_PASSWORD "$(openssl rand -hex 24)"
  set_env JWT_SECRET "$(openssl rand -hex 48)"
  set_env SITE_DOMAIN "$SITE_DOMAIN"
  set_env FRONTEND_URL "https://$SITE_DOMAIN"
  # Only Caddy (80/443) is public; Docker would otherwise publish these on
  # every interface, past the firewall.
  set_env API_PORT 127.0.0.1:8080
  set_env WEB_PORT 127.0.0.1:5173
  chmod 600 "$ENV_FILE"
fi

echo "==> SSH key for GitHub Actions"
if [ ! -f "$DEPLOY_KEY" ]; then
  ssh-keygen -t ed25519 -N "" -C "github-actions-deploy" -f "$DEPLOY_KEY"
  cat "$DEPLOY_KEY.pub" >> "$HOME/.ssh/authorized_keys"
fi

SITE_DOMAIN=$(grep '^SITE_DOMAIN=' "$ENV_FILE" | cut -d= -f2)
cat <<EOF

Done. Next steps (also in backend/deploy/README.md):

1. Fill SMTP_USER and SMTP_PASSWORD (and any other keys you use) in:
     nano $ENV_FILE
2. Add these GitHub repository secrets (Settings > Secrets and variables > Actions):
     SERVER_HOST     = $PUBLIC_IP
     SERVER_USER     = $USER
     SERVER_SSH_KEY  = the whole private key printed by:  cat $DEPLOY_KEY
3. Log out and back in (docker group), then start everything once:
     cd $APP_DIR/backend && docker compose --profile edge up -d --build
4. Your site will be at https://$SITE_DOMAIN and the API at
   https://$SITE_DOMAIN/api/v1
EOF
