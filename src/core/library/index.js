const { ipcMain } = require("electron");
const fs = require("fs/promises");
const path = require("path");

const AUDIO_FORMATS = ['.mp3','.ogg','.wav','.flac','.m4a','.opus']
const IMAGE_FORMATS = ['.png','.jpeg','.jpg','.webp','svg']

ipcMain.handle("library:scan", async (event, directory, type, recursive) =>{
	let extensions = [];
	switch (type) {
		case "audio":
			formats = AUDIO_FORMATS;
		case "image":
			formats = IMAGE_FORMATS;
	}

	const files = await scanDirectory(
		directory,
		extensions,
		recursive || false);
	return files;
});

async function scanDirectory(directory, extensions, recursive) {
	try {
		const entries = await fs.readdir(directory, {
			recursive: recursive,
			withFileTypes: true
		});

		return entries
			.filter(entry =>
				entry.isFile() &&
				(extensions.includes(path.extname(entry.name).toLowerCase()) || extensions.length === 0))
			.map(entry => path.join(entry.parentPath, entry.name));
	} catch (err) {
		console.warn(`Failed to scan ${directory}:`, err.message);
		return [];
	}
}

module.exports = {
	metadata: require("./metadata"),
	scanDirectory
}