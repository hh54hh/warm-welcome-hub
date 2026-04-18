import { app, BrowserWindow, nativeImage } from "electron";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createWindow() {
  const iconPath = process.argv.includes("--dev")
    ? path.join(__dirname, "..", "public", "favicon.ico")
    : path.join(__dirname, "..", "dist", "favicon.ico");
  const window = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1000,
    minHeight: 700,
    autoHideMenuBar: true,
    backgroundColor: "#ffffff",
    icon: nativeImage.createFromPath(iconPath),
    webPreferences: {
      contextIsolation: true,
      sandbox: false,
    },
  });

  const devUrl = "http://localhost:8080";
  if (process.env.NODE_ENV === "development" || process.argv.includes("--dev")) {
    window.loadURL(devUrl);
    window.webContents.openDevTools({ mode: "undocked" });
  } else {
    window.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }
}

app.on("ready", createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
