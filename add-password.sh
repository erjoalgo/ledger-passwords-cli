#!/bin/bash -x

set -euo pipefail

cd "$(realpath $(dirname "${BASH_SOURCE[0]}"))"

COOKIE=$(xauth list | tr -s ' ' | cut -f3 -d' ')

docker compose up --build cli

# docker compose run cli bash -c "xauth add ${COOKIE} &&  \
#     /home/pptruser/ledger-password-backup-restore.js ${@}"

xhost +
chmod 766 ~/.Xauthority
docker compose run cli /home/pptruser/ledger-password-backup-restore.js ${@}

# cd cli

# docker run -i --init --cap-add=SYS_ADMIN  \
#        --rm ghcr.io/puppeteer/puppeteer:latest \
#        node -e "$(cat ./ledger-password-backup-restore.js)"
