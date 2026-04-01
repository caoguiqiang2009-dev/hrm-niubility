#!/usr/bin/expect -f

set timeout 300
set server_ip "8.129.5.180"
set server_user "administrator"
set server_pass "yixi2026."

spawn ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=10 ${server_user}@${server_ip}

expect "assword:"
send "${server_pass}\r"
expect ">"

send "powershell.exe\r"
expect ">"

send "cd C:\\hrm-niubility-test\r"
expect ">"

send "Invoke-WebRequest -Uri \"https://github.com/caoguiqiang2009-dev/hrm-niubility/archive/refs/heads/main.zip\" -OutFile \"main.zip\"\r"
expect ">"

send "Expand-Archive -Path \"main.zip\" -DestinationPath \".\\temp\" -Force\r"
expect ">"

send "Copy-Item \".\\temp\\hrm-niubility-main\\server\\*\" -Destination \".\\server\\\" -Recurse -Force\r"
expect ">"

send "Copy-Item \".\\temp\\hrm-niubility-main\\src\\*\" -Destination \".\\src\\\" -Recurse -Force\r"
expect ">"

send "Copy-Item \".\\temp\\hrm-niubility-main\\package.json\" -Destination \".\" -Force\r"
expect ">"

send "Remove-Item \".\\temp\" -Recurse -Force\r"
expect ">"

send "npm install --loglevel error\r"
expect ">"

send "npm run build:all\r"
expect ">"

send "Restart-Service HrmNiubilityTest\r"
expect ">"

send "exit\r"
expect ">"

send "exit\r"
expect eof
