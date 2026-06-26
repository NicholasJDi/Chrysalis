const { contextBridge, ipcRenderer } = require("electron");

function electron() {
	contextBridge.exposeInMainWorld("electron", {
		getAccentColor: () => ipcRenderer.invoke("get-accent-color")
	});
}

electron()