const electron = require('electron')
const { app, Menu, Tray, BrowserWindow, dialog, shell } = electron
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
const open = require('open')

// require('electron-reload')(__dirname)

let helperFiles = [
  'geo.mmdb',
  'geosite.dat',
  'md5sum',
  'route',
  'core'
]

let helperResourcePath = path.join(process.resourcesPath, 'helper')
let helperInstallPath = "/Library/Application Support/Mellow"
let logPath = log.transports.file.findLogPath('Mellow')

let routeCmd = path.join(helperInstallPath, 'route')
let coreCmd = path.join(helperInstallPath, 'core')
let md5Cmd = path.join(helperInstallPath, 'md5sum')

let running = false
let coreNeedResume = false
let tray = null
let contextMenu = null
let startItem = null
let core = null
let coreRpcPort = 6002
let coreInterrupt = false
let origGw = null
let origGwScope = null
let sendThrough = null
let tunName = 'mellow-tap0'
let tunAddr = '10.255.0.2'
let tunMask = '255.255.255.0'
let tunGw = '10.255.0.1'
let loglevel = 'info'
var tunAddrBlock = new Netmask(tunAddr, tunMask)

var trayOnIcon
var trayOffIcon
switch (process.platform) {
  case 'darwin':
    trayOnIcon = path.join(__dirname, 'assets/tray-on-icon.png')
    trayOffIcon = path.join(__dirname, 'assets/tray-off-icon.png')
    break
  case 'win32':
    trayOnIcon = path.join(__dirname, 'assets/tray-on-icon-win.ico')
    trayOffIcon = path.join(__dirname, 'assets/tray-off-icon.png')
    break
}

switch (process.platform) {
  case 'darwin':
    app.dock.hide()
    break
  case 'win32':
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
        dialog.showErrorBox('Error', 'Failed checksum helper files, it seems md5 or awk command is missing.')
      } else {
        log.info(err)
        return false
      }
    }
  }
  return true
}
// Return true if the core start successfully, otherwise return false.
async function startCore(callback) {
  coreInterrupt = false

  configFile = path.join(app.getPath('userData'), 'cfg.json')

  try {
    if (!fs.existsSync(configFile)) {
      dialog.showErrorBox('Error', util.format('Can not find V2Ray config file at %s, if the file does not exist, you must create one, and note the file location is fixed.', configFile))
      return
    }
  } catch(err) {
    dialog.showErrorBox('Error', err)
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
    case 'darwin':
      cmd = coreCmd
      params = [
        '-tunAddr', tunAddr,
        '-tunMask', tunMask,
        '-tunGw', tunGw,
        '-sendThrough', sendThrough,
        '-vconfig', configFile,
        '-proxyType', 'v2ray',
        '-sniffingType', 'none',
        '-relayICMP',
        '-fakeDns',
        '-loglevel', loglevel,
        '-stats',
        '-fakeDnsCacheDir', app.getPath('userData')
      ]
      break
    case 'win32':
      cmd = path.join(helperResourcePath, 'core.exe')
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
        '-fakeDns',
        '-stats',
        '-loglevel', loglevel,
        '-vconfig', configFile,
        '-fakeDnsCacheDir', app.getPath('userData')
      ]
      break
  }
  core = spawn(cmd, params)
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
      tray.setImage(trayOffIcon)
      return
    }

    if (code && code != 0) {
      log.info('Core fails to startup, interrupt the starting procedure.')
      coreInterrupt = true
      core = null
      tray.setImage(trayOffIcon)
      dialog.showErrorBox('Error', util.format('Failed to start the Core, see "%s" for more details.', logPath))
    }
  })
  core.on('error', (err) => {
    log.info('Core errored.')
    coreInterrupt = true
    core = null
    tray.setImage(trayOffIcon)
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
        execSync(util.format('"%s" add default %s -ifscope %s', routeCmd, origGw, origGwScope))
        break
      case 'win32':
        await sudoExec(util.format('%s %s %s', path.join(helperResourcePath, 'config_route.bat'), tunGw, origGw))
        break
    }
    log.info('Set ' + tunGw + ' as the default gateway.')
  } catch (error) {
    log.info(error.stdout.toString())
    log.info(error.stderr.toString())
    dialog.showErrorBox('Error', util.format('Failed to configure routes, see "%s" for more details.', logPath))
  }
  tray.setImage(trayOnIcon)
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
  tray.setImage(trayOffIcon)
}

const delay = ms => new Promise(res => setTimeout(res, ms))

async function up() {
  if (process.platform == "darwin") {
    if (!checkHelper()) {
      success = await installHelper()
      if (!success) {
        return
      }
    }
  }

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
      startCore(configRoute)
      running = true
    } else {
      configRoute()
    }
  }
}

async function down() {
  log.info('Shutting down the core.')

  if (core) {
    stopCore()
  }

  gw = getDefaultGateway()
  // Recover default route only if current route is to tunGw.
  if (gw !== null && tunAddrBlock.contains(gw['gateway'])) {
    recoverRoute()
  }

  running = false
  tray.setImage(trayOffIcon)

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
  var installer = path.join(helperResourcePath, 'install_helper')
  cmd = util.format('"%s" "%s" "%s"', installer, helperResourcePath, helperInstallPath)
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

function createTray() {
  tray = new Tray(trayOffIcon)
  contextMenu = Menu.buildFromTemplate([
    { label: 'Start', type: 'normal', click: function() {
        up()
      }
    },
    { label: 'Stop', type: 'normal', click: function() {
        down()
      }
    },
    { type: 'separator' },
    { label: 'Config', type: 'normal', click: function() {
        shell.openItem(app.getPath('userData'))
      }
    },
    { label: 'Statistics', type: 'normal', click: function() {
        if (core === null) {
          dialog.showMessageBox({message: 'Proxy is not running.'})
        } else {
          open('http://localhost:6001/stats/session/plain')
        }
      }
    },
    { label: 'Log', type: 'normal', click: function() {
        shell.openItem(logPath)
      }
    },
    { label: 'Log Level', type: 'submenu', submenu: Menu.buildFromTemplate([
        {
          label: 'debug',
          type: 'radio',
          click: () => { loglevel = 'debug' }
        },
        {
          label: 'info',
          type: 'radio',
          click: () => { loglevel = 'info' },
          checked: true
        },
        {
          label: 'warn',
          type: 'radio',
          click: () => { loglevel = 'warn' }
        },
        {
          label: 'error',
          type: 'radio',
          click: () => { loglevel = 'error' }
        },
        {
          label: 'none',
          type: 'radio',
          click: () => { loglevel = 'none' }
        }
      ])
    },
    { type: 'separator' },
    { label: 'Quit', type: 'normal', click: function() {
        down()
        app.quit()
      }
    }
  ])
  tray.setToolTip('Mellow')
  tray.setContextMenu(contextMenu)
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
}

app.on('ready', init)
