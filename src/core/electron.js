const { ipcMain, systemPreferences } = require("electron");

ipcMain.handle("get-system-accent-color", () => {
	return systemPreferences.getAccentColor();
});