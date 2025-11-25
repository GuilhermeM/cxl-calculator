# A/B Test Calculator Documentation

## 1. Project Overview

This project is a web-based A/B Test Calculator designed to provide statistical insights for conversion rate optimization. It serves two primary functions: analyzing the results of a completed test and planning for a future test.

The application is split into two modes:

-   **Test Analysis:** Calculates the statistical significance of a test that has already concluded.
-   **Pre-test Analysis:** Estimates the required duration of a future test based on desired statistical parameters and baseline traffic data.

## 2. Features

-   **Persistent Inputs:** The calculator uses the browser's **Local Storage** to remember your inputs, so you don't have to re-enter them every time you visit the page.
-   **Sharable Results:** You can generate a unique URL to share your calculations with others.

## 3. Architecture Overview

The application is built using **Next.js** and **React** with TypeScript.

-   **Component-Based UI:** The UI is modular, with the main logic separated into two primary components: `TestAnalysis` and `PreTestAnalysis`, corresponding to the two application modes.
-   **State Management:** Application state is managed locally within each component using React Hooks (`useState` for inputs, `useMemo` for memoizing expensive calculations). The `useLocalStorage` custom hook is used to persist state between sessions.
-   **Styling:** Component-specific styles are managed using **CSS Modules** to ensure they are scoped locally and do not conflict.
-   **Structure:** All calculator logic and UI reside within the `app/calculator/` route.

## 4. Business Rules & Calculations

This section details the core business logic that powers the calculator's two modes. The statistical calculations rely on approximations for the **Standard Normal Cumulative Distribution Function (CDF)** and its inverse, which are implemented in the `standardNormalCdf` and `standardNormalInverseCdf` functions.

### 4.1 Test Analysis Mode

This mode determines if the observed change in a variation is statistically significant compared to the control.

-   **Core Method:** The calculation is based on a **two-proportion Z-test**.
-   **Inputs:**
    -   `VisitorsA`, `ConversionsA` (Control Group)
    -   `VisitorsB`, `ConversionsB` (Variation Group)
-   **Key Calculations:**
    1.  **Conversion Rate (CR):** Calculated for each group as `CR = Conversions / Visitors`.
    2.  **Uplift:** The relative improvement of the variation over the control: `Uplift = (CR_B - CR_A) / CR_A`.
    3.  **Z-Score:** This value measures the difference between the two conversion rates in terms of standard errors. It is the core of the significance calculation.
    4.  **P-value:** The probability of observing the given results (or more extreme) if there were no real difference between the groups. It is calculated from the Z-score using the `standardNormalCdf` function. A two-tailed test is used.
    5.  **Confidence Level:** The final output, calculated as `1 - p-value`. A result is considered statistically significant if the Confidence Level is **≥ 95%**.

### 4.2 Pre-test Analysis Mode

This mode helps users plan an A/B test by estimating the **Minimum Detectable Effect (MDE)** for different test durations. MDE is the smallest uplift you can expect to reliably detect.

-   **Core Method:** The calculation is derived from the sample size formula used in hypothesis testing, solving for the effect size (MDE).
-   **Inputs:**
    -   `Average Weekly Traffic`
    -   `Average Weekly Conversions`
    -   `Confidence Level` (default 95%): How sure we want to be that a declared winner is not a false positive.
    -   `Statistical Power` (default 80%): The probability of detecting a true effect of a certain size (the MDE).
-   **Key Calculations:**
    1.  **Baseline Conversion Rate (p):** Calculated from the user's weekly data: `p = Weekly Conversions / Weekly Traffic`.
    2.  **Dynamic Z-Scores:**
        -   **Z-alpha (from Confidence):** The Z-score corresponding to the desired confidence level.
        -   **Z-beta (from Power):** The Z-score corresponding to the desired statistical power.
        -   These are calculated dynamically using the `standardNormalInverseCdf` function, allowing users to input custom values.
    3.  **MDE Calculation:** The MDE is calculated for test durations from 1 to 6 weeks. The formula uses the Z-scores, the baseline conversion rate, and the sample size for the given duration (where `Sample Size per Variation = (Weekly Traffic * Weeks) / 2`). The key takeaway is that MDE decreases as sample size (duration) increases.