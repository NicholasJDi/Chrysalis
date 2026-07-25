const { contextBridge, ipcRenderer } = require("electron");


function Electron() {
	contextBridge.exposeInMainWorld("Electron", {
		getAccentColor: () => ipcRenderer.invoke("get-system-accent-color")
	});
}

function Chrysalis() {
	contextBridge.exposeInMainWorld("Chrysalis", {
		library: {
			metadata: {
				getMetadataFromFile: (path) => ipcRenderer.invoke("library:get-metadata", path)
			},
			getFiles: (directory, type, recursive) => ipcRenderer.invoke("library:scan", directory, type, recursive)
		},
		player: {

		}
	});
}

Electron();
Chrysalis();