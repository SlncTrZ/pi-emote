# deploy.ps1 - Push pi-emote Sixel fork to GitHub
# Chay: powershell -ExecutionPolicy Bypass .\deploy.ps1

cd H:\Develop\pi-emote

# Set remote origin -> fork
git remote set-url origin https://github.com/SlncTrZ/pi-emote.git
git remote add upstream https://github.com/cgxeiji/pi-emote.git 2>$null

# Commit + push
git add .
git status
git commit -m "feat: add Sixel renderer for Windows Terminal 1.22+

Pure TypeScript Sixel protocol renderer. Pipeline:
- png_decode.ts: PNG decoder (pure TS, zlib built-in)
- wu_quantizer.ts: Xiaolin Wu color quantizer
- sixel_packer.ts: Sixel DCS encoder
- render_sixel.ts: SixelRenderer extends BaseImageRenderer

Wire-in: types.ts (unions), index.ts (createRendererFromResolved),
terminal.ts (WT_SESSION detection), config.json (windowsterminal->sixel mapping)."

Write-Host "`n=== PUSHING TO FORK ===" -ForegroundColor Green
git push origin main 2>&1

Write-Host "`n=== DONE ===" -ForegroundColor Green
Write-Host "Next: pi install git:github.com/SlncTrZ/pi-emote"
