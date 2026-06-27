const { app } = require("electron")
const fs = require("fs");
const net = require("net")
const { Command } = require("commander");
const socketPath = process.platform === "win32"
	? "\\\\.\\pipe\\chrysalis"
	: "/tmp/chrysalis.sock";

let window

function prepareServer(win) {
	window = win

	if (process.platform !== "win32") {
		try {
			fs.unlinkSync(socketPath);
		} catch (err) {}
	}

	const server = net.createServer(socket => {
		socket.on("data", data => {
			const response = executeCommand(data.toString());

			socket.write(response)
			socket.end()
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

	program.action(() => {
		sendCommand(["show"])
		});

	program
		.command("show")
		.action(() => {
			sendCommand(["show"])
		});
	
	program
		.command("quit")
		.action(() => {
			sendCommand(["quit"])
		});
	
	program
		.command("get <thing>")
		.action((thing) => {
			sendCommand(["get", thing]);
		});

	program
		.command("play")
		.action(() => {
			sendCommand(["play"]);
		});

	program
		.command("pause")
		.action(() => {
			sendCommand(["pause"]);
		});
	
	program.parse(process.argv);
}

function executeCommand(data) {
	const request = JSON.parse(data)
	console.log(`Command '${request.command}' has been requested with args: ${JSON.stringify(request.args)}`)
	
	switch (request.command) {
		case "show":
			if (window) {
				if (window.isMinimized()) {
					window.restore();
				}
				if (!window.isVisible()) {
					window.show();
				}
				window.focus();
			}
			return "";
		case "quit":
			app.quit()
			return "";
		case "play":
			return "totally playing a song...";
		case "get":
			if (request.args[0] === "song")
				return "this is totally a song";
	}
	return "Invalid Command";
}

module.exports = {
	prepareServer,
	parseCommand
}