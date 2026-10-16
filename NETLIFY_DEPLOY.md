# Deploy Credlock Tech Support Portal on Netlify

Repo: https://github.com/techsupportint-dev/Technical-Support

## Deploy in ~2 minutes

1. Open **https://app.netlify.com** and sign in (GitHub login is fine).
2. **Add new site → Import an existing project → GitHub**
3. Authorize Netlify and select **techsupportint-dev/Technical-Support**
4. Settings:
   - **Branch:** `main`
   - **Build command:** leave empty (or `echo ok`)
   - **Publish directory:** `.` (site root)
5. Click **Deploy site**

Netlify gives a URL like:

`https://random-name-123.netlify.app`

You can rename it under **Site configuration → Domain management → Options → Edit site name**

e.g. `https://credlock-tech-support.netlify.app`

## Team link

Share the `*.netlify.app` URL with the team.

Sign-in:
- Email: `techsupport.int@gmail.com`
- PIN: `6424`

## Optional custom domain on Netlify

1. **Domain management → Add domain**
2. Enter e.g. `support.credlockng.com`
3. Netlify shows DNS records — in **Cloudflare**:
   - CNAME `support` → `your-site-name.netlify.app`
   - Proxy: DNS only or Proxied (both work with Netlify)
4. Enable HTTPS (automatic on Netlify)

## Continuous deploy

Every push to `main` redeploys automatically.

## Local preview

```bash
npx serve .
```
