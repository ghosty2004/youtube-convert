process.stdin.resume();

const fs = require("fs");
const youtubeSearch = require("youtube-search-without-api-key");
const youtubeMp3Converter = require("youtube-mp3-converter");
require("colors");

const packageJSON = require("./package.json");

if(!fs.existsSync(`${__dirname}/converted`)) fs.mkdirSync(`${__dirname}/converted`);
if(!fs.existsSync(`${__dirname}/download.txt`)) fs.writeFileSync(`${__dirname}/download.txt`, "");

/** @type {Array<{musicName: string, status: "downloading"|"queue"|"finished"|"error"}}>} */
let downloads = [];
/** @type {null|string} */
let currentProgressMusicName = null

/**
 * @param {string} musicName 
 */
function setCurrentProgressMusicName(musicName) {
    currentProgressMusicName = musicName
}

/**
 * @param {string} musicName 
 * @param {"downloading"|"queue"|"finished"|"error" newStatus 
 */
function setCurrentProgressMusicStatus(musicName, newStatus) {
    const index = downloads.findIndex(f => f.musicName == musicName);
    if(index == -1) return;
    if(newStatus == "error" || newStatus == "finished") {
        if(downloads[index + 1]) setCurrentProgressMusicName(downloads[index + 1].musicName);
    }
    downloads[index].status = newStatus;
}

/**
 * @param {string} musicName 
 * @returns {boolean}
 */
function canDownload(musicName) {
    return new Promise((resolve) => {
        let tempInterval = setInterval(() => {
            if(currentProgressMusicName == musicName) {
                clearInterval(tempInterval);
                resolve(true);
            }
        }, 500);
    });
}

function waitForEverythingToFinish() {
    return new Promise((resolve) => {
        let tempInterval = setInterval(() => {
            if(downloads.filter(f => f.status != "queue" && f.status != "downloading").length != downloads.length) return;
            clearInterval(tempInterval);
            resolve(true);
        }, 500);
    });
}

/**
 * @param {number} ms
 */
function timeout(ms) {
    return new Promise((resolve) => { setTimeout(resolve, ms); });
}

fs.readFile(`${__dirname}/download.txt`, async (err, data) => {
    console.log(`${"INFO".yellow}: ${`Youtube-Convert@${packageJSON.version}`.green} was successfully loaded by ${`${packageJSON.author}`.green}.`);
    await timeout(1500);

    if(err) return console.log(`${"ERROR".red}: Unexpected.`);

    const convertLinkToMp3 = youtubeMp3Converter(`${__dirname}/converted`);
    const text = data.toString().replace(/\r/g, "");

    text.split("\n").forEach(async(musicName, index) => {
        if(!index) setCurrentProgressMusicName(musicName);

        downloads.push({
            musicName: musicName,
            status: !index ? "downloading" : "queue"
        });

        await canDownload(musicName);

        if(musicName.length == 0) return console.log(`${"ERROR".red}: Can't use empty music name.`), setCurrentProgressMusicStatus(musicName, "error");

        if(fs.existsSync(`${__dirname}/converted/${musicName}.mp3`)) return console.log(`${"SKIPPING".cyan}: Music with name ${`${musicName}`.green} already exists.`), setCurrentProgressMusicStatus(musicName, "error");
        
        console.log(`${"INFO".yellow}: Searching for ${`${musicName}`.green}.`);

        youtubeSearch.search(musicName).then((musicData) => {
            const itemData = musicData[0];
            if(!itemData) return console.log(`${"ERROR".red}: Music with title ${`${musicName}`.green} was not found.`), setCurrentProgressMusicStatus(musicName, "error");
            console.log(`${"INFO".yellow}: Music with name ${`${musicName}`.green} was found. Starting download...`);
            convertLinkToMp3(itemData.url, {
                title: musicName
            }).then(() => {
                console.log(`${"INFO".yellow}: Music with name ${`${musicName}`.green} was successfully downloaded.`);
                setCurrentProgressMusicStatus(musicName, "finished");
            }).catch(() => {
                console.log(`${"ERROR".red}: Music with name ${`${musicName}`.green} can't download due to unexpected error.`);
                setCurrentProgressMusicStatus(musicName, "error");
            });
        });
    });

    await waitForEverythingToFinish();

    console.log(`${"INFO".yellow}: Everything was finished. Thanks for using this script <3.`);
});