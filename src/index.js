const { itemTypes, initSearch } = require('./search');
const { searchCrate, fetchSearchIndex } = require('./docsrs');

function openCrateHome(crate) {
    return console.log(
        JSON.stringify({
            items: [
                {
                    title: `Open ${crate} documentation in docs.rs`,
                    arg: `https://docs.rs/${crate}`,
                    icon: {
                        path: './icon/crate.png'
                    }
                }
            ]
        })
    );
}

async function main() {
    if (process.argv.length == 2) {
        // no search keywords
        return {
            title: `Type crate name to start search`,
            icon: {
                path: './icon/workflow-icon.png'
            }
        };
    }

    const input = process.argv[2].trim().split(' ');

    if (input[0] == '') {
        // no search keywords
        return {
            title: `Type crate name to start search`,
            icon: {
                path: './icon/workflow-icon.png'
            }
        };
    }

    if (input.length == 1) {
        // search crate names
        const result = await searchCrate(input[0]);

        return result.map(crate => {
            return {
                title: crate.name,
                subtitle: `${crate.version} - ${crate.description}`,
                autocomplete: crate.name,
                arg: `https://docs.rs/${crate.name}/${crate.version}/`,
                icon: {
                    path: './icon/crate.png'
                }
            };
        });
    }

    const crateName = input[0];
    const keywords = input.slice(1).join(' ');

    const index = await fetchSearchIndex(crateName);
    const search = initSearch(index.index);

    return search(keywords).others.map(result => {
        const displayPath = result.displayPath.replace(/<\/?span>/g, '');

        let desc = `${displayPath}${result.name}`;
        if (result.desc) {
            desc += ` - ${result.desc}`;
        }

        const type = itemTypes[result.ty];

        return {
            title: result.name,
            subtitle: desc,
            autocomplete: `${crateName} ${result.name}`,
            type: type,
            arg: `https://docs.rs${index.path}../${result.href}`,
            icon: {
                path: `./icon/${type}.png`
            }
        };
    });
}

(async function () {
    let result = await main();

    if (!Array.isArray(result)) {
        result = {
            items: [result]
        };
    } else {
        result = {
            items: result
        };
    }

    console.log(JSON.stringify(result));
})();
