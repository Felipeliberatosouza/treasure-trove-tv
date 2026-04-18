import { loadStripe, type Stripe } from "@stripe/stripe-js";

// Publishable key — safe to be in source code (not secret).
const STRIPE_PUBLISHABLE_KEY =
  "pk_live_51TNX9jRrzH8KdcmH2Ek3S28FciAXZO4fvCyG59hq7KqAtiNJZU5BvS65UcfA05x5cdAHVLEH5Bsg4vODhxK8uagL00o7n1fHx1";

let stripePromise: Promise<Stripe | null> | null = null;

export const getStripe = () => {
  if (!stripePromise) {
    stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY);
  }
  return stripePromise;
};
