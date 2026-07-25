const { app } = require("electron");
const rpc = require("./rpc");
const Mpv = require("mpv").default;

// the mpv file
const path = process.platform === "win32"
	? "src/resources/bin/Chrysalis.exe"
	: "src/resources/bin/Chrysalis";

async function startPlayer() {
	try {
		const player = await Mpv({
			args: [
				'--audio-client-name=Chrysalis',
				'--no-video', '--no-audio-display',
				'--pause'
			],
			path: path
		});

		app.on('will-quit', () =>{
			player.end();
		});

		// if the playlist is currently shuffled
		let shuffled = false;
		// the current loop mode, true = Playlist, false = None, null = Track.
		let looping = false;
		// the current status, true = Playing, false = Paused, null = Stopped.
		let playing = false;
		// the stopped id, this is used internally instead of 'playing'
		// -1 = playing/paused, 0 = stopped with no previous song, 1+ = the id of the song that was playing before Chrysalis was stopped.
		let stopped = 0;
		// the current time of the playing song
		let position = 0;

		// built in methods
		rpc.handle('player:play-pause', async () => {
			try {
				if (stopped > 0) {
					const playlist = await player.get('playlist');
					const index = playlist.findIndex(song => song.id === stopped);
					if (index !== -1) {
						await player.command('playlist-play-index', index);
						await player.set('pause', false);
						stopped = -1;
						return true;
					}
				} else if (stopped === 0) {
					await player.command('playlist-play-index', 0);
					await player.set('pause', false);
					stopped = -1;
					return true;
				} else {
					const play = !await player.get('pause');
					await player.set('pause', play);
					return !play;
				}
			} catch (e) {
				console.error(`player:play-pause exeption: ${e}`);
				return null;
			}
		});

		rpc.handle('player:play', async () => {
			try {
				if (stopped > 0) {
					const playlist = await player.get('playlist');
					const index = playlist.findIndex(song => song.id === stopped);
					if (index !== -1) {
						await player.command('playlist-play-index', index);
						await player.set('pause', false);
						stopped = -1;
					}
				} else if (stopped === 0) {
					await player.command('playlist-play-index', 0);
					await player.set('pause', false);
					stopped = -1;
				} else {
					await player.set('pause', false);
				}
			} catch (e) {
				console.error(`player:play exeption: ${e}`);
			}
		});

		rpc.handle('player:pause', () => {
			try {
				player.set('pause', true);
			} catch (e) {
				console.error(`player:pause exeption: ${e}`);
			}
		});

		rpc.handle('player:stop', async (event, unsafe) => {
			try {
				const pos = await player.get('playlist-pos');
				if (pos !== -1) {
					const playlist = await player.get('playlist');
					stopped = playlist[pos].id;
					await player.set('pause', true);
					await player.command('stop', 'keep-playlist');
				} else if (unsafe) {
					stopped = 0;
					await player.set('pause', true);
					await player.command('stop', 'keep-playlist');
				}
			} catch (e) {
				console.error(`player:stop exeption: ${e}`);
			}
		});

		rpc.handle('player:next', async () => {
			try {
				if (stopped === -1) {
					const pos = await player.get('playlist-pos');
					const count = await player.get('playlist-count') - 1;
					if (pos === count) {
						if (looping === false) {
							await rpc.invoke('player:stop');
							return;
						} else {
							await player.command('playlist-play-index', 0);
						}
					} else {
						await player.command('playlist-play-index', pos + 1);
					}
					await rpc.invoke('player:play');
				} else {
					await player.command('playlist-play-index', 0);
					await player.set('pause', false);
					stopped = -1;
				}
			} catch (e) {
				console.error(`player:next exeption: ${e}`);
			}
		});

		rpc.handle('player:prev', async () => {
			try {
				if (stopped === -1) {
					const time = await player.get('time-pos');
					const pos = await player.get('playlist-pos');
					if (time > 5) {
						await player.command('playlist-play-index', pos);
						await rpc.invoke('player:play');
					} else {
						if (pos === 0) {
							if (looping === false) {
								await player.command('playlist-play-index', pos);
							} else {
								await player.command('playlist-play-index', await player.get('playlist-count') - 1);
							}
						} else {
							await player.command('playlist-play-index', pos - 1);
						}
						await rpc.invoke('player:play');
					}
				} else {
					const count = await player.get('playlist-count') - 1;
					await player.command('playlist-play-index', count);
					await player.set('pause', false);
					stopped = -1;
				}
			} catch (e) {
				console.error(`player:prev exeption: ${e}`)
			}
		});

		rpc.handle('player:loop', (event, loop) => {
			try {
				if (loop) {
					player.set('loop-file','no');
					player.set('loop-playlist','inf');
				} else {
					player.set('loop-playlist','no')
					if (loop === null)
						player.set('loop-file','inf');
					else
						player.set('loop-file','no');
				}
				return loop;
			} catch (e) {
				console.error(`player:loop exeption: ${e}`);
			}
		});

		rpc.handle('player:shuffle', (event, status, safe) => {
			try {
				if (!safe) shuffled = status;
				if (shuffled) {
					player.command('playlist-shuffle');
					if (!safe) rpc.invoke('plugins:shuffle-changed', true);
				} else {
					player.command('playlist-unshuffle');
					if (!safe) rpc.invoke('plugins:shuffle-changed', false);
				}
				return shuffled;
			} catch (e) {
				console.error(`player:shuffle exeption: ${e}`);
			}
		});

		rpc.handle('player:get-time', () => {
			try {
				return position;
			} catch (e) {
				console.error(`player:get-time exeption: ${e}`);
			}
		});

		rpc.handle('player:set-time', async (event, time) => {
			try {
				await player.command('seek', time, "absolute");
				return await player.get('time-pos');
			} catch (e) {
				console.error(`player:set-time exeption: ${e}`);
			}
		});

		rpc.handle('player:shift-time', async (event, offset) => {
			try {
				await player.command('seek', offset);
				return await player.get('time-pos');
			} catch (e) {
				console.error(`player:shift-time exeption: ${e}`);
			}
		});

		rpc.handle('player:get-volume', async () => {
			try {
				return await player.get('volume');
			} catch (e) {
				console.error(`player:get-volume exeption: ${e}`);
			}
		});

		rpc.handle('player:set-volume', async (event, volume) => {
			try {
				await player.set('volume', Math.abs(Math.min(volume, 130)));
				return await rpc.invoke('player:get-volume');
			} catch (e) {
				console.error(`player:set-volume exeption: ${e}`);
			}
		});

		rpc.handle('player:shift-volume', async (event, offset) => {
			try {
				const volume = Math.max(Math.min(await rpc.invoke('player:get-volume') + offset, 130), 0);
				await player.set('volume', volume);
				return volume;
			} catch (e) {
				console.error(`player:shift-volume exeption: ${e}`);
			}
		});

		rpc.handle('player:get-status', () => {
			try {
				return playing;
			} catch (e) {
				console.error(`player:get-status exeption: ${e}`);
			}
		});

		rpc.handle('player:get-looping', () => {
			try {
				return looping;
			} catch (e) {
				console.error(`player:get-looping exeption: ${e}`);
			}
		});

		rpc.handle('player:get-shuffled', () => {
			try {
				return shuffled;
			} catch (e) {
				console.error(`player:get-shuffled exeption: ${e}`);
			}
		});

		// temporary methods
		rpc.handle('player:open', async (event, path, append) => {
			try {
				const uri = forceUri(path);
				const check = new URL(uri);
				const playlist = await player.get('playlist');
				const has = playlist.findIndex(song => compareUris(forceUri(song.filename), uri));
				if (has === -1) {
					await player.command('loadfile', uri, 'append');
					if (!append) {
						const count = await player.get('playlist-count') - 1;
						await player.command('playlist-play-index', count);
						await player.set('pause', false);
						stopped = -1;
					}
					return [true, check.href];
				} else {
					if (!append) {
						await player.command('playlist-play-index', has);
						await player.set('pause', false);
						stopped = -1;
					} else {
						const count = await player.get('playlist-count') - 1;
						await player.command('playlist-move', has, count);
					}
					return [false, check.href];
				}
			} catch (e) {
				console.error(`player:open exeption: ${e}`);
				return [];
			}
		});

		rpc.handle('player:close', async (event, path) => {
			try {
				const uri = forceUri(path);
				const check = new URL(uri);
				const playlist = await player.get('playlist');
				const has = playlist.findIndex(song => compareUris(forceUri(song.filename), uri));
				if (has !== -1) {
					await player.command('playlist-remove', has);
					return [true, check.href];
				} else return [false, check.href];
			} catch (e) {
				console.error(`player:close exeption: ${e}`);
				return [];
			}
		});

		rpc.handle('player:replace', async (event, playlist) => {
			try {
				await player.set('playlist', playlist);
				rpc.invoke('player:shuffle', true);
			} catch (e) {
				console.error(`player:replace exeption: ${e}`);
			}
		});

		rpc.handle('player:list', async () => {
			try {
				const list = await player.get('playlist');
				return list.map(song => forceUri(song.filename));
			} catch (e) {
				console.error(`player:replace exeption: ${e}`);
			}
		})

		// dangerous methods
		rpc.handle('player:get', async (event, ...args) => {
			try {
				return await player.get(...args);
			} catch (e) {
				console.error(`player:get exeption: ${e}`);
			}
		});

		rpc.handle('player:set', async (event, ...args) => {
			try {
				return await player.set(...args);
			} catch (e) {
				console.error(`player:set exeption: ${e}`);
			}
		});

		rpc.handle('player:on', async (event, ...args) => {
			try {
				return await player.on(...args);
			} catch (e) {
				console.error(`player:on exeption: ${e}`);
			}
		});

		rpc.handle('player:observe', async (event, ...args) => {
			try {
				return await player.observe(...args);
			} catch (e) {
				console.error(`player:observe exeption: ${e}`);
			}
		});

		rpc.handle('player:command', async (event, ...args) => {
			try {
				return await player.command(...args);
			} catch (e) {
				console.error(`player:command exeption: ${e}`);
			}
		});

		// when i do library i need to set playlist to a proper song list WITH the id's stored in the database,
		// with the current setup this would make ID be the proper database id automatically,
		// and would also keep id's consistant across searches and albums

		// other
		player.observe('eof-reached', async eof => {
			const pos = await player.get('playlist-pos');
			if (pos === -1 && stopped === -1) await rpc.invoke('player:stop', true);
		});
		player.observe('idle-active', async stopped => {
			if (stopped) rpc.invoke('plugins:state-changed', null);
			if (stopped) playing = null;
		});
		player.observe('pause', paused => {
			rpc.invoke('plugins:state-changed', !paused);
			playing = !paused;
		});

		player.observe('loop-playlist', loop => {
			if (loop === "inf") {
				looping = true;
				rpc.invoke("plugins:loop-changed",true)
			}
		});
		player.observe('loop-file', loop => {
			if (!loop) {
				looping = false;
				rpc.invoke("plugins:loop-changed",false)
			} else if (loop === "inf") {
				looping = null;
				rpc.invoke("plugins:loop-changed",null)
			}
		});

		player.observe('time-pos', time => {
			position = time;
			rpc.invoke('plugins:position-changed', time);
		});

		player.observe('volume', volume => {
			rpc.invoke('plugins:volume-changed', volume);
		});

		player.observe('metadata', async metadata => {
			if (metadata) {
				const playlist = await player.get('playlist');
				const current = playlist[await player.get('playlist-pos')];
				metadata.id = current.id;
				metadata.url = forceUri(current.filename);
				metadata.length = await player.get('duration');
			}
			rpc.invoke('plugins:metadata-changed', metadata);
		});

		player.on('seek', () => {
			rpc.invoke('plugins:seeked', position);
		});

		// default stuff
		rpc.invoke('player:set-volume', 50);
	} catch (e) {
		console.error(e);
	}
}

function compareUris(uri1, uri2) {
	try {
		return new URL(uri1).href === new URL(uri2).href;
	} catch (e) {
		console.error(e)
		return false;
	}
};

function forceUri(uri) {
	try {
		if (uri.startsWith('/')) uri = 'file://' + uri
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
				throw new Error(`Could not force Uri '${uri}': ${e}`);
			}
		}
	}
}


module.exports = {
	startPlayer
};