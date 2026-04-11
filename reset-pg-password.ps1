Write-Host "PostgreSQL 密码重置工具" -ForegroundColor Green
Write-Host "======================" -ForegroundColor Green
Write-Host ""

# 设置 PostgreSQL 路径
$PG_HOME = "E:\PostgreSQL\18"
$PG_BIN = "$PG_HOME\bin"

# 停止 PostgreSQL 服务
Write-Host "停止 PostgreSQL 服务..." -ForegroundColor Yellow
Stop-Service -Name "postgresql-x64-18" -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# 以单用户模式启动 PostgreSQL
Write-Host "以单用户模式启动 PostgreSQL..." -ForegroundColor Yellow
$singleUserProcess = Start-Process -FilePath "$PG_BIN\postgres.exe" -ArgumentList "--single", "-D", "$PG_HOME\data", "postgres" -NoNewWindow -PassThru

# 等待服务启动
Start-Sleep -Seconds 3

# 创建密码更新脚本
$resetSql = "ALTER USER postgres WITH PASSWORD 'postgres';"
$resetSql | Out-File -FilePath "reset_password.sql" -Encoding ASCII

Write-Host "执行密码重置..." -ForegroundColor Yellow
# 使用 psql 执行密码重置
try {
    & "$PG_BIN\psql.exe" -U postgres -d postgres -f "reset_password.sql"
    Write-Host "密码重置成功！" -ForegroundColor Green
} catch {
    Write-Host "密码重置失败: $($_.Exception.Message)" -ForegroundColor Red
}

# 停止单用户模式
if ($singleUserProcess) {
    Stop-Process -Id $singleUserProcess.Id -Force -ErrorAction SilentlyContinue
}

# 启动 PostgreSQL 服务
Write-Host "启动 PostgreSQL 服务..." -ForegroundColor Yellow
Start-Service -Name "postgresql-x64-18" -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# 清理临时文件
if (Test-Path "reset_password.sql") {
    Remove-Item "reset_password.sql" -Force
}

Write-Host ""
Write-Host "密码重置完成！" -ForegroundColor Green
Write-Host "postgres 用户的密码已设置为: postgres" -ForegroundColor Green
Write-Host ""
Write-Host "按任意键退出..." -ForegroundColor Cyan
$host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
