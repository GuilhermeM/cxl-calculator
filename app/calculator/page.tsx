"use client";

import React, { useState, useMemo } from 'react';
import styles from './Calculator.module.css';

// --- UTILITY FUNCTIONS ---

// Standard normal cumulative distribution function (for Z-score to p-value)
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

const formatPercentage = (value: number | null | undefined) => {
    if (value === null || value === undefined || isNaN(value)) return 'N/A';
    if (value === Infinity) return '∞%';
    return `${(value * 100).toFixed(2)}%`;
};


// --- MODE 1: TEST ANALYSIS ---

const TestAnalysis = () => {
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

        if (convRateA === 0) {
            return {
                convRateA, convRateB,
                uplift: convRateB > 0 ? Infinity : 0,
                confidence: null, isSignificant: false, pValue: null,
            };
        }

        const pooledProb = (cA + cB) / (vA + vB);
        const stdError = Math.sqrt(pooledProb * (1 - pooledProb) * (1 / vA + 1 / vB));

        if (stdError === 0) {
             return {
                convRateA, convRateB, uplift,
                confidence: convRateA === convRateB ? 0.5 : (convRateB > convRateA ? 1 : 0),
                isSignificant: false,
                pValue: convRateA === convRateB ? 1 : 0,
            };
        }

        const zScore = (convRateB - convRateA) / stdError;
        const pValue = 2 * (1 - standardNormalCdf(Math.abs(zScore)));
        const confidence = 1 - pValue;
        const isSignificant = confidence >= 0.95;

        return { convRateA, convRateB, uplift, confidence, isSignificant, pValue };
    }, [visitorsA, conversionsA, visitorsB, conversionsB]);

    return (
        <>
            <div className={styles.grid}>
                <div className={styles.card}>
                    <h2>Control (A)</h2>
                    <div className={styles.inputGroup}>
                        <label htmlFor="visitorsA">Visitors</label>
                        <input id="visitorsA" type="number" value={visitorsA} onChange={(e) => setVisitorsA(e.target.value)} placeholder="e.g., 1000" />
                    </div>
                    <div className={styles.inputGroup}>
                        <label htmlFor="conversionsA">Conversions</label>
                        <input id="conversionsA" type="number" value={conversionsA} onChange={(e) => setConversionsA(e.target.value)} placeholder="e.g., 100" />
                    </div>
                    {results && <div className={styles.resultsPreview}><p>Conversion Rate: {formatPercentage(results.convRateA)}</p></div>}
                </div>

                <div className={styles.card}>
                    <h2>Variation (B)</h2>
                    <div className={styles.inputGroup}>
                        <label htmlFor="visitorsB">Visitors</label>
                        <input id="visitorsB" type="number" value={visitorsB} onChange={(e) => setVisitorsB(e.target.value)} placeholder="e.g., 1000" />
                    </div>
                    <div className={styles.inputGroup}>
                        <label htmlFor="conversionsB">Conversions</label>
                        <input id="conversionsB" type="number" value={conversionsB} onChange={(e) => setConversionsB(e.target.value)} placeholder="e.g., 120" />
                    </div>
                    {results && <div className={styles.resultsPreview}><p>Conversion Rate: {formatPercentage(results.convRateB)}</p></div>}
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
                        <span className={`${styles.resultValue} ${results.isSignificant ? styles.significant : styles.notSignificant}`}>
                            {formatPercentage(results.confidence)}
                        </span>
                    </div>
                    {results.confidence !== null && (
                         <p className={styles.summary}>{results.isSignificant ? 'The change is statistically significant.' : 'The change is not statistically significant.'}</p>
                    )}
                </div>
            )}
        </>
    );
};


// --- MODE 2: PRE-TEST ANALYSIS ---

const PreTestAnalysis = () => {
    const [weeklyTraffic, setWeeklyTraffic] = useState<number | string>('');
    const [weeklyConversions, setWeeklyConversions] = useState<number | string>('');

    const preTestResults = useMemo(() => {
        const traffic = Number(weeklyTraffic);
        const conversions = Number(weeklyConversions);

        if (traffic <= 0 || conversions < 0 || conversions > traffic) {
            return null;
        }

        const baselineConvRate = conversions / traffic;
        if (baselineConvRate === 0 || baselineConvRate === 1) return [];

        const results = [];
        // Z-scores for 95% confidence (alpha=0.05) and 80% power (beta=0.20)
        const Z_ALPHA = 1.96;
        const Z_BETA = 0.84;

        for (let weeks = 1; weeks <= 6; weeks++) {
            const totalTrafficPerVariation = (traffic * weeks) / 2;
            
            // Formula for MDE: MDE = sqrt( (Z_alpha + Z_beta)^2 * (p1(1-p1) + p2(1-p2)) / n ) / p1
            // We can approximate p1 ~= p2 for calculation
            const MDE = (Z_ALPHA + Z_BETA) / baselineConvRate * Math.sqrt((2 * baselineConvRate * (1 - baselineConvRate)) / totalTrafficPerVariation);

            results.push({
                weeks,
                mde: MDE,
            });
        }
        return results;

    }, [weeklyTraffic, weeklyConversions]);

    return (
        <div className={styles.preTestContainer}>
            <div className={styles.grid}>
                 <div className={styles.card}>
                    <h2>Baseline Data</h2>
                    <div className={styles.inputGroup}>
                        <label htmlFor="weeklyTraffic">Average Weekly Traffic</label>
                        <input id="weeklyTraffic" type="number" value={weeklyTraffic} onChange={(e) => setWeeklyTraffic(e.target.value)} placeholder="e.g., 20000" />
                    </div>
                    <div className={styles.inputGroup}>
                        <label htmlFor="weeklyConversions">Average Weekly Conversions</label>
                        <input id="weeklyConversions" type="number" value={weeklyConversions} onChange={(e) => setWeeklyConversions(e.target.value)} placeholder="e.g., 400" />
                    </div>
                </div>
            </div>
            
            {preTestResults && preTestResults.length > 0 && (
                <div className={styles.results}>
                     <h2>Minimum Detectable Effect (MDE) by Duration</h2>
                     <p className={styles.preTestSubtitle}>Calculated with 95% significance and 80% power.</p>
                     <table className={styles.preTestTable}>
                        <thead>
                            <tr>
                                <th>Test Duration</th>
                                <th>Minimum Detectable Effect (MDE)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {preTestResults.map(result => (
                                <tr key={result.weeks}>
                                    <td>{result.weeks} Week{result.weeks > 1 ? 's' : ''}</td>
                                    <td>{formatPercentage(result.mde)}</td>
                                </tr>
                            ))}
                        </tbody>
                     </table>
                </div>
            )}
        </div>
    )
};


// --- MAIN PAGE COMPONENT ---

const CalculatorPage = () => {
    type Mode = 'test-analysis' | 'pre-test-analysis';
    const [mode, setMode] = useState<Mode>('test-analysis');

    return (
        <div className={styles.container}>
            <div className={styles.toggleContainer}>
                <button 
                    className={`${styles.toggleButton} ${mode === 'test-analysis' ? styles.active : ''}`} 
                    onClick={() => setMode('test-analysis')}>
                    Test Analysis
                </button>
                <button 
                    className={`${styles.toggleButton} ${mode === 'pre-test-analysis' ? styles.active : ''}`}
                    onClick={() => setMode('pre-test-analysis')}>
                    Pre-test Analysis
                </button>
            </div>
            <h1 className={styles.title}>
                {mode === 'test-analysis' ? 'A/B Test Significance Calculator' : 'A/B Test Duration & MDE Calculator'}
            </h1>
            {mode === 'test-analysis' ? <TestAnalysis /> : <PreTestAnalysis />}
        </div>
    );
};

export default CalculatorPage;
