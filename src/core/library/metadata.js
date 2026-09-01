const rpc = require("../rpc");
const fs = require("fs/promises");
const Path = require("path");

// the metadata index of libraryId -> CRSIM dict
const metadata = {};

// the metadata of the currently playing song
let current = {};
// the libraryId of the currently playing song
let currentId = 0;
// the current subtrack number
let currentMix = 0;

// create a new metadata file
rpc.handle('metadata:create', (event, id, path, uri) => {
	metadata[id] = { "version":1, "path":uri, "title":Path.basename(uri) };
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

	if (currentId === id) rpc.invoke('metadata:update');
	rpc.invoke('metadata:save', id, rpc.invoke('library:get', id));
});

// update the current song
rpc.handle('metadata:update', (event, id = currentId) => {
	try {
		if (id !== currentId) {
			currentId = id;
			currentMix = 0;
			if (!currentId || !metadata[id]) current = {};
			else current = structuredClone(metadata[id]);
			if (current?.mix?.["1"] && !current.mix["1"].start > 0) {
				rpc.invoke('metadata:position-changed', 0);
				return;
			}
		}

		let processed = {};
		if (Object.keys(current).length) {
			processed = structuredClone(current);
			processed.id = currentId;
			if (currentMix > 0) {
				processed.subId = currentMix;
				current.mix["_processed"] = currentMix;
				const mix = processed.mix[currentMix.toString()];
				processed = rpc.invoke('metadata:merge', processed, mix, 'mix');
			}

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
		}

		rpc.invoke('plugins:metadata-changed', current, processed);
	} catch (e) {
		console.error(`metadata:update exception: ${e}`);
	}
});

rpc.handle('metadata:position-changed', (event, time) => {
	if (current?.mix?.["_default"]) {
		const mix = Object.entries(current.mix).find(([id, mix]) => {
			if (typeof mix === "object" && !Array.isArray(mix)) {
				const start = mix.start ?? 0;
				const end = mix.end ?? Infinity;
				return start <= time && time < end;
			}
			return false;
		})?.[0] ?? 0;

		if (mix !== currentMix) {
			currentMix = mix;
			rpc.invoke('metadata:update');
		}
	}
});

rpc.handle('metadata:duration-changed', async (event, id, duration) => {
	if (id === currentId && duration && !await rpc.invoke('metadata:get', id, "length")) rpc.invoke('metadata:set', id, duration, "length");
});

// merge a 'dict' into a 'base' dict while respecting ignored tags (makes a new dict) if 'key' is provided removes it from the merged dict
rpc.handle('metadata:merge', (event, base, dict, key = null) => {
	const to = structuredClone(dict)
	const out = structuredClone(base)
	for (const key of Object.keys(to)) {
		out[key] = to[key];
	}
	if (Array.isArray(out["_ignore"])) {
		for (const key of out["_ignore"]) {
			delete out[key];
		}
	}
	if (typeof key === "string") {
		delete out[key];
	}
	return out;
});

// flatten the crsim dict into externally valid crsim keys, if 'process' is false ignores non static data
rpc.handle('metadata:flatten', (event, dict, process = true, history = "", section = "crsim:") => {
	if (typeof dict !== "object" || Array.isArray(dict)) return {};
	if (dict["_internal"]) return {};

	let out = {};
	for (const key of Object.keys(dict)) {
		const array = Array.isArray(dict[key])
		const value = array ? JSON.stringify(dict[key]) : dict[key].toString();

		if (process && key === "_processed") {
			if (typeof dict[key] === "object" && !array) {
				out = { ...out, ...rpc.invoke('metadata:flatten', dict[key], process, history, `${section.startsWith(".") ? "._" + section.slice(1) : "_" + section}`) };
			} else if (!section.startsWith("_") && !section.startsWith("._")) {
				out[history + `${section.startsWith(".") ? "._" + section.slice(0) : "_" + section}`] = value;
			}
		} else {
			if (typeof dict[key] === "object" && !array) {
				out = { ...out, ...rpc.invoke('metadata:flatten', dict[key], process, history + section, (section).endsWith(":") ? `${key}` : `.${key}`) };
			} else if (key === "_default") {
				out[history + section] = value;
			} else if (!key.startsWith("_")) {
				out[`${history + section}${(section).endsWith(":") ? key : `.${key}`}`] = value;
			}
		}
	}

	return out;
});