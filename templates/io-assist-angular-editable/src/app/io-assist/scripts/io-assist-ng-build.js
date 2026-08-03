/**
 * Steps:
 *   1. copy-fonts       — copy Inter woff2 files to dist/files/
 *   2. ng build         — compile the Angular library
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const IO_ASSIST_DIR = path.resolve(__dirname, "..");

const run = (cmd) => {
    console.log(`\n> ${cmd}`);
    execSync(cmd, { stdio: "inherit" });
};

const copyFonts = () => {
    const fontPackageDir = path.dirname(require.resolve("@fontsource-variable/inter/wght.css"));
    const srcFile = path.join(fontPackageDir, "files", "inter-latin-wght-normal.woff2");
    const destDir = path.join(IO_ASSIST_DIR, "files");
    const destFile = path.join(destDir, "inter-latin-wght-normal.woff2");

    fs.mkdirSync(destDir, { recursive: true });
    fs.copyFileSync(srcFile, destFile);

    console.log("Copied inter-latin-wght-normal.woff2 -> src/app/io-assist/files/");
};

copyFonts();
run("ng build");


