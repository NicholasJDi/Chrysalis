// main.js
const { app, BrowserWindow } = require("electron");

app.whenReady().then(() => {
    const window = new BrowserWindow();
    window.loadFile("index.html");
});