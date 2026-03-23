export type ProductTier = 'basic' | 'premium';

export interface ProductFeature {
  text: string;
  included: boolean;
}

export interface Product {
  id: ProductTier;
  name: string;
  tagline: string;
  price: number;
  priceDisplay: string;
  description: string;
  features: ProductFeature[];
  badge?: string;
  color: string;
}

export const PRODUCTS: Record<ProductTier, Product> = {
  basic: {
    id: 'basic',
    name: 'Builder Plan Package',
    tagline: 'Weekend-ready. Competition-proven.',
    price: 1999, // cents
    priceDisplay: '$19.99',
    description:
      'Everything you need to build a fast, durable, award-winning cardboard boat — even if you have never built one before. Our fully illustrated plans walk you through every cut and fold with exact panel templates so there is no guesswork. Beginner-friendly and fast: most builders finish in a single weekend.',
    features: [
      { text: 'Fully illustrated step-by-step build diagrams', included: true },
      { text: 'Exact panel cut templates', included: true },
      { text: 'Beginner-friendly design', included: true },
      { text: 'Fast build — weekend ready', included: true },
      { text: 'Video tutorial series (6 videos)', included: false },
      { text: 'Advanced design hacks', included: false },
      { text: 'Speed optimization secrets', included: false },
      { text: 'Priority email support', included: false },
    ],
    color: '#1B6CA8',
  },
  premium: {
    id: 'premium',
    name: 'Premium Builder Package',
    tagline: 'The complete award-winning system',
    price: 3999, // cents
    priceDisplay: '$39.99',
    description:
      'The ultimate cardboard boat building system. Everything in the Basic package PLUS an exclusive video tutorial series, advanced design hacks used by championship winners, and speed optimization secrets. This is the complete system for serious competitors.',
    features: [
      { text: 'Full-size PDF plan set (12 pages)', included: true },
      { text: 'Materials & tools checklist', included: true },
      { text: 'Step-by-step construction guide', included: true },
      { text: 'Hull design templates', included: true },
      { text: 'Waterproofing techniques guide', included: true },
      { text: 'Competition tips & rules overview', included: true },
      { text: 'Video tutorial series (6 videos)', included: true },
      { text: 'Advanced design hacks', included: true },
      { text: 'Speed optimization secrets', included: true },
      { text: 'Priority email support', included: true },
    ],
    badge: 'Best Value',
    color: '#F4A020',
  },
};

export const TESTIMONIALS = [
  {
    id: '1',
    name: 'Mike T.',
    location: 'Columbus, OH',
    rating: 5,
    text: 'Used these plans at our city regatta and took first place! The instructions are incredibly clear.',
  },
  {
    id: '2',
    name: 'Sarah K.',
    location: 'Portland, OR',
    rating: 5,
    text: 'The premium package was worth every penny. The video tutorials made it so easy to follow along.',
  },
  {
    id: '3',
    name: 'James R.',
    location: 'Austin, TX',
    rating: 5,
    text: 'My kids and I built our first boat using these plans. We finished the race and the boat held together perfectly!',
  },
];
