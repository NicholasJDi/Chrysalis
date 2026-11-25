const fs = require("fs/promises");
const Path = require("path");

let API;

let CHRYSALIS_DIRECTORY;

let state = null;
let loading = false;

async function _init(api) {
	API = api;
	CHRYSALIS_DIRECTORY = await API.invoke('library:expand-path', '~/chrysalis');
	API.handle("save", () => {
		save()
	});
	API.handle("load", () => {
		load()
	});
}

async function save() {
	try {
		await fs.mkdir(CHRYSALIS_DIRECTORY, { recursive: true });
		await fs.writeFile(
			Path.join(CHRYSALIS_DIRECTORY, 'state.json'),
			JSON.stringify(state, null, '\t')
		);
	} catch (e) {
		console.warn(`stater@chrysalis:save exception: ${e}`);
	}
}

async function load() {
	loading = true;
	try {
		state = JSON.parse(
			await fs.readFile(
				Path.join(CHRYSALIS_DIRECTORY, 'state.json'), 'utf8'
			)
		);
		if (!state) {
			return;
		}
		if (state.volume !== undefined) {
			await API.invoke('player:volume.set', state.volume);
		}
		if (state.looping !== undefined) {
			await API.invoke('player:loop', state.looping);
		}
		if (state.shuffled !== undefined) {
			await API.invoke('player:shuffle', state.shuffled);
		}
		if (state.id) {
			await API.invoke('player:play', state.id)
			if (!state.playing) {
				await API.invoke('player:pause');
			}
			if (!state.time) {
				loading = false;
			}
		}
	} catch (e) {
		console.warn(`stater@chrysalis:load exception: ${e}`);
	}
	if (!state) {
		state = {};
	}
	state.version = await API.invoke('app:version');
}

async function _quitRequested() {
	await save();
}

async function _playlistChanged() {
	if (!state) {
		await load();
	}
}

function _trackChanged(id) {
	if (id === 0) {
		delete state.id
		delete state.playing;
		delete state.time;
	} else {
		state.id = id;
	}
}

function _loopChanged(looping) {
	state.looping = looping;
}

function _shuffleChanged(shuffle) {
	state.shuffled = shuffle;
}

function _stateChanged(playing) {
	state.playing = playing;
}

function _positionChanged(time) {
	state.time = time;
}

function _seeked(time) {
	if (loading) {
		API.invoke('player:time.set', state.time)
		loading = false;
	}
}

function _volumeChanged(volume) {
	state.volume = volume;
}

module.exports = {
	_init,
	_quitRequested,
	_playlistChanged,
	_trackChanged,
	_loopChanged,
	_shuffleChanged,
	_stateChanged,
	_positionChanged,
	_seeked,
	_volumeChanged
};