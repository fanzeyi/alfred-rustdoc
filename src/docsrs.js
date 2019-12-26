const { VM } = require('vm2');
const fs = require('fs');
const path = require('path');
const https = require('https');
const cheerio = require('cheerio');

function httpget(url) {
    const _httpget = (url, resolve, reject) => {
        let buffers = [];
        https.get(url, (res) => {
            if (res.statusCode >= 400) {
                res.on('data', (d) => {
                    reject([res, d]);
                })
            } else if (res.statusCode >= 300) {
                const location = res.headers['location'];

                if (location !== undefined) {
                    return _httpget(location, resolve, reject);
                } else {
                    reject([res]);
                }
            } else {
                res.on('data', (d) => {
                    buffers.push(d);
                });
                res.on('end', () => {
                    const final = Buffer.concat(buffers);
                    resolve([final.toString(), res]);
                });
            }
        }).on('error', (e) => reject([undefined, e]));
    };

    return new Promise((resolve, reject) => _httpget(url, resolve, reject));
}

async function searchCrate(query) {
    const url = `https://docs.rs/releases/search?query=` + query.replace(/ /g, '+');
    const resp = await httpget(url);
    const $ = cheerio.load(resp[0]);
    const list = $('.recent-releases-container > ul li');

    return list.map((idx, item) => {
        const $item = $(item);
        const description = $item.find('.description').text().replace(/\s+/g, ' ').trim();
        const link = $item.find('.release').attr("href");
        const parts = link.split("/");

        if (parts[1] === "crate") {
            parts.shift();
        }

        return {
            name: parts[1],
            version: parts[2],
            description: description,
        }
    }).get();
};

async function fetchSearchIndex(crate, version) {
    console.log("....");
    let url = `https://docs.rs/${crate}/`;

    if (version !== undefined) {
        // this is not always correct but it should work for docs.rs
        url += `${version}/${crate}/`;
    }

    const resp = await httpget(url);
    const result = resp[0].match(/search-index.*?js/g);

    if (result.length === 0) {
        return null;
    }

    const searchIndexUrl = result[0];
    const rawIndex = await httpget(`https://docs.rs${resp[1].req.path}../${searchIndexUrl}`);
    let searchIndex;

    // it is unfortunate that we have to run this file since some time `cargo doc` may generate
    // a search index file with some basic substitution.
    new VM({
        sandbox: {
            addSearchOptions: () => { },
            initSearch: (result) => { searchIndex = result },
        }
    }).run(rawIndex[0]);

    return {
        index: searchIndex,
        path: resp[1].req.path,
    };
}

const CACHE_PATH = "/tmp/fan.zeyi.alfred-rustdoc/";
function cache(name, func) {
    try {
        fs.mkdirSync(CACHE_PATH);
    } catch (e) {
        if (e.code !== 'EEXIST') {
            throw e;
        }
    }

    return async (...args) => {
        const format = `${name}-${args.join("-")}.json`;
        const cachePath = path.join(CACHE_PATH, format);

        try {
            const now = new Date();
            const stat = fs.statSync(cachePath);

            // 1 day expiration time
            if (now.getTime() - stat.mtime.getTime() > 86400000) {
                throw "expired cache";
            }

            const result = fs.readFileSync(cachePath);
            return JSON.parse(result.toString());
        } catch (err) {
            const result = await func(...args);
            fs.writeFileSync(cachePath, JSON.stringify(result));
            return result;
        }
    }
}

exports.searchCrate = searchCrate;
exports.fetchSearchIndex = cache('index', fetchSearchIndex);