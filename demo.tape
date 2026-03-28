# Unblocks Demo — Record with: vhs demo.tape
# Install VHS: https://github.com/charmbracelet/vhs
# Output: docs/assets/demo.gif

Output docs/assets/demo.gif
Set FontSize 14
Set Width 900
Set Height 500
Set Theme "Catppuccin Mocha"
Set Padding 20

Type "# Unblocks — from zero to running SaaS app in 3 commands"
Enter
Sleep 1s

Type "git clone https://github.com/ProbsAI/Unblocks.git && cd Unblocks"
Enter
Sleep 3s

Type "cp .env.example .env && docker compose up -d && npm install"
Enter
Sleep 8s

Type "npm run db:migrate && npm run dev"
Enter
Sleep 5s

Type "# Open http://localhost:3000"
Enter
Sleep 2s

Type "# Auth, billing, teams, notifications, admin — all ready."
Enter
Sleep 3s
