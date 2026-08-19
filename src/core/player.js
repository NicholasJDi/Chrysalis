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
		// -1 = playing/paused, 0 = stopped with no previous song, 1+ = the libraryId of the song that was playing before Chrysalis was stopped.
		let stopped = 0;
		// the current time of the playing song
		let position = 0;
		// track index of mpvId -> LibraryId
		let idIndex = {}
		// if after 'player:replace' there is a untracked song
		let reloading = false

		// built in methods
		rpc.handle('player:play-pause', async (event, id) => {
			try {
				const ids = Object.values(idIndex);
				if (playing !== true && ids.includes(id)) {
					const playlist = await player.get('playlist');
					const index = playlist.findIndex(song => idIndex[song.id] === id);
					if (index !== -1) {
						await player.command('playlist-play-index', index);
						await player.set('pause', false);
						stopped = -1;
						return true;
					}
				} else if (stopped > 0) {
					const playlist = await player.get('playlist');
					const index = playlist.findIndex(song => idIndex[song.id] === stopped);
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
				console.error(`player:play-pause exception: ${e}`);
				return null;
			}
		});

		rpc.handle('player:play', async (event, id) => {
			try {
				if (typeof id === "number") id = id.toString()
				const ids = Object.values(idIndex);
				if (ids.includes(id)) {
					const playlist = await player.get('playlist');
					const index = playlist.findIndex(song => idIndex[song.id] === id);
					if (index !== -1) {
						await player.command('playlist-play-index', index);
						await player.set('pause', false);
						stopped = -1;
					}
				} else if (stopped > 0) {
					const playlist = await player.get('playlist');
					const index = playlist.findIndex(song => idIndex[song.id] === stopped);
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
				console.error(`player:play exception: ${e}`);
			}
		});

		rpc.handle('player:pause', () => {
			try {
				player.set('pause', true);
			} catch (e) {
				console.error(`player:pause exception: ${e}`);
			}
		});

		rpc.handle('player:stop', async (event, unsafe) => {
			try {
				const pos = await player.get('playlist-pos');
				if (pos !== -1) {
					const playlist = await player.get('playlist');
					stopped = idIndex[playlist[pos].id];
					await player.set('pause', true);
					await player.command('stop', 'keep-playlist');
				} else if (unsafe) {
					stopped = 0;
					await player.set('pause', true);
					await player.command('stop', 'keep-playlist');
				}
			} catch (e) {
				console.error(`player:stop exception: ${e}`);
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
				console.error(`player:next exception: ${e}`);
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
				console.error(`player:prev exception: ${e}`)
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
				console.error(`player:loop exception: ${e}`);
			}
		});

		rpc.handle('player:shuffle', (event, status) => {
			try {
				if (status !== null) shuffled = status;
				if (shuffled) {
					player.command('playlist-shuffle');
					if (status !== null) rpc.invoke('plugins:shuffle-changed', true);
				} else {
					player.command('playlist-unshuffle');
					if (status !== null) rpc.invoke('plugins:shuffle-changed', false);
				}
				return shuffled;
			} catch (e) {
				console.error(`player:shuffle exception: ${e}`);
			}
		});

		rpc.handle('player:replace', async (event, ids, paths) => {
			try {
				if (!ids?.length || !paths?.length || ids.length !== paths.length) return;
				reloading = false
				await player.command('playlist-clear');
				const playlist = await player.get('playlist');
				let song = -1;
				if (playlist.length) {
					song = idIndex[playlist[0].id];
					reloading = true
				}
				idIndex = {};
				for (const id of ids) {
					if (id === song) {
						const count = await player.get('playlist-count');
						await player.command('playlist-move', 0, count);
						const playlist = await player.get('playlist');
						const index = playlist[await player.get('playlist-pos')].id
						idIndex[index] = id;
						reloading = false;
					} else {
						const path = ids.findIndex(index => index === id);
						if (path === -1) continue;
						const uri = await rpc.invoke('library:uri', paths[path]);
						const index = (await player.command('loadfile', uri, 'append')).playlist_entry_id;
						idIndex[index] = id;
					}
				}
				rpc.invoke('player:shuffle', null);
			} catch (e) {
				console.error(`player:replace exception: ${e}`);
			}
		});

		rpc.handle('player:list', async () => {
			try {
				const playlist = await player.get('playlist');
				let list = (await Promise.allSettled(playlist.map(async song => `${idIndex[song.id]}: ${await rpc.invoke('library:uri', song.filename)}`))).map(promise => promise.value);
				if (reloading) list[0] = `(cached) ${list[0]}`;
				return list;
			} catch (e) {
				console.error(`player:replace exception: ${e}`);
			}
		});

		rpc.handle('player:get-time', () => {
			try {
				return position;
			} catch (e) {
				console.error(`player:get-time exception: ${e}`);
			}
		});

		rpc.handle('player:set-time', async (event, time) => {
			try {
				await player.command('seek', time, "absolute");
				return await player.get('time-pos');
			} catch (e) {
				console.error(`player:set-time exception: ${e}`);
			}
		});

		rpc.handle('player:shift-time', async (event, offset) => {
			try {
				await player.command('seek', offset);
				return await player.get('time-pos');
			} catch (e) {
				console.error(`player:shift-time exception: ${e}`);
			}
		});

		rpc.handle('player:get-volume', async () => {
			try {
				return await player.get('volume');
			} catch (e) {
				console.error(`player:get-volume exception: ${e}`);
			}
		});

		rpc.handle('player:set-volume', async (event, volume) => {
			try {
				await player.set('volume', Math.abs(Math.min(volume, 130)));
				return await rpc.invoke('player:get-volume');
			} catch (e) {
				console.error(`player:set-volume exception: ${e}`);
			}
		});

		rpc.handle('player:shift-volume', async (event, offset) => {
			try {
				const volume = Math.max(Math.min(await rpc.invoke('player:get-volume') + offset, 130), 0);
				await player.set('volume', volume);
				return volume;
			} catch (e) {
				console.error(`player:shift-volume exception: ${e}`);
			}
		});

		rpc.handle('player:get-status', () => {
			try {
				return playing;
			} catch (e) {
				console.error(`player:get-status exception: ${e}`);
			}
		});

		rpc.handle('player:get-looping', () => {
			try {
				return looping;
			} catch (e) {
				console.error(`player:get-looping exception: ${e}`);
			}
		});

		rpc.handle('player:get-shuffled', () => {
			try {
				return shuffled;
			} catch (e) {
				console.error(`player:get-shuffled exception: ${e}`);
			}
		});

		// dangerous methods
		rpc.handle('player:get', async (event, ...args) => {
			try {
				return await player.get(...args);
			} catch (e) {
				console.error(`player:get exception: ${e}`);
			}
		});

		rpc.handle('player:set', async (event, ...args) => {
			try {
				return await player.set(...args);
			} catch (e) {
				console.error(`player:set exception: ${e}`);
			}
		});

		rpc.handle('player:on', async (event, ...args) => {
			try {
				return await player.on(...args);
			} catch (e) {
				console.error(`player:on exception: ${e}`);
			}
		});

		rpc.handle('player:observe', async (event, ...args) => {
			try {
				return await player.observe(...args);
			} catch (e) {
				console.error(`player:observe exception: ${e}`);
			}
		});

		rpc.handle('player:command', async (event, ...args) => {
			try {
				return await player.command(...args);
			} catch (e) {
				console.error(`player:command exception: ${e}`);
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
			rpc.invoke('metadata:position-changed', time)
			rpc.invoke('plugins:position-changed', time);
		});

		player.observe('volume', volume => {
			rpc.invoke('plugins:volume-changed', volume);
		});

		player.observe('metadata', async metadata => {
			if (reloading && await player.get('playlist-pos') !== 0) {
				reloading = false
				await player.command('playlist-remove', 0);
			}
			if (metadata) {
				const playlist = await player.get('playlist');
				const current = playlist[await player.get('playlist-pos')];
				metadata.id = idIndex[current.id];
				metadata.url = rpc.invoke('library:uri', current.filename);
				metadata.length = await player.get('duration');
			}
			rpc.invoke('library:track-changed', metadata?.id ?? 0)
			rpc.invoke('metadata:update', metadata);
		});

		player.on('seek', () => {
			rpc.invoke('plugins:seeked', position);
		});

		// default stuff
		await rpc.invoke('player:set-volume', 50);
	} catch (e) {
		console.error(`Player failed to start ${e}`);
	}
}

module.exports = {
	startPlayer
};