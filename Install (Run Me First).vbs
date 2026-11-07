' Install (Run Me First).vbs
' Creates a "Dress Shop Billing" icon on the Windows Desktop.
' Run this ONCE. After that, just use the Desktop icon — you
' never need to open this folder again.

Dim fso, shell, scriptDir, desktopPath, shortcut

Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
desktopPath = shell.SpecialFolders("Desktop")

Set shortcut = shell.CreateShortcut(desktopPath & "\Dress Shop Billing.lnk")
shortcut.TargetPath = "wscript.exe"
shortcut.Arguments = """" & scriptDir & "\Launch.vbs"""
shortcut.WorkingDirectory = scriptDir
shortcut.IconLocation = scriptDir & "\assets\app_icon.ico"
shortcut.Description = "Dress Shop Billing - Offline Billing Software"
shortcut.Save

MsgBox "Setup complete!" & vbCrLf & vbCrLf & _
       "A 'Dress Shop Billing' icon has been added to your Desktop." & vbCrLf & _
       "Double-click it any time to open the billing software." & vbCrLf & vbCrLf & _
       "Default login -> Username: admin   Password: admin123" & vbCrLf & _
       "(Please change this from Users & Roles after logging in.)", _
       64, "Dress Shop Billing - Installed"
