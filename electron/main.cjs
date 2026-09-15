const { app, BrowserWindow, shell } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

const DEV_URL = process.env.VITE_DEV_SERVER_URL

// userData is named after productName; move the pre-rename profile so saved plans survive
function migrateUserData() {
  const current = app.getPath('userData')
  const legacy = path.join(path.dirname(current), 'Salmon Cuts')
  if (!fs.existsSync(current) && fs.existsSync(legacy)) fs.renameSync(legacy, current)
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 960,
    minHeight: 640,
    title: 'Salmon Flipper',
    backgroundColor: '#efe7d3',
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, sandbox: true },
  })
  // external links (SSB, fonts) open in the system browser, never inside the app window
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
  if (DEV_URL) win.loadURL(DEV_URL)
  else win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
}

try {
  migrateUserData()
} catch {}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
