const axios = require('axios').default
const path = require('path')
const os = require('os')
const fs = require('fs')
const targz = require('targz')

const geositeUrl = 'https://github.com/v2ray/domain-list-community/releases/latest/download/dlc.dat'
const mmdbUrl = 'https://web.archive.org/web/20191227182412/https://geolite.maxmind.com/download/geoip/database/GeoLite2-Country.tar.gz'

async function downloadGeosite() { 
  const dstPath = path.join(__dirname, '../src/helper', 'geosite.dat')
  const writer = fs.createWriteStream(dstPath)
  console.log('Downloading', geositeUrl)
  const resp = await axios({
    url: geositeUrl,
    method: 'GET',
    responseType: 'stream',
    onDownloadProgress: (e) => {
      console.log(e)
    }
  })
  resp.data.pipe(writer)
  writer.on('finish', () => {
    console.log('Saved file', dstPath)
  })
  writer.on('error', (err) => {
    console.log('Download geosite.dat failed.', err)
  })
}

function findInDir (dir, filter, fileList = []) {
  const files = fs.readdirSync(dir);

  files.forEach((file) => {
    const filePath = path.join(dir, file);
    const fileStat = fs.lstatSync(filePath);

    if (fileStat.isDirectory()) {
      findInDir(filePath, filter, fileList);
    } else if (filter.test(filePath)) {
      fileList.push(filePath);
    }
  });

  return fileList;
}

async function downloadGeommdb() {
  const tmpFolder = path.join(os.tmpdir(), 'mellow')
  if (!fs.existsSync(tmpFolder)) {
    fs.mkdirSync(tmpFolder)
  }
  const dlname = 'mmdb.tar.gz'
  const tarPath = path.join(tmpFolder, dlname)
  const writer = fs.createWriteStream(tarPath)
  console.log('Downloading', mmdbUrl) 
  const resp = await axios({
    url: mmdbUrl,
    method: 'GET',
    responseType: 'stream',
    onDownloadProgress: (e) => {
      console.log(e)
    }
  })
  resp.data.pipe(writer)
  writer.on('finish', () => {
    console.log('Saved file', tarPath)
    targz.decompress({
      src: tarPath,
      dest: tmpFolder
    }, (err) => {
      if (err) {
        console.log('Failed to extract mmdb.', err)
        process.exit(1)
      } else {
        const dstPath = path.join(__dirname, '../src/helper', 'geo.mmdb')
        const fileName = 'GeoLite2-Country.mmdb'
        const files = findInDir(tmpFolder, /\.mmdb/)
        if (files.length != 1) {
          console.log('mmdb file not found.')
          process.exit(1)
        }
        fs.renameSync(files[0], dstPath)
        console.log('Saved file', dstPath)
      }
    })

  })
  writer.on('error', (err) => {
    console.log('Download Geo mmdb failed.', err)
  })
}

downloadGeosite()
downloadGeommdb()
