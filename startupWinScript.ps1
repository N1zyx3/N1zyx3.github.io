# Windows Setup Utility - Interactive WinGet Installer
# Developer: System Admin Toolset

$Host.UI.RawUI.WindowTitle = "Windows Setup Utility"

# --- Helper Functions ---
function Show-Banner {
    Clear-Host
    $banner = @"
***************************************************************************
*                                                                         *
*    __      __ _             _                     _____        _        *
*    \ \    / /(_)           | |                   / ____|      | |       *
*     \ \  / /  _  _ __    __| |  ___ __      __  | (___   ___  | |_      *
*      \ \/ /  | || '_ \  / _` | / _ \\ \ /\ / /   \___ \ / _ \ | __|     *
*       \  /   | || | | || (_| || (_) |\ V  V /    ____) |  __/ | |_      *
*        \/    |_||_| |_| \__,_| \___/  \_/\_/    |_____/ \___|  \__|     *
*                                                                         *
*                      WINDOWS SETUP UTILITY v1.0                         *
***************************************************************************
"@
    Write-Host $banner -ForegroundColor Cyan
    Write-Host "`n[!] Checking WinGet availability..." -ForegroundColor Gray
    if (!(Get-Command winget -ErrorAction SilentlyContinue)) {
        Write-Host "[!] WinGet is not installed. Please install it from the Microsoft Store." -ForegroundColor Red
        pause
        exit
    }
}

function Install-Package {
    param([string]$PackageId)
    Write-Host "`n[>] Installing: $PackageId..." -ForegroundColor Yellow
    winget install --id $PackageId --silent --accept-package-agreements --accept-source-agreements
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[+] Successfully installed $PackageId" -ForegroundColor Green
    } else {
        Write-Host "[-] Failed to install $PackageId. Error code: $LASTEXITCODE" -ForegroundColor Red
    }
}

# --- Main Script ---
Show-Banner

# STAGE 1: Browsers
Write-Host "`n--- STAGE 1: WEB BROWSERS ---" -ForegroundColor Cyan
Write-Host "1) Google Chrome"
Write-Host "2) Mozilla Firefox"
Write-Host "3) Brave Browser"
Write-Host "4) Opera"
Write-Host "Press [Enter] to skip this stage." -ForegroundColor Gray

$browserChoice = Read-Host "Select a browser (1-4)"

switch ($browserChoice) {
    "1" { Install-Package "Google.Chrome" }
    "2" { Install-Package "Mozilla.Firefox" }
    "3" { Install-Package "Brave.Brave" }
    "4" { Install-Package "Opera.Opera" }
    Default { Write-Host "Skipping browsers..." -ForegroundColor Gray }
}

# STAGE 2: Messengers
Write-Host "`n--- STAGE 2: MESSENGERS ---" -ForegroundColor Cyan
Write-Host "You can select multiple apps (e.g., 1,2)" -ForegroundColor Gray
Write-Host "1) Telegram Desktop"
Write-Host "2) Discord"
Write-Host "3) WhatsApp"
Write-Host "Press [Enter] to skip this stage." -ForegroundColor Gray

$msgChoice = Read-Host "Select messengers"

if ($msgChoice) {
    $choices = $msgChoice.Split(',').Trim()
    foreach ($choice in $choices) {
        if ($choice -eq "1") { Install-Package "Telegram.TelegramDesktop" }
        elseif ($choice -eq "2") { Install-Package "Discord.Discord" }
        elseif ($choice -eq "3") { Install-Package "WhatsApp.WhatsApp" }
    }
} else {
    Write-Host "Skipping messengers..." -ForegroundColor Gray
}

# STAGE 3: Custom Search Loop
Write-Host "`n--- STAGE 3: CUSTOM SEARCH & INSTALL ---" -ForegroundColor Cyan
Write-Host "Search for any software or type 'exit' to finish." -ForegroundColor Gray

while ($true) {
    $query = Read-Host "`nEnter app name to search"
    
    if ($query -eq "exit") { break }
    if ([string]::IsNullOrWhiteSpace($query)) { continue }

    Write-Host "Searching for '$query'..." -ForegroundColor Gray
    $results = winget search $query
    
    if ($null -eq $results -or $results.Count -lt 3) {
        Write-Host "No packages found for '$query'." -ForegroundColor Red
        continue
    }

    $results
    
    $idToInstall = Read-Host "`nCopy and Paste the ID to install (or press Enter to search again)"
    
    if (![string]::IsNullOrWhiteSpace($idToInstall)) {
        Install-Package $idToInstall
    }
}

Write-Host "`n***************************************************" -ForegroundColor Cyan
Write-Host "   Setup complete! Thank you for using the tool.   " -ForegroundColor Green
Write-Host "***************************************************" -ForegroundColor Cyan
pause