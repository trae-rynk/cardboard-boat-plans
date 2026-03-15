# Cardboard Boat Builder — Mobile App Design Plan

## App Concept
A mobile storefront for selling digital cardboard boat building plans. Two product tiers:
- **Basic Package** — Downloadable PDF plans set ($19.99)
- **Premium Package** — PDF plans + instructional video series + expanded design hacks ($39.99)

---

## Brand & Color Palette

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `primary` | `#1B6CA8` | `#3B9FE0` | CTA buttons, links, highlights |
| `background` | `#F8F9FA` | `#0F1923` | Screen backgrounds |
| `surface` | `#FFFFFF` | `#1A2535` | Cards, modals |
| `foreground` | `#0D1B2A` | `#E8EDF2` | Primary text |
| `muted` | `#6B7C93` | `#8FA3BB` | Secondary text, captions |
| `border` | `#D6E0EA` | `#2A3D52` | Dividers, card borders |
| `accent` | `#F4A020` | `#F4A020` | Badges, "Best Value" labels |
| `success` | `#22C55E` | `#4ADE80` | Purchase confirmed, download ready |
| `error` | `#EF4444` | `#F87171` | Payment errors |

**Typography:** System font (SF Pro on iOS, Roboto on Android). Bold headers, medium body.

**Visual Style:** Nautical/maritime feel — deep navy blues, warm amber accents. Clean cards with subtle shadows. Hero images of cardboard boats racing on water.

---

## Screen List

### Tab 1: Home (Store)
- Hero banner with boat image placeholder
- App tagline: "Build an Award-Winning Cardboard Boat"
- Quick intro paragraph about the product
- Two product cards (Basic & Premium) with "View Details" CTA
- Testimonials / social proof section
- "How It Works" 3-step section

### Tab 2: Packages (Pricing)
- Header with title "Choose Your Package"
- Side-by-side or stacked package cards
- Feature comparison list per package
- "Best Value" badge on Premium
- Large CTA buttons: "Get Basic" / "Get Premium"
- Money-back guarantee note

### Tab 3: My Downloads
- Empty state when no purchases
- List of purchased items with download status
- Download button / progress indicator per item
- Re-download capability
- Order history with date and amount

### Modal Screens (not tabs):
- **Product Detail Screen** — Full description, feature list, gallery placeholders, video preview placeholder, CTA
- **Checkout Screen** — Order summary, price, Stripe payment form (card input)
- **Payment Processing Screen** — Loading/spinner state
- **Purchase Success Screen** — Confirmation, download button, confetti animation
- **Download Progress Screen** — Progress bar for file download

---

## Primary Content Per Screen

### Home Screen
- Hero image placeholder (1200×600px boat race photo)
- Tagline headline (bold, large)
- 2 product preview cards with thumbnail placeholders
- 3-step "How It Works" icons + text
- Star rating / testimonial quote

### Packages Screen
- Package cards with:
  - Package name + price
  - Feature bullet list (checkmarks)
  - "Best Value" badge (Premium only)
  - CTA button
- Feature comparison table (optional expandable)

### Product Detail Screen
- Large hero image placeholder (full-width)
- Product name + price badge
- Description paragraphs
- Feature list with icons
- Image gallery row (3 placeholder thumbnails)
- Video preview placeholder (Premium only)
- Sticky bottom CTA bar with price + Buy button

### Checkout Screen
- Order summary card (product name, price)
- Stripe card input (number, expiry, CVC)
- Billing name field
- "Pay Now" button with lock icon
- Secure payment badge

### Purchase Success Screen
- Large checkmark animation
- "Purchase Complete!" heading
- Order ID
- "Download Now" primary button
- "View My Downloads" secondary link

### My Downloads Screen
- Purchased item cards with:
  - Product name + tier badge
  - Purchase date
  - Download button (PDF / ZIP)
  - Video access button (Premium)
  - Re-download option

---

## Key User Flows

### Flow 1: Browse → Purchase Basic
1. Home tab → tap "View Details" on Basic card
2. Product Detail screen → scroll features → tap "Buy Now — $19.99"
3. Checkout screen → enter card details → tap "Pay Now"
4. Payment Processing screen (spinner)
5. Purchase Success screen → tap "Download Now"
6. File downloads to device → success toast

### Flow 2: Browse → Purchase Premium
1. Packages tab → tap "Get Premium — $39.99"
2. Checkout screen → enter card details → tap "Pay Now"
3. Purchase Success screen → tap "Download Now"
4. Downloads screen shows PDF + Video access

### Flow 3: Re-download
1. My Downloads tab → find order
2. Tap "Download Again" → file saves to device

---

## Navigation Structure

```
TabBar
├── Home (house.fill)
├── Packages (tag.fill)
└── My Downloads (arrow.down.circle.fill)

Modal Stack (presented over tabs)
├── ProductDetail
├── Checkout
├── PaymentProcessing
└── PurchaseSuccess
```

---

## Layout Notes
- All screens use `ScreenContainer` with proper safe area handling
- Sticky bottom bars for CTAs on product/checkout screens
- `FlatList` for downloads list
- `ScrollView` for long product detail and home screens
- Cards use 16px border radius, subtle shadow
- Image placeholders use dashed border with camera icon + "Add Photo" label
