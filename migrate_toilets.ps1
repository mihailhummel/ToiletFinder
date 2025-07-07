# PowerShell script to migrate all toilets to Supabase
Write-Host "🚀 Starting FULL toilet migration to Supabase..." -ForegroundColor Green

# Check if Node.js is available
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js found: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js not found or not in PATH" -ForegroundColor Red
    exit 1
}

# Check if the JSON file exists
if (-not (Test-Path "bulgaria_toilets_complete.json")) {
    Write-Host "❌ bulgaria_toilets_complete.json file not found!" -ForegroundColor Red
    exit 1
}

# Run the migration script
Write-Host "🔄 Running migration script..." -ForegroundColor Yellow
try {
    node migrate_all_toilets.js
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Migration completed successfully!" -ForegroundColor Green
    } else {
        Write-Host "❌ Migration failed with exit code: $LASTEXITCODE" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Error running migration: $_" -ForegroundColor Red
} 