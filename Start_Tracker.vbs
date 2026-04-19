Set WshShell = CreateObject("WScript.Shell")
UserProfile = WshShell.ExpandEnvironmentStrings("%USERPROFILE%")

' Kill existing node processes silently
WshShell.Run "cmd.exe /c taskkill /F /IM node.exe", 0, True

' Run Backend invisibly
WshShell.Run "cmd.exe /c cd /d " & Chr(34) & UserProfile & "\Desktop\Antigravity\finance-tracker\bot" & Chr(34) & " && node server.js", 0, False

' Run Frontend invisibly
WshShell.Run "cmd.exe /c cd /d " & Chr(34) & UserProfile & "\Desktop\Antigravity\finance-tracker\webapp" & Chr(34) & " && npm run dev", 0, False

' Wait 3 seconds
WScript.Sleep 3000

' Open browser natively
WshShell.Run "http://localhost:5173", 0, False
