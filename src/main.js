const { app } = require("electron");

const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
	// Another instance is already running
	const Command = require("./core/command");
	Command.parseCommand()
	app.quit();
} else {
	const { BrowserWindow } = require("electron");
	const core = require("./core");
	const plugins = require("./plugins")

	let window;
	let allowClose = false;

	function createWindow() {
		window = new BrowserWindow({
			backgroundColor: "#3d3d3d",
			autoHideMenuBar:true,
			fullscreenable:false,
			webPreferences:{
				preload: __dirname + "/preload.js",
				backgroundThrottling:true,
				nodeIntegration: false,
				contextIsolation: true
			},
			show:false
		});

		window.loadFile("src/renderer/index.html");
	}

	// disable automatic mpris and related
	app.commandLine.appendSwitch("disable-features", "HardwareMediaKeyHandling,MediaSessionService");
	app.setName("Chrysalis");
	app.whenReady().then(() => {
		createWindow();
		core.rpc.allowSends(window);
		registerProcesses();
		core.player.startPlayer();
		core.command.prepareServer();
		plugins.doPluginStuff();
		window.once('ready-to-show', async () => {
			await window.maximize();
			window.show();
		});
	});

	function registerProcesses() {
		core.rpc.handle('app:quit', () => {
			app.quit();
		});
		app.on("before-quit", () => {
			allowClose = true;
		});
		window.on("close", (event) => {
			if (!allowClose) {
				event.preventDefault();
				window.hide();
			}
		});
		core.rpc.handle('app:raise', () => {
			if (window) {
				if (window.isMinimized())
					window.restore();
				if (!window.isVisible())
					window.show();
				window.focus();
			}
		});
	}
}