$WshShell = New-Object -comObject WScript.Shell
$Desktop = [Environment]::GetFolderPath('Desktop')

Remove-Item "$Desktop\My Finance.lnk" -ErrorAction SilentlyContinue
Remove-Item "$Desktop\Start_Tracker.vbs" -ErrorAction SilentlyContinue

$Shortcut = $WshShell.CreateShortcut("$Desktop\My Finance.lnk")
$Shortcut.TargetPath = "$Desktop\Start_Tracker.bat"
$Shortcut.IconLocation = "$Desktop\Antigravity\finance-tracker\app_icon.ico, 0"
$Shortcut.Save()

$Shell = New-Object -ComObject Shell.Application
$DT = $Shell.NameSpace(0)
$DT.Items() | ForEach-Object { $_.InvokeVerb("refresh") }
