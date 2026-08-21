const rpc = require("../rpc");
const fs = require("fs/promises");
const Path = require("path");

const { fileURLToPath } = require('node:url');

// the metadata index of libraryId -> CRSIM dict
const metadata = {};

// the metadata of the currently playing song
let current = {};
// the libraryId of the currently playing song
let currentId = 0;

// the current track number within the mix
let currentMix = 0;
// the next time metadata:update should be called to update the mix
let targetTime = -1;

// create a new metadata file
rpc.handle('metadata:create', (event, id, path, uri) => {
	metadata[id] = { "path":uri };
	rpc.invoke('metadata:save', id, path);
})

// load metadata from a crsim file
rpc.handle('metadata:load', async (event, id, path) => {
	try {
		metadata[id] = JSON.parse(
			await fs.readFile(
				path, "utf8"
			)
		);
		return metadata[id].path;
	} catch (e) {
		console.warn(`metadata:load exception: ${e}`);
	}
});

// save metadata to a crsim file
rpc.handle('metadata:save', async (event, id, path) => {
	try {
		await fs.mkdir(Path.dirname(path), { recursive: true });
		await fs.writeFile(
			path,
			JSON.stringify(metadata[id], null, "\t")
		);
	} catch (e) {
		console.error(`metadata:save exception: ${e}`);
	}
});

// get a metadata dict
rpc.handle('metadata:get', (event, id, property = "") => {
	if (!id) return;
	if (typeof property !== "string") throw new Error("Invalid poperty name");
	if (!metadata[id]) throw new Error("Cannot get metadata that has not been loaded");
	if (property.length) {
		return metadata[id][property];
	}
	return metadata[id];
});

// set a metadata dict or one of its properties
rpc.handle('metadata:set', (event, id, value, property = "") => {
	if (!id) return;
	if (typeof property !== "string") throw new Error("Invalid poperty name");
	if (!metadata[id]) throw new Error("Cannot set metadata that has not been loaded");
	if (property.length) {
		metadata[id][property] = value;
	} else {
		metadata[id] = value;
	}
	if (currentId === id) rpc.invoke('metadata:update')

	rpc.invoke('metadata:save', id, rpc.invoke('library:get', id));
});

// update the current mix
rpc.handle('metadata:update', (event, id) => {
	try {
	if (id !== currentId) {
		currentId = id;
		currentMix = 0;
		targetTime = -1;
		if (!currentId || !metadata[id]) current = {};
		else current = { ...metadata[id] };
	}

	if (Object.keys(current).length) {
		const processed = { ...current };
		processed.id = currentId;
		if (currentMix !== 0) {
			const mix = current.mix[currentMix];
			for (const key in Object.keys(mix)) {
				processed[key] = mix[key];
			}
		}
		processed["_internal"] = true;

		try {
			const art = processed.art?.override ??
				processed.art?.album ??
				processed.art?.type ??
				processed.art?.artist;
			if (art) processed.art["_default"] = rpc.invoke('library:uri', art);
		} catch (e) {
			console.warn(`metadata:update (art) exception: ${e}`);
		}

		try {
			const background = processed.art?.background?.override ??
				processed.art?.background?.album ??
				processed.art?.background?.type ??
				processed.art?.background?.artist;
			if (background) processed.art.background["_default"] = rpc.invoke('library:uri', background);
		} catch (e) {
			console.warn(`metadata:update (art.background) exception: ${e}`);
		}

		if (Object.keys(processed)?.length)
			current["_processed"] = processed;
	}

	rpc.invoke('plugins:metadata-changed', current);
} catch (e) {
	console.error(`metadata:update exception: ${e}`);
}
});

rpc.handle('metadata:position-changed', (event, time) => {

});