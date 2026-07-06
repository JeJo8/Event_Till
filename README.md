# Event Till

A simple one-day event billing app. Runs in the browser, works on iPad/tablet, installable as a home-screen app (PWA). Saves everything to the device — no server, no accounts.

## Features

- Tap-to-add menu with categories
- Editable menu (add/edit/delete categories and items with prices) — changes persist
- Big on-screen number pad (no iPad keyboard popping up)
- Cash change calculation with quick-cash buttons (£10, £20, etc.)
- Cash vs card payment tracking
- Day summary with total, cash total, card total, and order history
- **Nothing lost on refresh** — menu, sales, and current order all restored
- Installable as a PWA on iPad home screen

---

## Local setup (first time)

Requires [Node.js](https://nodejs.org/) 18 or newer.

```bash
npm install
npm run dev
```

Open http://localhost:5173 in your browser. Tap **Menu** in the top-right to add your event's items and prices.

---

## Deploy to GitHub Pages

### 1. Update the base path

Open `vite.config.js` and change this line to match your repo name:

```js
base: '/event-till/',
```

Example: if your repo is `https://github.com/JeJo8/my-till`, use `base: '/my-till/'`.

### 2. Create the GitHub repo

Create an empty repo on GitHub (don't initialize with README). Then in this project folder:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/JeJo8/YOUR-REPO-NAME.git
git push -u origin main
```

### 3. Deploy

```bash
npm run deploy
```

This builds the app and pushes it to a `gh-pages` branch.

### 4. Enable GitHub Pages

- Go to your repo → **Settings** → **Pages**
- Under **Source**, pick branch `gh-pages` and folder `/ (root)`
- Save

Your app will be live at `https://JeJo8.github.io/YOUR-REPO-NAME/` within a minute.

---

## Install on iPad (recommended for events)

Open the deployed URL in Safari on the iPad, then:

1. Tap the **Share** button
2. Tap **Add to Home Screen**
3. Tap **Add**

Now it opens like a native app — full screen, no browser bars, and iOS won't clear the saved data.

---

## Editing the menu

Tap the **Menu** button top-right in the app. Add categories, add items, set prices, save. All changes stick automatically.

---

## Where does data live?

Everything (menu, sales, current order, cash typed) lives in your browser's `localStorage` on that device only. Clearing browser data or uninstalling the PWA will wipe it. There's no cloud sync.

**Before the event**, do a quick test order and check the day summary works. **After the event**, screenshot or note the day summary before hitting "Reset day".

---

## Storage keys (in case of conflicts)

- `billing_menu_v1` — the menu
- `billing_sales_v1` — completed orders
- `billing_current_order_v1` — in-progress order
- `billing_current_cash_v1` — cash typed on the number pad

---

## Tech stack

- Vite + React
- Tailwind CSS v4
- lucide-react (icons)
- vite-plugin-pwa (installable app)
- gh-pages (deploy)
