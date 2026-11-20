'use strict';

const path = require('node:path');
const { app, BrowserWindow, shell, session } = require('electron');
const {
  createPkcePair,
  loginUrl,
  exchangeUrl,
  parseAuthDeepLink,
  isLoginNavigation,
  isInternalUrl,
} = require('./auth');

const APP_URL = process.env.DOTASK_APP_URL || 'https://dotaskweb.app-sprint.com';
const API_URL = process.env.DOTASK_API_URL || 'https://api.app-sprint.com';
const PROTOCOL = 'dotask';

/** @type {BrowserWindow | null} */
let mainWindow = null;
/** Verificador PKCE del login en curso (solo en memoria). */
let pendingVerifier = null;

// Una sola instancia: los enlaces dotask:// llegan a la ventana ya abierta.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  if (process.defaultApp && process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [path.resolve(process.argv[1])]);
  } else {
    app.setAsDefaultProtocolClient(PROTOCOL);
  }

  app.on('second-instance', (_event, argv) => {
    const link = argv.find((arg) => arg.startsWith(`${PROTOCOL}://`));
    if (link) handleDeepLink(link);
    focusWindow();
  });

  // macOS entrega los enlaces por este evento.
  app.on('open-url', (event, link) => {
    event.preventDefault();
    handleDeepLink(link);
  });

  app.whenReady().then(() => {
    const ua = session.defaultSession.getUserAgent();
    session.defaultSession.setUserAgent(`${ua} DoTaskDesktop/${app.getVersion()}`);
    createWindow();

    // Arranque en frío desde un enlace dotask:// (Windows lo pasa en argv).
    const link = process.argv.find((arg) => arg.startsWith(`${PROTOCOL}://`));
    if (link) handleDeepLink(link);
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 380,
    minHeight: 560,
    title: 'DoTask',
    icon: path.join(__dirname, 'build', 'icon.png'),
    autoHideMenuBar: true,
    backgroundColor: '#ffffff',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const contents = mainWindow.webContents;

  // Google no permite iniciar sesión en ventanas embebidas: el login va al navegador.
  contents.on('will-navigate', (event, target) => {
    if (isLoginNavigation(target, API_URL)) {
      event.preventDefault();
      startLogin();
    } else if (!isInternalUrl(target, APP_URL, API_URL)) {
      event.preventDefault();
      shell.openExternal(target);
    }
  });

  contents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('mailto:')) shell.openExternal(url);
    return { action: 'deny' };
  });

  contents.on('did-fail-load', (_event, errorCode, _description, validatedURL, isMainFrame) => {
    // -3 = navegación abortada (p. ej. una redirección): no es un error real.
    if (!isMainFrame || errorCode === -3) return;
    mainWindow.loadFile(path.join(__dirname, 'pages', 'offline.html'), {
      query: { retry: validatedURL || APP_URL },
    });
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.loadURL(APP_URL);
}

function startLogin() {
  const { verifier, challenge } = createPkcePair();
  pendingVerifier = verifier;
  shell.openExternal(loginUrl(API_URL, challenge));
  mainWindow?.loadFile(path.join(__dirname, 'pages', 'login-waiting.html'), {
    query: { login: loginUrl(API_URL, challenge), app: APP_URL },
  });
}

function handleDeepLink(link) {
  const code = parseAuthDeepLink(link);
  if (!code) return;
  if (!mainWindow) createWindow();

  if (!pendingVerifier) {
    // La app se reinició durante el login: hay que empezar de nuevo.
    mainWindow.loadURL(`${APP_URL}/login?error=escritorio`);
    return;
  }
  const verifier = pendingVerifier;
  pendingVerifier = null;
  mainWindow.loadURL(exchangeUrl(API_URL, code, verifier));
  focusWindow();
}

function focusWindow() {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}
