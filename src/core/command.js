const { app } = require("electron");
const fs = require("fs");
const net = require("net");
const { Command, InvalidArgumentError, Argument } = require("commander");
const rpc = require("./rpc");
const socketPath = process.platform === "win32"
	? "\\\\.\\pipe\\chrysalis"
	: "/tmp/chrysalis.sock";

function prepareServer() {
	if (process.platform !== "win32") {
		try {
			fs.unlinkSync(socketPath);
		} catch (err) {}
	}

	const server = net.createServer(socket => {
		socket.on("data", async data => {
			const response = await executeCommand(data.toString());

			socket.write(response);
			socket.end();
		});
	});

	server.listen(socketPath);

	app.on("will-quit", () => {
		if (process.platform !== "win32") {
			try {
				fs.unlinkSync(socketPath);
			} catch {}
		}
	});
}

function sendCommand(command) {
	const client = net.createConnection(socketPath, () => {
		client.write(JSON.stringify({
			command: command[0],
			args: command.slice(1)
		}));
	});

	client.on("data", data => {
		console.log(data.toString());
	});

	client.on("close", () => {
		app.quit();
	});

	client.on("error", err => {
		console.error("Failed to connect to running Chrysalis instance.");
		app.quit();
	});
}

function parseCommand() {
	const program = new Command();

	function valueNumber(value) {
		const parsedValue = Number(value);
		if (isNaN(parsedValue)) {
			throw new InvalidArgumentError('Not a number.');
		}
		return parsedValue;
	}

	program
		.name('Chrysalis')
		.description('Chrysalis music player CLI')
		.version('0.2.0');

	program
		.command("show", { isDefault: true })
		.description("Show Chrysalis's Window")
		.action(() => sendCommand(["show"]));

	program
		.command("quit")
		.description("Quit Chrysalis")
		.action(() => sendCommand(["quit"]));
	program
		.command("volume")
		.description('Get or modify the current volume of Chrysalis')
		.argument("[volume]", 'Volume to set to', valueNumber)
		.addArgument(new Argument("[+/-]", 'Treat [volume] as an offset, shifting the volume up or down respectively').choices(['+','-']))
		.action((volume, direction) => {
			sendCommand(["volume", ...volume !== undefined ? [volume] : [], ...direction !== undefined ? [direction] : []]);
		});

	program
		.command("play")
		.description("Play the current song")
		.action(() => sendCommand(["play"]));

	program
		.command("pause")
		.description("Pause the current song")
		.action(() => sendCommand(["pause"]));

	program
		.command("play-pause")
		.aliases(["playPause", "playpause"])
		.description("Toggle playing the current song")
		.action(() => sendCommand(["playPause"]));

	program
		.command("stop")
		.description("Unload the current song")
		.action(() => sendCommand(["stop"]));

	program
		.command("status")
		.description('Get the current status of Chrysalis')
		.action(() => sendCommand(["status"]));

	program
		.command("next")
		.description("Skip to the next song")
		.action(() => sendCommand(["next"]));

	program
		.command("previous")
		.alias("prev")
		.description("Skip to the previous song")
		.action(() => sendCommand(["previous"]));

	program
		.command("position")
		.description('Get or modify the current time of the playing song')
		.argument("[time]", 'Time to seek to', valueNumber)
		.addArgument( new Argument("[+/-]", 'Treat [time] as an offset, shifting the position forwards or backwards respectively').choices(['+','-']))
		.action((time, direction) => sendCommand(["position", ...time !== undefined ? [time] : [], ...direction !== undefined ? [direction] : []]));

	program
		.command("loop")
		.description('Get or set the current loop type')
		.addArgument( new Argument("[type]", 'The loop type to use').choices(['None','Playlist','Track']))
		.action((type) => sendCommand(["loop", type]));

	program
		.command("shuffle")
		.description('Get or set if the Playlist is shuffled')
		.addArgument( new Argument("[shuffle]", '').choices(['On','Off','Toggle']))
		.action((shuffle) => sendCommand(["shuffle", shuffle]));

	program
		.command("open <uri>")
		.description('Add to the Playlist and play a File or remote Url')
		.action((uri) => sendCommand(["open", uri]));

	program
		.command("add <uri>")
		.description('Add a File or remote Url to the Playlist')
		.action((uri) => sendCommand(["add", uri]));

	program
		.command("close <uri>")
		.alias("remove")
		.alias("del")
		.description('Remove a File or remote Url from the Playlist')
		.action((uri) => sendCommand(["close", uri]));

	program
		.command("list")
		.description('List the current songs in the Playlist')
		.action(() => sendCommand(["list"]));

	program.parse(process.argv);
}

async function executeCommand(data) {
	try {
		const request = JSON.parse(data)
		console.log(`Command '${request.command}' has been requested with args: ${JSON.stringify(request.args)}`);

		switch (request.command) {
			case "show":
				rpc.invoke('app:raise');
				return "";

			case "quit":
				app.quit();
				return "Quitting Chrysalis";

			case "volume":
				if (!request.args.length)
					return `Chrysalis is currently at ${await rpc.invoke('player:get-volume')}% volume`;
				else
					if (request.args[1] === '+' || request.args[1] === '-') {
						const volume = await rpc.invoke('player:get-volume');
						return `Set volume to ${await rpc.invoke('player:shift-volume', request.args[1] === '-' ? -Number(request.args[0]) : Number(request.args[0]))}% from ${volume}%`;
					} else
						return `Set volume to ${await rpc.invoke('player:set-volume', Number(request.args[0]))}%`;

			case "play":
				rpc.invoke('player:play');
				return "Playing the current song";

			case "pause":
				rpc.invoke('player:pause');
				return "Pausing the current song";

			case "playPause":
				const playing = await rpc.invoke('player:play-pause');
				return `${playing ? "Playing" : "Pausing"} the current song`;

			case "stop":
				rpc.invoke('player:stop');
				return "Stopping the current song";

			case "next":
				rpc.invoke('player:next');
				return 'Skipping to next song';

			case "previous":
				rpc.invoke('player:prev');
				return 'Skipping to previous song';

			case "status":
				const status = await rpc.invoke('player:get-status');
				return `Chrysalis is ${status ? 'Playing' : status === false ? "Paused" : "Stopped"}`;

			case "position":
				if (!request.args.length)
					return `Chrysalis is currently at ${await rpc.invoke('player:get-time')} seconds`;
				else
					if (request.args[1] === '+' || request.args[1] === '-') {
						const time = await rpc.invoke('player:get-time');
						return `Set Time to ${await rpc.invoke('player:shift-time', request.args[1] === '-' ? -Number(request.args[0]) : Number(request.args[0]))} seconds from ${time} seconds`;
					} else
						return `Set time to ${await rpc.invoke('player:set-time', Number(request.args[0]))} seconds`;

			case "loop":
				if (!request.args[0]) {
					const looping = await rpc.invoke('player:get-looping');
					return `Chrysalis is looping ${looping ? 'the Playlist' : looping === false ? "Nothing" : "the current Track"}`;
				} else {
					const looping = await rpc.invoke('player:loop', request.args[0] === "Playlist" ? true : request.args[0] === "Track" ? null : false);
					return `Now looping ${looping ? 'the Playlist' : looping === false ? "Nothing" : "the current Track"}`
				}

			case "shuffle":
				if (!request.args[0])
					return `The Playlist is ${await rpc.invoke('player:get-shuffled') ? "Shuffled" : "Unshuffled"}`;
				else
					return `${await rpc.invoke("player:shuffle", request.args[0] === "On" ? true : request.args === "Off" ? false : !await rpc.invoke("player:get-shuffled")) ? "Shuffling" : "Unshuffling"} the Playlist`;

			case "open":
				const result = await rpc.invoke('player:open', request.args[0]);
				if (!result.length)
					return "Invalid Uri";
				if (result[0])
					return `Opening '${result[1]}'`;
				else
					return `Playing '${result[1]}'`;

			case "add":
				const result1 = await rpc.invoke('player:open', request.args[0], true);
				if (!result1.length)
					return "Invalid Uri";
				if (result1[0])
					return `Adding '${result1[1]}' to the Playlist`;
				else
					return `Moved '${result1[1]}' to the end of the Playlist`;

			case "close":
				const result2 = await rpc.invoke('player:close', request.args[0]);
				if (!result2.length)
					return "Invalid Uri";
				if (result2[0])
					return `Removed '${result2[1]}' from the Playlsit`;
				else
					return `'${result2[1]}' is not in the Playlist`;

			case "list":
				const list = await rpc.invoke('player:list');
				return `Current songs in the Playlist:\n${list.join('\n')}`;

		}
		return "Invalid Command";
	} catch (e) {
		return `Command failed: ${e}`;
	}
}

module.exports = {
	prepareServer,
	parseCommand
};