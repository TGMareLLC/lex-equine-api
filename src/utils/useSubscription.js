import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Purchases } from "@revenuecat/purchases-capacitor";

export default function useSubscription(userAccess) {
  const [isActive, setIsActive] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const checkSubscription = async () => {
      try {
        if (userAccess === null) {
          if (!cancelled) {
            setIsActive(false);
            setLoading(false);
          }
          return;
        }

        const now = Date.now();
        const override = !!userAccess.subscriptionOverride;
        const trialEndsAt = Number(userAccess.trialEndsAt || 0);
        const inTrial = trialEndsAt > now;

        let hasRevenueCatAccess = false;

        if (Capacitor.getPlatform() === "ios") {
          const customerInfo = await Purchases.getCustomerInfo();

          console.log("REVENUECAT CUSTOMER INFO:", customerInfo);

          hasRevenueCatAccess =
            !!customerInfo?.customerInfo?.entitlements?.active?.premium ||
            !!customerInfo?.entitlements?.active?.premium;
        }

        if (!cancelled) {
          setIsActive(override || inTrial || hasRevenueCatAccess);
          setLoading(false);
        }
      } catch (e) {
        console.log("SUBSCRIPTION CHECK ERROR:", e);

        const now = Date.now();
        const override = !!userAccess?.subscriptionOverride;
        const trialEndsAt = Number(userAccess?.trialEndsAt || 0);
        const inTrial = trialEndsAt > now;

        if (!cancelled) {
          setIsActive(override || inTrial);
          setLoading(false);
        }
      }
    };

    checkSubscription();

    return () => {
      cancelled = true;
    };
  }, [userAccess]);

  return { isActive, loading };
}