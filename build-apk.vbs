Set shell = CreateObject("WScript.Shell")
shell.CurrentDirectory = "C:\Users\user\My-assistent\MyAssistant\MyAssistantFinal"
exitCode = shell.Run("cmd /c build-apk.bat", 0, True)
WScript.Quit exitCode
