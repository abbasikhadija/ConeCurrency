#!/usr/bin/env bash
# Run from a committed checkout on a dedicated Ubuntu demo instance.
set -euo pipefail
if [[ $EUID != 0 ]]; then echo 'Run with sudo.' >&2; exit 1; fi
if [[ $# != 1 || ! $1 =~ ^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$ || $1 != *.* ]]; then
    echo 'Usage: sudo bash deploy/install_ubuntu.sh PUBLIC_DNS_HOSTNAME' >&2; exit 1
fi
hostname=$1
source /etc/os-release
if [[ $ID != ubuntu || ! $VERSION_ID =~ ^(22.04|24.04)$ ]]; then
    echo 'Use Ubuntu 22.04 or 24.04.' >&2; exit 1
fi
repo=$(cd "$(dirname "$0")/.." && pwd)
commit=$(git -c safe.directory="$repo" -C "$repo" rev-parse HEAD)
base=/opt/conecurrency
release="$base/releases/$commit"
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y build-essential git python3 curl ca-certificates gnupg nginx certbot python3-certbot-nginx openssl

# Node 22 from NodeSource's signed repository (Ubuntu's default may be older).
if ! command -v node >/dev/null || [[ $(node -p 'process.versions.node.split(".")[0]') != 22 ]]; then
    install -d -m 0755 /etc/apt/keyrings
    curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key |
        gpg --dearmor --yes -o /etc/apt/keyrings/conecurrency-nodesource.gpg
    chmod 0644 /etc/apt/keyrings/conecurrency-nodesource.gpg
    arch=$(dpkg --print-architecture)
    printf 'deb [arch=%s signed-by=/etc/apt/keyrings/conecurrency-nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main\n' "$arch" > /etc/apt/sources.list.d/conecurrency-nodesource.list
    apt-get update
    apt-get install -y nodejs
fi
if [[ $(node -p 'process.versions.node.split(".")[0]') != 22 ]]; then
    echo 'Node.js 22 is required.' >&2; exit 1
fi
if ! id conecurrency >/dev/null 2>&1; then
    useradd --system --home-dir /var/lib/conecurrency --create-home --shell /usr/sbin/nologin conecurrency
fi
install -d -m 0755 "$base/releases"
if [[ ! -f $release/.deployment-ready ]]; then
    install -d -o conecurrency -g conecurrency -m 0755 "$release"
    # Only committed source is copied: no local secrets, handover files or caches.
    git -c safe.directory="$repo" -C "$repo" archive "$commit" | tar -x -C "$release"
    chown -R conecurrency:conecurrency "$release"
    runuser -u conecurrency -- bash -euo pipefail -c 'cd "$1"; make all; make test' _ "$release"
    runuser -u conecurrency -- bash -euo pipefail -c 'cd "$1/web"; npm ci --include=dev --no-fund; npm run lint; npm run build; REAL_C_SERVER="$1/ticket-server" npm test -- --maxWorkers=2 --minWorkers=1' _ "$release"
    touch "$release/.deployment-ready"
    chown -R root:root "$release"
fi
install -d -m 0700 /etc/conecurrency
if [[ ! -f /etc/conecurrency/environment ]]; then
    umask 077
    {
        printf 'ADMIN_PASSWORD=%s\n' "$(openssl rand -hex 24)"
        printf '%s\n' 'NODE_ENV=production' 'BRIDGE_HOST=127.0.0.1' 'BRIDGE_PORT=3001' 'BACKEND_HOST=127.0.0.1' 'BACKEND_PORT=8080' 'MANAGE_BACKEND=1' 'C_SERVER_PATH=../ticket-server'
    } > /etc/conecurrency/environment
fi
ln -sfn "$release" "$base/current"
cat > /etc/systemd/system/conecurrency.service <<'UNIT'
[Unit]
Description=ConeCurrency classroom demo
After=network.target

[Service]
Type=simple
User=conecurrency
Group=conecurrency
WorkingDirectory=/opt/conecurrency/current/web
EnvironmentFile=/etc/conecurrency/environment
ExecStart=/usr/bin/node --import tsx server/index.ts
Restart=on-failure
RestartSec=3
TimeoutStopSec=20
KillMode=mixed
NoNewPrivileges=true
PrivateTmp=true
ProtectHome=true
ProtectSystem=strict
UMask=0077

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable conecurrency
systemctl restart conecurrency
for attempt in {1..30}; do
    if curl --fail --silent http://127.0.0.1:3001/api/session >/dev/null; then break; fi
    sleep 1
done
curl --fail --silent http://127.0.0.1:3001/api/session >/dev/null

# Host and HTTPS forwarding preserve same-origin checks and secure cookies.
cat > /etc/nginx/conf.d/conecurrency.conf <<NGINX
map \$http_upgrade \$conecurrency_upgrade {
    default upgrade;
    '' close;
}
server {
    listen 80;
    server_name $hostname;
    client_max_body_size 16k;
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Forwarded-For \$remote_addr;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection \$conecurrency_upgrade;
        proxy_read_timeout 90s;
    }
}
NGINX
nginx -t
systemctl enable --now nginx
systemctl reload nginx
# No email is published or required; certbot's system timer handles renewal.
certbot --nginx --non-interactive --agree-tos --register-unsafely-without-email --redirect -d "$hostname"
curl --fail --silent "https://$hostname/api/session" >/dev/null
printf '%s\n' "$commit" > /etc/conecurrency/revision
printf 'Ready for workflow verification: https://%s\n' "$hostname"
echo 'Admin password is stored only in /etc/conecurrency/environment (root access).'
echo 'No round is running yet. Sign in as admin to open the shop.'
