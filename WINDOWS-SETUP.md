# Windows Setup Guide — Dress Shop Billing

Follow these steps once on the shop's Windows computer. After that, your
client just clicks a normal desktop icon — no browser bar, no typing
addresses, no internet needed.

## Requirements
- Windows 10 or 11
- Google Chrome or Microsoft Edge installed (Edge comes pre-installed on
  every Windows 10/11 PC, so this will work even with zero extra installs)

## Step 1 — Unzip
Right-click `DressShopBilling.zip` → **Extract All** → choose a permanent
location, for example:
```
C:\DressShopBilling
```
(Don't extract it to a USB drive or a temporary folder — keep it somewhere
permanent, since the shortcut points back to this folder.)

## Step 2 — Install the Desktop icon
Open the extracted folder and **double-click**:
```
Install (Run Me First).vbs
```
Windows may show a security prompt the first time ("Windows protected your
PC") — click **More info → Run anyway**. This is normal for any script
downloaded from outside the Windows Store; the script only creates a
shortcut, nothing else.

A popup will confirm: *"A 'Dress Shop Billing' icon has been added to your
Desktop."*

## Step 3 — Use it
From now on, your client just:
1. Double-clicks the **Dress Shop Billing** icon on the Desktop
2. It opens in its own app window (no browser tabs/toolbar visible)
3. Logs in with `admin` / `admin123` the first time, then changes the
   password under **Users & Roles**

That's it — this is now a normal-feeling desktop program. It never needs
internet, never needs re-installing, and keeps working even if the PC's
WiFi is off.

## Moving to a new/different computer
1. Copy the whole folder (e.g. `C:\DressShopBilling`) to the new PC
2. Run `Install (Run Me First).vbs` again on that PC
3. In the old app, go to **Settings → Download Backup**, then on the new
   installation go to **Settings → Restore Backup** to bring all products,
   sales, and customers across

## Troubleshooting
- **"Windows protected your PC" warning** → click "More info" → "Run
  anyway". This appears for any unsigned script; it's expected and safe.
- **Icon opens a blank page** → right-click the Desktop icon → Properties,
  confirm the target folder wasn't moved/renamed after installing. If it
  was moved, just re-run `Install (Run Me First).vbs` from the new location.
- **Nothing installed (Chrome/Edge missing)** → install Microsoft Edge
  (built into Windows Update) or Google Chrome, then re-run the installer.

## Want a "real" single-file .exe installer instead?
This setup uses lightweight Windows scripts (no compiling needed) so it
works instantly, offline, on any machine. If you'd prefer a proper signed
`.exe` installer (like a normal downloaded program, with an uninstaller in
Control Panel), that requires packaging with **Electron** — this needs an
internet connection to download build tools and can be done later as a
separate step. Ask and it can be prepared as a source project for a
developer to build, or built directly if given an environment with
internet access.
