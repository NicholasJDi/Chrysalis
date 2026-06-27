const { app, BrowserWindow } = require("electron");
const core = require("./core");

let window;
let allowClose = false;



function createWindow() {
	window = new BrowserWindow({
		show:false,
		backgroundColor: "#1e1e1e",
		autoHideMenuBar:true,
		webPreferences:{
			preload: __dirname + "/preload.js",
			backgroundThrottling:true,
			nodeIntegration: false,
			contextIsolation: true
		},
	});

	window.loadFile("src/renderer/index.html");
	window.maximize();
}

const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
	// Another instance is already running
	core.command.parseCommand()
	app.quit();
} else {
	app.whenReady().then(() => {
		createWindow();
		registerProcesses();
		core.command.prepareServer(window);
		window.once('ready-to-show', () => {
			window.show();
		});
	});
}

function registerProcesses() {
	app.on("before-quit", () => {
	    allowClose = true;
	});
	window.on("close", (event) => {
	    if (!allowClose) {
	        event.preventDefault();
	        window.hide();
	    }
	});
}