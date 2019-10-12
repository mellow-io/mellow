// =============================
require('module-alias/register')
// =============================

const electron = require('electron')
const { app, systemPreferences, Menu, Tray, BrowserWindow, dialog, shell } = electron
const path = require('path')
const { spawn, execSync } = require('child_process')
const log = require('electron-log')
const sudo = require('sudo-prompt')
const defaultGateway = require('default-gateway')
const os = require('os')
const fs = require('fs')
const net = require('net')
const util = require('util')
const Netmask = require('netmask').Netmask
const Store = require('electron-store')
const AutoLaunch = require('auto-launch')
const prompt = require('electron-prompt')
const https = require('https')
const semver = require('semver')

const config = require('@mellow/config/config')
const convert = require('@mellow/config/convert')

const autoLauncher = new AutoLaunch({name: 'Mellow'})

const schema = {
  autoLaunch: {
    type: 'boolean',
    default: false
  },
  autoConnect: {
    type: 'boolean',
    default: false
  },
  checkUpdates: {
    type: 'boolean',
    default: true
  },
  loglevel: {
    type: 'string',
    default: 'info'
  },
  configUrl: {
    type: 'string',
    default: 'https://www.example.org/cfg.json'
  },
  selectedConfig: {
    type: 'string',
    default: ''
  },
}
const store = new Store({name: 'preference', schema: schema})

function resetAutoLaunch() {
  if (store.get('autoLaunch')) {
    autoLauncher.isEnabled().then((isEnabled) => {
      if (!isEnabled) {
        // Enabled in Mellow but found disabled in system preferences.
        autoLauncher.enable()
      }
    }).catch((err) => {
      dialog.showErrorBox('Error', 'Failed to check auto launcher status.')
    })
  } else {
    autoLauncher.isEnabled().then((isEnabled) => {
      if (isEnabled) {
        // Disabled in Mellow but found enabled in system preferences.
        autoLauncher.disable()
      }
    }).catch((err) => {
      dialog.showErrorBox('Error', 'Failed to check auto launcher status.')
    })
  }
}

resetAutoLaunch()

var helperResourcePath
if (app.isPackaged) {
  helperResourcePath = path.join(process.resourcesPath, 'src/helper')
} else {
  helperResourcePath = path.join(path.join(__dirname, 'helper'), process.platform)
  for (let f of ['geo.mmdb', 'geosite.dat']) {
    src = path.join(path.join(__dirname, 'helper'), f)
    dst = path.join(helperResourcePath, f)
    if (!fs.existsSync(dst)) {
      fs.copyFileSync(src, dst)
    }
  }
}

var helperInstallPath
var helperFiles
switch (process.platform) {
  case 'darwin':
    helperInstallPath = "/Library/Application Support/Mellow"
    helperFiles = [
      'geo.mmdb',
      'geosite.dat',
      'core',
      'md5sum',
      'route'
    ]
    break
  case 'linux':
    helperInstallPath = '/usr/local/mellow'
    helperFiles = [
      'geo.mmdb',
      'geosite.dat',
      'core',
      'md5sum',
      'ip'
    ]
    break
}

let logPath = log.transports.file.findLogPath('Mellow')
let configFolder = path.join(app.getPath('userData'), 'config')
let lagecyConfigFile = path.join(app.getPath('userData'), 'cfg.json')
let runningConfig = path.join(app.getPath('userData'), 'running-config.json')

const createConfigFolderIfNotExists = () => {
  if (!fs.existsSync(configFolder)) {
    fs.mkdirSync(configFolder, { recursive: true })
    log.info(util.format('Created config folder %s', configFolder))
  }
}
createConfigFolderIfNotExists()

const handleLagecyConfigFile = () => {
  if (fs.existsSync(lagecyConfigFile)) {
    const newPath = path.join(configFolder, 'cfg.json')
    fs.renameSync(lagecyConfigFile, newPath)
    log.info(util.format('Renamed lagecy config file %s to %s', lagecyConfigFile, newPath))
  }
}
handleLagecyConfigFile()

var md5Cmd
var routeCmd
var coreCmd
switch(process.platform) {
  case 'linux':
    md5Cmd = path.join(helperInstallPath, 'md5sum')
    coreCmd = path.join(helperInstallPath, 'core')
    routeCmd = path.join(helperInstallPath, 'ip')
    break
  case 'darwin':
    md5Cmd = path.join(helperInstallPath, 'md5sum')
    coreCmd = path.join(helperInstallPath, 'core')
    routeCmd = path.join(helperInstallPath, 'route')
    break
  case 'win32':
    coreCmd = path.join(helperResourcePath, 'core.exe')
    break
}

let running = false
let helperVerified = false
let coreNeedResume = false
let tray = null
let core = null
let coreRpcPort = 6002
let coreInterrupt = false
let tempOrigGw = null
let origGw = null
let origGwScope = null
let tempSendThrough = null
let sendThrough = null

var tunName
switch (process.platform) {
  case 'darwin':
    tunName = 'utun233'
    break
  case 'win32':
    tunName = 'mellow-tap0'
    break
  case 'linux':
    tunName = 'tun1'
    break
}

let tunAddr = '10.255.0.2'
let tunMask = '255.255.255.0'
let tunGw = '10.255.0.1'
var tunAddrBlock = new Netmask(tunAddr, tunMask)

function isDarkMode() {
  return (systemPreferences.getUserDefault('AppleInterfaceStyle', 'string') == 'Dark')
}

const trayIcon = {
  get on() {
    switch (process.platform) {
      case 'linux':
      case 'darwin':
        if (isDarkMode()) {
          return path.join(__dirname, 'assets/tray-on-icon-light.png')
        } else {
          return path.join(__dirname, 'assets/tray-on-icon.png')
        }
      case 'win32':
        return path.join(__dirname, 'assets/tray-on-icon-win.ico')
    }
  },
  get off() {
    switch (process.platform) {
      case 'linux':
      case 'darwin':
        return path.join(__dirname, 'assets/tray-off-icon.png')
      case 'win32':
        return path.join(__dirname, 'assets/tray-off-icon.png')
    }
  }
}

const state = {
  Disconnected: 'Disconnected',
  Connecting: 'Connecting',
  Connected: 'Connected'
}

var currentState = state.Disconnected

function isConnected() {
  return (currentState == state.Connected)
}

function setState(s) {
  switch (s) {
    case state.Disconnected:
      tray.setImage(trayIcon.off)
      break
    case state.Connecting:
      tray.setImage(trayIcon.off)
      break
    case state.Connected:
      tray.setImage(trayIcon.on)
      break
    default:
      throw 'Invalid State'
  }

  currentState = s
}

switch (process.platform) {
  case 'darwin':
    if (app.isPackaged) {
      app.dock.hide()
    }
    break
  case 'linux':
  case 'win32':
    break
}

let themeChangedNotifier = null
switch (process.platform) {
  case 'darwin':
    themeChangedNotifier = systemPreferences.subscribeNotification('AppleInterfaceThemeChangedNotification', (e, i) => {
      setState(currentState)
    })
    break
}

function monitorPowerEvent() {
  electron.powerMonitor.on('lock-screen', () => {
    log.info('Screen locked.')
  })
  electron.powerMonitor.on('unlock-screen', () => {
    log.info('Screen unlocked.')
  })
  electron.powerMonitor.on('suspend', () => {
    log.info('Device suspended.')
    if (process.platform == 'win32') {
      coreNeedResume = true
      down()
    }
  })
  electron.powerMonitor.on('resume', async () => {
    log.info('Device resumed.')
    await delay(2000)
    up()
  })
}

function checkHelper() {
  log.info('Checking helper files.')
  for (let f of helperFiles) {
    try {
      resourceFile = path.join(helperResourcePath, f)
      installedFile = path.join(helperInstallPath, f)
      resourceSum = execSync(util.format('"%s" "%s"', md5Cmd, resourceFile))
      installedSum = execSync(util.format('"%s" "%s"', md5Cmd, installedFile))
      if (resourceSum.toString() != installedSum.toString()) {
        log.info('md5 checksum not match:')
        log.info(util.format('[%s "%s"] not match [%s "%s"]', resourceFile, resourceSum, installedFile, installedSum))
        return false
      }
    } catch (err) {
      if (err.status == 1) {
        dialog.showErrorBox('Error', 'Failed checksum helper files, it seems md5/md5sum or awk command is missing.')
      } else {
        log.info(err)
        return false
      }
    }
  }
  return true
}

async function startCore(callback) {
  coreInterrupt = false

  var parsedConfig

  const selectedConfig = store.get('selectedConfig')
  if (selectedConfig.length == 0) {
      dialog.showMessageBox({ message: 'Please select a config.' })
      return
  }
  if (selectedConfig.includes('.conf')) {
    try {
      const content = fs.readFileSync(selectedConfig, 'utf-8')
      const v2json = convert.constructJson(content)
      parsedConfig = JSON.stringify(v2json, null, 2)
    } catch(err) {
      dialog.showErrorBox('Config Error', err)
      return
    }
  } else if (selectedConfig.includes('.json')) {
    const content = fs.readFileSync(selectedConfig, 'utf-8')
    parsedConfig = JSON.stringify(JSON.parse(content), null, 2)
  } else {
      dialog.showErrorBox('Config Error', 'Unknown config suffix')
      return
  }

  if (parsedConfig) {
    f = fs.openSync(runningConfig, 'w')
    fs.writeFileSync(f, parsedConfig)
    fs.closeSync(f)
  } else {
    dialog.showErrorBox('Config Error', 'Parsing config failed')
    return
  }

  if (process.platform == 'win32') {
    log.info('Ensuring tap device sets up correctly.')
    try {
      out = await sudoExec(util.format('%s %s %s', path.join(helperResourcePath, 'ensure_tap_device.bat'), path.join(helperResourcePath, 'tap-windows6'), tunName))
      log.info(out)
    } catch (err) {
      dialog.showErrorBox('Error', 'TAP device not ready: ' + err)
      return
    }
  }

  var params
  var cmd
  switch (process.platform) {
    case 'linux':
    case 'darwin':
      params = [
        '-tunName', tunName,
        '-tunAddr', tunAddr,
        '-tunMask', tunMask,
        '-tunGw', tunGw,
        '-sendThrough', sendThrough,
        '-vconfig', runningConfig,
        '-proxyType', 'v2ray',
        '-relayICMP',
        '-loglevel', store.get('loglevel'),
        '-stats'
      ]
      break
    case 'win32':
      // The flag order is important, some flags won't work in specific
      // flag order, and I don't known exactly why is it.
      params = [
        '-tunName', tunName,
        '-tunAddr', tunAddr,
        '-tunMask', tunMask,
        '-tunGw', tunGw,
        '-tunDns', '223.5.5.5,1.1.1.1',
        '-rpcPort', coreRpcPort.toString(),
        '-sendThrough', sendThrough,
        '-proxyType', 'v2ray',
        '-relayICMP',
        '-stats',
        '-loglevel', store.get('loglevel'),
        '-vconfig', runningConfig
      ]
      break
  }

  core = spawn(coreCmd, params)
  core.stdout.on('data', (data) => {
    log.info(data.toString())
  })
  core.stderr.on('data', (data) => {
    log.info(data.toString())
  })
  core.on('close', (code, signal) => {
    log.info('Core stopped, code', code, 'signal' , signal)

    if (coreNeedResume) {
      // Change status and wait for the resume event callback to be called so the core will be restarted.
      log.info('Core will restart upon device resume.')
      coreNeedResume = false
      core = null
      return
    }

    if (code && code != 0) {
      log.info('Core fails to startup, interrupt the starting procedure.')
      coreInterrupt = true
      core = null
      dialog.showErrorBox('Error', util.format('Failed to start the Core, see "%s" for more details.', logPath))
    }

    setState(state.Disconnected)
  })
  core.on('error', (err) => {
    log.info('Core errored.')
    coreInterrupt = true
    core = null
    setState(state.Disconnected)
    log.info(err)
    dialog.showErrorBox('Error', util.format('Failed to start the Core, see "%s" for more details.', logPath))
  })
  log.info('Core started.')
  if (callback !== null) {
    callback()
  }
}

async function configRoute() {
  if (coreInterrupt) {
    log.info('Start interrupted.')
    coreInterrupt = false
    return
  }

  switch (process.platform) {
    case 'linux':
    case 'darwin':
      if (tunGw === null || origGw === null || origGwScope === null) {
        return
      }
      break
    case 'win32':
      if (tunGw === null || origGw === null) {
        return
      }
      break
    default:
      dialog.showErrorBox('Error', 'Unsupported platform: ' + process.platform)
  }

  gw = null
  for (i = 0; i < 5; i++) {
    gw = getDefaultGateway()
    if (gw === null) {
      await delay(2 * 1000)
      log.info('Retrying to get the default gateway.')
      continue
    }
    break
  }
  log.info('The default gateway before configuring routes:')
  log.info(gw)
  if (gw === null) {
    dialog.showErrorBox('Error', util.format('Failed to find the default gateway, see "%s" for more details.', logPath))
  }

  // Try to find the TUN interface, it must exists and up before we can
  // add routes to it. We now wait for the core to open the device.
  tunIface = null
  for (i = 0; i < 10; i++) {
    tunIface = findTunInterface()
    if (tunIface === null) {
      await delay(2 * 1000)
      log.info('Retrying to find the TUN interface.')
      continue
    }
    break
  }
  if (tunIface === null) {
    dialog.showErrorBox('Error', util.format('Failed to find the TUN interface, see "%s" for more details.', logPath))
    return
  }
  log.info('The TUN interface before configuring routes:')
  log.info(tunIface)

  try {
    switch (process.platform) {
      case 'darwin':
        execSync(util.format('"%s" delete default', routeCmd))
        execSync(util.format('"%s" add default %s', routeCmd, tunGw))
        if (tempOrigGw && tempOrigGw !== origGw) {
          execSync(util.format('"%s" delete default %s -ifscope %s', routeCmd, tempOrigGw, origGwScope))
        }
        execSync(util.format('"%s" add default %s -ifscope %s', routeCmd, origGw, origGwScope))
        break
      case 'win32':
        await sudoExec(util.format('%s %s %s', path.join(helperResourcePath, 'config_route.bat'), tunGw, origGw))
        break
      case 'linux':
        execSync(util.format('%s %s %s %s %s %s', path.join(helperResourcePath, 'config_route'), routeCmd, tunGw, origGw, origGwScope, sendThrough))
        break
    }
    log.info('Set ' + tunGw + ' as the default gateway.')
  } catch (err) {
    log.info(err)
    log.info(err)
    dialog.showErrorBox('Error', util.format('Failed to configure routes, see "%s" for more details.', logPath))
  }

  setState(state.Connected)
}

async function recoverRoute() {
  if (origGw !== null) {
    log.info('Restore ' + origGw + ' as the default gateway.')
    try {
      switch (process.platform) {
        case 'darwin':
          execSync(util.format('"%s" delete default', routeCmd))
          execSync(util.format('"%s" delete default -ifscope %s', routeCmd, origGwScope))
          execSync(util.format('"%s" add default %s', routeCmd, origGw))
          break
        case 'win32':
          await sudoExec(util.format('%s %s', path.join(helperResourcePath, 'recover_route.bat'), origGw))
          break
        case 'linux':
          execSync(util.format('%s %s %s', path.join(helperResourcePath, 'recover_route'), routeCmd, sendThrough, origGw))
          break
      }
    } catch (error) {
      log.info(error.stdout)
      log.info(error.stderr)
      dialog.showErrorBox('Error', util.format('Failed to configure routes, see "%s" for more details.', logPath))
    }
  } else {
    dialog.showErrorBox('Error', 'Failed to recover original network, original gateway is missing.')
  }
}

function stopCore() {
  if (core !== null) {
    // We want a graceful shutdown for the core, but sending signals
    // not work on Windows, use TCP instead.
    if (process.platform == 'win32') {
      c = new net.Socket()
      c.connect(coreRpcPort, '127.0.0.1', () => {
        c.write('SIGINT')
      })
      c.on('data', (data) => {
        if (data.toString() == 'OK') {
          c.destroy()
          core = null
        }
      })
      c.on('error', (err) => {
        log.info('management RPC error:')
        log.info(err)
      })
    } else {
      core.kill('SIGTERM')
      core = null
    }
  }
  setState(state.Disconnected)
}

const delay = ms => new Promise(res => setTimeout(res, ms))

async function up() {
  switch (process.platform) {
    case 'darwin':
    case 'linux':
      if (!helperVerified) {
        if (!checkHelper()) {
          success = await installHelper()
          if (!success) {
            return
          }
        }
        helperVerified = true
      }
      break
  }
  // Store current variables for special handling when the network change
  tempOrigGw = origGw
  tempSendThrough = sendThrough
  gw = null
  for (i = 0; i < 5; i++) {
    gw = getDefaultGateway()
    if (gw === null) {
      await delay(1000)
      log.info('Retrying to get the default gateway.')
      continue
    }
    break
  }
  if (gw === null) {
    // Default gateway is missing, already tried 5 times to get it and
    // all failed, better to show an error to user and stop the core
    // for the moment.
    stopCore()
    dialog.showErrorBox('Error', 'Failed to find the default gateway, please ensure your network is reachable. You may try to restart/reconnect the network/wifi.')
    return
  } else if (tunAddrBlock.contains(gw['gateway'])) {
    // Routing seems ready, check if the core should restart.
    if (core === null) {
      startCore(null)
      running = true
      return
    }
    return
  } else {
    // This is the original gateway.
    origGw = gw['gateway']
    log.info('Original gateway is ' + origGw)
    st = null
    for (i = 0; i < 5; i++) {
      st = findOriginalSendThrough()
      if (st === null) {
        await delay(1000)
        log.info('Retrying to find the original send through address.')
        continue
      }
      break
    }
    if (st !== null) {
      log.info('Original send through ' + st['address'] + ' ' + st['interface'])
      sendThrough = st['address']
      origGwScope = st['interface']
    } else {
      log.info('Can not find original send through.')
      sendThrough = null
      origGwScope = null
      stopCore()
      return
    }

    // Original gateway and original send through were found, start the core
    // if necessary.
    if (core === null) {
      startCore(configRoute);
      running = true;
    } else if (tempSendThrough !== sendThrough) {
      stopCore()
      startCore(configRoute);
      running = true;
    } else {
      configRoute();
    }
  }
}

async function down() {
  log.info('Shutting down the core.')

  // Get the gateway first since stopping the core may causes
  // the route to be deleted.
  gw = getDefaultGateway()

  if (core) {
    stopCore()
  }

  // Recover default route only if current route is to tunGw.
  if (gw !== null && tunAddrBlock.contains(gw['gateway'])) {
    recoverRoute()
  }

  running = false

  setState(state.Disconnected)

  log.info('Core downed.')
}

// {gateway: '1.2.3.4', interface: 'en1'}
function getDefaultGateway() {
  try {
    return defaultGateway.v4.sync()
  } catch(error) {
    return null
  }
}

// {address: '192.168.1.1', interface: 'en0'}
function findOriginalSendThrough() {
  if (origGw === null) {
    return null
  }

  ifaces = os.networkInterfaces()
  for (k in ifaces) {
    for (let addrObj of ifaces[k]) {
      cidr = addrObj['cidr']
      if (addrObj['family'] == 'IPv4' && !addrObj['internal'] && cidr !== undefined) {
        block = new Netmask(cidr)
        if (block.contains(origGw)) {
          return {address: addrObj['address'], interface: k}
        }
      }
    }
  }

  return null
}

function findTunInterface() {
  ifaces = os.networkInterfaces()
  for (k in ifaces) {
    for (let addrObj of ifaces[k]) {
      cidr = addrObj['cidr']
      if (addrObj['family'] == 'IPv4' && !addrObj['internal'] && cidr !== undefined) {
        block = new Netmask(cidr)
        if (block.contains(tunGw)) {
          return {address: addrObj['address'], interface: k}
        }
      }
    }
  }

  return null
}

async function sudoExec(cmd) {
  return new Promise((resolve, reject) => {
    var options = { name: 'Mellow' }
    sudo.exec(cmd, options, (err, stdout, stderr) => {
      if (err) {
        log.info(stderr)
        log.info(stdout)
        reject(err)
      }
      resolve(stdout)
    })
  })
}

async function installHelper() {
  log.info('Installing helper.')

  var installer
  var cmd

  if (process.platform == 'linux') {
    let tmpResDir = '/tmp/mellow_helper_res'
    execSync(util.format('cp -r %s %s', helperResourcePath, tmpResDir))
    installer = path.join(tmpResDir, 'install_helper')
    cmd = util.format('"%s" "%s" "%s"', installer, tmpResDir, helperInstallPath)
  } else {
    installer = path.join(helperResourcePath, 'install_helper')
    cmd = util.format('"%s" "%s" "%s"', installer, helperResourcePath, helperInstallPath)
  }

  log.info('Executing:', cmd)

  try {
    await sudoExec(cmd)
    log.info('Helper installed.')
    return true
  } catch (err) {
    dialog.showErrorBox('Error', 'Failed to install helper: ' + err)
    return false
  }
}

function createConfigFileIfNotExists() {
  if (!fs.existsSync(configFile)) {
    if (!fs.existsSync(configFolder)) {
      fs.mkdirSync(configFolder, { recursive: true })
    }
    fd = fs.openSync(configFile, 'w')
    fs.writeSync(fd, config.jsonTemplate)
    fs.closeSync(fd)
  }
}

function checkForUpdates(silent) {
  opt = {
    headers: {
      'User-Agent': 'Mellow'
    }
  }
  https.get('https://api.github.com/repos/eycorsican/Mellow/releases/latest', opt, (res) => {
    if (res.statusCode != 200) {
      if (!silent) {
        dialog.showErrorBox('Error', 'HTTP GET failed, status: ' + res.statusCode)
      }
      return
    }
    var body = ''
    res.on('data', (data) => {
      body += data
    })
    res.on('end', () => {
      obj = JSON.parse(body)
      latestVer = semver.clean(obj['tag_name'])
      ver = app.getVersion()
      if (ver != latestVer) {
        dialog.showMessageBox({ message: util.format('A new version (%s) is available.\n\nRelease Notes:\n%s\n\nDownload: %s', latestVer, obj['body'], obj['html_url']) })
      } else {
        if (!silent) {
          dialog.showMessageBox({ message: 'You are up-to-date!' })
        }
      }
    })
  }).on('error', (err) => {
    if (!silent) {
      dialog.showErrorBox('Error', 'HTTP GET failed: ' + err)
    }
  })
}

function reconnect() {
  down()
  up()
}

function getFormattedTime() {
    var today = new Date();
    var y = today.getFullYear();
    // JavaScript months are 0-based.
    var m = today.getMonth() + 1;
    var d = today.getDate();
    var h = today.getHours();
    var mi = today.getMinutes();
    var s = today.getSeconds();
    return y + "-" + m + "-" + d + "-" + h + "-" + mi + "-" + s;
}

function createTray() {
  tray = new Tray(trayIcon.off)

  var mainMenus = []
  mainMenus = [
    ...mainMenus,
    { label: 'Connect', type: 'normal', click: function() {
        up()
      }
    },
    { label: 'Disconnect', type: 'normal', click: function() {
        down()
      }
    },
    { label: 'Reconnect', type: 'normal', click: function() {
        reconnect()
      }
    }
  ]

  mainMenus.push({ type: 'separator' })

  const configs = fs.readdirSync(configFolder).filter(x => (x.match(/^[^.].*(\.conf|\.json)$/g)))
  configs.forEach((config) => {
    mainMenus.push({
      label: config,
      type: 'checkbox',
      checked: ((store.get('selectedConfig').length > 0) && (config == store.get('selectedConfig').replace(/^.*[\\\/]/, ''))),
      click: function() {
        const fullpath = path.join(configFolder, config)
        store.set('selectedConfig', fullpath)
        if (isConnected()) {
          reconnect()
        }
      }
    })
  })
  if (configs.length > 0) {
    mainMenus.push({ type: 'separator' })
  }
  mainMenus.push({
    label: 'Config Template',
    type: 'submenu',
    submenu: Menu.buildFromTemplate([{
      label: 'Create Conf Template',
      type: 'normal',
      click: () => {
        f = fs.openSync(path.join(configFolder, getFormattedTime() + '.conf'), 'w+')
        fs.writeFileSync(f, config.confTemplate)
        fs.closeSync(f)
        reloadTray()
      }
    }, {
      label: 'Create JSON Template',
      type: 'normal',
      click: () => {
        f = fs.openSync(path.join(configFolder, getFormattedTime() + '.json'), 'w+')
        fs.writeFileSync(f, config.jsonTemplate)
        fs.closeSync(f)
        reloadTray()
      }
    }])
  })
  mainMenus.push({
    label: 'Config Folder',
    type: 'normal',
    click: () => { shell.openItem(configFolder) }
  })
  mainMenus.push({
    label: 'Reload Configs',
    type: 'normal',
    click: () => {
      reloadTray()
    }
  })

  mainMenus.push({ type: 'separator' })

    // { label: 'Config', type: 'submenu', submenu: Menu.buildFromTemplate([
    //     { label: 'Edit', type: 'normal', click: function() {
    //         try {
    //           createConfigFileIfNotExists()
    //         } catch (err) {
    //           dialog.showErrorBox('Error', 'Failed to create file/folder: ' + err)
    //         }
    //         shell.openItem(configFile)
    //       }
    //     },
    //     {
    //       label: 'Download From URL',
    //       type: 'normal',
    //       click: () => {
    //         prompt({
    //           title: 'Download V2Ray Config',
    //           label: 'V2Ray Config URL:',
    //           value: store.get('configUrl'),
    //           inputAttrs: {
    //               type: 'url'
    //           }
    //         })
    //         .then((r) => {
    //             if (r) {
    //               opt = {
    //                 timeout: 15 * 1000
    //               }
    //               https.get(r, opt, (res) => {
    //                 if (res.statusCode != 200) {
    //                   dialog.showErrorBox('Error', 'HTTP GET failed, status: ' + res.statusCode)
    //                   return
    //                 }
    //                 var body = ''
    //                 res.on('data', (data) => {
    //                   body += data
    //                 })
    //                 res.on('end', () => {
    //                   try {
    //                     createConfigFileIfNotExists()
    //                   } catch (err) {
    //                     dialog.showErrorBox('Error', 'Failed to create file/folder: ' + err)
    //                     return
    //                   }

    //                   fd = fs.openSync(configFile, 'w')
    //                   fs.writeSync(fd, body)
    //                   fs.closeSync(fd)

    //                   store.set('configUrl', r)
    //                   dialog.showMessageBox({message: 'Success.'})
    //                 })
    //                 res.on('timeout', ()=> {
    //                   dialog.showErrorBox('Error', 'HTTP GET timeout')
    //                 })
    //               }).on('error', (err) => {
    //                 dialog.showErrorBox('Error', 'HTTP GET failed: ' + err)
    //               })
    //             }
    //         })
    //         .catch((err) => {
    //           dialog.showErrorBox('Error', 'Failed to download config: ' + err)
    //         })
    //       }
    //     },
    //     {
    //       label: 'Open Folder',
    //       type: 'normal',
    //       click: () => { shell.openItem(configFolder) }
    //     },
    //   ])
    // },

    var otherMenus = [{
      label: 'Preferences',
      type: 'submenu',
      submenu: Menu.buildFromTemplate([
        {
          label: 'Auto Launch',
          type: 'checkbox',
          click: (item) => {
            store.set('autoLaunch', item.checked)
            resetAutoLaunch()
          },
          checked: store.get('autoLaunch')
        },
        {
          label: 'Auto Connect',
          type: 'checkbox',
          click: (item) => { store.set('autoConnect', item.checked) },
          checked: store.get('autoConnect')
        },
        {
          label: 'Check Updates',
          type: 'checkbox',
          click: (item) => { store.set('checkUpdates', item.checked) },
          checked: store.get('checkUpdates')
        },
        {
          label: 'Log Level',
          type: 'submenu',
          submenu: Menu.buildFromTemplate([
            {
              label: 'debug',
              type: 'radio',
              click: () => { store.set('loglevel', 'debug') },
              checked: store.get('loglevel') == 'debug'
            },
            {
              label: 'info',
              type: 'radio',
              click: () => { store.set('loglevel', 'info') },
              checked: store.get('loglevel') == 'info'
            },
            {
              label: 'warn',
              type: 'radio',
              click: () => { store.set('loglevel', 'warn') },
              checked: store.get('loglevel') == 'warn'
            },
            {
              label: 'error',
              type: 'radio',
              click: () => { store.set('loglevel', 'error') },
              checked: store.get('loglevel') == 'error'
            },
            {
              label: 'none',
              type: 'radio',
              click: () => { store.set('loglevel', 'none') },
              checked: store.get('loglevel') == 'none'
            }
          ])
        },
        { type: 'separator' },
        {
          label: 'Reset',
          type: 'normal',
          click: (item) => {
            store.clear()
            reloadTray()
          }
        },
      ])
    },
    { type: 'separator' },
    { label: 'Sessions', type: 'normal', click: function() {
        if (core === null) {
          dialog.showMessageBox({message: 'Proxy is not running.'})
        } else {
          shell.openExternal('http://localhost:6001/stats/session/plain')
        }
      }
    },
    {
      label: 'Open Log',
      type: 'normal',
      click: () => { shell.openItem(logPath) }
    },
    { type: 'separator' },
    { label: 'Check For Updates', type: 'normal', click: function() {
        checkForUpdates(false)
      }
    },
    { label: 'About', type: 'normal', click: function() {
        dialog.showMessageBox({ message: util.format('Mellow (v%s)\n\n%s', app.getVersion(), 'https://github.com/eycorsican/Mellow') })
      }
    },
    { type: 'separator' },
    { label: 'Quit', type: 'normal', click: function() {
        down()
        app.quit()
      }
    }
  ]

  mainMenus.push(...otherMenus)

  tray.setToolTip('Mellow')
  tray.setContextMenu(Menu.buildFromTemplate(mainMenus))
  setState(currentState)
}

function reloadTray() {
  tray.destroy()
  createTray()
}

function monitorRunningStatus() {
  setInterval(() => {
    if (running) {
      up()
    }
  }, 60 * 1000)
}

function init() {
  createTray()
  monitorPowerEvent()
  monitorRunningStatus()
  if (store.get('autoConnect')) {
    up()
  }
  log.info(util.format('Mellow (%s) started.', app.getVersion()))
  if (store.get('checkUpdates')) {
    checkForUpdates(true)
  }
}

app.on('ready', init)

app.on('window-all-closed', function () {
  // Do nothing.
})

app.on('quit', () => {
  switch (process.platform) {
    case 'darwin':
      if (themeChangedNotifier !== null) {
        systemPreferences.unsubscribeNotification(themeChangedNotifier)
      }
      break
  }
})
