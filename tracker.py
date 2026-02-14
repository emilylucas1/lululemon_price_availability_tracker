"""
Lululemon Size & Sale Tracker
Checks product pages for your size + price threshold, sends Gmail alerts.
"""

import json
import os
import smtplib
import time
from dataclasses import dataclass
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

import requests
from bs4 import BeautifulSoup

# ── Config ────────────────────────────────────────────────────────────────────

PRODUCTS_FILE = "products.json"   # edit this file to add/remove items
STATE_FILE    = "last_state.json" # auto-managed; tracks previous prices/availability

# Gmail credentials come from environment variables (set as GitHub Secrets)
GMAIL_USER     = os.environ.get("GMAIL_USER", "")       # your Gmail address
GMAIL_APP_PASS = os.environ.get("GMAIL_APP_PASS", "")   # Gmail App Password
ALERT_EMAIL    = os.environ.get("ALERT_EMAIL", GMAIL_USER)  # where to send alerts

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
}

# ── Data classes ───────────────────────────────────────────────────────────────

@dataclass
class Product:
    name: str
    url: str
    sizes: list[str]           # e.g. ["4", "6"] or ["XS", "S"]
    colors: list[str]          # preferred colors, for reference in email alerts
    max_price: Optional[float] # alert if price <= this (None = alert on any sale)


@dataclass
class ProductState:
    available_sizes: list[str]
    price: Optional[float]


# ── Load config ────────────────────────────────────────────────────────────────

def load_products() -> list[Product]:
    with open(PRODUCTS_FILE) as f:
        data = json.load(f)
    return [
        Product(
            name=p["name"],
            url=p["url"],
            sizes=p["sizes"],
            colors=p.get("colors") or [],
            max_price=p.get("max_price"),
        )
        for p in data
    ]


def load_state() -> dict:
    if os.path.exists(STATE_FILE):
        with open(STATE_FILE) as f:
            return json.load(f)
    return {}


def save_state(state: dict):
    with open(STATE_FILE, "w") as f:
        json.dump(state, f, indent=2)


# ── Scraping ───────────────────────────────────────────────────────────────────

def fetch_product_info(product: Product) -> ProductState:
    """
    Scrapes a Lululemon product page and returns available sizes + price.
    Lululemon renders product data in a JSON blob inside a <script> tag.
    """
    try:
        resp = requests.get(product.url, headers=HEADERS, timeout=15)
        resp.raise_for_status()
    except requests.RequestException as e:
        print(f"  ⚠️  Failed to fetch {product.name}: {e}")
        return ProductState(available_sizes=[], price=None)

    soup = BeautifulSoup(resp.text, "html.parser")

    # Lululemon embeds product JSON in a <script id="__NEXT_DATA__"> tag
    script_tag = soup.find("script", {"id": "__NEXT_DATA__"})

    available_sizes: list[str] = []
    price: Optional[float] = None

    if script_tag:
        try:
            next_data = json.loads(script_tag.string)
            # Navigate the Next.js page props to find product data
            page_props = (
                next_data.get("props", {})
                         .get("pageProps", {})
            )

            # Try to get product details from various possible locations
            product_data = (
                page_props.get("productData") or
                page_props.get("product") or
                page_props.get("initialData", {}).get("product")
            )

            if product_data:
                # Extract price
                price_raw = (
                    product_data.get("price") or
                    product_data.get("priceRange", {}).get("min")
                )
                if price_raw is not None:
                    price = float(str(price_raw).replace("$", "").strip())

                # Extract available sizes from SKUs / variants
                skus = (
                    product_data.get("skus") or
                    product_data.get("variants") or
                    []
                )
                for sku in skus:
                    availability = (
                        sku.get("availability") or
                        sku.get("inventoryStatus") or ""
                    ).lower()
                    size_val = (
                        sku.get("size") or
                        sku.get("attributes", {}).get("size") or ""
                    )
                    if size_val and availability not in ("out_of_stock", "unavailable", "soldout", "0"):
                        available_sizes.append(str(size_val).strip())

        except (json.JSONDecodeError, AttributeError, KeyError) as e:
            print(f"  ⚠️  JSON parse error for {product.name}: {e}")

    # Fallback: parse visible size buttons from HTML
    if not available_sizes:
        available_sizes = _scrape_sizes_from_html(soup)

    # Fallback: parse visible price from HTML
    if price is None:
        price = _scrape_price_from_html(soup)

    print(f"  📦 {product.name}: sizes={available_sizes} price=${price}")
    return ProductState(available_sizes=available_sizes, price=price)


def _scrape_sizes_from_html(soup: BeautifulSoup) -> list[str]:
    """Fallback: find size buttons that aren't marked as sold-out."""
    sizes = []
    # Lululemon uses various class patterns for size swatches
    for btn in soup.find_all(["button", "li"], class_=lambda c: c and "size" in c.lower()):
        text = btn.get_text(strip=True)
        disabled = btn.get("disabled") or btn.get("aria-disabled") == "true"
        sold_out_class = any("sold" in str(c).lower() or "unavailable" in str(c).lower()
                             for c in btn.get("class", []))
        if text and not disabled and not sold_out_class:
            sizes.append(text)
    return sizes


def _scrape_price_from_html(soup: BeautifulSoup) -> Optional[float]:
    """Fallback: find the first price-looking element."""
    for tag in soup.find_all(["span", "div", "p"]):
        text = tag.get_text(strip=True)
        if text.startswith("$") and text[1:].replace(".", "").isdigit():
            try:
                return float(text[1:])
            except ValueError:
                pass
    return None


# ── Alert logic ────────────────────────────────────────────────────────────────

def should_alert(product: Product, state: ProductState, prev_state: Optional[dict]) -> tuple[bool, str]:
    """Returns (should_alert, reason_string)."""

    # Check if any wanted size is available
    wanted_and_available = [s for s in product.sizes if s in state.available_sizes]
    if not wanted_and_available:
        return False, "No wanted sizes available"

    # Check price threshold
    if product.max_price is not None and state.price is not None:
        if state.price > product.max_price:
            return False, f"Price ${state.price} > threshold ${product.max_price}"
        price_ok = True
    else:
        price_ok = True  # no price filter set

    # Avoid re-alerting for same state (only alert on *changes*)
    if prev_state:
        prev_sizes = set(prev_state.get("available_sizes", []))
        prev_price = prev_state.get("price")
        curr_sizes = set(wanted_and_available)

        new_sizes = curr_sizes - prev_sizes
        price_dropped = (
            state.price is not None and
            prev_price is not None and
            state.price < prev_price
        )

        if not new_sizes and not price_dropped:
            return False, "No change since last check"

    reasons = []
    if wanted_and_available:
        reasons.append(f"Size(s) {', '.join(wanted_and_available)} now available")
    if state.price is not None:
        reasons.append(f"Price: ${state.price:.2f}")

    return True, " · ".join(reasons)


# ── Email ──────────────────────────────────────────────────────────────────────

def send_alert_email(product: Product, state: ProductState, reason: str):
    if not GMAIL_USER or not GMAIL_APP_PASS:
        print(f"  📧 [DRY RUN] Would email alert for: {product.name} — {reason}")
        return

    subject = f"🛍️ Lululemon Alert: {product.name} is available!"

    body_html = f"""
    <html><body style="font-family:sans-serif;max-width:600px;margin:auto">
      <h2 style="color:#8B1A4A">🛍️ Lululemon Alert!</h2>
      <p><strong>{product.name}</strong> matches your criteria:</p>
      <ul>
        <li><strong>Available sizes:</strong> {', '.join([s for s in product.sizes if s in state.available_sizes])}</li>
        <li><strong>Current price:</strong> {'$'+f'{state.price:.2f}' if state.price else 'N/A'}</li>
        {'<li><strong>Your max price:</strong> $'+f'{product.max_price:.2f}</li>' if product.max_price else ''}
        {'<li><strong>Your preferred colors:</strong> '+', '.join(product.colors)+'</li>' if product.colors else ''}
        <li><strong>Reason:</strong> {reason}</li>
      </ul>
      <p><a href="{product.url}" style="background:#8B1A4A;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;margin-top:8px">
        View on Lululemon →
      </a></p>
      <p style="color:#888;font-size:12px;margin-top:24px">
        You're receiving this because you set up a Lululemon tracker.
        Use the tracker UI to update your wishlist, then re-export products.json.
      </p>
    </body></html>
    """

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = GMAIL_USER
    msg["To"]      = ALERT_EMAIL
    msg.attach(MIMEText(body_html, "html"))

    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as smtp:
            smtp.login(GMAIL_USER, GMAIL_APP_PASS)
            smtp.sendmail(GMAIL_USER, ALERT_EMAIL, msg.as_string())
        print(f"  ✅ Alert email sent for {product.name}")
    except smtplib.SMTPException as e:
        print(f"  ❌ Failed to send email: {e}")


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    print("🔍 Lululemon Tracker starting…\n")
    products = load_products()
    prev_states = load_state()
    new_states = {}

    for product in products:
        print(f"Checking: {product.name}")
        state = fetch_product_info(product)
        prev = prev_states.get(product.url)

        alert, reason = should_alert(product, state, prev)

        if alert:
            print(f"  🚨 ALERT: {reason}")
            send_alert_email(product, state, reason)
        else:
            print(f"  ✓  No alert: {reason}")

        new_states[product.url] = {
            "available_sizes": state.available_sizes,
            "price": state.price,
        }

        time.sleep(2)  # be polite between requests

    save_state(new_states)
    print("\n✅ Done.")


if __name__ == "__main__":
    main()
