const rpc = require("../rpc");
const fs = require("fs/promises");
const Path = require("path");

const AUDIO_FORMATS = ['.mp3','.ogg','.wav','.flac','.m4a','.opus'];
const IMAGE_FORMATS = ['.png','.jpeg','.jpg','.webp','.svg'];

const CHRYSALIS_DIRECTORY = '/home/nicholasjdi/chrysalis';
const METADATA_DIRECTORY = '/home/nicholasjdi/chrysalis/metadata';

// the base index of libraryId -> metadataPath
let index = { "default":1 };
// the libraryId order to be given to ui and the playlist (if ids are in the index but not here they will not be shown in ui)
let order = [];
// the index of libraryId -> songPath
let files = {};

function init() {
	rpc.invoke('library:load');
}

// loads the index from index.json and fills files (requests metadata)
rpc.handle('library:load', async () => {
	try {
		index = JSON.parse(
			await fs.readFile(
				Path.join(CHRYSALIS_DIRECTORY, 'index.json'), "utf8"
			)
		);
		const keys = Object.keys(index)
		for (const id of keys) {
			if (id === "default") continue;
			files[id] = await rpc.invoke("metadata:load", id, index[id]);
		}
		if (!index.default) {
			index.default = Number(keys[keys.length - 1]) + 1;
		}
		await rpc.invoke('library:save');
	} catch (e) {
		console.warn(`libary:load exception: ${e}`);
		rpc.invoke('library:save');
	}
});

// saves the index to index.json
rpc.handle('library:save', async () => {
	try {
		const list = { ...index };
		delete list["default"];
		order = Object.keys(list);
		await rpc.invoke('player:replace', order, order.map(id => files[id]));
		await fs.mkdir(CHRYSALIS_DIRECTORY, { recursive: true });
		await fs.writeFile(
			Path.join(CHRYSALIS_DIRECTORY, 'index.json'),
			JSON.stringify(index, null, "\t")
		);
	} catch (e) {
		console.error(`library:save exception: ${e}`);
	}
});

// adds a file to the index or plays it if it is already in the index
rpc.handle('library:open', async (event, uri) => {
	try {
		uri = await rpc.invoke('library:uri', uri);
		const id = Object.values(files).findIndex(path => uriCompare(path, uri));
		if (id !== -1) {
			await rpc.invoke('player:play', Object.keys(index)[id]);
			return [false, uri];
		}
		index[index.default] = Path.join(METADATA_DIRECTORY, changeExtension(Path.basename(uri), ".crsim"));
		rpc.invoke('metadata:create', index.default, index[index.default], uri);
		files[index.default] = uri;
		index.default++;
		await rpc.invoke('library:save');
		return [true, uri];
	} catch (e) {
		console.error(`library:add exception: ${e}`);
		return [];
	}
});

// removes a file from the index
rpc.handle('library:close', async (event, uri) => {
	try {
		uri = await rpc.invoke('library:uri', uri);
		const list = Object.values(files);
		const id = list.findIndex(path => uriCompare(path, uri));
		if (id === -1) return [false, uri];
		delete index[Object.keys(index)[id]];
		await rpc.invoke('library:save');
		return [true, uri];
	} catch (e) {
		console.error(`library:remove exception: ${e}`);
		return [];
	}
});

rpc.handle('library:track-changed', async (event, id, length) => {
	if (rpc.invoke('metadata:get', id, "length") !== length) rpc.invoke('metadata:set', id, length, "length");
	rpc.invoke('metadata:update', id);
});

rpc.handle('library:get', (event, id) => {
	return index?.[id];
});

rpc.handle("library:scan", async (event, directory, type, recursive) => {
	let extensions = [];
	switch (type) {
		case "audio":
			extensions = AUDIO_FORMATS;
			break;
		case "image":
			extensions = IMAGE_FORMATS;
			break;
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
				(extensions.includes(Path.extname(entry.name).toLowerCase()) || extensions.length === 0))
			.map(entry => Path.join(entry.parentPath, entry.name));
	} catch (e) {
		console.warn(`Failed to scan ${directory}: ${e}`);
		return [];
	}
}

rpc.handle('library:uri', (event, uri) => uriForce(uri));
function uriForce(uri) {
	const uri0 = uri;
	try {
		if (uri.startsWith('/')) uri = 'file://' + uri
		while (uri.endsWith('/')) {
			uri = uri.slice(0, uri.length - 1);
		}
		if (new URL(uri)) return uri;
	} catch (e) {
		try {
			const uri1 = encodeURI(uri);
			if (new URL(uri1)) return uri1;
		} catch (e) {
			try {
				const uri2 = encodeURIComponent(uri);
				if (new URL(uri2)) return uri2;
			} catch (e) {
				throw new Error(`Could not force Uri '${uri}' ('${uri0}'): ${e}`);
			}
		}
	}
}

rpc.handle('library:uri-compare', (event, uri1, uri2) => uriCompare(uri1, uri2));
function uriCompare(uri1, uri2) {
	try {
		return new URL(uri1).href === new URL(uri2).href;
	} catch (e) {
		console.warn(`library:uri-compare exception: ${e}`)
		return false;
	}
}

function changeExtension(filePath, newExt) {
	const parsedPath = Path.parse(filePath);

	parsedPath.ext = newExt.startsWith('.') ? newExt : `.${newExt}`;

	parsedPath.base = '';

	return Path.format(parsedPath);
}

module.exports = {
	metadata: require("./metadata"),
	init
};