@echo off
setlocal
set "APP=%~dp0index.html"
set "APPURL=file:///%APP:\=/%"
set "EDGE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not exist "%EDGE%" set "EDGE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if exist "%EDGE%" (
  start "" "%EDGE%" --app="%APPURL%"
) else (
  start "" "%APP%"
)
endlocal
