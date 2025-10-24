# GitHub Pages PWA - Troubleshooting Guide

## 🔴 FIXING 404 ERROR ON ANDROID

If you're getting "404 - There isn't a GitHub Pages site here" on Android but it works on Mac, follow these steps:

### Step 1: Verify GitHub Pages is Enabled

1. Go to your GitHub repository
2. Click **Settings** tab
3. Scroll down to **Pages** section (left sidebar)
4. Make sure **Source** is set to:
   - Branch: `main` (or `master`)
   - Folder: `/ (root)`
5. Click **Save** if you made changes
6. Wait 1-2 minutes for deployment

### Step 2: Check Your Files are in Root

Your repository should look like this:
```
your-repo/
├── index.html
├── manifest.json
├── sw.js
├── icon-192.png
├── icon-512.png
└── icon-generator.html
```

**NOT like this:**
```
your-repo/
└── subfolder/
    ├── index.html
    └── ...
```

If files are in a subfolder, move them to the root directory.

### Step 3: Verify Your URL

Your GitHub Pages URL should be:
- Format: `https://username.github.io/repository-name/`
- Example: `https://johnsmith.github.io/location-tracker/`

**Test both URLs:**
1. `https://username.github.io/repository-name/` (with trailing slash)
2. `https://username.github.io/repository-name/index.html`

Both should work. If neither works, GitHub Pages isn't deployed yet.

### Step 4: Wait for Deployment

After committing files:
1. Go to repository **Actions** tab
2. Look for "pages build and deployment" workflow
3. Wait for green checkmark (usually 1-2 minutes)
4. If it shows a red X, click it to see the error

### Step 5: Check File Names

File names are **case-sensitive** on GitHub Pages:
- ✅ `index.html` (correct)
- ❌ `Index.html` (wrong)
- ✅ `manifest.json` (correct)
- ❌ `Manifest.json` (wrong)

### Step 6: Clear Browser Cache on Android

On Android Chrome:
1. Open Chrome Settings
2. Privacy and Security > Clear browsing data
3. Select "Cached images and files"
4. Click "Clear data"
5. Revisit your site

### Step 7: Test in Incognito Mode

1. Open Chrome incognito tab on Android
2. Visit your GitHub Pages URL
3. This bypasses cache issues

## 📋 COMPLETE CHECKLIST

Use this checklist to verify everything is correct:

**Repository Setup:**
- [ ] GitHub Pages is enabled in repository settings
- [ ] Source is set to `main` (or `master`) branch, root folder
- [ ] All files are in repository root (not in a subfolder)
- [ ] File names are lowercase and match exactly: `index.html`, `manifest.json`, `sw.js`

**Required Files:**
- [ ] `index.html` exists in root
- [ ] `manifest.json` exists in root
- [ ] `sw.js` exists in root
- [ ] `icon-192.png` exists in root
- [ ] `icon-512.png` exists in root

**File Contents:**
- [ ] manifest.json uses relative paths: `./icon-192.png` (not `/icon-192.png`)
- [ ] index.html links to `./manifest.json` (not `/manifest.json`)
- [ ] No absolute paths in any files

**Deployment:**
- [ ] Latest commit is pushed to GitHub
- [ ] GitHub Actions shows successful deployment (green checkmark)
- [ ] Waited at least 2 minutes after push

**Testing:**
- [ ] Site opens in desktop browser
- [ ] Site opens in mobile browser
- [ ] No console errors (F12 Developer Tools)
- [ ] manifest.json is accessible at: `https://username.github.io/repo-name/manifest.json`

## 🔍 DEBUGGING STEPS

### Check if Files are Accessible

Visit these URLs directly (replace with your username/repo):

1. `https://username.github.io/repository-name/`
2. `https://username.github.io/repository-name/index.html`
3. `https://username.github.io/repository-name/manifest.json`
4. `https://username.github.io/repository-name/sw.js`
5. `https://username.github.io/repository-name/icon-192.png`

If ANY of these show 404, that file is not deployed correctly.

### Check Service Worker Console

On Android Chrome:
1. Visit your site
2. Type in address bar: `chrome://inspect/#service-workers`
3. Look for your site in the list
4. Click "inspect" to see errors

### Check Manifest Console

On Android Chrome:
1. Visit your site
2. Open DevTools (if available on your device)
3. Go to Application > Manifest
4. Check for errors

### Common Console Errors and Fixes

**Error:** "Failed to fetch manifest"
- **Fix:** Check manifest.json path in index.html
- **Fix:** Verify manifest.json exists and is valid JSON

**Error:** "Service worker registration failed"
- **Fix:** Ensure HTTPS is being used
- **Fix:** Check sw.js path is correct
- **Fix:** Verify sw.js exists in repository

**Error:** "Failed to load resource: 404"
- **Fix:** File doesn't exist or path is wrong
- **Fix:** Check file names match exactly (case-sensitive)

## 🌐 GITHUB PAGES SPECIFIC ISSUES

### Issue: Works Locally but Not on GitHub Pages

**Solution:** Use relative paths everywhere
- Change `/manifest.json` to `./manifest.json`
- Change `/icon-192.png` to `./icon-192.png`
- Update service worker paths accordingly

### Issue: "Repository with this name already exists"

**Solution:** 
- Use a different repository name
- Or delete the existing repository first

### Issue: Custom Domain 404

**Solution:**
- If using custom domain, update in repository Settings > Pages
- Add a CNAME file in repository root with your domain
- Wait for DNS propagation (up to 24 hours)

## 📱 ANDROID-SPECIFIC ISSUES

### Issue: Install Banner Doesn't Show

**Possible reasons:**
1. PWA criteria not met (check Console for errors)
2. Already installed
3. Site visited too few times
4. Using mobile data with restricted background data

**Solution:**
- Open Chrome menu (three dots)
- Look for "Install app" or "Add to Home Screen"
- Manually install from there

### Issue: App Installs but Won't Open

**Solution:**
1. Uninstall the PWA from home screen
2. Clear Chrome cache
3. Clear site data: Settings > Site Settings > [your site] > Clear & Reset
4. Reinstall

## 🔧 QUICK FIXES

### Fix #1: Redeploy

Force a redeployment:
```bash
# Make a small change to README or any file
git commit -am "Trigger redeploy"
git push origin main
```

### Fix #2: Use Index File

Ensure there's an index.html (not index.htm or default.html):
- GitHub Pages looks for `index.html` by default
- Rename if necessary

### Fix #3: Check Repository Visibility

If repository is private:
- GitHub Pages for private repos requires GitHub Pro/Teams
- Make repository public or upgrade account

## 📊 Verification Tools

### Online Tools to Test Your PWA

1. **Lighthouse Audit** (Chrome DevTools)
   - Open your site in Chrome
   - F12 > Lighthouse tab
   - Click "Generate report"
   - Check PWA score

2. **Manifest Validator**
   - Visit: https://manifest-validator.appspot.com/
   - Enter your manifest.json URL
   - Check for errors

3. **SSL Checker**
   - Visit: https://www.ssllabs.com/ssltest/
   - Verify HTTPS is working correctly

## 💡 STILL NOT WORKING?

### Last Resort Steps

1. **Create New Repository**
   - Sometimes a fresh start helps
   - Create new repo with exact same files
   - Enable GitHub Pages

2. **Check GitHub Status**
   - Visit: https://www.githubstatus.com/
   - Verify GitHub Pages service is operational

3. **Try Different Browser**
   - Test on Firefox, Edge, Samsung Internet
   - This isolates Chrome-specific issues

4. **Contact GitHub Support**
   - If none of this works
   - Open issue at: https://github.com/contact

## 📚 Additional Resources

- [GitHub Pages Documentation](https://docs.github.com/en/pages)
- [PWA Documentation](https://web.dev/progressive-web-apps/)
- [Service Worker Guide](https://developers.google.com/web/fundamentals/primers/service-workers)
- [Web App Manifest](https://developer.mozilla.org/en-US/docs/Web/Manifest)

## ✅ Success Indicators

You know it's working when:
- ✅ Site loads on both desktop and mobile
- ✅ No 404 errors
- ✅ Install banner appears (or manual install option in menu)
- ✅ Console shows "Service Worker registered successfully"
- ✅ Lighthouse PWA score is 90+ (optional but good to check)

---

**Note:** GitHub Pages deployment typically takes 1-2 minutes. If you just pushed changes, wait a bit before troubleshooting!
