import sys

sys.stdout.reconfigure(encoding='utf-8')

with open(r'C:/Users/Raman/.gemini/antigravity/brain/8430355a-2850-4ffc-a247-6940d455de76/.user_uploaded/media_1793345135062_c322e771.html', 'r', encoding='utf-8', errors='ignore') as f:
    text = f.read()

# Let's write the 3 screens to scratch files so we can review them cleanly
p1 = text.find('Set up The Kraft Heinz Company')
p2 = text.find('Which data points do you have?')
p3 = text.find('Connect your systems')
p4 = text.find('EPR fees · 2026')

with open('scratch/screen2.html', 'w', encoding='utf-8') as f:
    f.write(text[p1-500:p2-100])

with open('scratch/screen3.html', 'w', encoding='utf-8') as f:
    f.write(text[p2-500:p3-100])

with open('scratch/screen4.html', 'w', encoding='utf-8') as f:
    f.write(text[p3-500:p4-100])

print("Screens 2, 3, 4 saved to scratch/!")

