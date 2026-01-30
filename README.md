# JPG → PNG Converter

Lightweight, privacy-first client-side JPG → PNG converter. Drag & drop a JPG, preview it, convert to PNG using the Canvas API, and download instantly — everything runs in your browser.

Key points
- No server, no uploads: All image processing happens locally in the user's browser.
- Mobile-first, accessible UI with drag & drop and keyboard support.
- Safe handling for large images (auto-downscales to avoid OOM).

Files included
- `index.html` — app UI
- `style.css` — styles
- `script.js` — client-side logic

Quick start (local)
1. Open `index.html` in your browser, or serve the directory locally:

```bash
# from project root
python3 -m http.server 5500
# then open http://127.0.0.1:5500
```

Publish to GitHub Pages (automatic)
1. Create a public GitHub repository and push this project to `main` (replace values):

```bash
git init
git add .
git commit -m "Initial site"
git branch -M main
git remote add origin https://github.com/<YOUR_USERNAME>/<REPO>.git
git push -u origin main
```

2. The repository includes a GitHub Actions workflow at `.github/workflows/deploy.yml` that deploys the repository root to GitHub Pages automatically on every push to `main`.

3. After the first deploy, your site will be available at `https://<YOUR_USERNAME>.github.io/<REPO>/` (GitHub may take a minute to provision Pages).

Custom domain (optional)
- This repo contains a `CNAME` file with a placeholder domain (`www.example.com`). If you own a domain, replace the contents of `CNAME` with your domain (e.g. `www.mydomain.com`) and configure your DNS provider:
  - Create an A record pointing to GitHub Pages IPs (for apex/root domain): 185.199.108.153, 185.199.109.153, 185.199.110.153, 185.199.111.153
  - Or create a CNAME record for the `www` subdomain pointing to `<YOUR_USERNAME>.github.io`.

Security & privacy
- The app is intentionally client-side only. Do not add analytics or third-party scripts unless you update the privacy messaging.
- The site shows this message on the page: “All image processing happens locally in your browser.”

Notes & troubleshooting
- If you see a blank page after deployment, check that `index.html` is in the repo root (not in a subfolder).
- If you use the included `CNAME`, make sure DNS points to GitHub before expecting the custom domain to resolve.

Want me to push this to your GitHub for you?
- I can prepare the GitHub repo and commit the files locally, but you'll need to run the `git push` command above or grant a deploy key.

License
- MIT
