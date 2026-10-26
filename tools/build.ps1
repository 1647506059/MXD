param([string]$Creator = 'D:/Softwares/CocosDashboard/resources/editors/Creator/3.8.8/CocosCreator.exe')
$ErrorActionPreference = 'Stop'
$projectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
if (-not (Test-Path -LiteralPath $Creator)) { throw 'Cocos Creator 3.8.8 not found. Pass -Creator with its executable path.' }
$logPath = Join-Path $projectRoot 'temp/builder/log'
$arguments = @('--project', ('"' + $projectRoot + '"'), '--build', '"configPath=buildConfig_web-desktop.json"')
$savedElectronMode = $env:ELECTRON_RUN_AS_NODE
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
try { $process = Start-Process -FilePath $Creator -ArgumentList $arguments -PassThru -WindowStyle Hidden }
finally { if ($null -ne $savedElectronMode) { $env:ELECTRON_RUN_AS_NODE = $savedElectronMode } }
Write-Output ('Build PID: ' + $process.Id + '; log: ' + $logPath)
$process.WaitForExit()
Write-Output ('Creator exit code: ' + $process.ExitCode)
if ($process.ExitCode -ne 0 -and $process.ExitCode -ne 36) { throw ('Build failed. Read ' + $logPath) }
if (-not (Test-Path -LiteralPath (Join-Path $projectRoot 'build/web-desktop/index.html'))) { throw 'Build output was not generated.' }
Write-Output 'Build complete. Run npm run preview.'
