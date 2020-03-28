const convert = require('@mellow/config/convert')

const existingInbounds = [
  {
    "port": 1086,
    "protocol": "socks",
    "listen": "127.0.0.1",
    "settings": {
      "auth": "noauth",
      "udp": false
    }
  },
  {
    "port": 1088,
    "protocol": "http",
    "listen": "127.0.0.1",
    "settings": {}
  }
]

const newInbounds = [
  {
    "port": 1086,
    "protocol": "socks",
    "listen": "127.0.0.1",
    "settings": {
      "auth": "noauth",
      "udp": false
    }
  },
  {
    "port": 1087,
    "protocol": "http",
    "listen": "127.0.0.1",
    "settings": {}
  }
]

const expectedInbounds = [
  {
    "port": 1088,
    "protocol": "http",
    "listen": "127.0.0.1",
    "settings": {}
  },
  {
    "port": 1086,
    "protocol": "socks",
    "listen": "127.0.0.1",
    "settings": {
      "auth": "noauth",
      "udp": false
    }
  },
  {
    "port": 1087,
    "protocol": "http",
    "listen": "127.0.0.1",
    "settings": {}
  }
]

describe('Append inbounds', () => {
  test('Removing comments', () => {
    const commentedJsonString = `{
      "inbounds": [{
        // comment
        "port": 1087,
        # comment
        "protocol": "http",
        "listen": "127.0.0.1", # inline comment
        "settings": {} \/\/ inline comment
      }]
    }`
    const jsonString = convert.removeJsonComments(commentedJsonString)
    const expectedJson = {
      inbounds: [{
        "port": 1087,
        "protocol": "http",
        "listen": "127.0.0.1",
        "settings": {}
      }]
    }
    expect(JSON.parse(jsonString)).toEqual(expectedJson)
  })

  test('Merging inbounds', () => {
    const config = {
      inbounds: existingInbounds
    }
    const newConfig = convert.appendInbounds(config, newInbounds)
    expect(newConfig.inbounds).toEqual(expectedInbounds)
  })
})
