with open('frontend/src/app/features/dashboard/dashboard.component.html', 'r', encoding='utf-8') as f:
    html = f.read()

# 1. Update Card 4 (EU PPWR) badge
old_card4_badge = """      <div class="kpi-top-row">
        <span class="kpi-kicker">EU PPWR</span>
        <span class="badge-pill pill-red">
          <span class="dot-red"></span> 3 at risk
        </span>
      </div>"""

new_card4_badge = """      <div class="kpi-top-row">
        <span class="kpi-kicker">EU PPWR</span>
        @if (totalTrackedSkus() === 0) {
        <span class="badge-pill pill-neutral">0 at risk</span>
        } @else if (ppwrNonCompliantCount() > 0) {
        <span class="badge-pill pill-red">
          <span class="dot-red"></span> {{ ppwrNonCompliantCount() }} at risk
        </span>
        } @else {
        <span class="badge-pill pill-green">On track</span>
        }
      </div>"""

if old_card4_badge in html:
    html = html.replace(old_card4_badge, new_card4_badge)
    print("Replaced Card 4 badge with dynamic check")

# 2. Update Forecast section with @if (globalLiabilityGbp() > 0)
old_forecast_chart = """      <!-- Visual 6-Year Column Bar Chart -->
      <div class="chart-wrapper">
        <div class="chart-columns-grid">
          
          <!-- 2025 actual -->
          <div class="col-chart-item">
            <div class="col-val mono">&pound;5.52m</div>
            <div class="col-bar-wrap">
              <div class="col-bar-fill bar-navy" style="height: 65%;"></div>
            </div>
            <div class="col-year mono">2025</div>
            <div class="col-status">actual</div>
          </div>

          <!-- 2026 invoiced -->
          <div class="col-chart-item">
            <div class="col-val mono">&pound;6.29m</div>
            <div class="col-bar-wrap">
              <div class="col-bar-fill bar-navy" style="height: 74%;">
                <div class="col-bar-cap-cyan" style="height: 7%;"></div>
              </div>
            </div>
            <div class="col-year mono">2026</div>
            <div class="col-status">invoiced</div>
          </div>

          <!-- 2027 forecast -->
          <div class="col-chart-item">
            <div class="col-val mono">&pound;6.57m</div>
            <div class="col-bar-wrap">
              <div class="col-bar-fill bar-navy-muted" style="height: 78%;">
                <div class="col-bar-cap-cyan" style="height: 8%;"></div>
              </div>
            </div>
            <div class="col-year mono">2027</div>
            <div class="col-status">forecast</div>
          </div>

          <!-- 2028 forecast -->
          <div class="col-chart-item">
            <div class="col-val mono">&pound;6.89m</div>
            <div class="col-bar-wrap">
              <div class="col-bar-fill bar-navy-muted" style="height: 82%;">
                <div class="col-bar-cap-cyan" style="height: 8%;"></div>
              </div>
            </div>
            <div class="col-year mono">2028</div>
            <div class="col-status">forecast</div>
          </div>

          <!-- 2029 forecast -->
          <div class="col-chart-item">
            <div class="col-val mono">&pound;7.24m</div>
            <div class="col-bar-wrap">
              <div class="col-bar-fill bar-navy-muted" style="height: 87%;">
                <div class="col-bar-cap-cyan" style="height: 9%;"></div>
              </div>
            </div>
            <div class="col-year mono">2029</div>
            <div class="col-status">forecast</div>
          </div>

          <!-- 2030 forecast -->
          <div class="col-chart-item">
            <div class="col-val mono">&pound;7.59m</div>
            <div class="col-bar-wrap">
              <div class="col-bar-fill bar-navy-muted" style="height: 92%;">
                <div class="col-bar-cap-cyan" style="height: 9%;"></div>
              </div>
              <div class="node-optimized" title="With recommendations: £7.31m">
                <span class="node-optimized-val mono">&pound;7.31m</span>
              </div>
            </div>
            <div class="col-year mono">2030</div>
            <div class="col-status">forecast</div>
          </div>

        </div>

        <!-- Trendline SVG overlay -->
        <svg class="chart-trendline-svg" viewBox="0 0 600 160" preserveAspectRatio="none">
          <path d="M 60 78 L 160 62 L 260 56 L 360 48 L 460 41 L 550 50" fill="none" stroke="#10B981" stroke-width="2.5" stroke-dasharray="5 5"></path>
          <circle cx="60" cy="78" r="4.5" fill="#10B981"></circle>
          <circle cx="160" cy="62" r="4.5" fill="#10B981"></circle>
          <circle cx="260" cy="56" r="4.5" fill="#10B981"></circle>
          <circle cx="360" cy="48" r="4.5" fill="#10B981"></circle>
          <circle cx="460" cy="41" r="4.5" fill="#10B981"></circle>
          <circle cx="550" cy="50" r="5.5" fill="#10B981" stroke="#ffffff" stroke-width="2"></circle>
        </svg>
      </div>

      <!-- Forecast Callout Summary Boxes -->
      <div class="forecast-summary-boxes">
        <div class="forecast-callout-box">
          <div class="callout-label">2030, if nothing changes</div>
          <div class="callout-value-row">
            <span class="callout-val mono">&pound;7.59m</span>
            <span class="callout-tag red">+21%</span>
          </div>
        </div>

        <div class="forecast-callout-box highlight-green">
          <div class="callout-label">2030, with recommendations</div>
          <div class="callout-value-row">
            <span class="callout-val mono green">&pound;7.31m</span>
            <span class="callout-tag green">&minus;&pound;282k a year</span>
          </div>
        </div>
      </div>"""

new_forecast_chart = """      @if (globalLiabilityGbp() > 0) {
      <!-- Visual 6-Year Column Bar Chart -->
      <div class="chart-wrapper">
        <div class="chart-columns-grid">
          @for (item of forecastYears(); track item.year) {
          <div class="col-chart-item">
            <div class="col-val mono">{{ formatCurrencyMillions(item.feeGbp) }}</div>
            <div class="col-bar-wrap">
              <div class="col-bar-fill" [class.bar-navy]="item.isNavy" [class.bar-navy-muted]="item.isNavyMuted" [style.height.%]="item.heightPct">
                @if (item.hasCap) {
                <div class="col-bar-cap-cyan" style="height: 8%;"></div>
                }
              </div>
              @if (item.optimizedFee) {
              <div class="node-optimized" [title]="'With recommendations: ' + formatCurrencyMillions(item.optimizedFee)">
                <span class="node-optimized-val mono">{{ formatCurrencyMillions(item.optimizedFee) }}</span>
              </div>
              }
            </div>
            <div class="col-year mono">{{ item.year }}</div>
            <div class="col-status">{{ item.status }}</div>
          </div>
          }
        </div>

        <!-- Trendline SVG overlay -->
        <svg class="chart-trendline-svg" viewBox="0 0 600 160" preserveAspectRatio="none">
          <path d="M 60 78 L 160 62 L 260 56 L 360 48 L 460 41 L 550 50" fill="none" stroke="#10B981" stroke-width="2.5" stroke-dasharray="5 5"></path>
          <circle cx="60" cy="78" r="4.5" fill="#10B981"></circle>
          <circle cx="160" cy="62" r="4.5" fill="#10B981"></circle>
          <circle cx="260" cy="56" r="4.5" fill="#10B981"></circle>
          <circle cx="360" cy="48" r="4.5" fill="#10B981"></circle>
          <circle cx="460" cy="41" r="4.5" fill="#10B981"></circle>
          <circle cx="550" cy="50" r="5.5" fill="#10B981" stroke="#ffffff" stroke-width="2"></circle>
        </svg>
      </div>

      <!-- Forecast Callout Summary Boxes -->
      <div class="forecast-summary-boxes">
        <div class="forecast-callout-box">
          <div class="callout-label">2030, if nothing changes</div>
          <div class="callout-value-row">
            <span class="callout-val mono">{{ formatCurrencyMillions(baselineProjected2030Gbp()) }}</span>
            <span class="callout-tag red">+21%</span>
          </div>
        </div>

        <div class="forecast-callout-box highlight-green">
          <div class="callout-label">2030, with recommendations</div>
          <div class="callout-value-row">
            <span class="callout-val mono green">{{ formatCurrencyMillions(withRecommendations2030Gbp()) }}</span>
            <span class="callout-tag green">&minus;{{ formatCurrency(savingsOpportunityGbp()) }} / yr</span>
          </div>
        </div>
      </div>
      } @else {
      <!-- Onboarding state for new tenant with 0 SKUs -->
      <div class="forecast-empty-box">
        <div class="empty-icon-shield">&#128202;</div>
        <h4 class="empty-title">Awaiting Packaging Volume Baseline</h4>
        <p class="empty-desc">
          No product sales or packaging specifications found for <strong>{{ activeTenantName() }}</strong>.
          Import your packaging catalog to generate automated 2026–2030 liability projections.
        </p>
        <a routerLink="/products" class="btn-empty-action">+ Import SKU Catalog</a>
      </div>
      }"""

if old_forecast_chart in html:
    html = html.replace(old_forecast_chart, new_forecast_chart)
    print("Replaced forecast chart with dynamic multi-tenant logic")

# 3. Update Hotspots section with empty check
old_hotspots_table = """      <!-- Hotspots Table -->
      <div class="hotspots-table-wrap">
        <table class="hotspots-table">
          <thead>
            <tr>
              <th class="th-name">Packaging format and recommended change</th>
              <th class="th-rating">Rating</th>
              <th class="th-fee">Fee</th>
              <th class="th-saving">Saving</th>
            </tr>
          </thead>
          <tbody>
            @for (row of hotspotRows(); track row.title) {
            <tr class="hotspot-tr">
              <td class="td-format">
                <div class="hotspot-main-name">{{ row.title }}</div>
                <div class="hotspot-rec-line">
                  <span class="rec-arrow">&rarr;</span> {{ row.recommendation }}
                </div>
                <div class="hotspot-row-bar" [style.background-color]="row.accentColor"></div>
              </td>
              <td class="td-rating">
                <span class="rating-dot-badge" [class]="'rating-' + row.rating.toLowerCase()">
                  <span class="dot"></span> {{ row.rating }}
                </span>
              </td>
              <td class="td-fee mono">{{ row.fee }}</td>
              <td class="td-saving mono">{{ row.saving }}</td>
            </tr>
            }
          </tbody>
        </table>
      </div>"""

new_hotspots_table = """      @if (hotspotRows().length > 0) {
      <!-- Hotspots Table -->
      <div class="hotspots-table-wrap">
        <table class="hotspots-table">
          <thead>
            <tr>
              <th class="th-name">Packaging format and recommended change</th>
              <th class="th-rating">Rating</th>
              <th class="th-fee">Fee</th>
              <th class="th-saving">Saving</th>
            </tr>
          </thead>
          <tbody>
            @for (row of hotspotRows(); track row.title) {
            <tr class="hotspot-tr">
              <td class="td-format">
                <div class="hotspot-main-name">{{ row.title }}</div>
                <div class="hotspot-rec-line">
                  <span class="rec-arrow">&rarr;</span> {{ row.recommendation }}
                </div>
                <div class="hotspot-row-bar" [style.background-color]="row.accentColor"></div>
              </td>
              <td class="td-rating">
                <span class="rating-dot-badge" [class]="'rating-' + row.rating.toLowerCase()">
                  <span class="dot"></span> {{ row.rating }}
                </span>
              </td>
              <td class="td-fee mono">{{ row.fee }}</td>
              <td class="td-saving mono">{{ row.saving }}</td>
            </tr>
            }
          </tbody>
        </table>
      </div>
      } @else {
      <div class="forecast-empty-box">
        <div class="empty-icon-shield">&#10024;</div>
        <h4 class="empty-title">No Packaging Hotspots Flagged</h4>
        <p class="empty-desc">
          There are currently no high-liability, non-recyclable, or malus-triggering packaging SKUs registered for this workspace.
        </p>
        <a routerLink="/products" class="btn-empty-action">View Pack Records</a>
      </div>
      }"""

if old_hotspots_table in html:
    html = html.replace(old_hotspots_table, new_hotspots_table)
    print("Replaced hotspots table with dynamic empty check")

with open('frontend/src/app/features/dashboard/dashboard.component.html', 'w', encoding='utf-8') as f:
    f.write(html)

print("Finished updating dashboard.component.html")

