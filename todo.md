# Cardboard Boat Builder — TODO

## Branding & Theme
- [x] Update theme colors (nautical navy + amber)
- [x] Generate app logo/icon
- [x] Update app.config.ts with name and logo

## Navigation & Structure
- [x] Configure 3-tab navigation (Home, Packages, My Downloads)
- [x] Add icon mappings for all tabs
- [x] Set up modal stack for Product Detail, Checkout, Success screens

## Home Screen
- [x] Hero banner with image placeholder
- [x] Tagline and intro text
- [x] Two product preview cards
- [x] "How It Works" 3-step section
- [x] Testimonials/social proof section

## Packages Screen
- [x] Package cards (Basic + Premium) with pricing
- [x] Feature comparison list per package
- [x] "Best Value" badge on Premium
- [x] CTA buttons linking to checkout

## Product Detail Screen
- [x] Full-width hero image placeholder
- [x] Product name, price, description
- [x] Feature list with checkmark icons
- [x] Image gallery row (3 placeholders)
- [x] Video preview placeholder (Premium only)
- [x] Sticky bottom CTA bar

## Backend & Database
- [x] Define orders table in drizzle schema
- [x] Define downloads table in drizzle schema
- [x] Run database migration
- [x] Create order management API routes (tRPC)
- [x] Create download token/URL generation API
- [x] Integrate Stripe payment intent creation
- [x] Handle Stripe webhook for payment confirmation
- [x] Store product file URLs (PDF, video links)

## Checkout Screen
- [x] Order summary card
- [x] Stripe card input (manual card form, Stripe SDK integration ready)
- [x] Billing name field
- [x] "Pay Now" button with loading state
- [x] Error handling for failed payments

## Purchase Success Screen
- [x] Success animation / checkmark
- [x] Order confirmation details
- [x] "Download Now" primary button
- [x] "View My Downloads" link

## My Downloads Screen
- [x] Empty state (no purchases yet)
- [x] Purchased items list
- [x] Download button with progress indicator
- [x] Re-download capability
- [x] Video access button (Premium)
- [x] Order history with date and amount

## Polish & UX
- [x] Image placeholder components with dashed border + camera icon
- [x] Loading states on all async actions
- [x] Error states and toast notifications
- [x] Haptic feedback on key actions
- [ ] Smooth transitions between screens
