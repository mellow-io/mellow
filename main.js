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
  dnsFallback: {
    type: 'boolean',
    default: false
  },
  loglevel: {
    type: 'string',
    default: 'info'
  }
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
  helperResourcePath = path.join(process.resourcesPath, 'helper')
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
let configFolder = app.getPath('userData')
let configFile = path.join(configFolder, 'cfg.json')
let configTemplate = `{
    "log": {
        "loglevel": "warning"
    },
    "outbounds": [
        {
            "protocol": "vmess",
            "settings": {
                "vnext": [
                    {
                        "users": [
                            {
                                "id": "d2953280-9eb3-451d-aef6-283cd79ba62c",
                                "alterId": 4
                            }
                        ],
                        "address": "yourserver.com",
                        "port": 10086
                    }
                ]
            },
            "tag": "proxy"
        },
        {
            "protocol": "freedom",
            "settings": {
              "domainStrategy": "UseIP"
            },
            "tag": "direct"
        }
    ],
    "dns": {
        "servers": [
            {
                "address": "8.8.8.8",
                "port": 53
            },
            {
                "address": "223.5.5.5",
                "port": 53,
                "domains": [
                    "geosite:cn"
                ]
            }
        ]
    },
    "routing": {
        "domainStrategy": "IPIfNonMatch",
        "rules": [
            {
                "ip": [
                    "8.8.8.8/32"
                ],
                "type": "field",
                "outboundTag": "proxy"
            },
            {
                "type": "field",
                "domain": [
                    "geosite:cn"
                ],
                "outboundTag": "direct"
            },
            {
                "type": "field",
                "ip": [
                    "geoip:cn",
                    "geoip:private"
                ],
                "outboundTag": "direct"
            },
            {
                "ip": [
                    "0.0.0.0/0",
                    "::/0"
                ],
                "type": "field",
                "outboundTag": "proxy"
            }
        ]
    }
}`

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
let contextMenu = null
let startItem = null
let core = null
let coreRpcPort = 6002
let coreInterrupt = false
let origGw = null
let origGwScope = null
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

var trayOnIcon
var trayOffIcon
switch (process.platform) {
  case 'linux':
  case 'darwin':
    if (systemPreferences.isDarkMode()) {
      trayOnIcon = path.join(__dirname, 'assets/tray-on-icon-light.png')
    } else {
      trayOnIcon = path.join(__dirname, 'assets/tray-on-icon.png')
    }
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
  case 'linux':
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

  try {
    if (!fs.existsSync(configFile)) {
      dialog.showMessageBox({message: 'Config file not found.'})
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
    case 'linux':
    case 'darwin':
      params = [
        '-tunName', tunName,
        '-tunAddr', tunAddr,
        '-tunMask', tunMask,
        '-tunGw', tunGw,
        '-sendThrough', sendThrough,
        '-vconfig', configFile,
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
        '-vconfig', configFile
      ]
      break
  }
  if (store.get('dnsFallback')) {
    params.push('-dnsFallback')
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
  tray.setImage(trayOffIcon)
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

function createTray() {
  tray = new Tray(trayOffIcon)
  contextMenu = Menu.buildFromTemplate([
    { label: 'Connect', type: 'normal', click: function() {
        up()
      }
    },
    { label: 'Disconnect', type: 'normal', click: function() {
        down()
      }
    },
    { type: 'separator' },
    { label: 'Config', type: 'submenu', submenu: Menu.buildFromTemplate([
        { label: 'Edit', type: 'normal', click: function() {
            try {
              if (!fs.existsSync(configFile)) {
                if (!fs.existsSync(configFolder)) {
                  fs.mkdirSync(configFolder, { recursive: true })
                }
                fd = fs.openSync(configFile, 'w')
                fs.writeSync(fd, configTemplate)
                fs.closeSync(fd)
              }
            } catch (err) {
              dialog.showErrorBox('Error', 'Failed to create file/folder: ' + err)
            }
            shell.openItem(configFile)
          }
        },
        {
          label: 'Open Folder',
          type: 'normal',
          click: () => { shell.openItem(configFolder) }
        },
      ])
    },
    { type: 'separator' },
    {
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
          label: 'Force DNS over TCP',
          type: 'checkbox',
          click: (item) => { store.set('dnsFallback', item.checked) },
          checked: store.get('dnsFallback')
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
        }
      ])
    },
    { type: 'separator' },
    { label: 'Statistics', type: 'normal', click: function() {
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
  if (store.get('autoConnect')) {
    up()
  }
  log.info(util.format('Mellow (%s) started.', app.getVersion()))
}

app.on('ready', init)
