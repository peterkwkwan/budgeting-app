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
  const formatCompact = useCallback(
    (amount: number) => formatCompactMoney(amount, currency),
    [currency]
  );

  return useMemo(
    () => ({ currency, format, formatCompact }),
    [currency, format, formatCompact]
  );
}
