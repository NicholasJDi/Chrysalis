const mpris = require("mpris-service");

let API

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
	API = api
	API.handle("reset", () => {
		player.metadata = {};
		player.playbackStatus = mpris.PLAYBACK_STATUS_STOPPED;
	});
}

function _playerMetadataChanged(metadata) {
	const data = {};
	// mpris (Media Player Remote Interfacing Specification)
	if (metadata?.["_processed"]?.id) data['mpris:trackid'] = player.objectPath(`track/${metadata["_processed"].id}`);
	if (metadata?.length) data['mpris:length'] = metadata.length * 1_000_000;
	if (metadata?.["_processed"]?.art?.["_default"]) data['mpris:artUrl'] = metadata["_processed"].art["_default"];
	// xesam (eXtEnsible Search And Metadata)
	if (metadata?.path) data['xesam:url'] = metadata.path;
	if (metadata?.["_processed"]?.title) data['xesam:title'] = metadata["_processed"].title;
	if (metadata?.["_processed"]?.artists) data['xesam:artist'] = metadata["_processed"].artists;
	if (metadata?.["_processed"]?.album) data['xesam:album'] = metadata["_processed"].album;
	if (metadata?.["_processed"]?.genre) data['xesam:genre'] = metadata["_processed"].genre;
	if (metadata?.["_processed"]?.art?.artists) data['xesam:albumArtist'] = metadata["_processed"].art.artists;
	if (metadata?.["_processed"]?.disc) data['xesam:discNumber'] = metadata["_processed"].disc.toString()
	if (metadata?.["_processed"]?.track) data['xesam:trackNumber'] = metadata["_processed"].track.toString()
	if (metadata?.["_processed"]?.bpm) data['xesam:audioBPM'] = metadata["_processed"].bpm.toString()
	// crsim (Customizable, Rich, Supplemental Information Metadata / ChRySalIs Metadata)
	delete metadata.path;


	player.metadata = data;
}

function _playerLoopChanged(looping) {
	player.loopStatus =  looping ? mpris.LOOP_STATUS_PLAYLIST : looping === false ? mpris.LOOP_STATUS_NONE : mpris.LOOP_STATUS_TRACK;
}

function _playerShuffleChanged(shuffle) {
	player.shuffle =  shuffle;
}

function _playerStateChanged(playing) {
	player.playbackStatus =  playing ? mpris.PLAYBACK_STATUS_PLAYING : playing === false ? mpris.PLAYBACK_STATUS_PAUSED : mpris.PLAYBACK_STATUS_STOPPED;
}

function _playerPositionChanged(time) {
	position = time;
}

function _playerSeeked(time) {
	player.seeked(time * 1_000_000);
}

function _playerVolumeChanged(volume) {
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
	_playerMetadataChanged,
	_playerLoopChanged,
	_playerShuffleChanged,
	_playerStateChanged,
	_playerPositionChanged,
	_playerSeeked,
	_playerVolumeChanged
};