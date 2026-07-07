$ErrorActionPreference = "Stop"

$ports = @(3000, 3001)

foreach ($profile in Get-NetConnectionProfile) {
  if ($profile.IPv4Connectivity -ne "NoTraffic" -and $profile.NetworkCategory -eq "Public") {
    try {
      Set-NetConnectionProfile -InterfaceIndex $profile.InterfaceIndex -NetworkCategory Private
      Write-Host "Set $($profile.InterfaceAlias) network profile to Private"
    } catch {
      Write-Warning "Could not set $($profile.InterfaceAlias) to Private: $($_.Exception.Message)"
    }
  }
}

foreach ($port in $ports) {
  $name = "Goalix Dev TCP $port"
  Get-NetFirewallRule -DisplayName $name -ErrorAction SilentlyContinue | Remove-NetFirewallRule
  New-NetFirewallRule `
    -DisplayName $name `
    -Direction Inbound `
    -Action Allow `
    -Protocol TCP `
    -LocalPort $port `
    -Profile Any | Out-Null
  Write-Host "Allowed inbound TCP $port"
}

Write-Host ""
Write-Host "Goalix LAN access is enabled."
Write-Host "Open from your phone: http://192.168.1.12:3001"
