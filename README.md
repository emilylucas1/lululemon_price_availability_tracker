# 🛍️ Lululemon Sale & Size Tracker

Get a Gmail alert whenever a Lululemon item you want drops in price or becomes available in your size. Runs free on GitHub Actions — no server needed.

---

## How It Works

- Checks your listed product URLs on a schedule (default: every hour)
- Looks for your specific sizes being in stock
- Compares the price against your threshold
- Sends you a Gmail alert **only when something changes** (won't spam you)

---

## Setup (takes ~10 minutes)

### Step 1 — Fork / create this repo on GitHub

1. Go to [github.com](https://github.com) and create a free account if you don't have one
2. Create a new **private** repository (private = your email creds stay safe)
3. Upload all these files to the repo, keeping the folder structure:
   ```
   your-repo/
   ├── tracker.py
   ├── products.json
   └── .github/
       └── workflows/
           └── tracker.yml
   ```

### Step 2 — Create a Gmail App Password

> You need an App Password (not your regular Gmail password) for secure SMTP access.

1. Go to your Google Account → **Security**
2. Make sure **2-Step Verification** is ON
3. Search for "App Passwords" in the search bar
4. Create a new App Password → name it "Lululemon Tracker"
5. Copy the 16-character password (looks like: `xxxx xxxx xxxx xxxx`)

### Step 3 — Add GitHub Secrets

1. In your GitHub repo, go to **Settings → Secrets and variables → Actions**
2. Click **New repository secret** and add these three:

| Secret Name     | Value                                      |
|-----------------|--------------------------------------------|
| `GMAIL_USER`    | Your Gmail address (e.g. you@gmail.com)    |
| `GMAIL_APP_PASS`| The 16-char App Password from Step 2       |
| `ALERT_EMAIL`   | Where to send alerts (can be same as above)|

### Step 4 — Edit `products.json`

Replace the example items with the products you want to track:

```json
[
  {
    "name": "Align High-Rise Pant 25\" - Black",
    "url": "https://www.lululemon.com/en-us/p/align-high-rise-pant-25/...",
    "sizes": ["4", "6"],
    "max_price": 79.00
  }
]
```

**Fields:**
- `name` — Just a label for your alert email (anything you want)
- `url` — The full Lululemon product URL (copy from your browser)
- `sizes` — Your size(s). Use the exact size labels shown on the site: `"4"`, `"6"`, `"XS"`, `"S"`, `"M"`, etc.
- `max_price` — Alert only if price is AT or BELOW this amount. Set to `null` to alert whenever your size is available at any price.

### Step 5 — Test it manually

1. In your GitHub repo, go to **Actions → Lululemon Sale Tracker**
2. Click **Run workflow**
3. Watch the logs — you'll see what sizes/prices were found
4. If your criteria match, you'll get an email within a minute!

---

## Customizing the Schedule

The tracker runs every hour by default. To change this, edit the `cron` line in `.github/workflows/tracker.yml`:

```yaml
- cron: "0 * * * *"      # every hour (default)
- cron: "0 */2 * * *"    # every 2 hours
- cron: "0 16 * * 4"     # Thursdays at 11am ET (restock day!)
- cron: "0 9,16 * * *"   # twice a day at 9am and 4pm UTC
```

> 💡 **Tip:** Lululemon's "We Made Too Much" section updates **every Thursday at 11am ET** (16:00 UTC). Consider running more frequently on Thursdays.

---

## Troubleshooting

**No email received?**
- Check GitHub Actions logs (Actions tab → click the latest run) for errors
- Make sure your 3 Secrets are set correctly (no extra spaces)
- Gmail App Password must be exactly 16 characters with no spaces

**Sizes not detected?**
- Lululemon occasionally updates their website structure. Open an issue or re-run to check logs.
- Make sure you're using the exact size text from the site (e.g. `"6"` not `"size 6"`)

**Getting too many alerts?**
- The tracker only alerts on *changes*. If you're getting many, it means availability is fluctuating. Narrow your `max_price`.

---

## Files

| File | Purpose |
|------|---------|
| `tracker.py` | Main script — scrapes Lululemon, checks criteria, sends email |
| `products.json` | **Edit this** to add/remove tracked items |
| `.github/workflows/tracker.yml` | GitHub Actions schedule config |
| `last_state.json` | Auto-generated — tracks previous state to avoid duplicate alerts |
