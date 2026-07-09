import { loadStripe, type Stripe } from "@stripe/stripe-js";

// Publishable key — safe to be in source code (not secret).
const STRIPE_PUBLISHABLE_KEY =
  "pk_test_51TNX9jRrzH8KdcmHxbY2gTnmeMm4agf0NLOPofV3pCVZbGM2lYTgB6V4eqLgMSQrVRRMUEsH2uK2JyqoiViSv6bh00hPfk18wQ";

let stripePromise: Promise<Stripe | null> | null = null;

export const getStripe = () => {
  if (!stripePromise) {
    stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY);
  }
  return stripePromise;
};
