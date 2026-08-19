const rpc = require("../rpc");
const fs = require("fs/promises");
const Path = require("path");

const AUDIO_FORMATS = ['.mp3','.ogg','.wav','.flac','.m4a','.opus'];
const IMAGE_FORMATS = ['.png','.jpeg','.jpg','.webp','.svg']

const CHRYSALIS_DIRECTORY = '/home/nicholasjdi/chrysalis'

let index = { default:1 };

function init() {
	rpc.invoke('library:load');
}

rpc.handle('library:load', async () => {
	try {
		index = JSON.parse(
			await fs.readFile(
				Path.join(CHRYSALIS_DIRECTORY, 'index.json'), "utf8"
			)
		);
		for (const id of Object.keys(index)) {
			try {
				new URL(index[id]);
			} catch {
				index[id] = await rpc.invoke('library:uri', index[id]);
			}
		}
		await rpc.invoke('library:save');
	} catch (e) {
		console.warn(`libary:load exception: ${e}`);
	}
});

rpc.handle('library:save', async () => {
	try {
		await rpc.invoke('player:replace', Object.keys(index), Object.values(index));
		await fs.mkdir(CHRYSALIS_DIRECTORY, { recursive: true });
		await fs.writeFile(
			Path.join(CHRYSALIS_DIRECTORY, 'index.json'),
			JSON.stringify(index, null, "\t")
		);
	} catch (e) {
		console.error(`library:save exception: ${e}`);
	}
});

rpc.handle('library:open', async (event, uri) => {
	try {
		uri = await rpc.invoke('library:uri', uri);
		const id = Object.values(index).findIndex(path => uriCompare(path, uri));
		if (id !== -1) {
			console.log(id)
			console.log(Object.keys(index))
			console.log(Object.keys(index)[id])
			await rpc.invoke('player:play', Object.keys(index)[id]);
			return [false, uri];
		}
		index[index.default] = uri;
		index.default++;
		await rpc.invoke('library:save');
		return [true, uri];
	} catch (e) {
		console.error(`library:add exception: ${e}`);
		return [];
	}
});

rpc.handle('library:close', async (event, uri) => {
	try {
		uri = await rpc.invoke('library:uri', uri);
		const list = Object.values(index);
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

rpc.handle('library:track-changed', (event, id) => {

});

rpc.handle('library:get', (event, id) => {
	return index?.[id];
});

rpc.handle("library:scan", async (event, directory, type, recursive) => {
	let extensions = [];
	switch (type) {
		case "audio":
			extensions = AUDIO_FORMATS;
		case "image":
			extensions = IMAGE_FORMATS;
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
			.map(entry => Path.join(entry.parentPath, entry.name));
	} catch (e) {
		console.warn(`Failed to scan ${directory}: ${e}`);
		return [];
	}
}

rpc.handle('library:uri', (event, uri) => {
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
});

rpc.handle('library:uri-compare', (event, uri1, uri2) => uriCompare(uri1, uri2));
function uriCompare(uri1, uri2) {
	try {
		return new URL(uri1).href === new URL(uri2).href;
	} catch (e) {
		console.warn(`library:uri-compare exception: ${e}`)
		return false;
	}
}

module.exports = {
	metadata: require("./metadata"),
	init
};