# GOALIX Docker Auto Deploy Without GitHub Actions

This is the fallback deployment flow when GitHub Actions cannot run because of billing or account limits.

The watcher runs on the same machine that runs Docker. It checks `origin/master` every minute. When a new commit appears, it runs:

```powershell
git pull --ff-only origin master
docker compose -f docker-compose.prod.yml config
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml restart nginx
```

## Start Manually

From the project root:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\auto-docker-deploy.ps1
```

Run one deploy check only:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\auto-docker-deploy.ps1 -Once
```

Change the polling interval:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\auto-docker-deploy.ps1 -PollSeconds 30
```

## Important

The production checkout should be clean. If local files are modified, the watcher refuses to deploy so it does not overwrite or mix local changes with GitHub changes.

Check the current state:

```powershell
git status --short
```

If changes are intended for production, commit and push them first.

## Run Automatically On Windows Startup

Open PowerShell as Administrator and run:

```powershell
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-ExecutionPolicy Bypass -File E:\goalix\scripts\auto-docker-deploy.ps1"
$trigger = New-ScheduledTaskTrigger -AtStartup
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
Register-ScheduledTask -TaskName "GOALIX Docker Auto Deploy" -Action $action -Trigger $trigger -Settings $settings -RunLevel Highest
```

Start it now without rebooting:

```powershell
Start-ScheduledTask -TaskName "GOALIX Docker Auto Deploy"
```

Logs are written to:

```text
.deploy/auto-docker-deploy.log
```
