# Quick Setup Guide

## Step 1: Update Environment Variables

Create or edit the file `.env.local` in the root folder:

```env
NEXT_PUBLIC_SUPABASE_URL=https://vcbldunebyayqgrxfbra.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZjYmxkdW5lYnlheXFncnhmYnJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0NzMxMDAsImV4cCI6MjA5NDA0OTEwMH0.qL95hlogSOeXknghvQRAZhFSncEFESwbCzn7k5rU0Bc
```

## Step 2: Clear Cache & Restart

Open PowerShell and run:

```powershell
# Clear Next.js cache
Remove-Item -Path ".next" -Recurse -Force -ErrorAction SilentlyContinue

# Clear DNS cache (fixes network issues)
ipconfig /flushdns

# Start dev server
npm run dev
```

## Step 3: Test Connection

1. Open browser to http://localhost:3000
2. Go to Suppliers page
3. Click "Add Supplier" 
4. Fill form and save

## If Still Fails

### Option A: Test in Incognito Mode
- Open Chrome Incognito (Ctrl+Shift+N)
- Try adding supplier there

### Option B: Check Network
- Try on different WiFi/mobile hotspot
- Disable VPN if using one
- Disable browser extensions

### Option C: Verify Supabase Tables
Run this SQL in Supabase SQL Editor:

```sql
-- Check if tables exist
SELECT * FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('suppliers', 'deliveries', 'payments');
```

## Troubleshooting

**Error: "Failed to fetch"**
→ Network/DNS issue. Run `ipconfig /flushdns` and restart.

**Error: "Cannot connect"**
→ Check if Supabase project is active in dashboard.

**Tables don't exist**
→ Run the SQL schema setup from the SQL Editor.
