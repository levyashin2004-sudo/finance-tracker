$WshShell = New-Object -comObject WScript.Shell
$DesktopPath = [Environment]::GetFolderPath('Desktop')
$Shortcut = $WshShell.CreateShortcut("$DesktopPath\Finance Tracker.lnk")
$Shortcut.TargetPath = "wscript.exe"
$Shortcut.Arguments = """$DesktopPath\Start_Tracker.vbs"""
$Shortcut.IconLocation = "$DesktopPath\Antigravity\finance-tracker\app_icon.ico"
$Shortcut.Save()

# Attempt to refresh the desktop icons
$Shell = New-Object -ComObject Shell.Application
$Desktop = $Shell.NameSpace(0)
$Desktop.Items() | ForEach-Object { $_.InvokeVerb("refresh") }
