// electron-builder afterPack hook.
//
// Jewel VTT is freeware without an Apple Developer certificate. Apple
// Silicon refuses to launch apps with a broken signature ("damaged"), so the
// Mac build gets a free ad-hoc signature. Users then open it once via
// System Settings -> Privacy & Security -> Open Anyway.
const { execFileSync } = require("node:child_process")
const path = require("node:path")

exports.default = async function afterPack(context) {
    if (context.electronPlatformName !== "darwin") return
    const appPath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`)
    execFileSync("codesign", ["--force", "--deep", "--sign", "-", appPath], { stdio: "inherit" })
}
