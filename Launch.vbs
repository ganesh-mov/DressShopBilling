' Launch.vbs — opens Dress Shop Billing in its own app window
' (no address bar, no tabs) using whichever browser is installed.
' Runs completely offline. Do not move this file out of this folder.

Dim fso, shell, scriptDir, targetFile
Dim chromePath, chromePathX86, edgePath, edgePathX86

Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
targetFile = "file:///" & Replace(scriptDir, "\", "/") & "/index.html"

chromePath    = shell.ExpandEnvironmentStrings("%ProgramFiles%") & "\Google\Chrome\Application\chrome.exe"
chromePathX86 = shell.ExpandEnvironmentStrings("%ProgramFiles(x86)%") & "\Google\Chrome\Application\chrome.exe"
edgePath      = shell.ExpandEnvironmentStrings("%ProgramFiles(x86)%") & "\Microsoft\Edge\Application\msedge.exe"
edgePathX86   = shell.ExpandEnvironmentStrings("%ProgramFiles%") & "\Microsoft\Edge\Application\msedge.exe"

If fso.FileExists(chromePath) Then
    shell.Run """" & chromePath & """ --app=" & targetFile & " --window-size=1300,850", 1, False
ElseIf fso.FileExists(chromePathX86) Then
    shell.Run """" & chromePathX86 & """ --app=" & targetFile & " --window-size=1300,850", 1, False
ElseIf fso.FileExists(edgePath) Then
    shell.Run """" & edgePath & """ --app=" & targetFile & " --window-size=1300,850", 1, False
ElseIf fso.FileExists(edgePathX86) Then
    shell.Run """" & edgePathX86 & """ --app=" & targetFile & " --window-size=1300,850", 1, False
Else
    ' Fallback: open in default browser normally
    shell.Run targetFile, 1, True
End If
