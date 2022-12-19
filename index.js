process.stdin.resume();

import packageJSON from "./package.json" assert { type: "json" };
import fs from "fs";
import youtubeSearch from "youtube-search-without-api-key";
import ffmpeg from "fluent-ffmpeg";
import ytdl from "ytdl-core";
import { path as ffmpegPath } from "@ffmpeg-installer/ffmpeg";
import "colors";

ffmpeg.setFfmpegPath(ffmpegPath);

if(!fs.existsSync("./converted")) fs.mkdirSync("./converted");
if(!fs.existsSync("./download.txt")) fs.writeFileSync("./download.txt", "");

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

fs.readFile("./download.txt", async (err, data) => {
    console.log(`${"INFO".yellow}: ${`Youtube-Convert@${packageJSON.version}`.green} was successfully loaded by ${`${packageJSON.author}`.green}.`);
    await timeout(1500);

    if(err) return console.log(`${"ERROR".red}: Unexpected.`);

    const text = data.toString().replace(/\r/g, "");

    text.split("\n").forEach(async(musicName, index) => {
        if(!index) setCurrentProgressMusicName(musicName);

        downloads.push({
            musicName: musicName,
            status: !index ? "downloading" : "queue"
        });

        await canDownload(musicName);

        console.log("");

        if(musicName.length == 0) return console.log(`${"ERROR".red}: Can't use empty music name.`), setCurrentProgressMusicStatus(musicName, "error");
        
        console.log(`${"INFO".yellow}: Searching for ${`${musicName}`.green}.`);

        youtubeSearch.search(musicName).then((musicData) => {
            const itemData = musicData[0];
            var songTitle = itemData.title
            if(!itemData) return console.log(`${"ERROR".red}: Music with title ${`${musicName}`.green} was not found.`), setCurrentProgressMusicStatus(musicName, "error");
            if(fs.existsSync(`./converted/${itemData.title}.mp3`)) return console.log(`${"SKIPPING".cyan}: Music with name ${`${itemData.title}`.green} already exists.`), setCurrentProgressMusicStatus(musicName, "error");
            console.log(`${"INFO".yellow}: Music with name ${`${itemData.title}`.green} was found. Starting download...`);
            songTitle = songTitle.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '');
            songTitle = songTitle.replace(/[^a-zA-Z ]/g, "")
            const stream = ytdl(itemData.url, {
                quality: "highestaudio"
            });
            const status = ffmpeg(stream).audioBitrate(128).save(`./converted/${songTitle}.mp3`);
            let error = false;
            status.on("error", (err) => {
                console.log(err);
                error = true;
                console.log(`${"ERROR".red}: Music with name ${`${itemData.title}`.green} can't download due to unexpected error.`);
                setCurrentProgressMusicStatus(musicName, "error");
            });

            status.on("end", () => {
                if(error) return;
                console.log(`${"INFO".yellow}: Music with name ${`${itemData.title}`.green} was successfully downloaded.`);
                setCurrentProgressMusicStatus(musicName, "finished");
            });
        });
    });

    await waitForEverythingToFinish();

    console.log("");
    console.log(`${"INFO".yellow}: Everything was finished. Thanks for using this script ${"<3".red}.`);
    console.log(`${"INFO".yellow}: You can find converted files here: ${`./converted`.green}`);
    console.log(`${"INFO".yellow}: Process will be exit in ${"5".green} seconds.`);

    await timeout(5000);
    process.exit();
});
