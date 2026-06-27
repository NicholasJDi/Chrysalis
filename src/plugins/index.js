const { ipcMain } = require("electron");
const plugins = require("././core/settings/plugins")
// idfk how to do plugins smh

module.exports = {
	discord: require("./discord"),
	mpris: require("./mpris")
}