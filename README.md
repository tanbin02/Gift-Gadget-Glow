# Gift-Gadget-Glow · Invoice & Stock

A fast, mobile-friendly tool for running a small online shop that takes orders through a Facebook page. Pick products, enter the customer's details, and get a clean, branded invoice in seconds. Stock updates itself.

<p align="center">
  <img src="docs/screenshots/invoice-builder.png" alt="Invoice builder with live preview" width="880">
</p>

## Why it exists

Orders arrive as Messenger chats. Writing each invoice by hand is slow, prices get mixed up, and stock counts drift. This tool turns every order into three quick steps and keeps the numbers right.

1. **Enter the customer.** Name, phone number, delivery address.
2. **Pick the products.** Tap items, adjust quantity or price, add delivery and discount.
3. **Send the invoice.** Download it as an image, copy it as text, or print it.

## Features

**Invoices**
- Live preview that updates as you type
- Branded invoice with the shop name, invoice number and date
- Download as an image for Messenger, copy as plain text, or print / save as PDF
- Delivery charge, discount, payment method (COD, bKash, Nagad and more) and an order note
- Per-order price override for negotiated deals

**QR code with product photos**
- Every invoice carries a QR code
- Scanning it shows the products in that order with photo, name, price and quantity
- Combos list the items inside, each with its own photo
- Customers see products only, never personal details

<p align="center">
  <img src="docs/screenshots/invoice-with-qr.png" alt="Finished invoice with QR code" width="360">
  &nbsp;&nbsp;
  <img src="docs/screenshots/customer-view.png" alt="What a customer sees after scanning the QR" width="250">
</p>

**Stock and SKUs**
- Separate SKU groups: **Main**, **Mobile Accessories**, **Gift** and **Combo**
- Rename the groups, pick your own icons, add new ones and reorder them, all from inside the app
- SKU numbers are suggested automatically (`MN-001`, `AC-001`, `GF-001`, `CB-001`)
- Rename categories, pick your own icons and SKU prefixes, add or remove categories, all from inside the app
- Record both the **buy price** and the **sell price** for every product, with the profit per piece shown while you type
- Add a new SKU any time, with a product photo taken from the phone camera or gallery
- Combo products are built from existing SKUs, and selling a combo reduces the stock of every item inside it
- Stock drops automatically when an invoice is created
- Orders that would exceed available stock are blocked
- Low-stock and out-of-stock warnings, plus a quick `± Stock` update for restocking

<p align="center">
  <img src="docs/screenshots/stock.png" alt="Stock overview" width="880">
</p>

**Inventory value and profit**
- Total stock value counted at **buy price**, next to the value at sell price and the potential profit
- Sales, buying cost and **profit** shown separately for today, this month and all time
- Each order keeps the buy price from the day it was sold, so later price changes never rewrite old profit

<p align="center">
  <img src="docs/screenshots/stock-phone.png" alt="Inventory and profit on a phone" width="300">
</p>

**Orders**
- Full order history with search by invoice number, name or phone
- Today's and this month's sales at a glance
- Filter by Confirmed or Cancelled, select several orders and delete them in one go
- Cancelling an order returns its items to stock

**Everyday comfort**
- Settings: light, dark or automatic theme, accent colours, three text sizes, your shop details for the invoice, and an Excel download of inventory and sales
- Works well on a phone, tablet and desktop, in light and dark mode
- Bengali and English throughout
- Your data stays in a Google Sheet that you own

## Built with

Plain HTML, CSS and JavaScript with no build step, so it is easy to host and easy to change.

---

Made for **Gift-Gadget-Glow**.
