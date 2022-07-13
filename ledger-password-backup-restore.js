#!/usr/bin/env node

const puppeteer = require('puppeteer');
var fs = require('fs');
var uuid = require('uuid');
const { argv } = require('process');

async function sleep ( secs )  {
    await new Promise(function(resolve, reject)  {
        setTimeout(resolve, secs * 1000);
    });
}

async function waitFor ( expr, options )  {
    let { maxRetries, retrySecs } = options || {};
    retrySecs = retrySecs || 1;
    maxRetries = maxRetries || 60;
    var desc = options.desc || expr;
    while (maxRetries > 0)  {
        var val;
        try  {
            val = await expr();
            console.log(`successfully evaluated ${desc}`);
            return val;
        } catch(err)  {
            console.log(`error evaluating ${desc}: ${err}. retrying...`);
        }
        console.log(`waiting for ${desc}`);
        await sleep(retrySecs);
        maxRetries -= 1;
    }
    throw `timed out waiting for: ${desc}`
}



class LedgerBackupRestore {
    constructor() {
        var _browser;
        var _page;
    }

    async _init (  )  {
        this._browser = await puppeteer.launch({headless: false});
    }

    async close (  )  {
        await this._browser.close();
    }

    async backup ( destFile )  {
        await this._backupRestore('backup', destFile);
    }

    async restore ( fromFile )  {
        await this._backupRestore('restore', fromFile);
    }

    async _backupRestore ( operation, filePath )  {
        if (["backup", "restore"].indexOf(operation)<0)  {
            throw `unsupported operation: ${operation}`;
        }
        if (!this._browser)  {
            await this._init();
        }
        if (!this._page)  {
            this._page = await this._browser.newPage();
        }
        var filename = __dirname + '/html/Passwords Backup.html';
        var url;
        if (fs.existsSync(filename)) {
            url = `file://${filename}`;
        } else   {
            console.warn(`${filename} doesn't exist. falling back to live website`);
            url = "https://ledgerhq.github.io/passwords-backup/"
        }
        await this._page.goto(url);
        // connect and wait for the backup and restore buttons to become clickable
        await waitFor(
            () => this._page.evaluate(
                () => {
                    var backup = [...document.querySelectorAll("button")].filter(
                        x => x.textContent == "Backup")[0];
                    if (!backup.offsetParent)  {
                        var connect = [...document.querySelectorAll("button")]
                            .filter(x => x.textContent == "Connect")[0];
                        if (!connect)  {
                            throw "connect button not found!"
                        } else   {
                            connect.click();
                        }
                        throw "backup button not visible yet";
                    }
                }), {retrySecs: 5, maxRetries: 99,
                     desc: "backup button becomes visible"});
        if (operation == "backup")  {
            const dir = this._makeEmptyTempDir();
            var client;
            try {
                client = await this._page.target().createCDPSession();
            } catch(err) {
                client = this._page._client;
            }
            await client.send('Page.setDownloadBehavior',
                              {behavior: 'allow', downloadPath: dir});
            await waitFor(() => this._page.evaluate(() => {
                var backup = [...document.querySelectorAll("button")].filter(
                    x => x.textContent == "Backup")[0];
                backup.click();
            }), {desc: "click backup button"});
            var download = await this._waitForCompletedDownload(dir);
            fs.renameSync(download, filePath);
        } else if (operation == "restore")  {
            console.log(`waiting for file chooser`);
            var fileChooserPromise = this._page.waitForFileChooser({timeout: 60 * 1000});
            await waitFor(() => this._page.click('.RestoreButton'),
                          {desc: "click restore button"})
            var fileChooser = await fileChooserPromise;
            await fileChooser.accept([filePath]);
            await sleep(20);
        } else   {
            throw `unsupported operation: ${operation}`;
        }
    }

    _makeEmptyTempDir (  )  {
        var dir = `/tmp/${uuid.v1()}`;
        fs.mkdirSync(dir);
        return dir;
    }

    async _waitForCompletedDownload ( dir, secsLeft )  {
        return await waitFor(
            () => {
                var files = fs.readdirSync(dir);
                console.log(`waiting for download in ${dir}: ${files}`);
                if (files.length > 0 && ! /crdownload/i.test(files[0]))  {
                    return dir + '/' + files[0];
                }  else   {
                    throw `downloaded file not ready at dir ${dir}`;
                }
            }, {retrySecs: secsLeft, maxRetries: 60,
                desc: "download finished"});
    }
}

async function appendNicks ( nicks, backupFilename, restoreFilename )  {
    const dataString = fs.readFileSync(backupFilename, 'utf8');
    const data = JSON.parse(dataString);
    const existingNicks = new Set(data.parsed.map(entry => entry.nickname));
    const dupeNicks = new Set(nicks.filter(nick => existingNicks.has(nick)));
    if (dupeNicks.size > 0)  {
        console.warn(
            `skipping ${dupeNicks.size} existing nicks: `+
                JSON.stringify(Array.from(dupeNicks)));
    }
    var newNickData = nicks.filter(nick => !dupeNicks.has(nick))
        .map((nick) => {
        return {
            "nickname": nick,
            "charsets": [
                "UPPERCASE",
                "LOWERCASE",
                "NUMBERS"
            ]
        }
    });
    data.parsed.push(...newNickData);
    fs.writeFileSync(restoreFilename, JSON.stringify(data, null, 4));
}

async function appendLedgerPasswords ( nicks )  {
    var uid = uuid.v1();
    const backupFilename = `/tmp/${uid}-backup.json`;
    const restoreFilename = `/tmp/${uid}-restore.json`;
    var backupRestore = new LedgerBackupRestore();
    await backupRestore.backup(backupFilename);
    await appendNicks(nicks, backupFilename, restoreFilename);
    await backupRestore.restore(restoreFilename);
    backupRestore.close();
}

function usage (  )  {
    console.log(`ledger-password-backup-restore.js <nick1> [<nick2> ...]`);
}

async function main (  )  {
    if (argv.length <= 2)  {
        // the first two args are the interpreter, this script
        usage();
    } else   {
        var nicks = argv.slice(2);
        await appendLedgerPasswords(nicks);
    }
}

if (require.main === module)  {
    main();
}

// Local Variables:
// compile-command: "./ledger-password-backup-restore.js deltadentalins"
// End:
