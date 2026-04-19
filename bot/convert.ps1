Add-Type -AssemblyName System.Drawing

$userProfile = [Environment]::GetFolderPath('UserProfile')
$imgPath = "$userProfile\.gemini\antigravity\brain\18c55830-38bd-4376-9eee-305eb8094e9f\finance_gold_icon_1776623217417.png"
$icoPath = "$userProfile\Desktop\Antigravity\finance-tracker\app_icon.ico"

try {
    $bmp = [System.Drawing.Bitmap]::FromFile($imgPath)
    $iconHandle = $bmp.GetHicon()
    $icon = [System.Drawing.Icon]::FromHandle($iconHandle)
    $stream = [System.IO.File]::Create($icoPath)
    $icon.Save($stream)
    $stream.Close()
    $icon.Dispose()
    $bmp.Dispose()
    Write-Host "ICO created successfully at $icoPath"
    
    $Shell = New-Object -ComObject Shell.Application
    $Desktop = $Shell.NameSpace(0)
    $Desktop.Items() | ForEach-Object { $_.InvokeVerb("refresh") }
} catch {
    Write-Error "Failed: $_"
}
