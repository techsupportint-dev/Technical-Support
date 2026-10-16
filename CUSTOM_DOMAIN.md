# Custom domain for Credlock Tech Support Portal

GitHub Pages URL (works after Pages is enabled):
https://techsupportint-dev.github.io/Technical-Support/

A **custom domain** (e.g. `support.credlockng.com`) requires a domain you own.
Nobody can invent a public domain without registering it.

---

## Option 1 — Subdomain of Credlock (recommended)

If you control **credlockng.com** or **credlock.africa**:

Suggested hostnames:
- `support.credlockng.com`
- `portal.credlockng.com`
- `techsupport.credlock.africa`

### A) DNS (at your domain registrar / Cloudflare)

Add a **CNAME** record:

| Type  | Name (host) | Value |
|-------|-------------|--------|
| CNAME | `support`   | `techsupportint-dev.github.io` |

(If the panel asks for a full name, use `support.credlockng.com` → `techsupportint-dev.github.io`.)

Do **not** put `https://` in the DNS value.

### B) GitHub Pages custom domain

1. Open: https://github.com/techsupportint-dev/Technical-Support/settings/pages
2. Under **Custom domain**, enter: `support.credlockng.com`
3. Save — GitHub creates/updates a `CNAME` file in the repo
4. Wait for DNS check (can take a few minutes to 48 hours)
5. Enable **Enforce HTTPS** once the certificate is ready

### C) Repo file (optional, if GitHub did not auto-create it)

Root file `CNAME` with a single line:

```
support.credlockng.com
```

---

## Option 2 — Buy a new domain

Examples: Namecheap, Google Domains / Squarespace, Cloudflare Registrar, GoDaddy.

1. Buy e.g. `credlock-support.com`
2. Point DNS as above (CNAME to `techsupportint-dev.github.io`)
3. Set the same name under **Settings → Pages → Custom domain**

For an **apex** domain (`credlock-support.com` without subdomain), use **A** records to GitHub Pages IPs:

```
185.199.108.153
185.199.109.153
185.199.110.153
185.199.111.153
```

(Plus AAAA records if your DNS supports IPv6 — see GitHub Docs.)

---

## Option 3 — No custom domain yet

Use the free GitHub URL and share with the team:

**https://techsupportint-dev.github.io/Technical-Support/**

Sign-in: `techsupport.int@gmail.com` / PIN `6424`

---

## Checklist

- [ ] GitHub Pages source is **main** / root **or** GitHub Actions workflow
- [ ] DNS CNAME points to `techsupportint-dev.github.io`
- [ ] Custom domain saved in repo Pages settings
- [ ] HTTPS enforced after cert is issued
- [ ] Team uses `https://your-custom-domain/` (not the old github.io link only)
