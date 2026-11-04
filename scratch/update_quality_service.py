with open('frontend/src/app/core/services/quality-api.service.ts', 'r', encoding='utf-8') as f:
    code = f.read()

target = """  exportSourceWorklist(): Observable<SourceWorklistExport> {"""

replacement = """  resolveInSource(issueId: string): Observable<DataQualityIssue> {
    return this.http
      .post<DataQualityIssue>(
        `${this.baseUrl}/api/v1/quality/issues/${encodeURIComponent(issueId)}/resolve-in-source`,
        {},
        { headers: this.getHeaders() }
      )
      .pipe(
        tap({
          next: () => this.loadIssues().subscribe(),
        })
      );
  }

  exportSourceWorklist(): Observable<SourceWorklistExport> {"""

if target in code:
    code = code.replace(target, replacement)
    with open('frontend/src/app/core/services/quality-api.service.ts', 'w', encoding='utf-8') as f:
        f.write(code)
    print("Added resolveInSource in quality-api.service.ts")
else:
    print("Target not found")
