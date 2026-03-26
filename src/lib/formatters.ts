/**
 * Formats numbers into USD string with shorthand suffixes (M, K).
 * - Millions: shown with 2 decimals as requested ("sem arredondar").
 * - Others: shown as integers as requested ("número inteiro").
 */
export const formatUSD = (v: number) => {
    const absV = Math.abs(v);
    if (absV >= 1000000) {
        return `$ ${(v / 1000000).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })}M`;
    }
    if (absV >= 1000) {
        return `$ ${(v / 1000).toLocaleString('en-US', {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1
        })}K`;
    }
    return `$ ${Math.round(v).toLocaleString('en-US')}`;
};

/**
 * Returns a percentage string as integer.
 */
export const formatPct = (v: number) => `${Math.round(v)}%`;
