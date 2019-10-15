# Mellow
Mellow 是一个可以基于规则进行全局透明代理的 V2Ray 客户端，支持 Windows、macOS 和 Linux。

## 下载

https://github.com/eycorsican/Mellow/releases

## 特性
Mellow 可对所有应用、所有请求进行透明代理，不需要为每个应用或程序单独设置代理，它所支持的特性可以概括为：

|     | [Mellow](https://github.com/eycorsican/Mellow) | [Surge Mac](https://nssurge.com/) | [SSTap](https://www.sockscap64.com/sstap-enjoy-gaming-enjoy-sstap/) | [Proxifier](https://www.proxifier.com/) | [Outline](https://getoutline.org/) |
|:---:|:------:|:---------:|:-----:|:---------:|:-------:|
| Windows 支持 | ✅ | | ✅ | ✅ | ✅ |
| macOS 支持 | ✅ | ✅ | | ✅ | ✅ |
| Linux 支持 | ✅ | | | | ✅ |
| 透明代理 | ✅ | ✅ | ✅ | ✅ | ✅ |
| TCP 代理 | ✅ | ✅ | ✅ | ✅ | ✅ |
| UDP 代理 | ✅ | ✅ | ✅ | | ✅ |
| IP 规则 | ✅ | ✅ | ✅ | ✅ |
| 域名规则 | ✅ | ✅ | | ✅ |
| 应用进程规则 | ✅ | ✅ | | ✅ |
| 端口规则 | ✅ | ✅ | | ✅ |
| MitM | | ✅ | | |
| URL Rewrite | | ✅ | | |
| 多个代理出口 | ✅ | ✅ | | ✅ |
| 负载均衡 | ✅ | ✅ | | |
| DNS 分流 | ✅ | ✅ | | |
| SOCKS | ✅ | ✅ | ✅ | ✅ |
| HTTP | ✅ | ✅ | | ✅ | |
| Shadowsocks | ✅ | ✅ | ✅ | | ✅ |
| VMess | ✅ | | | |
| WebSocket, mKCP, QUIC, HTTP/2 传输| ✅ | | | |

其它 V2Ray 所支持的功能也都是支持的，上面并没有全部列出。

## 配置

### 全局代理

```ini
[Endpoint]
MyProxyServer, ss, ss://aes-128-gcm:pass@192.168.100.1:8888
```

### 更多配置

```ini
[Endpoint]
; tag, parser, parser-specific params...
Direct, builtin, freedom, domainStrategy=UseIP
Reject, builtin, blackhole
Dns-Out, builtin, dns
Http-Out, builtin, http, address=192.168.100.1, port=1087, user=myuser, pass=mypass
Proxy-1, vmess1, vmess1://75da2e14-4d08-480b-b3cb-0079a0c51275@example.com:443/v2?network=ws&tls=true
Proxy-2, vmess1, vmess1://75da2e14-4d08-480b-b3cb-0079a0c51275@example.com:10025?network=tcp
Proxy-3, ss, ss://aes-128-gcm:pass@192.168.100.1:8888
Proxy-4, vmess1, vmess1://75da2e14-4d08-480b-b3cb-0079a0c51275@example.com:443/h2?network=http&http.host=example.com%2Cexample1.com&tls=true&tls.allowinsecure=true

[EndpointGroup]
; tag, colon-seperated list of selectors or endpoint tags, strategy, strategy-specific params...
MyGroup, Proxy-1:Proxy-2:Proxy-3, latency, interval=300, timeout=6

[Routing]
domainStrategy = IPIfNonMatch

[RoutingRule]
; type, filter, endpoint tag or enpoint group tag
DOMAIN-KEYWORD, geosite:category-ads-all, Reject
IP-CIDR, 223.5.5.5/32, Direct
IP-CIDR, 8.8.8.8/32, MyGroup
IP-CIDR, 8.8.4.4/32, MyGroup
PROCESS-NAME, cloudmusic.exe, Direct
PROCESS-NAME, NeteaseMusic, Direct
GEOIP, cn, Direct
GEOIP, private, Direct
PORT, 123, Direct
DOMAIN-KEYWORD, geosite:cn, Direct
DOMAIN, www.google.com, MyGroup
DOMAIN-FULL, www.google.com, MyGroup
DOMAIN-SUFFIX, google.com, MyGroup
FINAL, MyGroup

[Dns]
; hijack = dns endpoint tag
hijack = Dns-Out
clientIp = 114.114.114.114

[DnsServer]
; address, port, tag
localhost
223.5.5.5
8.8.8.8, 53, Remote
8.8.4.4

[DnsRule]
; type, filter, dns server tag
DOMAIN-KEYWORD, geosite:geolocation-!cn, Remote
DOMAIN-SUFFIX, google.com, Remote

[DnsHost]
; domain = ip
doubleclick.net = 127.0.0.1

[Log]
loglevel = warning
```

## 开发运行和构建

建议在 macOS 或者 Linux 上进行开发或构建，如果想在 Windows 上开发，那可能需要手动下载一下依赖数据（因为是用 curl 来下载）。

```sh
# 下载依赖数据
yarn dlgeo

# 开发运行
yarn start

# 构建 macOS 安装文件
yarn && yarn distmac

# 构建 Windows 安装文件
yarn && yarn distwin

# 构建 Linux 安装文件
yarn && yarn distlinux
```

## 一些说明

### 要不要使用 Mellow？
Mellow 是一个透明代理客户端，如果不理解，那说得实际点，就是不仅可以代理浏览器的请求，还可以代理微信、QQ、Telegram 客户端、Instagram 客户端、网易云音乐、各种命令行工具、Docker 容器、虚拟机、WSL、各种 IDE、各种游戏等等的网络请求，不需要任何额外的代理设置。

所以也很清楚的是，如果仅需要代理浏览器的请求，或者也不嫌麻烦为个别程序单独设置代理的话，是没必要使用 Mellow 的。

### 关于配置和启动
支持两种配置文件格式，一个是类 ini 的 conf 格式，另一个是 V2Ray JSON 格式，两种格式的配置可以同时存在。

可以在 Tray 菜单 Config Template 中创建对应的配置模板，创建后就是一个纯文本文件，自行打开目录去编辑完善配置，编辑好后保存，即可启动代理，待图标变色后，就表示代理已经启动。

macOS 客户端在初次和每次升级后启动时，都可能会弹框请求管理权限。

Windows 客户端在每次启动时都会弹框请求管理权限，如果不希望看到弹框，可以改变 UAC（用户帐户控制设置） 的通知等级。

如果启动代理后有任何问题，比如弹出错误，比如无法连接，要反馈的话，请附上必要的截图（错误弹框等）、配置和日志。

任何配置改动都需要重连生效。

### 关于 DNS
因为系统 DNS 很不好控制，推荐 Freedom Outbound 使用 UseIP 策略，再配置好内建 DNS 服务器，这样可以避免一些奇怪问题，也增加 DNS 缓存的利用效率。

macOS 和 Linux 用户可能需要检查下系统 DNS 配置，勿用路由器网关地址或私有地址作 DNS，因为那样流量就不会被路由到 TUN 接口，从而完全摆脱了 Mellow 控制，然后会导致一些 DNS 解析异常以及导致 DNS 分流完全失效。

DNS 的处理方面基本上和 [这篇文章](https://medium.com/@TachyonDevel/%E6%BC%AB%E8%B0%88%E5%90%84%E7%A7%8D%E9%BB%91%E7%A7%91%E6%8A%80%E5%BC%8F-dns-%E6%8A%80%E6%9C%AF%E5%9C%A8%E4%BB%A3%E7%90%86%E7%8E%AF%E5%A2%83%E4%B8%AD%E7%9A%84%E5%BA%94%E7%94%A8-62c50e58cbd0) 中介绍的没什么出入，默认使用 Sniffing 来处理 DNS 染污，建议再配置一下 DNS 分流，就是 conf 配置中的 DNS Hijack + DNS Outbound（Endpoint） + DNS Server + DNS Rule。

### 关于 NAT 类型
使用 SOCKS 或 Shadowsocks 协议的话支持 Full Cone NAT，注意服务器也要是支持 Full Cone NAT 的，如果要代理游戏，服务端可以考虑用 shadowsocks-libev、go-shadowsocks2 等。

### 关于 JSON 配置的 Inbound
JSON 配置文件中不需要有 Inbound，但也可以自行配置 Inbound 作其它用途，例如可以像其它非透明代理客户端一样，配置文件中写上 SOCKS/HTTP Inbound，再手动配置到系统或浏览器的代理设置中，那样浏览器的请求就会从 SOCKS/HTTP Inbound 过来，而不经过 TUN 接口。注意目前所有类型 Inbound 的 UDP 都不能用，因为我没见过哪个操作系统或浏览器真正地使用 SOCKS 的 UDP，所以也不会去修复它。

### 关于日志
日志有两份，一份是 Mellow 的日志，一份是 V2Ray 的日志，V2Ray 日志如果输出到 stdout/stderr，那 V2Ray 的日志会被打印到 Mellow 的日志里。

另打开 Sessions 页面可看到所有请求的详细信息，注意这个页面不会自动刷新。

### 关于 GUI
目前没有任何计划做成 UI 配置的方式。

## FAQ

### 为什么在 Sessions 中有些请求显示进程名称为 `unknown process`？

1. 某些 UDP 会话如果持续时间过短，则会无法获取其发送进程。
2. 在 Windows 上，会看到较多的 `unknown process`，这是因为 Mellow 没有权限访问系统进程的信息，特别是 DNS 请求，因为发送 DNS 请求的通常是一个名为 svchost.exe 的系统进程。

### 可以在 Linux 上以命令行方式运行吗？

可以的，只需要把 [这](https://github.com/eycorsican/Mellow/blob/master/src/helper/linux/core) [四](https://github.com/v2ray/domain-list-community/releases/latest/download/dlc.dat) [个](http://geolite.maxmind.com/download/geoip/database/GeoLite2-Country.tar.gz) [文件](https://github.com/eycorsican/Mellow/blob/master/scripts/run_linux.sh) 下载到同一个目录，把 `dlc.dat` 改名为 `geosite.dat`，把 `GeoLite2-Country.tar.gz` 解压后改名为 `geo.mmdb`，再自行创建一个叫 `cfg.json` 的 V2Ray 配置文件，然后运行 `run_linux.sh` 脚本（需要 root 权限）。

### 可以用作网关吗？

在 macOS 上，开启 Mellow 后，再开启 IP Forwarding 就行：

```sh
sudo sysctl -w net.inet.ip.forwarding=1
```

同样在 Linux 上，开启 IP Forwarding：

```sh
sudo sysctl -w net.ipv4.ip_forward=1
```

注意这种网关形式上有别于一般的路由器透明代理设置，这里的 “网关” 是局域网里另一台普通的局域网设备，它本身需要路由器作网关。

### 怎么把 conf 配置转换成 JSON 配置？

把 conf 配置运行起来，然后打开 Running Config 就是了，其实配置最终都是转成 JSON 再运行的。

不依赖 UI 的话可以用这条命令来转换：

```sh
cat config.conf | node src/config/convert.js > config.json
```

## JSON 配置的扩展功能说明

### 自动选择最优线路
就是 conf 配置中的 Endpoint Group 使用 latency 作策略，可根据代理请求的 RTT，自动选择负载均衡组中最优线路来转发请求。

```json
"routing": {
    "balancers": [
        {
            "tag": "server_lb",
            "selector": [
                "server_1",
                "server_2"
            ],
            "strategy": "latency",
            "totalMeasures": 2,
            "interval": 300,
            "delay": 1,
            "timeout": 6,
            "tolerance": 300,
            "probeTarget": "tls:www.google.com:443",
            "probeContent": "HEAD / HTTP/1.1\r\n\r\n"
        }
    ]
}
```

### 应用进程规则
就是 conf 配置中的 PROCESS-NAME 规则，支持 `*` 和 `?` 通配符匹配，匹配内容为进程名称，包括所有直接或非直接的父进程。

在 Windows 上，进程名称通常为 `xxx.exe`，例如 `chrome.exe`，在 Mellow 的 `Sessions` 中可方便查看。

在 macOS 上也可以通过 Mellow 的 `Sessions` 查看，也可以通过 `ps` 命令查看进程。

```json
"routing": {
    "rules": [
        {
            "app": [
                "git*",
                "chrome.exe"
            ],
            "type": "field",
            "outboundTag": "proxy"
        }
    ]
}
```
