"use client";

import React, { useState, useMemo } from 'react';
import styles from './Calculator.module.css';

// Standard normal cumulative distribution function
// This is an approximation. For more accuracy, a library might be needed.
const standardNormalCdf = (z: number): number => {
  const p = 0.3275911;
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;

  const sign = z >= 0 ? 1 : -1;
  const t = 1 / (1 + p * Math.abs(z));
  const poly = a1 * t + a2 * Math.pow(t, 2) + a3 * Math.pow(t, 3) + a4 * Math.pow(t, 4) + a5 * Math.pow(t, 5);
  const erf = 1 - poly * Math.exp(-Math.pow(z, 2));

  return 0.5 * (1 + sign * erf);
};


const CalculatorPage = () => {
  const [visitorsA, setVisitorsA] = useState<number | string>('');
  const [conversionsA, setConversionsA] = useState<number | string>('');
  const [visitorsB, setVisitorsB] = useState<number | string>('');
  const [conversionsB, setConversionsB] = useState<number | string>('');

  const results = useMemo(() => {
    const vA = Number(visitorsA);
    const cA = Number(conversionsA);
    const vB = Number(visitorsB);
    const cB = Number(conversionsB);

    if (vA <= 0 || cA < 0 || vB <= 0 || cB < 0 || cA > vA || cB > vB) {
      return null;
    }

    const convRateA = cA / vA;
    const convRateB = cB / vB;
    const uplift = (convRateB - convRateA) / convRateA;

    if (convRateA === 0 && convRateB > 0) {
        // Handle case where control has 0 conversion rate
        return {
            convRateA,
            convRateB,
            uplift: Infinity,
            confidence: null,
            isSignificant: false,
            pValue: null,
        };
    }

    if (convRateA === 0 && convRateB === 0) {
        return {
            convRateA: 0,
            convRateB: 0,
            uplift: 0,
            confidence: null,
            isSignificant: false,
            pValue: null,
        };
    }

    const pooledProb = (cA + cB) / (vA + vB);
    const stdError = Math.sqrt(pooledProb * (1 - pooledProb) * (1 / vA + 1 / vB));
    
    if (stdError === 0) {
        return {
            convRateA,
            convRateB,
            uplift,
            confidence: convRateA === convRateB ? 0.5 : (convRateB > convRateA ? 1 : 0),
            isSignificant: false,
            pValue: convRateA === convRateB ? 1 : 0,
        };
    }
    
    const zScore = (convRateB - convRateA) / stdError;

    // Two-tailed p-value
    const pValue = 2 * (1 - standardNormalCdf(Math.abs(zScore)));
    const confidence = 1 - pValue;
    const isSignificant = confidence >= 0.95;

    return {
      convRateA,
      convRateB,
      uplift,
      confidence,
      isSignificant,
      pValue,
    };
  }, [visitorsA, conversionsA, visitorsB, conversionsB]);

  const formatPercentage = (value: number | null | undefined) => {
    if (value === null || value === undefined) return 'N/A';
    if (value === Infinity) return '∞%';
    return `${(value * 100).toFixed(2)}%`;
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>A/B Test Significance Calculator</h1>
      <div className={styles.grid}>
        <div className={styles.card}>
          <h2>Control (A)</h2>
          <div className={styles.inputGroup}>
            <label htmlFor="visitorsA">Visitors</label>
            <input
              id="visitorsA"
              type="number"
              value={visitorsA}
              onChange={(e) => setVisitorsA(e.target.value)}
              placeholder="e.g., 1000"
            />
          </div>
          <div className={styles.inputGroup}>
            <label htmlFor="conversionsA">Conversions</label>
            <input
              id="conversionsA"
              type="number"
              value={conversionsA}
              onChange={(e) => setConversionsA(e.target.value)}
              placeholder="e.g., 100"
            />
          </div>
          {results && (
            <div className={styles.resultsPreview}>
                <p>Conversion Rate: {formatPercentage(results.convRateA)}</p>
            </div>
          )}
        </div>

        <div className={styles.card}>
          <h2>Variation (B)</h2>
          <div className={styles.inputGroup}>
            <label htmlFor="visitorsB">Visitors</label>
            <input
              id="visitorsB"
              type="number"
              value={visitorsB}
              onChange={(e) => setVisitorsB(e.target.value)}
              placeholder="e.g., 1000"
            />
          </div>
          <div className={styles.inputGroup}>
            <label htmlFor="conversionsB">Conversions</label>
            <input
              id="conversionsB"
              type="number"
              value={conversionsB}
              onChange={(e) => setConversionsB(e.target.value)}
              placeholder="e.g., 120"
            />
          </div>
          {results && (
             <div className={styles.resultsPreview}>
                <p>Conversion Rate: {formatPercentage(results.convRateB)}</p>
            </div>
          )}
        </div>
      </div>

      {results && (
        <div className={styles.results}>
          <h2>Results</h2>
          <div className={styles.resultItem}>
            <span>Uplift</span>
            <span className={styles.resultValue}>{formatPercentage(results.uplift)}</span>
          </div>
          <div className={styles.resultItem}>
            <span>Confidence</span>
            <span
              className={`${styles.resultValue} ${
                results.isSignificant ? styles.significant : styles.notSignificant
              }`}
            >
              {formatPercentage(results.confidence)}
            </span>
          </div>
          {results.isSignificant ? (
              <p className={styles.summary}>The change is statistically significant.</p>
          ) : (
            <p className={styles.summary}>The change is not statistically significant.</p>
          )}
        </div>
      )}
    </div>
  );
};

export default CalculatorPage;
