const rpc = require("./rpc");
const { systemPreferences } = require("electron");

rpc.handle("get-system-accent-color", () => {
	return systemPreferences.getAccentColor();
});