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

## Reviews & Ratings Feature
- [x] Add reviews table to drizzle schema
- [x] Run database migration for reviews table
- [x] Create tRPC API: submit review (verified purchasers only)
- [x] Create tRPC API: list reviews by product tier (public)
- [x] Create tRPC API: get user's own review for a product
- [x] Create tRPC API: delete/edit own review
- [x] Build StarRatingPicker component (interactive 1–5 stars)
- [x] Build StarRatingDisplay component (read-only stars)
- [x] Build ReviewCard component (avatar, name, stars, date, text)
- [x] Build ReviewsList component (sorted by date, paginated)
- [x] Build WriteReview screen/modal (star picker + text input + submit)
- [x] Add "Write a Review" button in My Downloads (verified purchasers only)
- [x] Integrate ReviewsList into Product Detail screen
- [x] Integrate average rating + count into Product Detail header
- [x] Integrate average rating + count into Packages screen cards
- [x] Show "Verified Purchase" badge on reviews from real buyers
- [x] Handle duplicate review prevention (one per user per product)
- [x] Add review count to Home screen product cards

## Content Updates
- [x] Add hero1.jpg to app assets and replace Home screen hero placeholder
- [x] Replace Product Detail hero image placeholder with hero1.jpg
- [x] Remove blue header bar from Home screen; hero image fills top edge-to-edge
- [x] Fix hero image clipping — show full photo without cropping edges
- [x] Remove "Cardboard Boat Builder" text overlay from hero image
- [x] Add boatplans1.jpg as Basic Plans card preview image on Home and Product Detail screens
- [x] Update tagline badge to "Competition-Tested Plan"
- [x] Update Home screen body paragraph with new copy
- [x] Apply dark navy blue (#1a3a5c) to all section header text across all screens
- [x] Bold the How It Works step titles in dark navy blue
- [x] Add copyright footer to bottom of Home screen

## SKU 1 — Builder Plan Package
- [x] Copy boat1.png to app assets and replace Basic card image placeholder
- [x] Upload BuilderPlan.pdf to server file storage
- [x] Update product name to "Builder Plan Package"
- [x] Update Basic package tagline, price ($19.99), and feature list
- [x] Wire BuilderPlan.pdf URL to post-purchase download delivery
- [x] Replace Builder Plan Package card image with Cover2A.jpg on Home and Product Detail screens
- [x] Add WIP.png (build-in-progress) to gallery slot 2 on Product Detail screen
- [x] Add manus1.webp (finished red boat) to gallery slot 3 on Product Detail screen
- [x] Add FB_IMG_12.jpg as Race Day Action Photo in Build Examples section
