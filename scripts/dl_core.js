const axios = require('axios').default
const fs = require('fs')
const util = require('util')
const path = require('path')

const version = 'v1.0.10'
const linkPrefix = 'https://github.com/mellow-io/go-tun2socks/releases/download'

const links = {
  darwin: util.format('%s/%s/core-darwin-10.6-amd64', linkPrefix, version),
  linux: util.format('%s/%s/core-linux-amd64', linkPrefix, version),
  win32: util.format('%s/%s/core-windows-4.0-amd64.exe', linkPrefix, version)
}
const dsts = {
  darwin: path.join(__dirname, '../src/helper/darwin/core'),
  linux: path.join(__dirname, '../src/helper/linux/core'),
  win32: path.join(__dirname, '../src/helper/win32/core.exe')
}

async function download(url, filePath) {
  const writer = fs.createWriteStream(filePath)
  console.log('Downloading', url)
  const resp = await axios({
    url,
    method: 'GET',
    responseType: 'stream',
    onDownloadProgress: (e) => {
      console.log(e)
    }
  })
  resp.data.pipe(writer)
  writer.on('finish', () => {
    console.log('Saved file', filePath)
  })
  writer.on('error', (err) => {
    console.log('Download failed.', err)
  })
}

if (process.argv.length > 2) {
  if (process.argv[2] == '--all') {
      download(links.darwin, dsts.darwin)
      download(links.linux, dsts.linux)
      download(links.win32, dsts.win32)
  }
  if (process.argv[2] == '--darwin') {
      download(links.darwin, dsts.darwin)
  }
  if (process.argv[2] == '--linux') {
      download(links.linux, dsts.linux)
  }
  if (process.argv[2] == '--win' || process.argv[2] == '--win32') {
      download(links.win32, dsts.win32)
  }
} else {
  switch (process.platform) {
    case 'darwin':
      download(links.darwin, dsts.darwin)
      break
    case 'linux':
      download(links.linux, dsts.linux)
      break
    case 'win32':
      download(links.win32, dsts.win32)
      break
  }
}
