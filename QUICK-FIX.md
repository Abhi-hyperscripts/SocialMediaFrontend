# QUICK FIX: 404 Error on Android

## Your Issue: Works on Mac, 404 on Android

This is a **GitHub Pages path issue**. Follow these steps in order:

## 🔥 IMMEDIATE FIXES (Try These First)

### Fix 1: Update Your Files
1. Download the updated files I provided
2. Replace ALL files in your repository:
   - index.html (UPDATED - uses relative paths)
   - manifest.json (UPDATED - uses relative paths)
   - sw.js (UPDATED - uses relative paths)
3. Commit and push to GitHub
4. Wait 2 minutes
5. Test on Android

### Fix 2: Verify GitHub Pages URL
Your correct URL should be:
```
https://YOUR-USERNAME.github.io/YOUR-REPO-NAME/
```

NOT:
```
https://YOUR-USERNAME.github.io/
```

Make sure you're using the RIGHT URL on Android.

### Fix 3: Clear Android Chrome Cache
1. Chrome Settings → Privacy → Clear browsing data
2. Select "Cached images and files"
3. Clear data
4. Visit site again

## 🔍 WHAT LIKELY HAPPENED

The old files used absolute paths like `/manifest.json` which work for root domains but NOT for GitHub Pages subdirectories (username.github.io/repo-name/).

The NEW files use relative paths like `./manifest.json` which work everywhere.

## ✅ VERIFICATION STEPS

1. Visit: `https://YOUR-USERNAME.github.io/YOUR-REPO-NAME/manifest.json`
   - Should show JSON, not 404

2. Visit: `https://YOUR-USERNAME.github.io/YOUR-REPO-NAME/`
   - Should show your app, not 404

3. Check GitHub Settings → Pages
   - Should show: "Your site is live at https://..."

## 🚨 IF STILL NOT WORKING

Check these:
1. Files are in repository **root** (not in a subfolder)
2. GitHub Pages is **enabled** in Settings
3. Wait **2 minutes** after pushing (deployment time)
4. Try **incognito mode** on Android

## 📝 FILES TO REPLACE

Replace these in your GitHub repository:
- ✅ index.html (uses `./manifest.json` instead of `/manifest.json`)
- ✅ manifest.json (uses `./icon-192.png` instead of `/icon-192.png`)
- ✅ sw.js (uses relative paths)

## 💡 WHY IT WORKED ON MAC

Mac browsers sometimes cache the site differently or you might have:
- Tested it locally (file://) where absolute paths work
- Used a different URL structure
- Had the site cached from before

## 🎯 BOTTOM LINE

**Replace all files with the updated versions I provided. They're specifically fixed for GitHub Pages subdirectory deployment.**

The key changes:
- `/` paths → `./` paths
- Absolute → Relative
- Added dynamic base path detection

This will work on BOTH Mac AND Android! 🎉
