# Short AWS classroom demo

Run the existing React interface, Node bridge and real C server together on one
Ubuntu EC2 instance. Nginx provides HTTPS and WebSocket forwarding. Neither the
C port (8080) nor bridge port (3001) is public. No database is required.

## Before launching

Use the AWS **Free plan**, check the actual remaining credits in Billing, and
stay within them. EC2, its disk and public IPv4 use credits; this is not permanent
free hosting. Do not upgrade the plan for this demo. A small x86-64 instance with
2 GB RAM, Ubuntu Server 24.04 LTS and an 8 GB encrypted gp3 disk is sufficient for
a modest classroom demo. Use standard CPU credits rather than Unlimited to avoid
surplus CPU charges. Exact eligible instance types and prices depend on region.

Allow inbound TCP **80 and 443** from the internet; allow SSH **22 only from
your current public IP /32**. Do not open 3001, 5173 or 8080. Use an SSH key you
control and keep the private key outside the repository. Require IMDSv2. Enable
Delete on termination for the demo disk. No load balancer, NAT gateway, database
or Elastic IP is needed.

Use your own domain with an A record pointing at the public IPv4, or a temporary
free hostname such as `conecurrency.203-0-113-10.sslip.io` with the example IP
replaced by the instance's real IP. sslip.io/nip.io is a third-party DNS service;
availability and certificate issuance are not guaranteed. Verify the hostname
resolves correctly before installing. A normal stop/start can change the IPv4,
which also changes this temporary hostname. Keep the server running for the demo.

## Install a reviewed revision

On the instance, clone the repository and check out the reviewed deployment
branch or commit containing these files. From its root run:

```sh
# Replace this with the real hostname. Ports 80/443 must already be reachable.
sudo bash deploy/install_ubuntu.sh conecurrency.YOUR-IP-WITH-DASHES.sslip.io
```

The installer supports Ubuntu 22.04 and 24.04, installs Node.js 22 from the
signed NodeSource repository, builds and tests the real C and web components,
and installs a dedicated unprivileged systemd service. It deploys **committed
source only**, records the revision, generates a private random admin password
on the server and obtains a Let's Encrypt certificate with HTTP-to-HTTPS
redirects. An existing admin password is preserved on subsequent runs.

The install command must finish successfully; a running Node process alone is
not deployment verification. See `/var/log/letsencrypt/letsencrypt.log` if
certificate issuance fails. Do not log in as admin over plain HTTP.

```sh
sudo systemctl status conecurrency nginx --no-pager
sudo journalctl -u conecurrency -n 60 --no-pager
# View privately; do not paste this output into chat or commit it.
sudo cat /etc/conecurrency/environment
```

Open the HTTPS link, choose Team admin and use the generated ADMIN_PASSWORD.
Open a round before classmates start ordering. Share the HTTPS link, not the
password. Sequential mode with many customers and a long preparation delay can
exceed the existing 5-second order timeout; start with 100 ms preparation for a
large class and use a small controlled group for slower sequential demonstrations.

## Verify through the public URL

The default check reads the public page and verifies admin protection without
changing rounds:

```sh
cd /opt/conecurrency/current
node deploy/check_public.mjs https://YOUR-HOSTNAME
```

Before sharing with the class, explicitly allow the full check to **replace the
round and consume test cones**. This tests real managed sequential/concurrent
rounds, three separate students, stock depletion without overselling, order
history, admin-only mode changes, reset, secure cookies and the WSS connection.
It loads the password locally, without placing it in command-line arguments.

```sh
sudo bash -c 'set -a; source /etc/conecurrency/environment; set +a; cd /opt/conecurrency/current; node deploy/check_public.mjs "$1" --verify-workflows' _ https://YOUR-HOSTNAME
```

Then try the public page from a separate phone on mobile data: join with a name,
place an order and check the result. Have an admin start a fresh round after the
checks. The automated check verifies APIs and WSS; this phone check verifies the
actual classroom screen and an independent network.

Sessions, order history and inventory are deliberately in memory. Restarting the
bridge signs everyone out and requires an admin to start another round. The
service automatically starts after reboot; it does not automatically open a round.

## End the demo

Stop the instance when temporarily unused. Stopping stops compute billing but
the disk still uses credits. After the final demo, terminate the **named demo
instance** and confirm its attached demo disk was deleted. Do not delete shared
resources. The public link will stop working. Check Billing afterward.

Deployment is only confirmed after the public HTTPS and workflow checks pass.
Local Windows checks cannot verify systemd, nginx, certificates or the real Linux
C executable; these must run on the Ubuntu instance.

Official references: [AWS Free Tier](https://aws.amazon.com/free/),
[EC2 connection methods](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-instance-connect-methods.html),
[NodeSource](https://github.com/nodesource/distributions),
[temporary DNS service](https://sslip.io/).

## Preparation checks (18 November 2026)

On Windows with Node.js 22: type checking and production build passed; 98 web
checks passed with the real-C check skipped; 12 browser scenarios passed against
the mock backend. An initial browser page-load timeout did not repeat on the
second run. Two new integration checks cover same-origin HTTPS forwarding,
secure cookies and admin protection through a local proxy. Runtime-only npm
audit found no vulnerabilities; inherited development-tool advisories remain.
The Ubuntu installer passed Bash syntax checking and the public workflow script
passed Node syntax checking. These are preparation results: the Ubuntu install,
real C execution, certificate issuance and public deployment are unverified
until performed on the AWS instance.
