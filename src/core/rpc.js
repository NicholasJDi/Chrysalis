const { ipcMain } = require("electron");

const handlers = {};

let window = null;
function allowSends(win) {
	window = win;
}

// handle a channel (both main and renderer can invoke it)
function handle(channel, listener) {
	ipcMain.handle(channel, listener);
	handlers[channel] = listener;
}

// check if a channel is registered
function has(channel) {
	return channel in handlers;
}

// invoke a channel from main
async function invoke(channel, ...args) {
	if (!handlers[channel]) throw new Error(`There is no handler for the requested channel '${channel}'`);
	return await handlers[channel](null, ...args);
}

// send data to the renderer
function send(channel, ...args) {
	if (window) window.send(channel, ...args);
}

module.exports = {
	handle,
	invoke,
	allowSends,
	send
};