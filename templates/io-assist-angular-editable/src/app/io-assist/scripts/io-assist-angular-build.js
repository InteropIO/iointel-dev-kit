/**
 * io-assist-ng-build.js
 *
 * Build script for this app, invoked as the `build` npm script (no separate
 * prebuild/prestart step to run). 1:1 with @interopio/io-assist-ng's own
 * build script (libs/io-assist-ng/scripts/io-assist-ng-build.js in
 * iointel-js), adapted so the generated files land under this app's build
 * output (dist/io-assist-angular/browser) instead of being committed to src/.
 *
 * Steps:
 *   1. ng build         — compile the Angular library
 *   2. tailwindcss      — compile and minify styles.css → dist/styles.css
 *   3. copy-fonts       — copy Inter woff2 files to dist/files/
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const DIST_BROWSER = "dist/io-assist-angular/browser";

const run = (cmd) => {
    console.log(`\n> ${cmd}`);
    execSync(cmd, { stdio: "inherit" });
};

const copyFonts = () => {
    const fontPackageDir = path.dirname(require.resolve("@fontsource-variable/inter/wght.css"));
    const srcFile = path.join(fontPackageDir, "files", "inter-latin-wght-normal.woff2");
    const destDir = path.resolve(__dirname, "../../../../", DIST_BROWSER, "files");
    const destFile = path.join(destDir, "inter-latin-wght-normal.woff2");

    fs.mkdirSync(destDir, { recursive: true });
    fs.copyFileSync(srcFile, destFile);

    console.log(`Copied inter-latin-wght-normal.woff2 -> ${DIST_BROWSER}/files/`);
};

run("ng build");
run(`npx tailwindcss -i src/app/io-assist/styles.css -o ${DIST_BROWSER}/styles.css --minify`);
copyFonts();
