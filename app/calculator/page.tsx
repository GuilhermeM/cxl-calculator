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

const TestAnalysis = ({ visitorsA, setVisitorsA, conversionsA, setConversionsA, visitorsB, setVisitorsB, conversionsB, setConversionsB }: any) => {
    const results = useMemo(() => {
        const vA = Number(visitorsA);
        const cA = Number(conversionsA);
        const vB = Number(visitorsB);
        const cB = Number(conversionsB);

        if (vA <= 0 || cA < 0 || vB <= 0 || cB < 0 || cA > vA || cB > vB) return null;

        const convRateA = cA / vA;
        const convRateB = cB / vB;
        const uplift = (convRateB - convRateA) / convRateA;

        if (convRateA === 0) return { convRateA, convRateB, uplift: convRateB > 0 ? Infinity : 0, confidence: null, isSignificant: false, pValue: null };

        const pooledProb = (cA + cB) / (vA + vB);
        const stdError = Math.sqrt(pooledProb * (1 - pooledProb) * (1 / vA + 1 / vB));

        if (stdError === 0) return { convRateA, convRateB, uplift, confidence: convRateA === convRateB ? 0.5 : (convRateB > convRateA ? 1 : 0), isSignificant: false, pValue: convRateA === convRateB ? 1 : 0 };

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
        if (baselineConvRate === 0 || baselineConvRate === 1) return [];

        const results = [];
        const alpha = 1 - conf;
        const beta = 1 - pow;
        const Z_ALPHA = standardNormalInverseCdf(1 - alpha / 2);
        const Z_BETA = standardNormalInverseCdf(1 - beta);

        for (let weeks = 1; weeks <= 6; weeks++) {
            const totalTrafficPerVariation = (traffic * weeks) / 2;
            const MDE = (Z_ALPHA + Z_BETA) / baselineConvRate * Math.sqrt((2 * baselineConvRate * (1 - baselineConvRate)) / totalTrafficPerVariation);
            results.push({ weeks, mde: MDE });
        }
        return results;
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
            {preTestResults && preTestResults.length > 0 && (
                <div className={styles.results}>
                    <h2>Minimum Detectable Effect (MDE) by Duration</h2>
                    <p className={styles.preTestSubtitle}>Calculated with {confidence}% significance and {power}% power.</p>
                    <table className={styles.preTestTable}>
                        <thead><tr><th>Test Duration</th><th>Minimum Detectable Effect (MDE)</th></tr></thead>
                        <tbody>{preTestResults.map(result => (<tr key={result.weeks}><td>{result.weeks} Week{result.weeks > 1 ? 's' : ''}</td><td>{formatPercentage(result.mde)}</td></tr>))}</tbody>
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
                <TestAnalysis visitorsA={visitorsA} setVisitorsA={setVisitorsA} conversionsA={conversionsA} setConversionsA={setConversionsA} visitorsB={visitorsB} setVisitorsB={setVisitorsB} conversionsB={conversionsB} setConversionsB={setConversionsB} />
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
