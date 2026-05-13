const { app, BrowserWindow, shell } = require('electron');

let mainWindow = null;

const APP_URL = 'https://my-app-front-desktop-production.up.railway.app/';

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    autoHideMenuBar: true,
    show: false,
    backgroundColor: '#08090e',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    console.error('Failed to load app:', errorCode, errorDescription);

    mainWindow.loadURL(
      `data:text/html;charset=utf-8,${encodeURIComponent(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8" />
            <style>
              body {
                margin: 0;
                height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                background: #08090e;
                color: #fff;
                font-family: Arial, sans-serif;
              }
              .card {
                max-width: 420px;
                padding: 28px;
                border-radius: 18px;
                background: #11141d;
                border: 1px solid #252b3a;
                text-align: center;
              }
              h1 {
                margin: 0 0 10px;
                font-size: 24px;
              }
              p {
                color: #9aa3b2;
                line-height: 1.5;
              }
            </style>
          </head>
          <body>
            <div class="card">
              <h1>No se pudo cargar Gasto Fácil</h1>
              <p>Revisá tu conexión a internet e intentá abrir la app nuevamente.</p>
              <p style="font-size:12px;">${errorCode} - ${errorDescription}</p>
            </div>
          </body>
        </html>
      `)}`,
    );
  });

  mainWindow.loadURL(APP_URL).catch((error) => {
    console.error('loadURL error:', error);
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled rejection:', error);
});