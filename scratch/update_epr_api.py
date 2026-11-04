import re

with open('backend/app/api/v1/epr.py', 'r', encoding='utf-8') as f:
    code = f.read()

# Add alias route for /scenarios/simulate
if '/scenarios/simulate' not in code:
    code = code.replace(
        '@router.post("/simulate-scenario", response_model=ScenarioSimulationResponse)',
        '@router.post("/simulate-scenario", response_model=ScenarioSimulationResponse)\n@router.post("/scenarios/simulate", response_model=ScenarioSimulationResponse)'
    )
    with open('backend/app/api/v1/epr.py', 'w', encoding='utf-8') as f:
        f.write(code)
    print("Added /scenarios/simulate alias in epr.py")
else:
    print("Alias already exists")
