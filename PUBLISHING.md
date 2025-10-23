# Publishing Guide

This guide explains how to publish Bruno MCP Server to NPM.

## Prerequisites

1. **NPM Account**: You need an NPM account. Create one at [npmjs.com](https://www.npmjs.com/signup)

2. **NPM Token**: Generate an automation token:
   - Log in to npmjs.com
   - Go to Access Tokens: https://www.npmjs.com/settings/YOUR_USERNAME/tokens
   - Click "Generate New Token"
   - Select "Automation" type
   - Copy the token (you won't see it again!)

3. **GitHub Secrets**: Add the NPM token to GitHub:
   - Go to your repository on GitHub
   - Navigate to Settings > Secrets and variables > Actions
   - Click "New repository secret"
   - Name: `NPM_TOKEN`
   - Value: Your NPM automation token
   - Click "Add secret"

## Publishing Methods

### Method 1: Automated Publishing via GitHub Release (Recommended)

This is the easiest method and is fully automated.

1. **Update version in package.json**:
   ```bash
   # For a patch release (0.1.0 -> 0.1.1)
   npm version patch

   # For a minor release (0.1.0 -> 0.2.0)
   npm version minor

   # For a major release (0.1.0 -> 1.0.0)
   npm version major

   # For a pre-release (0.1.0 -> 0.2.0-beta.1)
   npm version preminor --preid=beta
   ```

2. **Push the version tag**:
   ```bash
   git push origin main --tags
   ```

3. **Create a GitHub Release**:
   - Go to your repository on GitHub
   - Click "Releases" > "Create a new release"
   - Select the tag you just pushed (e.g., `v0.1.1`)
   - Add release title: "Release v0.1.1"
   - Add release notes (see CHANGELOG.md)
   - Click "Publish release"

4. **GitHub Actions will automatically**:
   - Run all tests
   - Build the project
   - Publish to NPM
   - Verify the publication

### Method 2: Manual Publishing via GitHub Actions

Use this method if you want to publish without creating a GitHub release first.

1. **Go to Actions tab** on GitHub

2. **Select "Publish to NPM" workflow**

3. **Click "Run workflow"**

4. **Enter version** (e.g., `0.1.1` or `0.2.0-beta.1`)

5. **Click "Run workflow"**

GitHub Actions will:
- Update package.json version
- Run tests and build
- Publish to NPM
- Create a git tag
- Create a GitHub release

### Method 3: Local Publishing (Not Recommended)

Only use this for testing or emergencies.

1. **Login to NPM**:
   ```bash
   npm login
   ```

2. **Update version**:
   ```bash
   npm version patch  # or minor, major
   ```

3. **Run pre-publish checks**:
   ```bash
   npm run build
   npm test
   npm pack --dry-run
   ```

4. **Publish**:
   ```bash
   # For stable releases
   npm publish --access public

   # For beta releases
   npm publish --tag beta --access public

   # For alpha releases
   npm publish --tag alpha --access public
   ```

5. **Push tags**:
   ```bash
   git push origin main --tags
   ```

## Version Guidelines

### Semantic Versioning

We follow [Semantic Versioning](https://semver.org/):

- **Major (1.0.0 -> 2.0.0)**: Breaking changes
- **Minor (1.0.0 -> 1.1.0)**: New features (backward compatible)
- **Patch (1.0.0 -> 1.0.1)**: Bug fixes (backward compatible)

### Pre-release Versions

- **Beta**: Feature complete, needs testing
  - Example: `0.2.0-beta.1`
  - NPM tag: `beta`
  - Install: `npm install bruno-mcp-server@beta`

- **Alpha**: Early development, incomplete features
  - Example: `0.2.0-alpha.1`
  - NPM tag: `alpha`
  - Install: `npm install bruno-mcp-server@alpha`

### Current Versioning Strategy

- **0.x.x**: Development/beta releases
- **1.0.0**: First stable release
- **1.x.x**: Stable releases with backward compatibility

## Pre-Release Checklist

Before publishing any version:

- [ ] All tests passing (`npm test`)
- [ ] Coverage above 80% (`npm run test:coverage`)
- [ ] Build successful (`npm run build`)
- [ ] CHANGELOG.md updated with changes
- [ ] README.md updated if needed
- [ ] No sensitive data in code or config
- [ ] Version number follows semver
- [ ] Git working directory is clean
- [ ] All changes committed and pushed

## Post-Release Checklist

After publishing:

- [ ] Verify package on NPM: https://www.npmjs.com/package/bruno-mcp-server
- [ ] Test global installation: `npm install -g bruno-mcp-server`
- [ ] Test local installation: `npm install bruno-mcp-server`
- [ ] Verify version: `npm view bruno-mcp-server version`
- [ ] Check GitHub release is created
- [ ] Update any dependent projects
- [ ] Announce release (if major/minor)

## Troubleshooting

### "You do not have permission to publish"

**Cause**: NPM token is invalid or expired, or you're not the package owner.

**Solution**:
1. Verify you're logged in: `npm whoami`
2. Check package ownership: `npm owner ls bruno-mcp-server`
3. Regenerate NPM token and update GitHub secret

### "Version already exists"

**Cause**: You're trying to publish a version that's already on NPM.

**Solution**:
1. Bump version: `npm version patch` (or minor/major)
2. Publish again

### "prepublishOnly script failed"

**Cause**: Build or tests failed.

**Solution**:
1. Run `npm run build` to see build errors
2. Run `npm test` to see test failures
3. Fix errors and try again

### "Package size too large"

**Cause**: Package includes unnecessary files.

**Solution**:
1. Check `.npmignore` is configured correctly
2. Verify `files` field in package.json
3. Run `npm pack --dry-run` to see what's included
4. Remove large unnecessary files

## NPM Tags

The publish workflow automatically assigns tags:

- **latest**: Stable releases (default)
  - Versions: `1.0.0`, `1.1.0`, `2.0.0`
  - Install: `npm install bruno-mcp-server`

- **beta**: Beta releases
  - Versions: `1.0.0-beta.1`, `1.1.0-beta.2`
  - Install: `npm install bruno-mcp-server@beta`

- **alpha**: Alpha releases
  - Versions: `1.0.0-alpha.1`, `1.1.0-alpha.2`
  - Install: `npm install bruno-mcp-server@alpha`

- **next**: Other pre-releases
  - Versions: `1.0.0-rc.1`, `1.1.0-canary.1`
  - Install: `npm install bruno-mcp-server@next`

## Release Cadence

**Patch Releases**: As needed for bug fixes
**Minor Releases**: Monthly (if new features are ready)
**Major Releases**: Quarterly or when breaking changes are needed

## Security

- Never commit NPM tokens to git
- Use automation tokens (not your personal token)
- Rotate tokens every 90 days
- Enable 2FA on your NPM account
- Review all changes before publishing

## Support

If you have issues publishing:

1. Check [NPM documentation](https://docs.npmjs.com/)
2. Check GitHub Actions logs
3. Open an issue on GitHub
4. Contact maintainers

## References

- [NPM Publishing Guide](https://docs.npmjs.com/packages-and-modules/contributing-packages-to-the-registry)
- [Semantic Versioning](https://semver.org/)
- [Keep a Changelog](https://keepachangelog.com/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
