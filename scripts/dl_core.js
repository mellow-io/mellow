const axios = require('axios').default
const fs = require('fs')
const util = require('util')
const path = require('path')

const version = 'v1.0.4'

const links = {
  darwin: util.format('https://github.com/mellow-io/mellow-core/releases/download/%s/core-darwin-10.6-amd64', version),
  linux: util.format('https://github.com/mellow-io/mellow-core/releases/download/%s/core-linux-amd64', version),
  win32: util.format('https://github.com/mellow-io/mellow-core/releases/download/%s/core-windows-4.0-amd64.exe', version)
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

if (process.argv.length > 2 && process.argv[2] == '--all') {
      download(links.darwin, dsts.darwin)
      download(links.linux, dsts.linux)
      download(links.win32, dsts.win32)
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
