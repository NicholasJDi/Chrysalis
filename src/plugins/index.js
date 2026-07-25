const rpc = require("./../core/rpc");
const fs = require("fs/promises");
const Path = require("path");

// const settings = require("././core/settings/plugins");
const enabledPlugins = [...process.platform === 'linux' ? ["mpris@chrysalis"] : []];
const forbidden = {
	"main": [],
	"renderer": [],
	"plugins": []
};

const plugins = {};
const activePlugins = {};

async function doPluginStuff() {
	try {
		await registerPlugins(["./src/plugins"]);
		await activatePlugins(enabledPlugins);
	} catch (e) {
		console.error(e);
	}
}

async function registerPlugins(directorys) {
	const folders = [];
	for (const directory of directorys) {
		const entries = await fs.readdir(directory, {withFileTypes: true});
		folders.push(...entries.filter(entry => entry.isDirectory()));
	}
	for (const plugin of folders) {
		await registerPlugin(plugin);
	}
}

async function registerPlugin(path) {
	const fullPath = Path.join(path.parentPath,path.name);
	const metadata = await grabMetadata(fullPath);
	if (!metadata) return;

	plugins[metadata.uuid] = {
		"metadata": metadata,
		"path": fullPath
	};
}

async function activatePlugins(IDs) {
	for (const id of IDs) {
		const pluginList = Object.keys(plugins);
		if (pluginList.includes(id)) {
			await activatePlugin(plugins[id]);
		}
	}
}

async function activatePlugin(plugin) {
	const parsed = Path.parse(plugin.path);
	if (parsed.dir === "src/plugins")
		activePlugins[plugin.metadata.uuid] = require("./" + parsed.name);
	else
		activePlugins[plugin.metadata.uuid] = require(plugin.path);
	if (activePlugins[plugin.metadata.uuid]._init) {
		activePlugins[plugin.metadata.uuid]._init({
			path: plugin.path,
			metadata: plugin.metadata,
			invoke: (channel, ...args) => invoke(plugin.metadata.uuid, channel, ...args),
			send: (channel, ...args) => send(plugin.metadata.uuid, channel, ...args),
			handle: (channelName, listener, forbid = false) => handle(plugin.metadata.uuid, channelName, listener, forbid),
			has: (channel) => has(plugin.metadata.uuid, channel)
		});
	}
}

async function grabMetadata(path) {
	try {
		const text = await fs.readFile(Path.join(path,"metadata.json"), "utf8");
		const metadata = JSON.parse(text);

		if (typeof metadata.uuid !== "string") {
			if (!metadata.uuid) {
				throw new Error("Plugin Metadata does not include a 'uuid'");
			} else if (metadata.uuid?.includes(":")) {
				throw new Error("Plugin Metadata does not include a valid 'uuid' (cannot include ':')");
			} else if (!metadata.uuid?.split("@")?.length === 2) {
				throw new Error("Plugin Metadata does not include a valid 'uuid' (must include exactly one '@')");
			} else {
				throw new Error("Plugin Metadata does not include a valid 'uuid' (must be a string)");
			}
		}
		if (typeof metadata.name !== "string") {
			if (!metadata.name) {
				throw new Error("Plugin Metadata does not include a 'name'");
			}
			throw new Error("Plugin Metadata does not include a valid 'name' (must be a string)");
		}
		if (typeof metadata.author !== "string") {
			if (!metadata.author) {
				throw new Error("Plugin Metadata does not include a 'author'");
			}
			throw new Error("Plugin Metadata does not include a valid 'author' (must be a string)");
		}
		if (typeof metadata.version !== "string") {
			if (!metadata.version) {
				throw new Error("Plugin Metadata does not include a 'version'");
			}
			throw new Error("Plugin Metadata does not include a valid 'version' (must be a string)");
		}

		return metadata;
	} catch (err) {
		console.error(`Failed to load plugin metadata for '${Path.parse(path).name}':`, err);
		return null;
	}
}

// invoke
async function invoke(id, channel, ...args) {
	try {
		if (channel.split(':')[0].includes("@")) {
			// plugin
			if (channel.split(':').length < 2)
				throw new Error(`Channel '${channel}' is not a valid plugin channel (must include an id 'id:channelName')`);
			if (channel.split(':')[0].split("@").length !== 2)
				throw new Error(`Channel '${channel}' is not a valid plugin channel (must include exactly one '@' in the id)`);
			if (forbidden.plugin.includes(channel))
				throw new Error(`The plugin channel '${channel}' is forbidden`);
			if (!plugins[id]?.metadata?.permissions?.plugin?.includes(channel))
				throw new Error(`Permission for plugin channel '${channel}' has not been requested`);
		} else {
			// main
			if (channel.split(':').length < 2)
				throw new Error(`Channel '${channel}' is not a valid main channel (must include an id 'id:channelName')`);
			if (forbidden.main.includes(channel))
				throw new Error(`The main channel '${channel}' is forbidden`);
			if (!plugins[id]?.metadata?.permissions?.main?.includes(channel))
				throw new Error(`Permission for main channel '${channel}' has not been requested`);
		}
		return await rpc.invoke(channel, ...args);
	} catch (e) {
		console.log(`Invocation for '${id}' failed with error: ${e}`);
	}
}

function send(id, channel, ...args) {
	try {
		if (channel.split(':').length < 2)
			throw new Error(`Channel '${channel}' is not a valid renderer channel (must include an id 'id:channelName')`);
		if (forbidden.renderer.includes(channel))
			throw new Error(`The renderer channel '${channel}' is forbidden`);
		if (!plugins[id]?.metadata?.permissions?.renderer?.includes(channel))
			throw new Error(`Permission for renderer channel '${channel}' has not been requested`);
		return rpc.send(channel, ...args);
	} catch (e) {
		console.log(`Send for '${id}' failed with error: ${e}`);
	}
}

// handle
function handle(id, channelName, listener, forbid) {
	const channel = id + ":" + channelName;
	if (forbid) forbidden.plugins.push(channel);
	return rpc.handle(channel, listener);
}

function has(id, channel) {
	if (channel.split(':')[0].includes("@")) {
		// plugin
		if (channel.split(':').length < 2)
			throw new Error(`Channel '${channel}' is not a valid plugin channel (must include an id 'id:channelName')`);
		if (channel.split(':')[0].split("@").length !== 2)
			throw new Error(`Channel '${channel}' is not a valid plugin channel (must include exactly one '@' in the id)`);
		if (forbidden.plugin.includes(channel))
			throw new Error(`The plugin channel '${channel}' is forbidden`);
		if (!plugins[id]?.metadata?.permissions?.plugin?.includes(channel))
			throw new Error(`Permission for plugin channel '${channel}' has not been requested`);
	} else {
		// main
		if (channel.split(':').length < 2)
			throw new Error(`Channel '${channel}' is not a valid main channel (must include an id 'id:channelName')`);
		if (forbidden.main.includes(channel))
			throw new Error(`The main channel '${channel}' is forbidden`);
		if (!plugins[id]?.metadata?.permissions?.main?.includes(channel))
			throw new Error(`Permission for main channel '${channel}' has not been requested`);
	}
	return rpc.has(channel);
}

// subscriptions
function subscribe(id, call, ...args) {
	for (const pluginID of Object.keys(activePlugins)) {
		try {
			const plugin = plugins[pluginID];
			if (plugin.metadata?.permissions?.subscribe?.includes(id)) {
				if (activePlugins[pluginID]["_" + call])
					activePlugins[pluginID]["_" + call](...args);
				else throw new Error(`The plugin '${pluginID}' requested '${id}' but does not expose '${"_" + call}'`);
			}
		} catch (e) {
			console.log(`Error while sending data to '${pluginID}': ${e}`);
		}
	}
}

rpc.handle('plugins:metadata-changed', (event, metadata) => {
	subscribe('metadata-changed', "playerMetadataChanged", metadata);
});

rpc.handle('plugins:loop-changed', (event, looping) => {
	subscribe('loop-changed', "playerLoopChanged", looping);
});

rpc.handle('plugins:shuffle-changed', (event, shuffle) => {
	subscribe('shuffle-changed', "playerShuffleChanged", shuffle);
});

rpc.handle('plugins:state-changed', (event, playing) => {
	subscribe('state-changed', "playerStateChanged", playing);
});

rpc.handle('plugins:position-changed', (event, time) => {
	subscribe('position-changed', "playerPositionChanged", time);
});

rpc.handle('plugins:seeked', (event, time) => {
	subscribe('seeked', "playerSeeked", time);
});

rpc.handle('plugins:volume-changed', (event, time) => {
	subscribe('volume-changed', "playerVolumeChanged", time);
});

module.exports = {
	doPluginStuff
};