# 枕边 · 手机访问临时服务器
$ErrorActionPreference = "Stop"
$Port = 4173
$AppRoot = Split-Path $PSScriptRoot -Parent
$PrivatePattern = '^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.)'

function Get-LanAddress {
  try {
    $configs = Get-NetIPConfiguration | Where-Object {
      $_.IPv4DefaultGateway -and $_.NetAdapter.Status -eq "Up"
    }
    foreach ($config in $configs) {
      $address = $config.IPv4Address | Where-Object {
        $_.IPAddress -match $PrivatePattern
      } | Select-Object -First 1
      if ($address) { return $address.IPAddress }
    }
  } catch {
    # 某些系统不允许读取网络配置时，使用 ipconfig 兜底
  }

  $text = (ipconfig 2>$null) -join "`n"
  $matches = [regex]::Matches(
    $text,
    'IPv4[^:：]*[:：]\s*([0-9]{1,3}(?:\.[0-9]{1,3}){3})'
  )
  $candidates = @()
  foreach ($match in $matches) {
    $ip = $match.Groups[1].Value
    if ($ip -match $PrivatePattern) { $candidates += $ip }
  }
  if ($candidates.Count -gt 0) {
    return $candidates |
      Sort-Object {
        if ($_.StartsWith("192.168.")) { 0 }
        elseif ($_.StartsWith("10.")) { 1 }
        else { 2 }
      } |
      Select-Object -First 1
  }

  try {
    $fallback = [System.Net.Dns]::GetHostAddresses(
      [System.Net.Dns]::GetHostName()
    ) | Where-Object {
      $_.AddressFamily -eq "InterNetwork" -and
      $_.IPAddressToString -notlike "127.*"
    } | Select-Object -First 1
    if ($fallback) { return $fallback.IPAddressToString }
  } catch {
    # ignore
  }

  return "127.0.0.1"
}

function Find-Python {
  $bundled = "C:\Users\31090\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe"
  if (Test-Path -LiteralPath $bundled) {
    return @{ Exe = $bundled; Args = @() }
  }

  $python = Get-Command python.exe -ErrorAction SilentlyContinue
  if ($python) {
    return @{ Exe = $python.Source; Args = @() }
  }

  $py = Get-Command py.exe -ErrorAction SilentlyContinue
  if ($py) {
    return @{ Exe = $py.Source; Args = @("-3") }
  }

  return $null
}

$Host.UI.RawUI.WindowTitle = "枕边 - 手机访问服务器"
$lan = Get-LanAddress
$python = Find-Python

Write-Host ""
Write-Host "  枕边 · 手机访问" -ForegroundColor Yellow
Write-Host "  ----------------------------------------"
Write-Host "  1. 手机和电脑连接同一个 Wi-Fi"
Write-Host "  2. 手机浏览器打开："
Write-Host ""
Write-Host ("       http://{0}:{1}/" -f $lan, $Port) -ForegroundColor Cyan
Write-Host ""
Write-Host "  首次运行如出现 Windows 防火墙提示，"
Write-Host "  请勾选“专用网络”并允许访问。"
Write-Host ""
Write-Host "  手机访问期间，电脑需要保持开机。"
Write-Host "  按 Ctrl+C 停止服务器。"
Write-Host "  ----------------------------------------"
Write-Host ""

if (-not $python) {
  Write-Host "  未找到可用的 Python，无法启动临时服务器。" -ForegroundColor Red
  Write-Host "  可以改用 HTTPS 静态托管（见 README.md）。"
  Write-Host ""
  Read-Host "按 Enter 退出"
  exit 1
}

try {
  Push-Location $AppRoot
  & $python.Exe @($python.Args + @(
    "-m", "http.server", "$Port",
    "--bind", "0.0.0.0",
    "--directory", "."
  ))
} finally {
  Pop-Location
  Write-Host ""
  Write-Host "服务器已停止。"
  Read-Host "按 Enter 退出"
}
