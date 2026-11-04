$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$taskNode = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $taskNode) { $taskNode = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node.exe' }
if (-not (Test-Path -LiteralPath $taskNode)) { throw '没有找到 Node.js，请先安装 Node.js 22 或更新版本。' }
$taskPort = Get-NetTCPConnection -LocalPort 9229 -State Listen -ErrorAction SilentlyContinue
if ($taskPort -and ($taskPort | Where-Object LocalAddress -NotIn @('127.0.0.1','::1'))) { throw '豆包调试连接不是仅本机地址，已停止。' }
if (-not $taskPort) {
 if (Get-Process -Name Doubao -ErrorAction SilentlyContinue) { throw '请先保存豆包草稿，并从托盘完整退出一次，再打开这个启动文件。不会强制关闭豆包。' }
 $taskDoubaoExe = 'D:\software\Doubao\Application\app\Doubao.exe'
 if (-not (Test-Path -LiteralPath $taskDoubaoExe)) { throw '豆包安装路径已变化，请更新 desktop/start.ps1 中的路径。' }
 Start-Process -FilePath $taskDoubaoExe -ArgumentList '--remote-debugging-port=9229','--remote-debugging-address=127.0.0.1','--no-first-run' -WindowStyle Normal
}
$taskRuntime = Join-Path $taskRoot '.sites-runtime\desktop-bridge'
New-Item -ItemType Directory -Path $taskRuntime -Force | Out-Null
if (-not (Get-NetTCPConnection -LocalPort 9231 -State Listen -ErrorAction SilentlyContinue)) {
 $taskBridge = Join-Path $PSScriptRoot 'bridge.mjs'
 Start-Process -FilePath $taskNode -ArgumentList ('"' + $taskBridge + '"') -WorkingDirectory $taskRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $taskRuntime 'bridge.log') -RedirectStandardError (Join-Path $taskRuntime 'bridge-error.log')
}
Write-Output '连接已启动。回到 AI创作台，点击“连接豆包桌面”。'
