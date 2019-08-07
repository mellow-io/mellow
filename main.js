const electron = require('electron')
const {app, Menu, Tray, BrowserWindow, dialog} = electron
const path = require('path')
const { spawn, execSync } = require('child_process')
const log = require('electron-log');
const sudo = require('sudo-prompt')
const defaultGateway = require('default-gateway');
const os = require('os');
const fs = require('fs');
const util = require('util');
const Netmask = require('netmask').Netmask
const open = require('open')

// require('electron-reload')(__dirname)

let helperFiles = [
  'geo.mmdb',
  'geosite.dat',
  'md5sum',
  'route',
  'tun2socks'
]

let helperResourcePath = path.join(process.resourcesPath, 'helper')
let helperInstallPath = "/Library/Application Support/Mellow"

let routeCmd = path.join(helperInstallPath, 'route')
let coreCmd = path.join(helperInstallPath, 'tun2socks')
let md5Cmd = path.join(helperInstallPath, 'md5sum')

let tray = null
let contextMenu = null
let startItem = null
let core = null
let startInterrupt = false
let origGw = null
let origGwScope = null
let sendThrough = null
let tunAddr = '10.255.0.2'
let tunMask = '255.255.255.0'
let tunGw = '10.255.0.1'
var tunAddrBlock = new Netmask(tunAddr, tunMask)

app.dock.hide()

function monitorPowerEvent() {
  electron.powerMonitor.on('lock-screen', () => {
    log.info('Screen locked.')
  })
  electron.powerMonitor.on('unlock-screen', () => {
    log.info('Screen unlocked.')
  })
  electron.powerMonitor.on('suspend', () => {
    log.info('Device suspended.')
  })
  electron.powerMonitor.on('resume', async () => {
    log.info('Device resumed.')
    await delay(2000)
    run()
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

function startCore() {
  startInterrupt = false
  configFile = path.join(app.getPath('userData'), 'cfg.json')
  try {
    if (!fs.existsSync(configFile)) {
      dialog.showErrorBox('Error', 'Can not find V2Ray config file at ' + configFile, ', if the file does not exist, you must create one, and note the file location is fixed.')
      return false
    }
  } catch(err) {
    dialog.showErrorBox('Error', err)
  }
  var params = [
    '-tunAddr', tunAddr,
    '-tunMask', tunMask,
    '-tunGw', tunGw,
    '-sendThrough', sendThrough,
    '-vconfig', configFile,
    '-proxyType', 'v2ray',
    '-sniffingType', '""',
    '-relayICMP', '-fakeDns', '-loglevel', 'info', '-stats',
    '-fakeDnsCacheDir', app.getPath('userData')
  ]
  core = spawn(coreCmd, params)
  core.stdout.on('data', (data) => {
    log.info(data.toString());
  });
  core.stderr.on('data', (data) => {
    log.info(data.toString())
  });
  core.on('close', (code, signal) => {
    log.info('Core stopped, code', code, 'signal' , signal)
    if (code != 0) {
      startInterrupt = true
      core = null
      tray.setImage(path.join(__dirname, 'assets/tray-off-icon.png'))
      dialog.showErrorBox('Error', 'Failed to start the Core, see "~/Library/Logs/Mellow/log.log" for more details.', )
    }
  })
  core.on('error', (err) => {
    log.info('Core errored.')
    startInterrupt = true
    core = null
    tray.setImage(path.join(__dirname, 'assets/tray-off-icon.png'))
    dialog.showErrorBox('Error', 'Failed to start the Core, see "~/Library/Logs/Mellow/log.log" for more details.', )
  })
  log.info('Core started.')
  tray.setImage(path.join(__dirname, 'assets/tray-on-icon.png'))
  return true
}

function configRoute() {
  if (startInterrupt) {
    log.info('Start interrupted.')
    startInterrupt = false
    return
  }
  if (tunGw === null || origGw === null || origGwScope === null) {
    dialog.showErrorBox('Warning', 'Unable to configure the routing table for the moment, please try to start the proxy from tray manually. If that does not work, try restarting the app.')
    return
  }
  log.info('Set ' + tunGw + ' as the default gateway.')
  try {
    execSync(util.format('"%s" delete default', routeCmd))
    execSync(util.format('"%s" add default %s', routeCmd, tunGw))
    execSync(util.format('"%s" add default %s -ifscope %s', routeCmd, origGw, origGwScope))
  } catch (error) {
    log.info(error.stdout.toString())
    log.info(error.stderr.toString())
    dialog.showErrorBox('Error', 'Failed to configure routes.')
  }
}

function recoverRoute() {
  if (origGw !== null) {
    log.info('Restore ' + origGw + ' as the default gateway.')
    try {
      execSync(util.format('"%s" delete default', routeCmd))
      execSync(util.format('"%s" delete default -ifscope %s', routeCmd, origGwScope))
      execSync(util.format('"%s" add default %s', routeCmd, origGw))
    } catch (error) {
      log.info(error.stdout)
      log.info(error.stderr)
      dialog.showErrorBox('Error', 'Failed to configure routes.')
    }
  } else {
    dialog.showErrorBox('Error', 'Failed to recover original network.')
  }
}

function stopCore() {
  core.kill('SIGTERM')
  core = null
  tray.setImage(path.join(__dirname, 'assets/tray-off-icon.png'))
}

const delay = ms => new Promise(res => setTimeout(res, ms));

async function run() {
  if (!checkHelper()) {
    success = await installHelper()
    if (!success) {
      return
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
  log.info('Default gateway is', gw['gateway'])
  if (gw === null) {
    // Stop if the default gateway is missing.
    dialog.showErrorBox('Error', 'Failed to find the default gateway.')
    stopCore()
    return
  } else if (tunAddrBlock.contains(gw['gateway'])) {
    // tunGw is already the default gateway.
    if (core === null) {
      if (!startCore()) {
        return
      }
    }
    return
  } else {
    // It should be the original gateway, remeber it.
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
    }
    if (core === null) {
      if (!startCore()) {
        return
      }
    }
    setTimeout(configRoute, 500)
  }
}

function stop() {
  gw = getDefaultGateway()
  // Recover default route only if current route is to tunGw.
  if (gw !== null && tunAddrBlock.contains(gw['gateway'])) {
    recoverRoute()
  }
  if (core) {
    stopCore()
  }
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

async function sudoExecSync(cmd) {
  return new Promise((resolve, reject) => {
    var options = { name: 'Mellow' }
    sudo.exec(cmd, options, (err, out, stderr) => {
      if (err) {
        reject(err)
      }
      resolve(out)
    })
  })
}

async function installHelper() {
  log.info('Installing helper.')
  var installer = path.join(helperResourcePath, 'install_helper')
  cmd = util.format('"%s" "%s" "%s"', installer, helperResourcePath, helperInstallPath)
  log.info('Executing:', cmd)
  try {
    await sudoExecSync(cmd)
    log.info('Helper installed.')
    return true
  } catch (err) {
    dialog.showErrorBox('Error', 'Failed to install helper: ' + err)
    return false
  }
}

function createTray() {
  tray = new Tray(path.join(__dirname, 'assets/tray-off-icon.png'))
  contextMenu = Menu.buildFromTemplate([
    { label: 'Start', type: 'normal', click: function() {
        run()
      }
    },
    { label: 'Stop', type: 'normal', click: function() {
        stop()
      }
    },
    { type: 'separator' },
    { label: 'Statistics', type: 'normal', click: function() {
        if (core === null) {
          dialog.showMessageBox({message: 'Proxy is not running.'})
        } else {
          open('http://localhost:6001/stats/session/plain')
        }
      }
    },
    { type: 'separator' },
    { label: 'Quit', type: 'normal', click: function() {
        stop()
        app.quit()
      }
    }
  ])
  tray.setToolTip('Mellow')
  tray.setContextMenu(contextMenu)
}

function monitorRunningStatus() {
  setInterval(() => {
    if (core !== null) {
      gw = getDefaultGateway()
      if (gw != null) {
        if (tunAddrBlock.contains(gw['gateway'])) {
          tray.setImage(path.join(__dirname, 'assets/tray-on-icon.png'))
          return
        } else {
          tray.setImage(path.join(__dirname, 'assets/tray-off-icon.png'))

          // Core is running, but the default route is not to TUN, try
          // to reconfigure routes.
          run()
        }
      }
    } else {
      tray.setImage(path.join(__dirname, 'assets/tray-off-icon.png'))
    }
  }, 5000)
}

function init() {
  createTray()
  monitorPowerEvent()
  monitorRunningStatus()
}

app.on('ready', init)
