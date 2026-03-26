# Armory

**Standalone Claude Code skills forged from real problems.**

**Every skill in this repo started as a problem I watched people work around instead of solve.** I built the structural fix, tested it, and published it here so anyone can use it. No frameworks, no dependencies, no setup. Copy the skill folder into your project's `.claude/skills/` and it works.

## Install any skill

```
cp -r ascii-diagram/ your-project/.claude/skills/
```

Done.

## Skills

| Skill | What it solves | Test cases |
|-------|----------------|------------|
| [ascii-diagram](./ascii-diagram/) | LLMs misalign ASCII diagrams because they predict tokens sequentially. This skill uses a programmatic character-grid so alignment is guaranteed by math, not prediction. | 31 test cases, zero false positives |

## How skills get added

**I find a problem nobody's solved structurally, build and test a skill that solves it, publish it here.** The bar is: works on any codebase, zero project-specific assumptions, drops in with a single copy command.

---

If you want the full orchestration infrastructure these skills were born from: github.com/SethGammon/Citadel
