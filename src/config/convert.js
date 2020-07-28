const util = require('util')
const log = require('electron-log')
const base64url = require('base64url')


const readSubConfigBySection = (config, sect) => {
  var subConfigNames = []
  var currSect = ''
  config.match(/[^\r\n]+/g).forEach((line) => {
    line = removeLineComments(line)
    const s = getSection(line)
    if (s.length != 0) {
      currSect = s
      return // next
    }
    if (equalSection(currSect, sect)) {
      line = line.trim()
      if (line.includes('INCLUDE')) {
        const parts = line.split(',')
        subConfigNames.push(parts[1].trim())
      }
    }
  })
  return subConfigNames
}

const sectionAlias = [
  ['RoutingRule', 'Rule'],
]

const getSection = (line) => {
  const re = /^\s*\[\s*([^\]]*)\s*\]\s*$/
  if (re.test(line)) {
    return line.match(re)[1]
  } else {
    return ""
  }
}

const equalSection = (s1, s2) => {
  s1 = s1.trim()
  s2 = s2.trim()
  for (var i = 0; i < sectionAlias.length; i++) {
    if (sectionAlias[i].includes(s1) && sectionAlias[i].includes(s2)) {
      return true
    }
  }
  return (s1 == s2)
}

const removeLineComments = (s) => {
  return s.replace(/;[^*]*/g, '')
}

const removeJsonLineComments = (s) => {
  s = s.replace(/#[^*]*/g, '')
  s = s.replace(/\/\/[^*]*/g, '')
  return s
}

const removeJsonComments = (s) => {
  let lines = []
  s.match(/[^\r\n]+/g).forEach((line) => {
    lines.push(removeJsonLineComments(line))
  })
  return lines.join('\n')
}

const getLinesBySection = (conf, sect) => {
  var lines = []
  var currSect = ''
  conf.match(/[^\r\n]+/g).forEach((line) => {
    line = removeLineComments(line)
    const s = getSection(line)
    if (s.length != 0) {
      currSect = s
      return // next
    }
    if (equalSection(currSect, sect)) {
      line = line.trim()
      if (line.length != 0) {
        lines.push(line)
      }
    }
  })
  return lines
}

const equalRuleType = (t1, t2) => {
  if (t1.includes('DOMAIN') && t2.includes('DOMAIN')) {
    return true
  }
  if (t1.includes('IP') && t2.includes('IP')) {
    return true
  }
  if (t1 == t2) {
    return true
  }
  return false
}

const ruleName = (type) => {
  if (type.includes('DOMAIN')) {
    return 'domain'
  } else if (type.includes('IP')) {
    return 'ip'
  } else if (type.includes('PROCESS')) {
    return 'app'
  } else if (type.includes('PORT')) {
    return 'port'
  } else if (type.includes('NETWORK')) {
    return 'network'
  } else {
    return new Error('invalid rule type')
  }
}

const nonListType = (type) => {
  if (type.includes('PORT') || type.includes('NETWORK') || type.includes('FINAL')) {
    return true
  }
  return false
}

const ruleFilter = (type, filters) => {
  if (nonListType(type)) {
    if (filters.length > 1) {
      return new Error('more that 1 filter in non-list type rule')
    }
    return filters[0]
  } else {
    return filters
  }
}

const isBalancerTag = (tag, balancers) => {
  for (var i = 0; i < balancers.length; i++) {
    if (balancers[i].tag == tag) {
      return true
    }
  }
  return false
}

const constructRoutingRules = (rule, routing, subconfig, overrideTarget=undefined) => {
  var lastType = ''
  var lastTarget = ''
  var filters = []
  var routingRules = []
  rule.forEach((line) => {
    const parts = line.trim().split(',')
    if (parts.length < 2) {
      return // next
    }
    const type = parts[0].trim()
    // override target
    const target = overrideTarget ? overrideTarget : parts[parts.length-1].trim()
    if (filters.length > 0 && (nonListType(type) || !equalRuleType(type, lastType) || target !== lastTarget)) {
      var r = {
        type: 'field',
      }
      if (isBalancerTag(lastTarget, routing.balancers)) {
        r['balancerTag'] = lastTarget
      } else {
        r['outboundTag'] = lastTarget
      }
      r[ruleName(lastType)] = ruleFilter(lastType, filters)
      routingRules.push(r)
      
      lastType = ''
      lastTarget = ''
      filters = []
    }

    if (type === 'INCLUDE') {
      if (parts.length <= 3) {
        const content = subconfig['RoutingRule'][parts[1].trim()]
        const routingRule = getLinesBySection(content, 'RoutingRule')
        const subRules = constructRoutingRules(routingRule, routing, subconfig, parts.length === 3 ? parts[2].trim() : undefined)
        routingRules = routingRules.concat(subRules)
      } else {
        return // next
      }
    }

    if (type !== 'FINAL') {
      if (parts.length != 3 && !overrideTarget) {
        return // next
      }
    } else {
      if (parts.length != 2) {
        return // next
      }
    }

    lastType = type
    lastTarget = target
    var filter = parts[1].trim()
    switch (type) {
      case 'DOMAIN-KEYWORD':
        filters.push(filter)
        break
      case 'DOMAIN-SUFFIX':
        filters.push(util.format('domain:%s', filter))
        break
      case 'DOMAIN':
      case 'DOMAIN-FULL':
        filters.push(util.format('full:%s', filter))
        break
      case 'IP-CIDR':
        filters.push(filter)
        break
      case 'GEOIP':
        filters.push(util.format('geoip:%s', filter))
        break
      case 'PORT':
        filters.push(filter)
        break
      case 'PROCESS-NAME':
        filters.push(filter)
        break
      case 'NETWORK':
        filters.push(filter.split(':').join(','))
        break
      case 'FINAL':
        if (routing.domainStrategy == 'IPIfNonMatch' || routing.domainStrategy == 'IPOnDemand') {
          filters.push('0.0.0.0/0')
          filters.push('::/0')
          lastType = 'IP-CIDR'
        } else {
          filters.push('tcp,udp')
          lastType = 'NETWORK'
        }
        break
    }
  })
  if (filters.length > 0) {
    var r = {
      type: 'field',
    }
    if (isBalancerTag(lastTarget, routing.balancers)) {
      r['balancerTag'] = lastTarget
    } else {
      r['outboundTag'] = lastTarget
    }
    r[ruleName(lastType)] = ruleFilter(lastType, filters)
    routingRules.push(r)
  }
  return routingRules
}

const constructRouting = (routingConf, strategy, balancer, rule, dns, subconfig) => {
  var routing = { balancers: [], rules: [] }

  routingConf.forEach((line) => {
    const parts = line.trim().split('=')
    if (parts.length != 2) {
      return // next
    }
    const k = parts[0].trim()
    const v = parts[1].trim()
    switch (k) {
      case 'domainStrategy':
        if (v.length > 0) {
          routing.domainStrategy = v
        }
        break
    }
  })

  // Deprecated
  strategy.forEach((line) => {
    line = line.trim()
    if (line.length != 0) {
      routing.domainStrategy = line
    }
  })

  balancer.forEach((line) => {
    const parts = line.trim().split(',')
    if (parts.length < 2) {
      return // next
    }
    const tag = parts[0].trim()
    const selectors = parts[1].trim().split(':').map(x => x.trim())
    var bnc = {
      tag: tag,
      selector: selectors
    }
    if (parts.length > 2) {
      bnc.strategy = parts[2].trim()
    }
    switch (bnc.strategy) {
      case 'latency':
        const params = parts.slice(3, parts.length)
        params.forEach((p) => {
          const ps = p.trim().split('=')
          if (ps.length != 2) {
            return // next
          }
          key = ps[0].trim()
          val = ps[1].trim()
          switch (key) {
            case 'timeout':
            case 'interval':
            case 'delay':
            case 'tolerance':
            case 'totalMeasures':
              bnc[key] = parseInt(val)
              break
            default:
              bnc[key] = val
          }
        })
        break
    }
    routing.balancers.push(bnc)
  })

  routing.rules = constructRoutingRules(rule, routing, subconfig)
  
  dns.forEach((line) => {
    const parts = line.trim().split('=')
    if (parts.length != 2) {
      return // next
    }
    const k = parts[0].trim()
    const v = parts[1].trim()
    if (k == 'hijack' && v.length > 0) {
      routing.rules.unshift({
        type: 'field',
        outboundTag: v,
        inboundTag: ['tun2socks'],
        network: 'udp',
        port: 53
      })
    }
  })

  if (routing.balancers.length == 0) {
    delete routing.balancers
  }
  if (routing.rules.length == 0) {
    delete routing.rules
  }
  return routing
}

const constructDns = (dnsConf, server, rule, host, clientIp) => {
  var dns = { servers: [] }

  dnsConf.forEach((line) => {
    const parts = line.trim().split('=')
    if (parts.length != 2) {
      return // next
    }
    const k = parts[0].trim()
    const v = parts[1].trim()
    if (k == 'clientIp' && v.length > 0) {
      dns.clientIp = v
    }
  })

  // Deprecated
  if (clientIp.length == 1) {
    const ip = clientIp[0].trim()
    if (ip.length > 0) {
      dns.clientIp = ip
    }
  }

  host.forEach((line) => {
    const parts = line.trim().split('=')
    if (parts.length != 2) {
      return // next
    }
    const domain = parts[0].trim()
    const ip = parts[1].trim()
    if (domain.length == 0 || ip.length == 0) {
      return // next
    }
    if (!dns.hasOwnProperty('hosts')) {
      dns.hosts = {}
    }
    dns.hosts[domain] = ip
  })

  var servers = []
  var rules = []

  rule.forEach((line) => {
    const parts = line.trim().split(',')
    if (parts.length != 3) {
      return // next
    }
    const type = parts[0].trim()
    var filter = parts[1].trim()
    const tag = parts[2].trim()
    switch (type) {
      case 'DOMAIN-SUFFIX':
        filter = util.format('domain:%s', filter)
        break
      case 'DOMAIN':
      case 'DOMAIN-FULL':
        filter = util.format('full:%s', filter)
        break
    }
    rules.push({
      filter: filter,
      tag: tag
    })
  })

  server.forEach((line) => {
    const parts = line.trim().split(',')
    if (parts.length == 1) {
      if (process.platform == 'win32' && parts[0].trim() == 'localhost') {
        const sysDnsServers = require('dns').getServers()
        sysDnsServers.forEach((sysDns) => {
          servers.push({
            address: sysDns
          })
        })
      } else {
        servers.push({
          address: parts[0].trim()
        })
      }
    } else if (parts.length == 3) {
      var filters = []
      rules.forEach((r) => {
        if (r.tag == parts[2].trim()) {
          filters.push(r.filter)
        }
      })
      servers.push({
        address: parts[0].trim(),
        port: parseInt(parts[1].trim()),
        filters: filters
      })
    }
  })

  servers.forEach((s) => {
    if (s.hasOwnProperty('port') && s.hasOwnProperty('filters')) {
      dns.servers.push({
        address: s.address,
        port: parseInt(s.port),
        domains: s.filters
      })
    } else {
      dns.servers.push(s.address)
    }
  })
  if (dns.servers.length == 0) {
    delete dns.servers
  }
  return dns
}

const constructLog = (logLines) => {
  var log = {}
  logLines.forEach((line) => {
    const parts = line.trim().split('=')
    if (parts.length != 2) {
      return // next
    }
    switch (parts[0].trim()) {
      case 'loglevel':
        log.loglevel = parts[1].trim()
    }
  })
  return log
}

const freedomOutboundParser = (tag, params) => {
  var ob = {
    "protocol": "freedom",
    "tag": tag
  }
  let settings = {}
  params.forEach((param) => {
    const kv = param.trim().split('=')
    if (kv.length != 2) {
      return
    }
    switch (kv[0].trim()) {
      case 'domainStrategy':
        settings.domainStrategy = kv[1].trim()
        break
    }
  })
  if (Object.keys(settings).length != 0) {
    ob.settings = settings
  }
  return ob
}

const blackholeOutboundParser = (tag, params) => {
  let ob = {
    "protocol": "blackhole",
    "tag": tag
  }
  let settings = {}
  params.forEach((param) => {
    const kv = param.trim().split('=')
    if (kv.length != 2) {
      return
    }
    switch (kv[0].trim()) {
      case 'type':
        settings.response = { type: kv[1].trim() }
        break
    }
  })
  if (Object.keys(settings).length != 0) {
    ob.settings = settings
  }
  return ob
}

const httpAndSocksOutboundParser = (protocol, tag, params) => {
  var ob = {
    "protocol": protocol,
    "tag": tag
  }
  var address = ''
  var port = 0
  var user = ''
  var pass = ''
  params.forEach((param) => {
    const parts = param.trim().split('=')
    if (parts.length != 2) {
      return
    }
    switch (parts[0].trim()) {
      case 'address':
        address = parts[1].trim()
        break
      case 'port':
        port = parseInt(parts[1].trim())
        break
      case 'user':
        user = parts[1].trim()
        break
      case 'pass':
        pass = parts[1].trim()
        break
    }
  })
  if (!ob.hasOwnProperty('settings')) {
    ob.settings = {
      servers: []
    }
  }
  var server = {
    address: address,
    port: port,
    users: []
  }
  if (user.length > 0 && pass.length > 0) {
    server.users.push({
      user: user,
      pass: pass
    })
  }
  if (server.users.length == 0) {
    delete server.users
  }
  ob.settings.servers.push(server)
  return ob
}

const dnsOutboundParser = (tag, params) => {
  let ob = {
    "protocol": "dns",
    "tag": tag,
    "settings": {}
  }
  let settings = {}
  params.forEach((param) => {
    const kv = param.trim().split('=')
    if (kv.length != 2) {
      return
    }
    switch (kv[0].trim()) {
      case 'network':
        ob.settings.network = kv[1].trim()
        break
      case 'address':
        ob.settings.address = kv[1].trim()
        break
      case 'port':
        ob.settings.port = parseInt(kv[1].trim())
        break
    }
  })
  if (Object.keys(settings).length != 0) {
    ob.settings = settings
  }
  return ob
}

const vmess1Parser = (tag, params) => {
  var ob = {
    "protocol": "vmess",
    "tag": tag,
    "settings": {
      "vnext": []
    },
    "streamSettings": {}
  }
  if (params.length > 1) {
    return new Error('invalid vmess1 parameters')
  }
  const url = new URL(params[0].trim())
  const uuid = url.username
  const address = url.hostname
  const port = url.port
  const path = url.pathname
  const query = decodeURIComponent(url.search.substr(1))
  const tlsSettings = {}
  const wsSettings = {}
  const httpSettings = {}
  const kcpSettings = {}
  const quicSettings = {}
  const mux = {}
  const sockopt = {}
  let header = null
  ob.settings.vnext.push({
    users: [{
      "id": uuid
    }],
    address: address,
    port: parseInt(port),
  })
  const parts = query.split('&')
  parts.forEach((q) => {
    const kv = q.split('=')
    switch (kv[0]) {
      case 'network':
        ob.streamSettings.network = kv[1]
        break
      case 'tls':
        if (kv[1] == 'true') {
          ob.streamSettings.security = 'tls'
        } else {
          ob.streamSettings.security = 'none'
        }
        break
      case 'tls.allowinsecure':
        if (kv[1] == 'true') {
          tlsSettings.allowInsecure = true
        } else {
          tlsSettings.allowInsecure = false
        }
        break
      case 'tls.servername':
        tlsSettings.serverName = kv[1]
        break
      case 'ws.host':
        let host = kv[1].trim()
        if (host.length != 0) {
          wsSettings.headers = { Host: host }
        }
        break
      case 'http.host':
        let hosts = []
        kv[1].trim().split(',').forEach((h) => {
          if (h.trim().length != 0) {
            hosts.push(h.trim())
          }
        })
        if (hosts.length != 0) {
          httpSettings.host = hosts
        }
        break
      case 'mux':
        var v = parseInt(kv[1].trim())
        if (v > 0) {
          mux.enabled = true
          mux.concurrency = v
        }
        break
      case 'sockopt.tos':
        var v = parseInt(kv[1].trim())
        if (v > 0) {
          sockopt.tos = v
        }
        break
      case 'sockopt.tcpfastopen':
        if (kv[1] == 'true') {
          sockopt.tcpFastOpen = true
        } else {
          sockopt.tcpFastOpen = false
        }
        break
      // header type for both kcp and quic (maybe tcp later, not planed)
      case 'header':
        header = kv[1]
        break
      case 'kcp.mtu':
        kcpSettings.mtu = parseInt(kv[1].trim())
        break
      case 'kcp.tti':
        kcpSettings.tti = parseInt(kv[1].trim())
        break
      case 'kcp.uplinkcapacity':
        kcpSettings.uplinkCapacity = parseInt(kv[1].trim())
        break
      case 'kcp.downlinkcapacity':
        kcpSettings.downlinkCapacity = parseInt(kv[1].trim())
        break
      case 'kcp.congestion':
        if (kv[1] == 'true') {
          kcpSettings.congestion = true
        } else {
          kcpSettings.congestion = false
        }
        break
      case 'quic.security':
        quicSettings.security = kv[1].trim()
        break
      case 'quic.key':
        quicSettings.key = kv[1]
        break
    }
  })
  if (Object.keys(tlsSettings).length != 0) {
    if (ob.streamSettings.security == 'tls') {
      ob.streamSettings.tlsSettings = tlsSettings
    }
  }
  if (Object.keys(sockopt).length != 0) {
    ob.streamSettings.sockopt = sockopt
  }
  switch (ob.streamSettings.network) {
    case 'ws':
      if (path.length != 0) {
        wsSettings.path = path
      }
      if (Object.keys(wsSettings).length != 0) {
        ob.streamSettings.wsSettings = wsSettings
      }
      break
    case 'http':
    case 'h2':
      if (path.length != 0) {
        httpSettings.path = path
      }
      if (Object.keys(httpSettings).length != 0) {
        ob.streamSettings.httpSettings = httpSettings
      }
      break
    case 'kcp':
    case 'mkcp':
      if (header) {
        kcpSettings.header = { type: header }
      }
      if (Object.keys(kcpSettings).length != 0) {
        ob.streamSettings.kcpSettings = kcpSettings
      }
      break
    case 'quic':
      if (header) {
        quicSettings.header = { type: header }
      }
      if (Object.keys(quicSettings).length != 0) {
        ob.streamSettings.quicSettings = quicSettings
      }
      break
  }
  if (Object.keys(mux).length != 0) {
    ob.mux = mux
  }
  return ob
}

const ssParser = (tag, params) => {
  var ob = {
    "protocol": "shadowsocks",
    "tag": tag,
    "settings": {
      "servers": []
    }
  }
  if (params.length > 1) {
    return new Error('invalid shadowsocks parameters')
  }
  const url = new URL(params[0].trim())
  const userInfo = url.username
  const address = url.hostname
  const port = url.port
  var method
  var password
  if (url.password.length == 0) {
    const parts = base64url.decode(decodeURIComponent(userInfo)).split(':')
    if (parts.length != 2) {
      return new Error('invalid user info')
    }
    method = parts[0]
    password = parts[1]
  } else {
    method = url.username
    password = url.password
  }
  ob.settings.servers.push({
    method: method,
    password: password,
    address: address,
    port: parseInt(port)
  })
  return ob
}

const builtinParser = (tag, params) => {
  switch (protocol = params[0].trim()) {
    case 'freedom':
      return freedomOutboundParser(tag, params.slice(1, params.length))
    case 'blackhole':
      return blackholeOutboundParser(tag, params.slice(1, params.length))
    case 'dns':
      return dnsOutboundParser(tag, params.slice(1, params.length))
    case 'http':
    case 'socks':
      return httpAndSocksOutboundParser(protocol, tag, params.slice(1, params.length))
  }
}

const parsers = {
  builtin: builtinParser,
  vmess1: vmess1Parser,
  ss: ssParser,
}

const constructOutbounds = (endpoint) => {
  var outbounds = []
  endpoint.forEach((line) => {
    const parts = line.trim().split(',')
    if (parts.length < 2) {
      return // next
    }
    const tag = parts[0].trim()
    const parser = parts[1].trim()
    const params = parts.slice(2, parts.length)
    const p = parsers[parser]
    if (p instanceof Function) {
      let outbound = p(tag, params)
      outbounds.push(outbound)
    } else {
      log.warn('parser not found: ', parser)
    }
  })
  return outbounds
}

const constructSystemInbounds = (opts) => {
  var inbounds = []
  if (opts && opts.enabled) {
    inbounds = [
      {
        "port": opts.socksPort,
        "protocol": "socks",
        "listen": "127.0.0.1",
        "settings": {
          "auth": "noauth",
          "udp": false
        }
      },
      {
        "port": opts.httpPort,
        "protocol": "http",
        "listen": "127.0.0.1",
        "settings": {}
      }
    ]
  }
  return inbounds
}

const appendInbounds = (config, inbounds) => {
  if (inbounds.length > 0) {
    if (config.inbounds) {
      const newPorts = inbounds.map(nib => nib.port)
      config.inbounds = config.inbounds.filter((ib) => {
        return !newPorts.includes(ib.port)
      })
      config.inbounds.push(...inbounds)
    } else {
      config['inbounds'] = inbounds
    }
  }
  return config
}

const constructJson = (conf, subConf) => {
  const routingDomainStrategy = getLinesBySection(conf, 'RoutingDomainStrategy')
  const routingConf = getLinesBySection(conf, 'Routing')
  const balancerRule = getLinesBySection(conf, 'EndpointGroup')
  const routingRule = getLinesBySection(conf, 'RoutingRule')
  const dnsConf = getLinesBySection(conf, 'Dns')
  const routing = constructRouting(routingConf, routingDomainStrategy, balancerRule, routingRule, dnsConf, subConf)

  const dnsServer = getLinesBySection(conf, 'DnsServer')
  const dnsRule = getLinesBySection(conf, 'DnsRule')
  const dnsHost = getLinesBySection(conf, 'DnsHost')
  const dnsClientIp = getLinesBySection(conf, 'DnsClientIp')
  const dns = constructDns(dnsConf, dnsServer, dnsRule, dnsHost, dnsClientIp)

  const logLines = getLinesBySection(conf, 'Log')
  const log = constructLog(logLines)

  const endpoint = getLinesBySection(conf, 'Endpoint')
  const outbounds = constructOutbounds(endpoint)

  var o = {
    log: log,
    dns: dns,
    outbounds: outbounds,
    routing: routing
  }

  for (var prop in o) {
    if (Object.entries(o[prop]).length === 0) {
      delete o[prop]
    }
  }

  return o
}

module.exports = {
  getLinesBySection,
  constructRouting,
  constructDns,
  constructLog,
  constructOutbounds,
  constructJson,
  constructSystemInbounds,
  appendInbounds,
  removeJsonComments,
  readSubConfigBySection
}

if (typeof require !== 'undefined' && require.main === module) {
  const readline = require('readline')
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
  })
  var lines = []
  rl.on('line', (line) => {
    lines.push(line)
  })
  rl.on('close', () => {
    console.log(JSON.stringify(constructJson(lines.join('\n')), null, 2))
  })
}
