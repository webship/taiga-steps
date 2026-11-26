#!/usr/bin/env bash
# Build the test site of this pack in a DDEV project: Taiga's own images as its reference setup runs them (its back
# end, the back end's Celery worker, its front end, its events, its protected media, the nginx gateway and the two
# RabbitMQ), every image pinned, on the project's own PostgreSQL 12; an administrator of this site (its password made
# for this site, kept in the site's folder, never printed), the accounts of the suite in their roles of the Scrum
# project Webship site, and the sample content the features read (Sprint 1, three user stories, an assignee, a tag, a
# comment and a task). It is what CI runs; on a machine with Docker, DDEV and 2 GB of free memory it makes the same site.
#
#   SITE_DIR=<folder>        where the project goes (default: ../taiga-site beside the pack)
#   COUNTS_ONLY=1            build nothing: print what the site holds, one count a line (a run must leave them)
#   TIDY_ONLY=1              build nothing: remove what a stopped run left ("Webship test …" user stories, tasks,
#                            sprints and comments of the suite's accounts in Webship site)
#
# The site answers at https://taigasteps.ddev.site, the address cucumber.js opens by default. The site script
# (site/taiga-site.py), the services (site/docker-compose.taiga.yaml) and the gateway's routes (site/taiga-gateway.conf)
# are the ones of the Webship Workspace's Taiga plugin: the script runs with Taiga's own code in its back end's
# container, and what it reads (the accounts, their passwords) comes on its input.
set -euo pipefail

PACK="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SITE_DIR="${SITE_DIR:-${PACK}/../taiga-site}"
NAME=taigasteps
PASSWORD='dD.123123ddd'

# The payload of the site script, on its input: the accounts of the suite, in their roles of Webship site.
payload() {
  python3 - "${PASSWORD}" <<'PYEOF'
import base64, json, sys
password = sys.argv[1]
rows = [{'login': login, 'mail': login + '@example.com', 'password': password, 'name': login.capitalize() + ' Test', 'role': role, 'action': ''}
        for login, role in [('owner', 'owner'), ('member', 'member'), ('reader', 'reader'), ('stranger', '')]]
print(base64.b64encode(json.dumps({'rows': rows, 'login': ''}).encode()).decode())
PYEOF
}

# A verb of the site script, with Taiga's own code in its back end's container; its input reaches it.
site() {
  ( cd "${SITE_DIR}" && ddev exec -s taiga-back "cd /taiga-back && TAIGA_SITE_VERB=$1 TAIGA_SITE_FLAG=${2:-} python manage.py shell -c \"exec(open('/opt/webship/taiga-site.py').read())\"" )
}

if [ "${COUNTS_ONLY:-}" = 1 ] ; then
  site counts < /dev/null | tr -d '\r' | grep -E '^[a-z ]+ [0-9]+$'
  exit 0
fi
if [ "${TIDY_ONLY:-}" = 1 ] ; then
  payload | site tidy | tr -d '\r'
  exit 0
fi

secret() { head -c 400 /dev/urandom | base64 -w0 | tr -dc 'A-Za-z0-9' | head -c "$1" ; }

mkdir -p "${SITE_DIR}/taiga" "${SITE_DIR}/.ddev"
SITE_DIR="$(cd "${SITE_DIR}" && pwd)"
cd "${SITE_DIR}"
# The project's database is its own db service on PostgreSQL 12, the major version Taiga's reference pins.
ddev config --project-type=generic --project-name="${NAME}" --database=postgres:12 --nodejs-version=24 < /dev/null

cp "${PACK}/site/taiga-site.py" taiga/
cp "${PACK}/site/taiga-gateway.conf" taiga/gateway.conf
cp "${PACK}/site/docker-compose.taiga.yaml" .ddev/
printf '%s\n' 'TAIGA_BACK_IMAGE=docker.io/taigaio/taiga-back:6.10.2' 'TAIGA_FRONT_IMAGE=docker.io/taigaio/taiga-front:6.10.3' \
  'TAIGA_EVENTS_IMAGE=docker.io/taigaio/taiga-events:6.10.0' 'TAIGA_PROTECTED_IMAGE=docker.io/taigaio/taiga-protected:6.10.1' \
  'TAIGA_RABBITMQ_IMAGE=docker.io/library/rabbitmq:3.8.34-management-alpine' 'TAIGA_GATEWAY_IMAGE=docker.io/library/nginx:1.19.10-alpine' > .ddev/.env
# The site's own values, which only their owner reads: made once for this site and kept across builds. Taiga's
# telemetry is off, and so is its public sign-up.
( umask 077
  [ -s taiga/secrets ] || printf 'SECRET=%s\nRABBIT=%s\nCOOKIE=%s\nADMIN=Aa1.%s\n' "$(secret 50)" "$(secret 24)" "$(secret 32)" "$(secret 20)" > taiga/secrets
  # shellcheck disable=SC1091
  . taiga/secrets
  cat > taiga/env <<ENVEOF
POSTGRES_DB=db
POSTGRES_USER=db
POSTGRES_PASSWORD=db
POSTGRES_HOST=db
TAIGA_SECRET_KEY=${SECRET}
TAIGA_SITES_SCHEME=https
TAIGA_SITES_DOMAIN=${NAME}.ddev.site
TAIGA_SUBPATH=
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
DEFAULT_FROM_EMAIL=taiga@example.com
EMAIL_USE_TLS=False
EMAIL_USE_SSL=False
EMAIL_HOST=web
EMAIL_PORT=1025
EMAIL_HOST_USER=
EMAIL_HOST_PASSWORD=
RABBITMQ_USER=taiga
RABBITMQ_PASS=${RABBIT}
ENABLE_TELEMETRY=False
PUBLIC_REGISTER_ENABLED=False
ENVEOF
  printf 'RABBITMQ_ERLANG_COOKIE=%s\nRABBITMQ_DEFAULT_USER=taiga\nRABBITMQ_DEFAULT_PASS=%s\nRABBITMQ_DEFAULT_VHOST=taiga\n' "${COOKIE}" "${RABBIT}" > taiga/rabbitmq.env
  printf 'TAIGA_URL=https://%s.ddev.site\nTAIGA_WEBSOCKETS_URL=wss://%s.ddev.site\nTAIGA_SUBPATH=\nPUBLIC_REGISTER_ENABLED=false\n' "${NAME}" "${NAME}" > taiga/front.env
  printf 'RABBITMQ_USER=taiga\nRABBITMQ_PASS=%s\nTAIGA_SECRET_KEY=%s\n' "${RABBIT}" "${SECRET}" > taiga/events.env
  printf 'MAX_AGE=360\nSECRET_KEY=%s\n' "${SECRET}" > taiga/protected.env
)

echo "Starting PostgreSQL 12 and Taiga 6.10's services."
ddev start -y < /dev/null
code=''
for attempt in $(seq 1 200) ; do
  code="$(ddev exec "curl -s -o /dev/null -m 15 -w '%{http_code}' http://taiga-gateway/api/v1/" < /dev/null 2>/dev/null | tr -d '\r' | tail -1 || true)"
  [ "${code}" = 200 ] && break
  [ "${attempt}" = 200 ] && { echo "Taiga did not answer (${code:-none})." ; ddev logs -s taiga-back --tail 80 < /dev/null || true ; exit 1 ; }
  sleep 3
done

# The site's administrator (its password made for this site, never printed); then the accounts of the suite and the
# sample content: the Scrum project Webship site, administered by owner (Product Owner), with member (Back) and reader
# (a role that only views); stranger not in it.
python3 - "${SITE_DIR}/taiga/secrets" <<'PYEOF' | site install
import base64, json, sys
admin = [l.split('=', 1)[1].strip() for l in open(sys.argv[1]) if l.startswith('ADMIN=')][0]
print(base64.b64encode(json.dumps({'login': 'webmaster', 'mail': 'webmaster@example.com', 'password': admin, 'name': 'Webmaster Workspace'}).encode()).decode())
PYEOF
payload | site accounts
payload | site content
site version < /dev/null | tr -d '\r'

echo "The site: https://${NAME}.ddev.site (Taiga on PostgreSQL 12)"
[ -n "${GITHUB_ENV:-}" ] && echo "LAUNCH_URL=https://${NAME}.ddev.site" >> "${GITHUB_ENV}"
exit 0
