"use client";

import React, { useState, useMemo, useEffect, Suspense } from 'react';
import styles from './Calculator.module.css';
import { useSearchParams, useRouter } from 'next/navigation';

// --- CUSTOM HOOK FOR LOCALSTORAGE ---

function useLocalStorage<T>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return initialValue;
    }
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.log(error);
      return initialValue;
    }
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(key, JSON.stringify(storedValue));
      } catch (error) {
        console.log(error);
      }
    }
  }, [key, storedValue]);

  return [storedValue, setStoredValue];
}


// --- UTILITY FUNCTIONS ---

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

const standardNormalInverseCdf = (p: number): number => {
    if (p <= 0 || p >= 1) return 0;
    const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
    const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
    const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
    const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];
    if (p < 0.5) {
        const q = Math.sqrt(-2 * Math.log(p));
        const num = (((((a[0] * q + a[1]) * q + a[2]) * q + a[3]) * q + a[4]) * q + a[5]);
        const den = (((((b[0] * q + b[1]) * q + b[2]) * q + b[3]) * q + b[4]) * q + 1);
        return num / den;
    } else {
        const q = Math.sqrt(-2 * Math.log(1 - p));
        const num = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]);
        const den = ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
        return -num / den;
    }
}

const formatPercentage = (value: number | null | undefined) => {
    if (value === null || value === undefined || isNaN(value)) return 'N/A';
    if (value === Infinity) return '∞%';
    return `${(value * 100).toFixed(2)}%`;
};

// --- MODE 1: TEST ANALYSIS ---

const TestAnalysis = ({ visitorsA, setVisitorsA, conversionsA, setConversionsA, visitorsB, setVisitorsB, conversionsB, setConversionsB, testDuration, setTestDuration }: any) => {
    const results = useMemo(() => {
        const vA = Number(visitorsA);
        const cA = Number(conversionsA);
        const vB = Number(visitorsB);
        const cB = Number(conversionsB);
        const duration = Number(testDuration);

        if (vA <= 0 || cA < 0 || vB <= 0 || cB < 0 || cA > vA || cB > vB) return null;

        const convRateA = cA / vA;
        const convRateB = cB / vB;
        const uplift = (convRateB - convRateA) / convRateA;

        const pooledProb = (cA + cB) / (vA + vB);
        const stdError = Math.sqrt(pooledProb * (1 - pooledProb) * (1 / vA + 1 / vB));

        let confidence: number | null = null;
        let isSignificant = false;
        let pValue: number | null = null;
        let additionalDaysNeeded: number | null | string = null;
        let projectedTotalDuration: number | null | string = null;

        if (stdError > 0) {
            const zScore = (convRateB - convRateA) / stdError;
            pValue = 2 * (1 - standardNormalCdf(Math.abs(zScore)));
            confidence = 1 - pValue;
            isSignificant = confidence >= 0.95;
        } else {
            confidence = convRateA === convRateB ? 0.5 : (convRateB > convRateA ? 1 : 0);
            pValue = convRateA === convRateB ? 1 : 0;
            isSignificant = false;
        }

        if (duration > 0 && convRateA > 0 && convRateA < 1 && convRateB > 0 && convRateB < 1 && convRateA !== convRateB) {
            const Z_ALPHA = standardNormalInverseCdf(1 - 0.05 / 2); // For 95% confidence
            const Z_BETA = standardNormalInverseCdf(1 - 0.2);  // For 80% power

            const p1 = convRateA;
            const p2 = convRateB;
            
            const requiredNPerVariation = ((Z_ALPHA * Math.sqrt(2 * pooledProb * (1 - pooledProb))) + (Z_BETA * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2))))**2 / (p1 - p2)**2;

            const totalVisitorsPerDay = (vA + vB) / duration;

            if (totalVisitorsPerDay > 0) {
                const requiredTotalVisitors = requiredNPerVariation * 2;
                const requiredTotalDays = Math.ceil(requiredTotalVisitors / totalVisitorsPerDay);
                const extraDays = requiredTotalDays - duration;
                additionalDaysNeeded = extraDays > 0 ? extraDays : 0;

                if (typeof additionalDaysNeeded === 'number') {
                    projectedTotalDuration = duration + additionalDaysNeeded;
                } else {
                    projectedTotalDuration = 'N/A';
                }

            } else {
                additionalDaysNeeded = 'N/A';
                projectedTotalDuration = 'N/A';
            }
        }


        return { convRateA, convRateB, uplift, confidence, isSignificant, pValue, additionalDaysNeeded, projectedTotalDuration };
    }, [visitorsA, conversionsA, visitorsB, conversionsB, testDuration]);

    return (
        <>
            <div className={`${styles.card} ${styles.durationCard}`}>
                <div className={styles.inputGroup}>
                    <label htmlFor="testDuration">Test Duration (in days)</label>
                    <input id="testDuration" type="number" value={testDuration} onChange={(e) => setTestDuration(e.target.value)} placeholder="e.g., 14" className={styles.inputField} />
                </div>
            </div>
            <div className={styles.grid}>
                <div className={styles.card}>
                    <h2>Control (A)</h2>
                    <div className={styles.inputGroup}><label htmlFor="visitorsA">Visitors</label><input id="visitorsA" type="number" value={visitorsA} onChange={(e) => setVisitorsA(e.target.value)} placeholder="e.g., 1000" className={styles.inputField} /></div>
                    <div className={styles.inputGroup}><label htmlFor="conversionsA">Conversions</label><input id="conversionsA" type="number" value={conversionsA} onChange={(e) => setConversionsA(e.target.value)} placeholder="e.g., 100" className={styles.inputField} /></div>
                    {results && <div className={styles.resultsPreview}><p>Conversion Rate: {formatPercentage(results.convRateA)}</p></div>}
                </div>
                <div className={styles.card}>
                    <h2>Variation (B)</h2>
                    <div className={styles.inputGroup}><label htmlFor="visitorsB">Visitors</label><input id="visitorsB" type="number" value={visitorsB} onChange={(e) => setVisitorsB(e.target.value)} placeholder="e.g., 1000" className={styles.inputField} /></div>
                    <div className={styles.inputGroup}><label htmlFor="conversionsB">Conversions</label><input id="conversionsB" type="number" value={conversionsB} onChange={(e) => setConversionsB(e.target.value)} placeholder="e.g., 120" className={styles.inputField} /></div>
                    {results && <div className={styles.resultsPreview}><p>Conversion Rate: {formatPercentage(results.convRateB)}</p></div>}
                </div>
            </div>
            {results && (
                <div className={styles.results}>
                    <h2>Results</h2>
                    <div className={styles.resultItem}><span>Uplift</span><span className={styles.resultValue}>{formatPercentage(results.uplift)}</span></div>
                    <div className={styles.resultItem}><span>Confidence</span><span className={`${styles.resultValue} ${results.isSignificant ? styles.significant : styles.notSignificant}`}>{formatPercentage(results.confidence)}</span></div>
                    {results.confidence !== null && <p className={styles.summary}>{results.isSignificant ? 'The change is statistically significant.' : 'The change is not statistically significant.'}</p>}
                    {results.uplift > 0 && results.additionalDaysNeeded !== null && (
                        <div className={styles.resultItem}>
                            <span>Additional days needed</span>
                            <span className={styles.resultValue}>
                                {results.additionalDaysNeeded === 0 
                                    ? "Check pre-test analysis for more details" 
                                    : `${results.additionalDaysNeeded} days`}
                            </span>
                        </div>
                    )}
                    {results.uplift > 0 && results.projectedTotalDuration !== null && results.additionalDaysNeeded !== 0 && (
                        <div className={styles.resultItem}>
                            <span>Projected total test duration</span>
                            <span className={styles.resultValue}>{`${results.projectedTotalDuration} days`}</span>
                        </div>
                    )}
                </div>
            )}
        </>
    );
};

// --- MODE 2: PRE-TEST ANALYSIS ---

const PreTestAnalysis = ({ weeklyTraffic, setWeeklyTraffic, weeklyConversions, setWeeklyConversions, confidence, setConfidence, power, setPower }: any) => {
    const preTestResults = useMemo(() => {
        const traffic = Number(weeklyTraffic);
        const conversions = Number(weeklyConversions);
        const conf = Number(confidence) / 100;
        const pow = Number(power) / 100;

        if (traffic <= 0 || conversions < 0 || conversions > traffic || conf <= 0 || conf >= 1 || pow <= 0 || pow >= 1) return null;

        const baselineConvRate = conversions / traffic;
        if (baselineConvRate === 0 || baselineConvRate === 1) return null;

        const p1 = baselineConvRate;
        const alpha = 1 - conf;
        const beta = 1 - pow;
        const Z_ALPHA = standardNormalInverseCdf(1 - alpha / 2);
        const Z_BETA = standardNormalInverseCdf(1 - beta);

        const calculateRequiredN = (mde: number) => {
            if (mde <= 0) return Infinity;
            const p2 = p1 * (1 + mde);
            if (p2 > 1) return Infinity;
            const term1 = p1 * (1 - p1);
            const term2 = p2 * (1 - p2);
            const variance = term1 + term2;
            const effectSizeSq = (p2 - p1) ** 2;
            if (effectSizeSq === 0) return Infinity;
            return ((Z_ALPHA + Z_BETA) ** 2 * variance) / effectSizeSq;
        };

        const durationResults = [];
        for (let weeks = 1; weeks <= 6; weeks++) {
            const durationInDays = weeks * 7;
            const dailyTraffic = traffic / 7;
            const sampleSizePerVariation = (dailyTraffic * durationInDays) / 2;

            let lowMde = 0;
            let highMde = 5; // Search up to 500% MDE
            let mde = null;

            for(let i = 0; i < 100; i++) { // 100 iterations for precision
                const midMde = (lowMde + highMde) / 2;
                if (midMde === 0) break;
                const requiredN = calculateRequiredN(midMde);
                
                if (requiredN > sampleSizePerVariation) {
                    lowMde = midMde;
                } else {
                    highMde = midMde;
                }
            }
            
            if (highMde < 5) { // Found a reasonable MDE
                 mde = highMde;
            }

            durationResults.push({
                weeks: `${weeks} week${weeks > 1 ? 's' : ''}`,
                mde: mde === null ? 'N/A' : `${(mde * 100).toFixed(2)}%`,
            });
        }
        
        return { durationResults };

    }, [weeklyTraffic, weeklyConversions, confidence, power]);

    return (
        <div className={styles.preTestContainer}>
            <div className={styles.grid}>
                <div className={styles.card}>
                    <h2>Parameters</h2>
                    <div className={styles.inputGroup}><label htmlFor="weeklyTraffic">Average Weekly Traffic</label><input id="weeklyTraffic" type="number" value={weeklyTraffic} onChange={(e) => setWeeklyTraffic(e.target.value)} placeholder="e.g., 20000" className={styles.inputField} /></div>
                    <div className={styles.inputGroup}><label htmlFor="weeklyConversions">Average Weekly Conversions</label><input id="weeklyConversions" type="number" value={weeklyConversions} onChange={(e) => setWeeklyConversions(e.target.value)} placeholder="e.g., 400" className={styles.inputField} /></div>
                    <div className={styles.inputGroup}><label htmlFor="confidence">Confidence Level (%)</label><input id="confidence" type="number" value={confidence} onChange={(e) => setConfidence(e.target.value)} placeholder="e.g., 95" className={styles.inputField} /></div>
                    <div className={styles.inputGroup}><label htmlFor="power">Statistical Power (%)</label><input id="power" type="number" value={power} onChange={(e) => setPower(e.target.value)} placeholder="e.g., 80" className={styles.inputField} /></div>
                </div>
            </div>
            {preTestResults && preTestResults.durationResults.length > 0 && (
                <div className={styles.results}>
                    <h2>Minimum Detectable Effect (MDE)</h2>
                     <p className={styles.preTestSubtitle}>To reach {confidence}% significance and {power}% power.</p>
                    <table className={styles.preTestTable}>
                        <thead>
                            <tr>
                                <th>Test Duration</th>
                                <th>Minimum Detectable Effect</th>
                            </tr>
                        </thead>
                        <tbody>
                            {preTestResults.durationResults.map(result => (
                                <tr key={result.weeks}>
                                    <td>{result.weeks}</td>
                                    <td>{result.mde}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

// --- MAIN PAGE COMPONENT ---

const CalculatorPage = () => {
    type Mode = 'test-analysis' | 'pre-test-analysis';
    const searchParams = useSearchParams();

    const [mode, setMode] = useLocalStorage<Mode>('calculator_mode', 'test-analysis');
    
    // State for Test Analysis
    const [visitorsA, setVisitorsA] = useLocalStorage<number | string>('testAnalysis_visitorsA', '');
    const [conversionsA, setConversionsA] = useLocalStorage<number | string>('testAnalysis_conversionsA', '');
    const [visitorsB, setVisitorsB] = useLocalStorage<number | string>('testAnalysis_visitorsB', '');
    const [conversionsB, setConversionsB] = useLocalStorage<number | string>('testAnalysis_conversionsB', '');
    const [testDuration, setTestDuration] = useLocalStorage<number | string>('testAnalysis_testDuration', '');


    // State for Pre-Test Analysis
    const [weeklyTraffic, setWeeklyTraffic] = useLocalStorage<number | string>('preTestAnalysis_weeklyTraffic', '');
    const [weeklyConversions, setWeeklyConversions] = useLocalStorage<number | string>('preTestAnalysis_weeklyConversions', '');
    const [confidence, setConfidence] = useLocalStorage<number | string>('preTestAnalysis_confidence', 95);
    const [power, setPower] = useLocalStorage<number | string>('preTestAnalysis_power', 80);


    const [shareUrl, setShareUrl] = useState('');
    const [showShareUrl, setShowShareUrl] = useState(false);
    const [copySuccess, setCopySuccess] = useState('');

    useEffect(() => {
        const params = new URLSearchParams(searchParams.toString());
        const modeParam = params.get('mode');

        if (modeParam === 'test-analysis' || modeParam === 'pre-test-analysis') {
            setMode(modeParam);
            if (modeParam === 'test-analysis') {
                setVisitorsA(params.get('visitorsA') || '');
                setConversionsA(params.get('conversionsA') || '');
                setVisitorsB(params.get('visitorsB') || '');
                setConversionsB(params.get('conversionsB') || '');
                setTestDuration(params.get('testDuration') || '');
            } else if (modeParam === 'pre-test-analysis') {
                setWeeklyTraffic(params.get('weeklyTraffic') || '');
                setWeeklyConversions(params.get('weeklyConversions') || '');
                setConfidence(params.get('confidence') || 95);
                setPower(params.get('power') || 80);
            }
        }
    }, [searchParams, setMode, setVisitorsA, setConversionsA, setVisitorsB, setConversionsB, setWeeklyTraffic, setWeeklyConversions, setConfidence, setPower]);

    const handleShare = () => {
        const params = new URLSearchParams();
        params.set('mode', mode);
        if (mode === 'test-analysis') {
            params.set('visitorsA', String(visitorsA));
            params.set('conversionsA', String(conversionsA));
            params.set('visitorsB', String(visitorsB));
            params.set('conversionsB', String(conversionsB));
            params.set('testDuration', String(testDuration));
        } else {
            params.set('weeklyTraffic', String(weeklyTraffic));
            params.set('weeklyConversions', String(weeklyConversions));
            params.set('confidence', String(confidence));
            params.set('power', String(power));
        }
        const fullUrl = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
        setShareUrl(fullUrl);
        setShowShareUrl(true);
    };

    const handleCopy = () => {
        if (!shareUrl) return;

        navigator.clipboard.writeText(shareUrl)
            .then(() => {
                setCopySuccess('Copied!');
                setTimeout(() => setCopySuccess(''), 2000);
            })
            .catch(err => {
                setCopySuccess('Failed!');
                console.error('Failed to copy URL: ', err);
                setTimeout(() => setCopySuccess(''), 2000);
            });
    };

    return (
        <div className={styles.container}>
            <div className={styles.toggleContainer}>
                <button className={`${styles.toggleButton} ${mode === 'test-analysis' ? styles.active : ''}`} onClick={() => setMode('test-analysis')}>Test Analysis</button>
                <button className={`${styles.toggleButton} ${mode === 'pre-test-analysis' ? styles.active : ''}`} onClick={() => setMode('pre-test-analysis')}>Pre-test Analysis</button>
            </div>
            <h1 className={styles.title}>
                {mode === 'test-analysis' ? 'A/B Test Significance Calculator' : 'A/B Test Duration & MDE Calculator'}
            </h1>

            {mode === 'test-analysis' ? (
                <TestAnalysis visitorsA={visitorsA} setVisitorsA={setVisitorsA} conversionsA={conversionsA} setConversionsA={setConversionsA} visitorsB={visitorsB} setVisitorsB={setVisitorsB} conversionsB={conversionsB} setConversionsB={setConversionsB} testDuration={testDuration} setTestDuration={setTestDuration}/>
            ) : (
                <PreTestAnalysis weeklyTraffic={weeklyTraffic} setWeeklyTraffic={setWeeklyTraffic} weeklyConversions={weeklyConversions} setWeeklyConversions={setWeeklyConversions} confidence={confidence} setConfidence={setConfidence} power={power} setPower={setPower} />
            )}

            <div className={styles.shareContainer}>
                <button className={styles.shareButton} onClick={handleShare}>Share</button>
                {showShareUrl && (
                    <div className={styles.shareUrlContainer}>
                        <input type="text" value={shareUrl} readOnly className={styles.shareUrlInput} />
                        <button onClick={handleCopy} className={styles.copyButton}>
                            {copySuccess || 'Copy'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

const CalculatorPageWrapper = () => (
    <Suspense fallback={<div>Loading...</div>}>
        <CalculatorPage />
    </Suspense>
);

export default CalculatorPageWrapper;
