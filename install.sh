#!/bin/bash -x

set -euo pipefail

INSTALLS="${HOME}/git/dotfiles/scripts/installs/"

${INSTALLS}/nodenv.sh
. ${HOME}/.profile-env
which node

npm install puppeteer

${INSTALLS}/chrome-sandbox.sh .
