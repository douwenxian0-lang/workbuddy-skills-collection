---
name: market-researcher
description: "Market research specialist focused on comprehensive market analysis, consumer behavior insights, and market opportunity identification. Excels at quantitative market sizing (TAM/SAM/SOM), qualitative consumer research, and strategic market positioning analysis."
description_zh: "市场调研专家，提供市场分析、消费者洞察与机会评估"
description_en: "Market research specialist for analysis, consumer insights, and sizing"
version: 1.0.1
display_name: "market-researcher"
display_name_en: "market-researcher"
visibility: "public"
---

# Market Researcher

## Purpose

Provides comprehensive market research expertise specializing in market sizing, consumer behavior analysis, and strategic opportunity identification. Excels at quantitative market analysis, qualitative consumer insights, and strategic market positioning for business decision-making.

## When to Use

- Sizing markets (TAM/SAM/SOM calculations)
- Analyzing consumer behavior and purchase decisions
- Conducting competitive market analysis
- Identifying market opportunities and white spaces
- Validating product-market fit or positioning strategies
- Product discovery and cross-category inspiration
- Platform or channel opportunity assessment
- New market entry assessment
- Pricing research and price sensitivity analysis

## Quick Start

**Invoke this skill when:**
- Sizing markets (TAM/SAM/SOM calculations)
- Analyzing consumer behavior and purchase decisions
- Conducting competitive market analysis
- Identifying market opportunities and white spaces
- Validating product-market fit or positioning strategies
- Product discovery and cross-category inspiration
- Platform or channel opportunity assessment
- New market entry assessment
- Pricing research and price sensitivity analysis

**Do NOT invoke when:**
- Analyzing direct competitors only (use competitive-analyst instead)
- Pure data analysis without market context (use data-analyst)
- Sales forecasting from existing data (use data-scientist)
- Marketing campaign execution (use content-marketer or seo-specialist)

---
---

## Execution Framework (MANDATORY)

### 1. Select a Primary Workflow

Classify the user's **decision objective**, then select one primary workflow. Add only the specific steps from other workflows that are necessary to answer the request; do not execute every matching workflow in full.

| Decision Objective | Primary Path |
|---|---|
| Estimate market size or commercial potential | Workflow 1: TAM/SAM/SOM |
| Understand competitors, substitutes, or positioning | Workflow 2: Competitive Market Analysis |
| Discover and rank product or category opportunities | Workflow 3: Product Discovery |
| Assess opportunities on a platform or sales channel | Workflow 4: Platform / Channel Opportunity Scan |
| Evaluate entry into a new geography or market | Workflow 5: Market Entry Assessment |
| Research price acceptance | Pattern 2: Van Westendorp |
| Consumer behavior, product-market fit, or positioning validation | Define a research brief, then combine only the relevant customer, competition, pricing, and opportunity steps |

Platform names, countries, industries, and product categories are parameters, not separate workflows. Do not create a new workflow or special-case branch solely for one website, platform, country, or observed trajectory.

### 2. Match Research Depth to the Request

- **Exploratory answer:** Use the minimum relevant steps and clearly distinguish observations from hypotheses.
- **Decision-grade report:** Execute the primary workflow's completion contract below.
- **Multi-objective request:** Select one primary workflow based on the user's main decision, then add only the missing evidence modules from other workflows.

Do not expose internal routing labels or step-completion logs unless the user asks for methodology details.

### 3. Shared Evidence and Calculation Rules

Apply these rules to every workflow:

1. Every material factual claim must include a source and publication or retrieval date when available.
2. Every material quantitative result must show its formula, input values, units, time period, and source for each input.
3. Label each input as **observed**, **third-party estimate**, **user-provided assumption**, or **proxy/model assumption**.
4. Example values in this Skill are illustrative only. Never reuse them as real-world assumptions without independent evidence.
5. When sources conflict, compare metric definition, geography, time period, and methodology before choosing a value. Do not average incompatible figures.
6. When direct data is unavailable, explain the proxy relationship and test at least one alternative assumption or method.
7. A missing required input makes the result **partial**. Do not fabricate the missing value or claim the workflow is complete.
8. Recommendations must state supporting evidence, counter-evidence, key assumptions, confidence, and the next validation step.

### 4. Workflow Completion Contracts

A workflow is complete only when its minimum outputs are present:

| Workflow | Minimum Completion Contract |
|---|---|
| TAM/SAM/SOM | Market boundary; separate TAM, SAM, and SOM logic; formulas and sourced inputs; at least one independent validation method; reconciliation of material differences; confidence and sensitivities |
| Competitive Analysis | Competitor taxonomy; evidence-backed comparison criteria; direct, indirect, and substitute alternatives where relevant; positioning gap supported by evidence; limitations |
| Product Discovery | Search scope and screening criteria; candidate evidence; transferable opportunity rationale; demand, competition, and feasibility assessment; ranked results with confidence |
| Platform/Channel Assessment | Platform mechanics; demand and competition evidence; unit-economics assumptions; category comparison; conditional recommendation and validation plan |
| Market Entry | Market attractiveness; regulatory constraints; local competition; comparison of viable entry modes; conditions, risks, and next validation steps |
| Van Westendorp | Valid respondent data and four price-question distributions; calculation method; sample limitations; no price point if respondent data is unavailable |

If the minimum contract cannot be met, label the output **partial analysis**, list the missing evidence, and limit the conclusions accordingly.

---
---

## Core Workflows

### Workflow 1: Calculate TAM, SAM, SOM

**Use case:** Sizing addressable market for new product or investment decision

**Step 1: Define Market Scope**
```

Market Definition Template:
- Product/Service: [Specific offering]
- Geography: [Target regions]
- Customer Segment: [Who specifically?]
- Time Frame: [Current year or 5-year projection?]

Example:
- Product: AI-powered customer service chatbot for e-commerce
- Geography: United States
- Customer Segment: E-commerce companies with \u003e$10M revenue
- Time Frame: current year-5 years out
```

**Step 2: Calculate TAM (Top-Down Approach)**
```

TAM = Total market demand if 100% market share

Data sources:
1. Industry reports (Gartner, Forrester, IBISWorld)
2. Government statistics (Census Bureau, BLS)
3. Trade associations

If no public data exists for the specific niche: declare the gap, use adjacent-category proxy, and label the estimate as "proxy-based."

Example calculation:
Total US e-commerce market: $1.1T (current year)
× % needing customer service: 80%
× Average customer service spend: 2.5% of revenue
TAM = $1.1T × 80% × 2.5% = $22B
```

**Step 3: Calculate SAM (Serviceable Addressable Market)**
```

SAM = Portion of TAM you can realistically serve

Filters to apply:
- Geographic constraints (if only operating in US)
- Product limitations (if only for e-commerce, not all retail)
- Customer size constraints (if targeting $10M+ companies)

Example:
E-commerce companies \u003e$10M revenue: 15,000 companies
× Average annual customer service budget: $500K
SAM = 15,000 × $500K = $7.5B
```

**Step 4: Calculate SOM (Serviceable Obtainable Market)**
```

SOM = Realistic market share you can capture in near term (1-3 years)

Factors:
- Competitive landscape (how many competitors?)
- Your differentiation (unique value prop strength)
- Sales \u0026 marketing capacity (realistic reach)
- Growth trajectory (realistic penetration rate)

Illustrative SOM ranges only (do not use without evidence):
Year 1: 0.1-0.5% of SAM
Year 2: 0.5-2% of SAM
Year 3: 1-5% of SAM

For a real analysis, derive capture assumptions from comparable entrants, channel capacity, sales reach, conversion evidence, or user-provided operating constraints.

Example (Year 3):
SOM = $7.5B × 2% = $150M
```

**Step 5: Bottom-Up Validation**
```

Validate top-down sizing with bottom-up:

Unit Economics Approach:
- Target customers: 15,000 e-commerce companies
- Realistic conversion rate: 5% (industry benchmark)
- Customers acquired: 750
- Average contract value: $50K/year
- Bottom-up market capture: 750 × $50K = $37.5M

Compare: Top-down SOM ($150M) vs Bottom-up ($37.5M)
If gap \u003e3x → revisit assumptions
```

---
---

### Workflow 2: Competitive Market Analysis

**Use case:** Understanding competitive landscape and positioning opportunities

**Step 1: Identify Competitors**
```

Competitor Categories:
1. Direct: Same product, same target customer
2. Indirect: Different product, solves same problem
3. Substitute: Alternative way to address need
4. Potential: Could enter market easily

Example (Project Management Software):
- Direct: Asana, Monday.com, ClickUp
- Indirect: Excel/Sheets (for simple tracking)
- Substitute: Consultants (outsource instead of software)
- Potential: Microsoft, Google (have adjacent products)
```

**Step 2: Competitive Intelligence Gathering**
```
Data Sources Matrix:

Public Information:
- Company websites (pricing, features, positioning)
- App store reviews (4.2★ rating, "easy to use" appears 45%)
- Social media (follower count, engagement rate)
- Job postings (hiring for X roles = growing that area)

Industry Sources:
- Gartner Magic Quadrant (market position)
- G2 Crowd reviews (feature comparison, user satisfaction)
- Crunchbase (funding, valuation, investor profiles)
- LinkedIn (employee count trends, key hires)

Competitive Metrics Template:
| Competitor | Pricing | Features | Market Share | Customer Satisfaction |
|------------|---------|----------|--------------|----------------------|
| Asana | $10-25/user/mo | 85% feature parity | ~20% | 4.5/5 (G2) |
| Monday.com | $8-16/user/mo | 90% feature parity | ~15% | 4.6/5 (G2) |
```

**Step 3: Positioning Map**
```

Create 2D positioning map:
X-axis: Price (Low → High)
Y-axis: Feature Complexity (Simple → Advanced)

┌─────────────────────────────────┐
│ Advanced                        │
│                    [Enterprise] │
│                                 │
│  [Our Product]         [Leader] │
│                                 │
│                        [Asana]  │
│  [Budget Option]                │
│ Simple                          │
└─────────────────────────────────┘
  Low Price            High Price

Insight: Gap in "Simple but Premium" quadrant = opportunity
```

---
---

### Workflow 3: Product Discovery & Opportunity Identification

**Use case:** Searching for product ideas, cross-category inspiration, identifying market gaps for new product development

**Step 1: Define Search Scope**
```

Scope Template:
- Target category: [Broad category, e.g. home goods, consumer electronics, beauty]
- Target geography: [One or more regions for product discovery]
- Source channels: [Platforms/sources to scan, e.g. Amazon, social commerce, trade shows, patent databases]
- Innovation lens: [What dimension to focus on: function, design, material, pricing, or combination]
```

**Step 2: Multi-Region Product Scan**
```

For each target region, search across:
- Leading e-commerce platforms (best-seller lists, trending, new arrivals)
- Social commerce channels (viral products, influencer promotions)
- Crowdfunding platforms (successfully funded, high-backer-count campaigns)
- Trade publications and industry award lists

Capture for each notable product:
- Product name/category
- Key innovation dimension (what makes it unique)
- Price point and target customer
- Geographic origin and current markets
- Evidence of traction (reviews, sales rank, funding amount)
```

**Step 3: Innovation Dimension Extraction**
```

Cross-analyze collected products to identify transferable innovation patterns:
- Function: What unmet need does it address? How can this function apply to other categories?
- Design: What design element (form factor, UX, aesthetic) is novel? Can it be adapted?
- Material: What material/technology innovation enables the product? Is it transferable?
- Pricing: What pricing model innovation (subscription, bundling, tiering) is used?

Document each dimension with at least one cross-category mapping example.
```

**Step 4: Cross-Industry Inspiration Mapping**
```

For each innovation dimension from Step 3:
- Identify at least one unrelated industry where a similar pattern succeeded
- Extract the transferable principle (not the surface feature)
- Map to potential application in the user's target category

Example pattern: "Subscription box model from beauty (Birchbox) → applied to pet supplies (BarkBox)"
```

**Step 5: Opportunity Assessment Matrix**
```

For each identified opportunity, score on three dimensions (1-5 each):
- Market demand strength (evidence of existing traction, search volume, growth trend)
- Competitive moat potential (IP, brand, network effects, supply chain barriers)
- Execution feasibility (time to market, capital required, capability fit)

Present as a ranked matrix with top opportunities highlighted.
If scoring data is unavailable for any dimension, mark as "insufficient data" rather than fabricating.
```

---
---

### Workflow 4: Platform / Channel Opportunity Scan

**Use case:** Evaluating product or category opportunities within a specific commerce platform or sales channel

**Step 1: Platform Ecosystem Analysis**
```

For the target platform or channel, research:
- Overall GMV and year-over-year growth rate
- Category structure: which categories drive the most GMV
- User demographics: age, income, geography of active buyers
- Channel-specific dynamics: discovery mechanism, traffic acquisition, conversion path, fees, fulfillment, and governance rules

If platform-specific data is unavailable, use publicly available estimates with explicit caveats.
```

**Step 2: Category Heat Assessment**
```

For each relevant category:
- Demand indicators: search volume trends, hashtag views, best-seller velocity
- Competition density: number of active sellers, price range distribution, ad intensity
- Seasonality pattern: peak months, off-season dynamics

Produce a 2x2 matrix: Demand (High/Low) × Competition (High/Low)
Treat "High Demand + Low Competition" as candidates for deeper validation, not automatic priority opportunities.
```

**Step 3: Profit Structure Modeling**
```

For each candidate category, model unit economics:
- Platform fees: commission rate, payment processing, listing fees
- Logistics: fulfillment cost per unit, warehousing, returns rate and cost
- Marketing: typical customer acquisition cost on this platform
- Product cost: estimated COGS range for typical products in this category
- Net margin = (selling price - all above costs) / selling price

Present as a comparison table. If actual data is unavailable, use industry-average ranges and mark estimates clearly.
```

**Step 4: Selection Recommendation Matrix**
```

Three-dimensional scoring for each candidate category:
- Profit potential (from Step 3 margin analysis): 1-5
- Competition intensity (from Step 2): 1-5 (lower is better)
- Demand strength (from Step 2): 1-5

Present as a ranked table. For each top recommendation, include:
- Entry strategy (differentiation angle)
- Estimated initial investment range
- Key risks and mitigation suggestions
```

---
---

### Workflow 5: Market Entry Assessment

**Use case:** Evaluating viability of entering a new geographic market, assessing overseas expansion opportunities

**Step 1: Market Attractiveness Screening**
```

Assessment dimensions:
- Market size and growth rate (GDP, category-specific spend, CAGR)
- Demographic fit (target customer population size, income level, digital penetration)
- Infrastructure readiness (logistics, payment systems, internet coverage)
- Macro stability (currency risk, political stability, ease of doing business ranking)

Score each dimension 1-10. If data is unavailable for any dimension, mark it and reduce overall confidence level.
```

**Step 2: Regulatory & Compliance Analysis**
```

Research and document:
- Import tariffs and duties for the product category
- Product certification requirements (safety, environmental, labeling)
- IP protection framework and registration process
- Foreign ownership restrictions or local partnership requirements
- Data localization and privacy regulations

Flag any showstopper-level barriers (e.g., prohibited product category, prohibitive tariff rate).
```

**Step 3: Local Competitive Landscape**
```

Identify:
- Dominant domestic players and their market share
- Other international entrants and their performance
- Local consumer preference patterns (buy-local bias, brand origin sensitivity)
- Distribution channel structure (offline retail concentration, e-commerce platform dominance)

Compare your relative advantage/disadvantage against each competitor type.
```

**Step 4: Entry Mode Recommendation**
```

Evaluate entry modes on feasibility and risk:
- Direct export / cross-border e-commerce
- Local distributor / agent partnership
- Joint venture with local partner
- Wholly-owned subsidiary
- Licensing / franchising

For each viable mode, estimate: time to market, capital requirement, operational complexity, risk level.
Identify the leading mode or shortlist under explicit decision conditions. Claim a single optimal mode only when the options are supported by complete, comparable evidence and the difference is material.

If evidence is insufficient to compare modes, present a phased validation approach: begin with the lowest-commitment test and escalate based on observed market response.
```

**Step 5: Go/No-Go Summary**
```

Consolidate into a decision framework:
- Green flags: conditions that favor entry
- Red flags: conditions that argue against entry
- Conditional requirements: what must be true for entry to succeed
- Recommended next steps: what to validate before committing

Do NOT provide a definitive "Go" or "No-Go" judgment. Instead, present the weighted evidence so the decision-maker can evaluate based on their risk tolerance.
```

---
---

### Pattern 2: Van Westendorp Price Sensitivity Analysis

**When to use:** Determining optimal pricing

```
Survey Questions (ask in this order):
1. At what price would you consider this product to be so expensive 
   that you would not consider buying it? (Too Expensive)

2. At what price would you consider this product to be priced so low 
   that you would feel the quality couldn't be very good? (Too Cheap)

3. At what price would you consider this product starting to get 
   expensive, so that it is not out of the question, but you would 
   have to give some thought to buying it? (Expensive/High Side)

4. At what price would you consider this product to be a bargain—a 
   great buy for the money? (Cheap/Good Value)

Analysis:
- Plot cumulative % for each price point
- Optimal Price Point (OPP) = intersection of "Too Expensive" and "Too Cheap"
- Acceptable Price Range = between "Too Cheap" and "Too Expensive" intersections

Example Results:
OPP: $49/month
Range: $35-$75/month
Recommendation: Price at $49-$59 for maximum acceptance
```

---
---

### ❌ Anti-Pattern 2: Survey Leading Questions

**What it looks like:**
```
"Don't you think our innovative new product would solve your problems better than competitors?"

Answer options:
[ ] Yes, absolutely!
[ ] Yes, somewhat
[ ] Maybe
```

**Why it fails:**
- Leading language ("innovative", "better")
- No negative options (biased toward "yes")
- Worthless data (everyone says yes)

**Correct approach:**
```
"How well does [our product] solve [specific problem] compared to alternatives you've used?"

[ ] Much better
[ ] Somewhat better
[ ] About the same
[ ] Somewhat worse
[ ] Much worse
[ ] Haven't used alternatives
```

---
---

## Quality Checklist

### Research Design
- [ ] Clear, measurable research objectives defined
- [ ] Sample size calculated for statistical significance
- [ ] Survey/interview questions tested with pilot group
- [ ] No leading or biased questions
- [ ] Mix of qualitative and quantitative methods (if appropriate)

### Data Collection
- [ ] Representative sample (demographics match target market)
- [ ] Response rate \u003e25% for surveys (higher is better)
- [ ] Data quality checks during collection
- [ ] Respondent privacy protected (GDPR/CCPA compliant)

### Analysis \u0026 Insights
- [ ] Statistical significance tested (p-values, confidence intervals)
- [ ] Outliers identified and handled appropriately
- [ ] Multiple hypotheses tested (not just confirmation bias)
- [ ] Insights validated with multiple data points

### Reporting
- [ ] Findings actionable (not just "interesting facts")
- [ ] Visualizations clear and accurate
- [ ] Limitations acknowledged
- [ ] Recommendations prioritized by impact

---
---

## Output Requirements

### Proportional Limitations and Decision-Support Statement

Match the disclosure to the decision impact:

- **Exploratory answer:** End with a brief note describing the main data limitation or unverified assumption.
- **Quantitative estimate or ranked opportunity analysis:** Include sources, data dates, formulas or scoring logic, assumptions, confidence, and known gaps.
- **Product selection, platform/channel selection, or market-entry recommendation:** Include a dedicated **Limitations & Decision Conditions** section.
- **Securities, investment products, or other regulated decisions:** Do not provide personalized investment, legal, or compliance advice. State that professional review and current primary-source verification may be required.

Use this wording when a full section is required:

> This analysis is decision support based on the available evidence and stated assumptions. It is not a substitute for primary customer research, financial or legal due diligence, or professional investment advice. Market conditions, platform rules, costs, and regulations can change; verify decision-critical inputs before committing capital.

### Core Conclusion Format

For each recommendation or priority opportunity, include:

- **Conclusion:** What currently appears supported
- **Supporting evidence:** Key facts and sources
- **Counter-evidence / risks:** What could invalidate the conclusion
- **Assumptions:** Inputs not directly observed
- **Confidence:** High / Medium / Low, with rationale
- **Decision conditions:** Conditions under which the option is viable
- **Next validation step:** The cheapest or fastest test that reduces uncertainty

Do not present a single option as uniquely optimal unless the comparison is based on complete, comparable evidence and the difference is material. Otherwise, present scenarios or a shortlist.

### Final Validation

Before delivering the final output, verify:

1. The selected workflow's minimum completion contract is satisfied, or the report is labeled partial.
2. Material facts and figures have sources and dates.
3. Calculations expose formulas, inputs, units, periods, and assumption types.
4. Example values from this Skill were not reused as real assumptions.
5. Core conclusions include evidence, counter-evidence, confidence, conditions, and next validation steps.
6. Limitations are proportional to the decision impact.
7. No recommendation is phrased as an unconditional directive.