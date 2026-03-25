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
- [x] Add Winner1.jpg as Finished Boat Example Photo in Build Examples section
- [x] Add IMG_20170704_151324.jpg as 4th gallery slot on Product Detail screen

## Post-Purchase Review Collection (Option 3)
- [x] Redesign review system to be order-based (no sign-in required)
- [x] Add guestReviewToken to orders table for anonymous review access
- [x] Update review schema: replace userId with orderId + email + guestToken
- [x] Update tRPC review.submit to accept orderId + guestToken (no auth required)
- [x] Update tRPC review.myReview to work by orderId (no auth required)
- [x] Build in-app RateProductModal component (star picker + optional text + submit)
- [x] Show RateProductModal on Purchase Success screen after 1.5-second delay
- [x] Add "Rate Your Purchase" button on Purchase Success screen as secondary action
- [x] Set up Resend email service for transactional email
- [x] Add reviewEmailSentAt column to orders table
- [x] Build sendReviewRequestEmail server function (HTML email with review link)
- [x] Build scheduleReviewEmail function: schedules 5-day follow-up for any order
- [x] Wire scheduleReviewEmail into confirmPayment flow (all SKUs)
- [x] write-review.tsx accepts orderId+token params (deep link target from email)
- [x] Test full flow: purchase → in-app prompt → email at day 5 → review submitted

## Captain Bob Chatbot (Premium Feature)
- [x] Add chatEntitlements table to schema
- [x] Add chatMessages table to schema
- [x] Run database migration for chat tables
- [x] Add chat DB functions: createEntitlement, getEntitlementByToken, getEntitlementByOrderId, addMessage, getMessages, incrementMessageCount, extendEntitlement
- [x] Add chat tRPC routes: getEntitlement, sendMessage (with cap enforcement), extendChat (extension SKU purchase)
- [x] Wire createChatEntitlement into confirmPayment for Premium orders
- [x] Add chat_support_extension SKU ($9.99 / 30 days) handled via chat.createExtensionIntent route
- [x] Build Captain Bob chat UI screen (message thread, input bar, status bar)
- [x] Build entitlement status bar (days remaining, messages remaining)
- [x] Build expired/upgrade state UI with extension purchase CTA
- [x] Add Chat tab to tab navigation (Captain Bob tab always visible, gated by credentials)
- [x] Wire extension purchase flow (Stripe intent → confirmExtension → extend entitlement)
- [x] Add OpenAI GPT stub (returns smart demo responses, activates with OPENAI_API_KEY)
- [x] Test full flow: Premium purchase → entitlement created → chat works → cap enforced → extension purchase extends window

## Premium Package Card Updates
- [x] Copy Upgrade.jpg into project assets
- [x] Use Upgrade.jpg as the main image on the Premium Builder Package card
- [x] Update Premium description to "The complete award-winning system plus 30 days of live support."

## Product Content Cleanup
- [x] Update Premium description text
- [x] Remove video tutorial, design hacks, speed optimization from Premium features list
- [x] Remove those same items from Basic features list (they were already marked excluded)
- [x] Remove 30-day money-back guarantee badge from packages screen
- [x] Remove 30-day money-back guarantee from product detail screen

## Premium Detail Screen Hero Image
- [x] Use Upgrade.jpg (product.heroImage) as the hero on the Premium product detail screen

## Image Fixes
- [x] Fix homepage Premium card to show captain-bob-premium.jpg (cache-busted with new filename)
- [x] Fix homepage Basic card preview to show cover2a.jpg (Cardboard Boat Build Plans cover)
- [x] Remove raceday.jpg (shirtless boy) from the Build Examples section on both product detail screens
- [x] raceday.jpg removed from both packages (single shared gallery component)

## Video Tutorial Removal
- [x] Remove Video Tutorial Preview section from Premium product detail screen

## Premium Live Support Highlight
- [x] Bold and visually distinguish the "30 days of live Captain Bob support" feature in the What's Included list
- [x] Add a Captain Bob callout section on the Premium detail screen to emphasize live support as the key upgrade reason

## Checkout No-Refunds Notice
- [x] Add "No refunds on digital downloads" notice to checkout screen before the Pay button

## Homepage Premium Card Callout
- [x] Add Captain Bob "Includes 30-day live support" callout to Premium package card on homepage

## Stripe Payment Sheet Integration
- [x] Install @stripe/stripe-react-native SDK
- [x] Add STRIPE_SECRET_KEY and EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY as secrets
- [x] Update server createPaymentIntent route to use real Stripe API (already built, now returns stripePaymentIntentId)
- [x] Wrap app root with StripeProvider using publishable key
- [x] Replace simulated checkout form with Stripe Payment Sheet
- [x] Support Apple Pay / Google Pay via Payment Sheet (enabled automatically)
- [ ] Test full payment flow with Stripe test cards (use 4242 4242 4242 4242 / any future date / any CVC)

## Stripe Webhook
- [x] Add STRIPE_WEBHOOK_SECRET as a secret (user must add via Secrets panel after creating webhook in Stripe)
- [x] Build POST /webhook endpoint with raw body parsing and Stripe signature verification
- [x] Handle payment_intent.succeeded: fulfill order, create downloads, schedule review email, create chat entitlement (Premium)
- [x] Handle payment_intent.payment_failed: mark order as failed
- [x] Prevent duplicate fulfillment (idempotency guard on order status)

## No Refunds Policy Page
- [x] Create app/no-refunds-policy.tsx screen with full digital download sales policy
- [x] Link "All sales are final" notice in checkout.tsx to the policy screen

## Privacy Policy Page
- [x] Create app/privacy-policy.tsx screen with full privacy policy
- [x] Link privacy policy from checkout footer and home screen footer

## Bundle CDN Images Locally
- [x] Copy wip.png (build-in-progress photo) from CDN to local assets
- [x] Copy race2.jpg (race day action photo) from CDN to local assets
- [x] Update product detail screen to use local require() instead of CDN URIs
