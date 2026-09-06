const mpris = require("mpris-service");
const { setTimeout } = require("timers/promises")

let API;

let loading = false;
let position = 0;

const player = mpris({
	name: "chrysalis",
	identity: "Chrysalis",
	volume: 0.5,
	shuffle: false,
	playbackStatus: mpris.PLAYBACK_STATUS_STOPPED,
	loopStatus: mpris.LOOP_STATUS_NONE,
	supportedInterfaces: ['player'],
	supportedUriSchemes: ['file','http','https'],
	canControl: true,
	canPlay: true,
	canPause: true,
	canSeek: true,
	canGoNext: true,
	canGoPrevious: true
});

player.getPosition = () => {
	return position * 1_000_000;
};

function _init(api) {
	API = api;
	API.handle("reset", () => {
		player.metadata = {};
		player.playbackStatus = mpris.PLAYBACK_STATUS_STOPPED;
	});
}

function _trackChanged(id) {
	loading = true;
	position = 0;
	forceZero();
}

async function forceZero() {
	while (loading) {
		if (position !== 0 || player.playbackStatus === mpris.PLAYBACK_STATUS_STOPPED)
			return;
		if (player.playbackStatus !== mpris.PLAYBACK_STATUS_PAUSED) {
			player.seeked(0);
		}
		await setTimeout(900);
	}
}

async function _metadataChanged(metadata, processed) {
	const data = {};
	// mpris (Media Player Remote Interfacing Specification)
	if (processed?.id) data['mpris:trackid'] = player.objectPath(`track/${processed.id}`);
	if (metadata?.length) data['mpris:length'] = metadata.length * 1_000_000;
	if (processed?.art?.["_default"]) data['mpris:artUrl'] = processed.art["_default"];
	// xesam (eXtEnsible Search And Metadata)
	if (metadata?.path) data['xesam:url'] = metadata.path;
	if (processed?.title) data['xesam:title'] = processed.title;
	if (processed?.artists) data['xesam:artist'] = processed.artists;
	if (processed?.album) data['xesam:album'] = processed.album;
	if (processed?.genre) data['xesam:genre'] = processed.genre;
	if (processed?.art?.artists) data['xesam:albumArtist'] = processed.art.artists;
	if (processed?.disc) data['xesam:discNumber'] = processed.disc.toString()
	if (processed?.track) data['xesam:trackNumber'] = processed.track.toString()
	if (processed?.bpm) data['xesam:audioBPM'] = processed.bpm.toString()
	// crsim (Customizable, Rich, Supplemental Information Metadata / ChRySalIs Metadata)
	const crsim = await API.invoke("metadata:flatten", metadata);

	player.metadata = { ...data, ...crsim };
}

function _loopChanged(looping) {
	player.loopStatus =  looping ? mpris.LOOP_STATUS_PLAYLIST : looping === false ? mpris.LOOP_STATUS_NONE : mpris.LOOP_STATUS_TRACK;
}

function _shuffleChanged(shuffle) {
	player.shuffle =  shuffle;
}

function _stateChanged(playing) {
	player.playbackStatus =  playing ? mpris.PLAYBACK_STATUS_PLAYING : playing === false ? mpris.PLAYBACK_STATUS_PAUSED : mpris.PLAYBACK_STATUS_STOPPED;
}

function _positionChanged(time) {
	position = time;
}

function _seeked(time) {
	loading = false;
	position = time;
	player.seeked(position * 1_000_000);
}

function _volumeChanged(volume) {
	player.volume = volume / 100;
}

player.on('playpause', async () => {
	if (API) API.invoke("player:play-pause");
});

player.on('play', async () => {
	if (API) API.invoke("player:play");
});

player.on('pause', async () => {
	if (API) API.invoke("player:pause");
});

player.on('stop',() => {
	if (API) API.invoke("player:stop");
});

player.on('position', (event) => {
	if (API && event.trackId === player.metadata['mpris:trackid']) API.invoke("player:set-time", event.position / 1_000_000);
});

player.on('seek', (time) => {
	if (API) API.invoke("player:shift-time", time / 1_000_000);
});

player.on('volume', (volume) => {
	if (API) API.invoke("player:set-volume", volume * 100);
});

player.on('next',() => {
	if (API) API.invoke("player:next");
});

player.on('previous',() => {
	if (API) API.invoke("player:prev");
});

player.on('loopStatus', status => {
	if (API) {
		if (status === "None") API.invoke("player:loop", false);
		else if (status === "Track") API.invoke("player:loop", null);
		else if (status === "Playlist") API.invoke("player:loop", true);
	}
});

player.on('shuffle', shuffle => {
	if (API) API.invoke('player:shuffle', shuffle);
});

player.on('open', path => {
	if (API) API.invoke('library:open', path.uri);
});

player.on('raise', () => {
	if (API) API.invoke("app:raise");
});

player.on('quit', () => {
	if (API) API.invoke('app:quit');
});

module.exports = {
	_init,
	_trackChanged,
	_metadataChanged,
	_loopChanged,
	_shuffleChanged,
	_stateChanged,
	_positionChanged,
	_seeked,
	_volumeChanged
};