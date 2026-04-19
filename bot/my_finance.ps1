$WshShell = New-Object -comObject WScript.Shell
$Desktop = [Environment]::GetFolderPath('Desktop')

Remove-Item "$Desktop\Семейный Бюджет.lnk" -ErrorAction SilentlyContinue

$Shortcut = $WshShell.CreateShortcut("$Desktop\My Finance.lnk")
$Shortcut.TargetPath = "wscript.exe"
$Shortcut.Arguments = """C:\Users\Лев\Desktop\Start_Tracker.vbs"""
$Shortcut.IconLocation = "C:\Users\Лев\Desktop\Antigravity\finance-tracker\app_icon.ico, 0"
$Shortcut.Save()

$Shell = New-Object -ComObject Shell.Application
$DT = $Shell.NameSpace(0)
$DT.Items() | ForEach-Object { $_.InvokeVerb("refresh") }
