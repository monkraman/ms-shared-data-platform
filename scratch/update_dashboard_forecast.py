# Check dashboard.component.ts computed signals for forecast
with open('frontend/src/app/features/dashboard/dashboard.component.ts', 'r', encoding='utf-8') as f:
    text = f.read()

# Let's inspect how forecast bars and values should be computed
forecast_code = """
  // Dynamic 6-year forecast based on tenant's real liability
  readonly forecastYears = computed(() => {
    const base = this.globalLiabilityGbp();
    if (base === 0) return [];
    return [
      { year: '2025', status: 'actual', feeGbp: Math.round(base * 0.877), heightPct: 65, isNavy: true },
      { year: '2026', status: 'invoiced', feeGbp: base, heightPct: 74, isNavy: true, hasCap: true },
      { year: '2027', status: 'forecast', feeGbp: Math.round(base * 1.044), heightPct: 78, isNavyMuted: true, hasCap: true },
      { year: '2028', status: 'forecast', feeGbp: Math.round(base * 1.095), heightPct: 82, isNavyMuted: true, hasCap: true },
      { year: '2029', status: 'forecast', feeGbp: Math.round(base * 1.151), heightPct: 87, isNavyMuted: true, hasCap: true },
      { year: '2030', status: 'forecast', feeGbp: this.baselineProjected2030Gbp(), heightPct: 92, isNavyMuted: true, hasCap: true, optimizedFee: this.withRecommendations2030Gbp() }
    ];
  });
"""

if 'forecastYears =' not in text:
    last_brace = text.rfind('}')
    text = text[:last_brace] + forecast_code + "\n}\n"
    with open('frontend/src/app/features/dashboard/dashboard.component.ts', 'w', encoding='utf-8') as f:
        f.write(text)
    print("Added dynamic forecastYears to dashboard.component.ts")
else:
    print("forecastYears already exists")

