@echo off
setlocal

echo PostgreSQL 密码重置工具
echo ======================
echo.

echo 正在重置 postgres 用户密码...

REM 设置 PostgreSQL 路径
set PG_HOME=E:\PostgreSQL\18
set PG_BIN=%PG_HOME%\bin

REM 停止 PostgreSQL 服务
echo 停止 PostgreSQL 服务...
net stop postgresql-x64-18

REM 以单用户模式启动 PostgreSQL
echo 以单用户模式启动 PostgreSQL...
start "PostgreSQL Single-User" /min "%PG_BIN%\postgres.exe" --single -D "%PG_HOME%\data" postgres

REM 等待服务启动
timeout /t 3 /nobreak >nul

REM 创建密码更新脚本
echo ALTER USER postgres WITH PASSWORD 'postgres'; > reset_password.sql

echo 执行密码重置...
REM 使用 psql 执行密码重置
"%PG_BIN%\psql.exe" -U postgres -d postgres -f reset_password.sql

REM 停止单用户模式
Taskkill /IM postgres.exe /F

REM 启动 PostgreSQL 服务
echo 启动 PostgreSQL 服务...
net start postgresql-x64-18

REM 清理临时文件
del reset_password.sql

echo.
echo 密码重置完成！
echo postgres 用户的密码已设置为: postgres
echo.
echo 按任意键退出...
pause >nul
endlocal
