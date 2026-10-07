# NJCSV — New Jersey Civil Statistics Visualizations

A site for exploring New Jersey Division of Family Development programs. It uses actual statewide CPS report values, with a source PDF, table, and page attached to each observation. It is an independent analysis, not an official state website.

## Included

- **Program trends:** SNAP households, TANF families, General Assistance cases/recipients, TANF Emergency Assistance families, and GA Emergency Assistance cases. Each has 211 monthly observations, December 2008–June 2026.
- **Child Support:** 70 quarterly collection totals, Q1 2009–Q2 2026. Dollars are nominal. Actual quarter ends are extracted from the table, not inferred from the report month.
- **Comparison:** indexed participation trends, actual caseload lines with optional separate vertical scales, adult/child composition, and monthly TANF EA, GA EA and blended administrative ratios.
- **County breakdowns:** all 21 counties, ranked counts, county histories, shares, annual changes, and CSV export. There are 66 published report-month snapshots per program, March 2010–June 2026. Child Support county data measures cases with orders, separately from statewide collection dollars.
- **Distinct comparison lines:** TANF uses orange solid lines; GA Emergency Assistance uses charcoal dotted lines. The legend shows each program's actual color and line style.
- **Light and dark modes:** a theme toggle saves your preference on this device; your system preference is used initially. Chart colors adapt to maintain visible distinctions.
- **Selectable change date:** the change statistic defaults to the same reporting month two years before the latest observation. Pick any published date; quarterly Child Support uses quarter ends.
- **Current caseload comparison:** actual monthly program counts with their original household/family/case units, plus quarterly Child Support case snapshots. A separate-scale option keeps smaller programs visible.
- **Census household context:** official 2020–2024 ACS household estimates, margins of error, approximate SNAP household percentages, and other program units per 100 households. Opening County breakdowns defaults to New Jersey state total; the dropdown offers all 21 counties for drill-down. Both ranking charts include a pinned state-total row. Intentional county links from model charts still open that county. The state total uses the published state household estimate and median income; county selections include their share of all NJ households. Rankings and exports include this context.
- **Machine learning:** regularized autoregression, a six-month outlook for each monthly series, time-based backtesting against a seasonal naive baseline, empirical error bands, and rolling residual anomaly flags.
- **Readable ML insights:** a step-by-step explanation of supervised forecasting, learned model weights, projected changes, and average past prediction errors. The main ML page omits the baseline comparison; the full validation remains in the data and methods.
- **Census-informed outlook:** pooled county ridge growth forecasts use household counts, income and household size with caseload history. A forecast treemap and actual year-over-year change calendar replace the former poverty scatter plot.
- **Statistical planning signals:** a configurable change threshold yields increase, decrease or mixed-scenario review categories, with eight historical-error scenarios and downloadable JSON evidence. Forecasts come from ridge regression; the categories follow an explicit review rule.
- **Definitions:** dashed-underlined technical terms open keyboard, pointer and touch definitions. Program acronyms are defined in component footers; links and controls never open definitions. DFD, PDF and CSV do not have tooltips, and NJCSV is defined only in the page footer. The July 2013 reporting-source note quotes DFD’s exact wording and links its PDF. Dynamic counts, formulas and source footnotes accompany the charts.
- **Household squares and county hover:** the 100-square grid shows SNAP households relative to the selected county or state's ACS household estimate, using the selected report month even when another program is selected. Partial squares preserve the fractional percentage. Redundant state shares of itself are omitted. County names, values, and full bar rows expose the same data tooltip; keyboard focus also shows the values.
- **Anomaly section:** unusual monthly changes have their own collapsed section directly above the monthly model diagnostics.
- **Provenance:** report library, download of selected series as CSV, complete JSON dataset, source hashes, quality notes, and downloadable model/backtest results.

## Run and build

Requires Node.js 20 or newer. The site has **no npm runtime dependencies**, account requirements, API keys, or inference charges. D3 7.9.0 is vendored locally.

```sh
npm run dev
```

Open `http://127.0.0.1:4317`. To verify and build:

```sh
npm test
npm run build
npm run preview
```

The production build is `dist/`. Normal builds use the checked-in data snapshot; they do not download reports or train models.

## Data sources and preparation

Official report indexes:

- [Current Program Statistics](https://www.nj.gov/humanservices/dfd/news/reports/cps.shtml)
- [CPS archive](https://www.nj.gov/humanservices/dfd/news/reports/cps_archives.shtml)

`public/data/programs.json` is the complete, source-linked snapshot, retrieved October 3, 2026. Tables 1, 5, 8, and 10 provide the monthly statewide series. Table 12 supplies quarterly child-support collections. December reports include overlapping monthly histories; the newest downloaded report wins for duplicate observations. March, June, September, and December reports supply quarterly Child Support data. Text-searchable reports from 2010 onward are used; their lookback tables extend the monthly series to December 2008 and quarterly series to March 2009. Scanned earlier reports are excluded.

The pipeline fails on malformed monthly rows, missing monthly dates, negative counts, or incomplete coverage. Component inconsistencies in published GA totals are recorded while the official total is retained. The source snapshot contains seven distinct such reporting months. Some older reports label General Assistance as “persons,” while later ones label it “cases”; this limits comparisons. July 2013 query-source conversion is also documented by DFD for TANF, SNAP, and TANF EA. The CPS reports do not contain general child-care enrollment; narrow post-TANF childcare statistics are not represented as a full-program series.

`public/data/counties.json` uses county tables 2 (TANF), 7 (SNAP), 9 (TANF EA), and 11 (GA and GA EA), plus the Child Support cases-with-orders table. Snapshots describe March, June, September, and December; they are not quarterly totals or a complete monthly series. County rows are preserved from each report, without filling intervening months. Shares use the sum of county rows, and annual changes use downloaded snapshots. Standalone dashes in numeric source cells are treated as published zeros. Three differences between county sums and the reconciled statewide history are disclosed in the dataset and on the affected county views. Counts are not population-adjusted.

`public/data/census.json` comes directly from the [official 2024 ACS 5-year Summary Files](https://www2.census.gov/programs-surveys/acs/summary_file/2024/table-based-SF/data/5YRData/), using tables B11001, B17017, B19013, and B25010. The preparation script streams each source and retains its 21 NJ county rows with an extract hash. It needs no Census API key. Median income is expressed in 2024 inflation-adjusted dollars. Household poverty uses the B17017 household universe.

The ACS denominator is a **fixed 2020–2024 period estimate**, not a June 2026 count or a period-matched historical household series. Older snapshot ratios explicitly describe comparison with this later reference. SNAP and ACS household definitions differ, so SNAP percentages are approximate. TANF families, GA cases, EA units, and Child Support cases are shown per 100 estimated households; these are not percentages of unique households served. Program populations overlap. The displayed denominator-only uncertainty range divides the caseload by the household estimate plus/minus its published 90% margin of error; it excludes administrative reporting uncertainty and definition differences.

To redownload the fixed ACS release independently: `python scripts/prepare_census.py --download`. Normal refresh reuses cached Census extracts when present. A newer ACS vintage requires deliberately updating the year and reviewing comparability.

To explicitly refresh locally, install Python 3.11+ dependencies and run:

```sh
python -m pip install -r requirements.txt
npm run data:refresh
python -m unittest discover -s tests -p "test_*.py"
npm test
npm run build
```

Source downloads are cached in ignored `sources/`. Refresh redownloads PDFs to capture revisions, extracts their text, prepares data, and retrains all models. Review quality notes before publishing a refreshed snapshot. If DFD changes its table structure, the extractor may need adjustment. This is an explicit refresh workflow, not an automatically scheduled service.

## ML methodology

`scripts/model.py` implements ridge regression in NumPy. Features are log-count lags at 1, 2, 3, 6, and 12 months, trailing 3- and 12-month means, and annual sine/cosine features. Each fit uses at most 84 recent training targets. Standardization uses training data only; the intercept is not penalized, and regularization strength is fixed at 1. Forecasts are recursively generated for six months.

Validation uses 18 rolling forecast origins, with six fully observed future months at every origin. Each model is fitted using only observations before the origin, and is compared to a seasonal naive prediction (the same month one year earlier). The site reports mean absolute error by horizon and overall, and mean absolute percentage error from the 108 rounded predictions. It does not use random splits or tune parameters against its reported test results. Four of five monthly models outperform the baseline in this snapshot; TANF Emergency Assistance does not. Full comparisons remain in the downloadable data; the main ML page shows the model's past error directly, without baseline bars or jargon.

The displayed empirical 80% band uses the 10th and 90th percentiles of historical log forecast errors for each horizon, expanded if necessary to include the central forecast and bounded at zero. Eighteen overlapping origins are a small dependent sample: this is an exploratory error range, not a calibrated guarantee of future coverage.

Anomaly scores compare one-step log prediction residuals with the median and scaled median absolute deviation of the previous 36 residuals, after a 24-residual warm-up. Flags require an absolute score of at least 3.5. Scores use earlier residuals only. Flags are statistical deviations, not determinations of fraud, errors, causes, or changes in underlying need.

Backtests use the reconciled historical series available now, rather than real-time archived vintages. No policy, economic, population, or labor-market features enter the statewide monthly model. Census demographics enter only the separate county model. Forecasts are exploratory and are not official projections, eligibility recommendations, or budget estimates. Monthly models do not include Child Support's quarterly dollar series. Counts overlap across programs and must not be added to estimate unique people.

The learned weight chart displays coefficients for standardized inputs predicting log counts, not causal feature importance. Monthly fit diagnostics are smaller and placed at the bottom of the ML page. Historical k-means group data is retained in the downloadable Census snapshot but is not used in the dashboard or forecasts.

`scripts/county_model.py` fits a separate pooled quarterly ridge growth model across all 21 counties. Nine features include last-quarter growth, year-over-year growth, recent average growth, two seasonal terms, counts relative to households, log household count, relative log median income, and average household size. Poverty is not a predictor. At most 16 quarterly origins per county train each fit; standardization uses training data only and ridge strength is 10. Two-quarter predictions (September and December 2026) are recursive. County totals are independent of the statewide monthly forecasts.

`census-history.json` supplies official 2015–2019 ACS county estimates. It is used from March 2021, after the release, until December 2025. The 2020–2024 release enters from March 2026, after its January 2026 publication. Future releases are excluded from earlier origins. Updated source extracts are not exact archived real-time vintages. `census-state.json` includes the official NJ household total (3,507,701), its margin of error, and state median income. The household total matches the sum of all 21 county estimates; medians are never averaged into a state median.

Eight rolling origins × two-quarter horizons × 21 counties test each county model. The same model without the four Census inputs provides a direct test of whether demographics help. In this snapshot they reduce SNAP county mean absolute error by 6.4%, but increase error for TANF (1.7%), GA (25.1%), TANF EA (12.0%) and GA EA (5.3%). These findings remain visible for the selected program. Added inputs do not guarantee better forecasts.

Each county’s eight historical log forecast errors are applied to its new prediction, with scenarios paired by validation origin across counties. The 10th–90th percentile range is expanded to contain the point forecast. The planning rule flags an increase or decrease when at least six of eight scenarios exceed the selected change threshold; a zero observed count receives insufficient-reference status. Frequencies are not calibrated probabilities and the scenarios are dependent. They support review of service capacity, not eligibility, causal policy claims or estimates of unmet need. The downloadable evidence records model inputs, as-of dates, threshold, rule, counts and source paths. The pipeline runs locally and is reproducible from the published inputs.

## Project structure

```text
public/                Deployable HTML, styles, app code, favicon
  data/programs.json   Source-linked actual observations and quality notes
  data/counties.json   All 21 counties across published report snapshots
  data/census.json     Official ACS estimates, margins of error and learned groups
  data/models.json     Monthly forecasts, residual flags, and rolling backtests
  data/county-models.json  Census-informed quarterly forecasts and validation
  data/census-state.json   Official statewide ACS estimates
  data/census-history.json Earlier ACS county vintage for as-of validation
  vendor/d3.min.js     Pinned chart library, served locally
scripts/               Static build/server and reproducible Python pipeline
tests/                 Data integrity, model-output, and temporal-feature tests
vercel.json            Static Vercel hosting configuration
```

No live backend, database, private user data, external model API, or external font service is required.
