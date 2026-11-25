const rpc = require("./rpc");
const { systemPreferences } = require("electron");

rpc.handle("electron:system.accent-color", () => {
	return systemPreferences.getAccentColor();
});