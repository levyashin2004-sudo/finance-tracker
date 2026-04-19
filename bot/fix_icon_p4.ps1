$WshShell = New-Object -comObject WScript.Shell
$Desktop = [Environment]::GetFolderPath('Desktop')

$Shortcut = $WshShell.CreateShortcut("$Desktop\My Finance.lnk")
$Shortcut.TargetPath = "wscript.exe"
$Shortcut.Arguments = "`"$Desktop\Antigravity\finance-tracker\Start_Tracker.vbs`""
$Shortcut.IconLocation = "$Desktop\Antigravity\finance-tracker\app_icon.ico, 0"
$Shortcut.Save()

$Shell = New-Object -ComObject Shell.Application
$DT = $Shell.NameSpace(0)
$DT.Items() | ForEach-Object { $_.InvokeVerb("refresh") }
