#!/bin/bash -x

set -euo pipefail

cd $( dirname "${BASH_SOURCE[0]}" )

INSTALLS="${HOME}/git/dotfiles/scripts/installs/"

${INSTALLS}/nodenv.sh
. ${HOME}/.profile-env
which node

npm install puppeteer

${INSTALLS}/chrome-sandbox.sh .
