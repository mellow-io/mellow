#!/bin/sh

VERSION=v1.0.0

curl -o src/helper/darwin/core -L "https://github.com/mellow-io/mellow-core/releases/download/$VERSION/core-darwin"
curl -o src/helper/linux/core -L "https://github.com/mellow-io/mellow-core/releases/download/$VERSION/core-linux"
curl -o src/helper/win32/core.exe -L "https://github.com/mellow-io/mellow-core/releases/download/$VERSION/core-win32.exe"
