import { useInactivityTimeout } from "@/hooks/useInactivityTimeout";

const InactivityGuard = () => {
  useInactivityTimeout();
  return null;
};

export default InactivityGuard;
