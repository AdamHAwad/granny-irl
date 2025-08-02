# Development Workflow - Granny IRL

## Branching Strategy

### Branch Structure:
- **`main`** - Production branch (auto-deploys to Vercel)
- **`development`** - Main development branch (stable features)
- **`feature/*`** - Feature branches (for individual features)

### Workflow:

#### 1. **For New Features:**
```bash
# Create feature branch from development
git checkout development
git pull origin development
git checkout -b feature/host-kick-functionality

# Work on feature...
git add .
git commit -m "Add host kick feature"
git push -u origin feature/host-kick-functionality

# Merge back to development when done
git checkout development
git merge feature/host-kick-functionality
git push origin development
```

#### 2. **For Production Releases:**
```bash
# Merge development to main when ready for production
git checkout main
git merge development
git push origin main
# This triggers automatic Vercel deployment
```

#### 3. **For Hotfixes:**
```bash
# Create hotfix branch from main
git checkout main
git checkout -b hotfix/critical-bug-fix

# Fix the issue...
git add .
git commit -m "Fix critical bug"
git push -u origin hotfix/critical-bug-fix

# Merge to both main and development
git checkout main
git merge hotfix/critical-bug-fix
git checkout development  
git merge hotfix/critical-bug-fix
git push origin main development
```

## Current Status
- **Production (main)**: Stable MVP with all core features
- **Development**: Ready for new feature development
- **Live URL**: https://granny-irl.vercel.app (deploys from main)

## Development Environment Setup

### Local Development:
```bash
git clone https://github.com/AdamHAwad/granny-irl.git
cd granny-irl
git checkout development
npm install
npm run dev  # Runs on localhost:3000
```

### Environment Variables:
```
NEXT_PUBLIC_SUPABASE_URL=https://vyybwuzpwvrwpbtoreoz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ5eWJ3dXpwd3Zyd3BidG9yZW96Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQwODc2MjYsImV4cCI6MjA2OTY2MzYyNn0.3Hg9ercrUA7y4VRK973dIO99TMSIjzNOuWo2XSWHTJU
```

## Feature Development Guidelines

### Commit Message Format:
```
type(scope): description

Examples:
feat(game): add host kick functionality
fix(auth): resolve login redirect issue
docs(readme): update installation instructions
refactor(timer): optimize game timer logic
```

### Testing Before Merge:
1. **Local testing**: `npm run build` must pass
2. **Feature testing**: Test the specific feature works
3. **Regression testing**: Ensure existing features still work
4. **Mobile testing**: Test on mobile devices

### Code Review Checklist:
- [ ] Feature works as expected
- [ ] No TypeScript errors
- [ ] Mobile responsive
- [ ] Error handling implemented
- [ ] Console logs appropriate for debugging
- [ ] Documentation updated if needed

## Release Process

### Development → Production:
1. **Test development branch thoroughly**
2. **Update version in package.json**
3. **Create release commit**
4. **Merge to main**
5. **Tag release**: `git tag v1.1.0`
6. **Monitor Vercel deployment**
7. **Test production deployment**

### Rollback Process:
```bash
# If production has issues, rollback
git checkout main
git reset --hard HEAD~1  # Go back one commit
git push --force origin main
```

---

**Current Development Status**: Ready for organized feature development on `development` branch.