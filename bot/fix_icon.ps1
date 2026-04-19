$WshShell = New-Object -comObject WScript.Shell
$Desktop = [Environment]::GetFolderPath('Desktop')

# Delete old shortut if it exists
Remove-Item "$Desktop\Finance Tracker.lnk" -ErrorAction SilentlyContinue

# Create a brand new shortcut with a slightly different name to bypass Windows Icon Cache
$Shortcut = $WshShell.CreateShortcut("$Desktop\Семейный Бюджет.lnk")
$Shortcut.TargetPath = "wscript.exe"
$Shortcut.Arguments = """$Desktop\Start_Tracker.vbs"""
$Shortcut.IconLocation = "$Desktop\Antigravity\finance-tracker\app_icon.ico, 0"
$Shortcut.Save()

# Refresh desktop icons
$Shell = New-Object -ComObject Shell.Application
$DT = $Shell.NameSpace(0)
$DT.Items() | ForEach-Object { $_.InvokeVerb("refresh") }
