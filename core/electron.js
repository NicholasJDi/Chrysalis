const { ipcMain, systemPreferences } = require("electron");

ipcMain.handle("get-accent-color", () => {
	return systemPreferences.getAccentColor();
});