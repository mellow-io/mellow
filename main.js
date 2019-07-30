const electron = require('electron')
const {app, Menu, Tray, BrowserWindow, dialog} = electron
const path = require('path')
const { spawn, execSync } = require('child_process')
const log = require('electron-log');
const sudo = require('sudo-prompt')
const defaultGateway = require('default-gateway');
const os = require('os');
const Netmask = require('netmask').Netmask

require('electron-reload')(__dirname)

let supportRouteCmd = path.join("/Library/Application\\ Support/Mellow", 'route')
let supportCoreCmd = path.join("/Library/Application Support/Mellow", 'tun2socks')
let tray = null
let contextMenu = null
let startItem = null
let tun2socks = null
let running = false
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
  electron.powerMonitor.on('resume', () => {
    log.info('Device resumed.')
    run()
  })
}

function startCore() {
  log.info('Core started.')
  var params = [
    '-tunAddr', tunAddr,
    '-tunMask', tunMask,
    '-tunGw', tunGw,
    '-sendThrough', sendThrough,
    '-vconfig', path.join(app.getPath('userData'), 'cfg.json'),
    '-proxyType', 'v2ray',
    '-fakeDns', '-loglevel', 'info', '-stats',
    '-fakeDnsCacheDir', app.getPath('userData')
  ]
  tun2socks = spawn(supportCoreCmd, params)
  tun2socks.stdout.on('data', (data) => {
    log.info(data.toString());
  });
  tun2socks.stderr.on('data', (data) => {
    log.info(data.toString());
  });
  tun2socks.on('close', (code, signal) => {
    log.info('Core stopped.')
  })
}

function configRoute() {
  if (tunGw === null || origGw === null || origGwScope === null) {
    dialog.showErrorBox('Error', 'Failed to configure routig table: invalid args.')
    return
  }
  log.info('Set ' + tunGw + ' as the default gateway.')
  try {
    execSync(supportRouteCmd + ' delete default')
    execSync(supportRouteCmd + ' add default ' + tunGw)
    execSync(supportRouteCmd + ' add default ' + origGw + ' -ifscope ' + origGwScope)
  } catch (error) {
    log.info('Failed to add default route:')
    log.info(error.stdout)
    log.info(error.stderr)
  }
  running = true
  log.info('Running: ' + running)
}

function recoverRoute() {
  if (origGw !== null) {
    log.info('Restore ' + origGw + ' as the default gateway.')
    try {
      execSync(supportRouteCmd + ' delete default')
      execSync(supportRouteCmd + ' delete default -ifscope ' + origGwScope)
      execSync(supportRouteCmd + ' add default ' + origGw)
    } catch (error) {
      log.info('Failed to delete default route:')
      log.info(error.stdout)
      log.info(error.stderr)
    }
    running = false
    log.info('Running: ' + running)
  } else {
    dialog.showErrorBox('Error', 'Failed to recover original network.')
  }
}

function stopCore() {
  tun2socks.kill('SIGTERM')
  tun2socks = null
}

function run() {
  gw = getDefaultGateway()
  if (gw === null) {
    // Stop running if the default gateway is missing.
    dialog.showErrorBox('Error', 'Failed to find the default gateway.')
    stopCore()
    return
  } else if (tunAddrBlock.contains(gw['gateway'])) {
    // tunGw is already the default gateway.
    if (tun2socks === null) {
      startCore()
    }
    return
  } else {
    // It should be the original gateway, remeber it.
    origGw = gw['gateway']
    log.info('Original gateway is ' + origGw)
    st = findOriginalSendThrough()
    if (st !== null) {
      log.info('Original send through ' + st['address'] + ' ' + st['interface'])
      sendThrough = st['address']
      origGwScope = st['interface']
    } else {
      log.info('Can not find original send through.')
      sendThrough = null
      origGwScope = null
    }
    if (tun2socks === null) {
      startCore()
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
  if (tun2socks) {
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

function createTray() {
  tray = new Tray(path.join(__dirname, '/assets/tray-icon.png'))

  startItem = { label: 'Start', type: 'normal', click: function() {
      run()
    }
  }

  contextMenu = Menu.buildFromTemplate([
    startItem,
    { label: 'Stop', type: 'normal', click: function() {
        stop()
      }
    },
    { label: 'Install Helper', type: 'normal', click: function() {
        var options = { name: 'Mellow' }
        var helperPath = path.join(process.resourcesPath, 'helper')
        var installHelper = path.join(helperPath, 'install_helper')
        log.info('Executing: ' + installHelper)
        sudo.exec(installHelper + ' "' + helperPath + '"', options, (err, out, stderr) => {
          if (err) {
            log.info(err)
            log.info(stderr)
          }
          log.info(out)
        })
      }
    },
    { label: 'Quit', type: 'normal', click: function() {
        stop()
        app.quit()
      }
    }
  ])
  tray.setToolTip('Mellow')
  tray.setContextMenu(contextMenu)
}

function init() {
  createTray()
  monitorPowerEvent()
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', init)

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', function () {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) createWindow()
})
