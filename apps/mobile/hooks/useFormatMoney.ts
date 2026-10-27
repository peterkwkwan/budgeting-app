import { useCallback, useMemo } from 'react';

import type { AccountCurrency } from '@/constants/currencies';
import { useAuth } from '@/lib/auth';
import { profileCurrency } from '@/lib/currency';
import { formatCompactMoney, formatMoney } from '@/lib/money';

/** Bound formatters for the signed-in account currency (default HKD). */
export function useFormatMoney() {
  const { profile } = useAuth();
  const currency: AccountCurrency = profileCurrency(profile);

  const format = useCallback(
    (amount: number) => formatMoney(amount, currency),
    [currency]
  );
  /** Whole currency units — Stats By category totals / list. */
  const formatWhole = useCallback(
    (amount: number) => formatMoney(amount, currency, { whole: true }),
    [currency]
  );
  const formatCompact = useCallback(
    (amount: number) => formatCompactMoney(amount, currency),
    [currency]
  );

  return useMemo(
    () => ({ currency, format, formatWhole, formatCompact }),
    [currency, format, formatWhole, formatCompact]
  );
}
