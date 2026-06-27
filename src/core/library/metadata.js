const { ipcMain } = require("electron");
const musicMetadata = require("music-metadata");

ipcMain.handle("library:get-metadata", async (event, path) => {
	try {
		return await musicMetadata.parseFile(path);
	} catch (err) {
		console.warn(`Could not obtain metadata from file: ${path}`);
		return err;
	}
});