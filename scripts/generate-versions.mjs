import { execFileSync } from "node:child_process";
import {
    mkdtempSync,
    readdirSync,
    readFileSync,
    rmSync,
    statSync,
    writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_URL = "https://ese.tjadataba.se/Yonokid/ESE-Version-Sorting.git";
let root = process.argv[2];
const tmp = root ? null : mkdtempSync(join(tmpdir(), "ese-version-sorting-"));
if (tmp) {
    execFileSync("git", ["clone", "--depth", "1", REPO_URL, tmp], {
        stdio: "inherit",
    });
    root = tmp;
}
const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), "../src/data");
const OUT = join(DATA_DIR, "versions.json");
const DAN_OUT = join(DATA_DIR, "dan_courses.json");
const CATEGORIES = ["Arcade", "Console"];

function findSongLists(dir) {
    const files = [];
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) files.push(...findSongLists(full));
        else if (entry === "song_list.txt") files.push(full);
    }
    return files;
}

function findDanFiles(dir) {
    const files = [];
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) files.push(...findDanFiles(full));
        else if (entry === "dan.json") files.push(full);
    }
    return files;
}

function hashesFromLine(line) {
    const field = line.split("|", 1)[0]?.trim();
    if (!field || field.length % 32 !== 0) return [];
    const out = [];
    for (let i = 0; i < field.length; i += 32) out.push(field.slice(i, i + 32));
    return out;
}

const versions = {};
for (const category of CATEGORIES) {
    const categoryDir = join(root, category);
    for (const versionName of readdirSync(categoryDir).sort()) {
        const versionDir = join(categoryDir, versionName);
        if (!statSync(versionDir).isDirectory()) continue;
        const hashes = new Set();
        for (const file of findSongLists(versionDir)) {
            const text = readFileSync(file, "utf-8");
            for (const line of text.split("\n")) {
                for (const h of hashesFromLine(line)) hashes.add(h);
            }
        }
        if (hashes.size > 0)
            versions[`${category}/${versionName}`] = [...hashes];
    }
}

const danCourses = CATEGORIES.flatMap((category) => findDanFiles(join(root, category)))
    .map((file) => ({
        ...JSON.parse(readFileSync(file, "utf-8")),
        path: relative(root, file).split("\\").join("/"),
    }))
    .sort((a, b) => a.path.localeCompare(b.path));

if (tmp) rmSync(tmp, { recursive: true, force: true });
writeFileSync(OUT, JSON.stringify(versions));
writeFileSync(DAN_OUT, JSON.stringify(danCourses));
console.log(
    `Wrote ${Object.keys(versions).length} versions to ${OUT} and ${danCourses.length} dan courses to ${DAN_OUT}`,
);
