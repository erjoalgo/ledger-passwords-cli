#!/bin/bash -x

set -euo pipefail

cd "$( dirname "${BASH_SOURCE[0]}" )"

ORIGINAL_BACKUP_FILENAME=$(mktemp)
./ledger-password-backup-restore.js backup ${ORIGINAL_BACKUP_FILENAME}

NEW_BACKUP_FILENAME=$(mktemp)

if ! npm list | grep puppeteer; then
    echo "node or puppeteer are missing. run npm install puppeteer uuid"
    # TODO upload as an npm package and merge bash into nodejs script
    exit ${LINENO}
fi

if test $# -lt 1; then
    echo "usage: ledger-password-append.sh <nick1> [<nick2> ...]"
    exit ${LINENO}
fi

python - ${ORIGINAL_BACKUP_FILENAME} ${*} <<EOF > ${NEW_BACKUP_FILENAME}
import json
import sys

nicks = sys.argv[2:]
data = json.load(open(sys.argv[1]))
parsed = data['parsed']
for nick in nicks:
    parsed.append({
            "nickname": nick,
            "charsets": [
                "UPPERCASE",
                "LOWERCASE",
                "NUMBERS"
            ]
    })
json.dump(data, sys.stdout, indent=4)
EOF

./ledger-password-backup-restore.js restore ${NEW_BACKUP_FILENAME}

# Local Variables:
# compile-command: "./ledger-password-append.sh github"
# End:
