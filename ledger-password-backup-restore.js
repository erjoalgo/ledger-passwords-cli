#!/usr/bin/env node

const puppeteer = require('puppeteer');
var fs = require('fs');
var uuid = require('uuid');
const { argv } = require('process');

function makeEmptyTempDir (  )  {
    var dir = `/tmp/${uuid.v1()}`;
    console.log("DEBUG dkko value of dir: "+dir);
    fs.mkdirSync(dir);
    return dir;
}

function sleep ( secs )  {
    return new Promise(function(resolve, reject)  {
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
            console.log("DEBUG trace ledger-password-backup-restore otys");
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

async function waitForCompletedDownload ( dir, secsLeft )  {
    return await waitFor(
        () => {
            var files = fs.readdirSync(dir);
            console.log("DEBUG 6vi6 value of dir: "+dir);
            console.log("DEBUG sre6 value of files: "+files);
            if (files.length > 0 && ! /crdownload/i.test(files[0]))  {
                return dir + '/' + files[0];
            }  else   {
                throw `downloaded file not ready at dir ${dir}`;
            }
        }, {retrySecs: secsLeft, maxRetries: 60});
}

async function main ( operation, filePath )  {
    const browser = await puppeteer.launch({headless: false});
    const page = await browser.newPage();
    var filename = __dirname + '/ledger-backup-html/Passwords Backup.html';
    var url;
    console.log("DEBUG 4eet value of filename: "+filename);
    if (fs.existsSync(filename)) {
        url = `file://${filename}`;
    } else   {
        console.log(`${filename} doesn't exist. falling back to live website`);
        url = "https://ledgerhq.github.io/passwords-backup/"
    }
    await page.goto(url);
    // connect and wait for the backup and restore buttons to become clickable
    await waitFor(
        () => page.evaluate(
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
        const dir = makeEmptyTempDir();
        try {
            const client = await page.target().createCDPSession();
        } catch(err) {
            const client = page._client;
        }
        await client.send('Page.setDownloadBehavior',
                          {behavior: 'allow', downloadPath: dir});
        await waitFor(() => page.evaluate(() => {
            var backup = [...document.querySelectorAll("button")].filter(
                x => x.textContent == "Backup")[0];
            backup.click();
        }));
        var download = await waitForCompletedDownload(dir);
        fs.renameSync(download, filePath);
    } else if (operation == "restore")  {
        console.log(`waiting for file chooser`);
        var fileChooserPromise = page.waitForFileChooser({timeout: 60 * 1000});
        await waitFor(async () => page.click('.RestoreButton'))
        console.log("DEBUG uqfg value of filePath: "+filePath);
        (await fileChooserPromise).accept([filePath]);
        await sleep(20);
    } else   {
        throw `unsupported operation: ${operation}`;
    }
    await browser.close();
}

function usage (  )  {
    console.log(`ledger-password-backup-restore.js [backup|restore] <file-path>`);
}

if (require.main === module)  {
    if (argv.length != 4)  {
        // the first two args are the interpreter, this script
        usage();
    } else   {
        const operation = argv[2];
        const filePath = argv[3];
        main(operation, filePath);
    }
}

// Local Variables:
// compile-command: "./ledger-password-backup-restore.js restore /tmp/caca.json"
// End:
