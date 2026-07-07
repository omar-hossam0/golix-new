param(
  [string]$Branch = "master",
  [string]$Remote = "origin",
  [string]$ComposeFile = "docker-compose.prod.yml",
  [int]$PollSeconds = 60,
  [switch]$Once,
  [switch]$AllowDirty
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$stateDir = Join-Path $repoRoot ".deploy"
$logFile = Join-Path $stateDir "auto-docker-deploy.log"
$lockFile = Join-Path $stateDir "auto-docker-deploy.lock"

function Write-DeployLog {
  param([string]$Message)
  if (-not (Test-Path $stateDir)) {
    New-Item -ItemType Directory -Path $stateDir | Out-Null
  }
  $line = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Message
  Write-Host $line
  Add-Content -Path $logFile -Value $line
}

function Invoke-Checked {
  param(
    [string]$FilePath,
    [string[]]$Arguments
  )
  Write-DeployLog ("$FilePath {0}" -f ($Arguments -join " "))
  & $FilePath @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "$FilePath exited with code $LASTEXITCODE"
  }
}

function Get-GitValue {
  param([string[]]$Arguments)
  $value = & git @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "git $($Arguments -join ' ') exited with code $LASTEXITCODE"
  }
  return ($value | Select-Object -First 1).Trim()
}

function Assert-CleanWorktree {
  if ($AllowDirty) {
    return
  }
  $dirty = & git status --porcelain
  if ($LASTEXITCODE -ne 0) {
    throw "Could not read git status"
  }
  if ($dirty) {
    Write-DeployLog "Local changes found. Commit/stash them, or rerun with -AllowDirty if you accept the risk."
    $dirty | ForEach-Object { Write-DeployLog "  $_" }
    throw "Refusing to auto deploy with a dirty worktree"
  }
}

function Invoke-DockerDeploy {
  Push-Location $repoRoot
  try {
    if (Test-Path $lockFile) {
      $lockAge = (Get-Date) - (Get-Item $lockFile).LastWriteTime
      if ($lockAge.TotalMinutes -lt 30) {
        Write-DeployLog "Another deployment appears to be running. Skipping this cycle."
        return
      }
      Write-DeployLog "Removing stale deployment lock."
      Remove-Item -LiteralPath $lockFile -Force
    }

    New-Item -ItemType File -Path $lockFile -Force | Out-Null

    Invoke-Checked git @("fetch", "--prune", $Remote, $Branch)
    $localSha = Get-GitValue @("rev-parse", "HEAD")
    $remoteSha = Get-GitValue @("rev-parse", "$Remote/$Branch")

    if ($localSha -eq $remoteSha) {
      Write-DeployLog "No new commit on $Remote/$Branch. Current: $localSha"
      return
    }

    Write-DeployLog "New commit detected: $localSha -> $remoteSha"
    Assert-CleanWorktree

    Invoke-Checked git @("checkout", $Branch)
    Invoke-Checked git @("pull", "--ff-only", $Remote, $Branch)

    Invoke-Checked docker @("compose", "-f", $ComposeFile, "config")
    Invoke-Checked docker @("compose", "-f", $ComposeFile, "build")
    Invoke-Checked docker @("compose", "-f", $ComposeFile, "up", "-d")

    # Nginx resolves upstream container IPs at startup in this setup.
    Invoke-Checked docker @("compose", "-f", $ComposeFile, "restart", "nginx")
    Invoke-Checked docker @("compose", "-f", $ComposeFile, "ps")

    $deployedSha = Get-GitValue @("rev-parse", "HEAD")
    Write-DeployLog "Deployment finished successfully at $deployedSha"
  } catch {
    Write-DeployLog "Deployment failed: $($_.Exception.Message)"
    throw
  } finally {
    if (Test-Path $lockFile) {
      Remove-Item -LiteralPath $lockFile -Force
    }
    Pop-Location
  }
}

Write-DeployLog "GOALIX Docker auto deploy watcher started for $Remote/$Branch"

do {
  try {
    Invoke-DockerDeploy
  } catch {
    Write-DeployLog "Cycle failed. Next cycle will retry."
  }

  if (-not $Once) {
    Start-Sleep -Seconds $PollSeconds
  }
} while (-not $Once)
