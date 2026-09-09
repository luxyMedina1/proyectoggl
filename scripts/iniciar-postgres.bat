@echo off
REM Arranca PostgreSQL 16 manualmente (sin servicio de Windows).
REM Doble clic despues de cada reinicio de la PC.
"C:\Program Files\PostgreSQL\16\bin\pg_ctl.exe" start -D "C:\Program Files\PostgreSQL\16\data" -w
echo.
echo Si dice "servidor iniciado" o "ya se esta ejecutando", esta OK.
pause
