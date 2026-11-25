const rpc = require("../core/rpc");
const fs = require("fs/promises");
const Path = require("path");

// temporary list until settings exist
const enabledModules = ['mpris@chrysalis', 'stater@chrysalis'];

// the currently loaded modules
const modules = {}
// the currently active (enabled) modules
const activeModules = {};

async function doModuleStuff() {
	try {
		await registerModules(['./src/modules']);
		await activateModules(enabledModules);
	} catch (e) {
		console.error(e);
	}
}

async function registerModules(directories) {
	const folders = [];
	for (const directory of directories) {
		const entries = await fs.readdir(directory, {withFileTypes: true});
		folders.push(...entries.filter(entry => entry.isDirectory()));
	}
	for (const module of folders) {
		await registerModule(module);
	}
}

async function registerModule(path) {
	const fullPath = Path.join(path.parentPath, path.name);
	const metadata = await grabMetadata(fullPath);
	if (!metadata) return;

	modules[metadata.uuid] = {
		'metadata': metadata,
		'path': fullPath
	};
}

async function activateModules(IDs) {
	for (const id of IDs) {
		const moduleList = Object.keys(modules);
		if (moduleList.includes(id)) {
			await activateModule(modules[id]);
		}
	}
}

async function activateModule(module) {
	const parsed = Path.parse(module.path);
	if (parsed.dir === "src/modules")
		activeModules[module.metadata.uuid] = require('./' + parsed.name);
	else
		activeModules[module.metadata.uuid] = require(module.path);
	if (activeModules[module.metadata.uuid]._init) {
		activeModules[module.metadata.uuid]._init({
			path: module.path,
			metadata: module.metadata,
			invoke: (channel, ...args) => invoke(module.metadata.uuid, channel, ...args),
			send: (channel, ...args) => send(module.metadata.uuid, channel, ...args),
			handle: (channelName, listener, forbid = false) => handle(module.metadata.uuid, channelName, listener, forbid),
			has: (channel) => has(module.metadata.uuid, channel)
		});
	}
}

async function grabMetadata(path) {
	try {
		const text = await fs.readFile(Path.join(path,'metadata.json'), 'utf8');
		const metadata = JSON.parse(text);

		if (metadata.uuid === undefined) {
			throw new Error('Module Metadata does not include a \'uuid\'');
		} else if (typeof metadata.uuid !== "string") {
			throw new Error('Module Metadata does not include a valid \'uuid\' (must be a string)');
		} else if (metadata.uuid?.includes(":")) {
			throw new Error('Module Metadata does not include a valid \'uuid\' (cannot include \':\')');
		} else if (!metadata.uuid?.split("@")?.length === 2) {
			throw new Error('Module Metadata does not include a valid \'uuid\' (must include exactly one \'@\')');
		}
		if (typeof metadata.name !== "string") {
			if (!metadata.name) {
				throw new Error('Module Metadata does not include a \'name\'');
			}
			throw new Error('Module Metadata does not include a valid \'name\' (must be a string)');
		}
		if (typeof metadata.author !== "string") {
			if (!metadata.author) {
				throw new Error('Module Metadata does not include a \'author\'');
			}
			throw new Error('Module Metadata does not include a valid \'author\' (must be a string)');
		}
		if (typeof metadata.version !== "string") {
			if (!metadata.version) {
				throw new Error('Module Metadata does not include a \'version\'');
			}
			throw new Error('Module Metadata does not include a valid \'version\' (must be a string)');
		}

		return metadata;
	} catch (err) {
		console.error(`Failed to load Module Metadata for '${Path.parse(path).name}':`, err);
		return null;
	}
}

// invoke
function invoke(id, channel, ...args) {
	try {
		if (channel.split(":")[0].includes("@")) {
			// module
			if (channel.split(":").length < 2)
				throw new Error(`Channel '${channel}' is not a valid module channel (must include an id 'id:channelName')`);
			if (channel.split(":")[0].split("@").length !== 2)
				throw new Error(`Channel '${channel}' is not a valid module channel (must include exactly one '@' in the id)`);
			if (!modules[id]?.metadata?.permissions?.module?.includes(channel))
				throw new Error(`Permission for module channel '${channel}' has not been requested`);
		} else {
			// main
			if (channel.split(":").length < 2)
				throw new Error(`Channel '${channel}' is not a valid main channel (must include an id 'id:channelName')`);
			if (!modules[id]?.metadata?.permissions?.main?.includes(channel))
				throw new Error(`Permission for main channel '${channel}' has not been requested`);
		}
		return rpc.invoke(channel, ...args);
	} catch (e) {
		console.log(`Invocation for '${id}' failed with error: ${e}`);
	}
}

function send(id, channel, ...args) {
	try {
		if (channel.split(":").length < 2)
			throw new Error(`Channel '${channel}' is not a valid renderer channel (must include an id 'id:channelName')`);
		if (!modules[id]?.metadata?.permissions?.renderer?.includes(channel))
			throw new Error(`Permission for renderer channel '${channel}' has not been requested`);
		return rpc.send(channel, ...args);
	} catch (e) {
		console.log(`Send for '${id}' failed with error: ${e}`);
	}
}

// handle
function handle(id, channelName, listener) {
	const channel = id + ':' + channelName;
	return rpc.handle(channel, listener);
}

function has(id, channel) {
	if (channel.split(":")[0].includes("@")) {
		// module
		if (channel.split(":").length < 2)
			throw new Error(`Channel '${channel}' is not a valid module channel (must include an id 'id:channelName')`);
		if (channel.split(":")[0].split("@").length !== 2)
			throw new Error(`Channel '${channel}' is not a valid module channel (must include exactly one '@' in the id)`);
		if (!modules[id]?.metadata?.permissions?.module?.includes(channel))
			throw new Error(`Permission for module channel '${channel}' has not been requested`);
	} else {
		// main
		if (channel.split(":").length < 2)
			throw new Error(`Channel '${channel}' is not a valid main channel (must include an id 'id:channelName')`);
		if (!modules[id]?.metadata?.permissions?.main?.includes(channel))
			throw new Error(`Permission for main channel '${channel}' has not been requested`);
	}
	return rpc.has(channel);
}

// subscriptions
rpc.handle('modules:subscribe', async (event, id, ...args) => {
	const call = id.toLowerCase().replace(/[^a-zA-Z0-9]+(.)/g, (match, chr) => chr.toUpperCase());
	const subscribers = [];
	for (const moduleID of Object.keys(activeModules)) {
		try {
			const module = modules[moduleID];
			if (module.metadata?.permissions?.subscribe?.includes(id)) {
				if (activeModules[moduleID]["_" + call])
					subscribers.push(activeModules[moduleID]["_" + call](...args));
				else throw new Error(`The module '${moduleID}' requested '${id}' but does not expose '${"_" + call}'`);
			}
		} catch (e) {
			console.log(`Error while sending data to '${moduleID}': ${e}`);
		}
	}
	for (const subscriber of subscribers) {
		await subscriber;
	}
});

module.exports = {
	doModuleStuff
};