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
    while (maxRetries > 0)  {
        var val;
        try  {
            val = await expr();
            console.log(`successfully evaluated ${expr}`);
            return val;
        } catch(err)  {
            console.log(`error evaluating ${expr}: ${err}. retrying...`);
        }
        console.log(`waiting for ${expr}`);
        await sleep(retrySecs);
        maxRetries -= 1;
    }
    throw `timed out waiting for: ${expr}`
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
        await browser.close();
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
        var filename = __dirname + '/ledger-backup-html/Passwords Backup.html';
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
                        [...document.querySelectorAll("button")].filter(
                            x => x.textContent == "Connect")[0].click();
                        throw "backup button not visible yet";
                    }
                }), {retrySecs: 5});
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
            }));
            var download = await this._waitForCompletedDownload(dir);
            fs.renameSync(download, filePath);
        } else if (operation == "restore")  {
            console.log(`waiting for file chooser`);
            var fileChooserPromise = this._page.waitForFileChooser({timeout: 60 * 1000});
            await waitFor(async () => this._page.click('.RestoreButton'))
            (await fileChooserPromise).accept([filePath]);
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
            }, {retrySecs: secsLeft, maxRetries: 60});
    }
}

function genTempFilename (  )  {
    return `/tmp/${uuid.v1()}`;
}

async function appendNicks ( nicks, backupFilename, restoreFilename )  {
    const dataString = fs.readFileSync(backupFilename, 'utf8');
    const data = JSON.parse(dataString);
    var newNickData = nicks.map((nick) => {
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
        // await appendNicks(["deltadental"],
        //     "/tmp/5a6c01c0-ee68-11ec-8885-eb82480cea07",
        //     "/tmp/5a6c01c0-ee68-11ec-8885-eb82480cea07.json");
        await appendLedgerPasswords(nicks);
    }
}

if (require.main === module)  {
        main();
}

// Local Variables:
// compile-command: "./ledger-password-backup-restore.js deltadentalins"
// End:
