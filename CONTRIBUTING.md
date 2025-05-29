# Contributing to X/Twitter MCP Server

We welcome contributions to the X/Twitter MCP Server! This document provides guidelines for contributing to the project.

## Development Setup

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Git

### Local Development

1. Fork and clone the repository:
```bash
git clone https://github.com/YOUR_USERNAME/x-mcp.git
cd x-mcp
```

2. Install dependencies:
```bash
npm install
```

3. Build the project:
```bash
npm run build
```

4. Test the MCP server:
```bash
npm run mcp
```

## Development Workflow

### Building
```bash
npm run build
```

### Running Locally
```bash
# MCP server (stdio transport)
npm run mcp

# CLI interface
npm run cli <command>
```

### Code Style
- Use TypeScript for all source code
- Follow existing code conventions
- Run build before committing to ensure compilation

## Release Process

This project uses [release-it](https://github.com/release-it/release-it) for automated releases with conventional commits.

### Making a Release

1. Ensure all changes are committed and pushed
2. Run the release command:
```bash
npm run release
```

This will:
- Bump the version according to conventional commits
- Generate/update CHANGELOG.md
- Create a git tag
- Push changes and tag to GitHub
- Create a GitHub release
- Publish to npm automatically via GitHub Actions

### Release Types

The release type is determined automatically based on conventional commit messages:

- `fix:` → patch release (1.0.0 → 1.0.1)
- `feat:` → minor release (1.0.0 → 1.1.0)
- `BREAKING CHANGE:` → major release (1.0.0 → 2.0.0)

### Manual Release Steps

If you need to release manually:

1. **Version bump:**
```bash
npm version patch|minor|major
```

2. **Build and test:**
```bash
npm run build
```

3. **Publish to npm:**
```bash
npm publish
```

4. **Create GitHub release:**
- Go to GitHub repository
- Create new release with the new tag
- Add release notes

## NPM Package

### Package Structure
```
x-mcp/
├── dist/           # Compiled JavaScript
├── README.md       # Package documentation
├── LICENSE         # MIT license
└── package.json    # Package manifest
```

### Binary Command
The package provides a binary command `x-mcp` that can be run with:
```bash
npx -y x-mcp
```

### Publishing

Publishing is automated via GitHub Actions when a release is created. The workflow:

1. Triggers on GitHub release publication
2. Builds the project
3. Publishes to npm with provenance

## GitHub Actions

### CI Pipeline (`.github/workflows/ci.yml`)
- Runs on push and pull requests
- Tests building on Node.js 18.x and 20.x
- Validates compilation

### Publish Pipeline (`.github/workflows/publish.yml`)
- Triggers on GitHub release
- Builds and publishes to npm
- Uses npm provenance for security

## Conventional Commits

This project follows [Conventional Commits](https://www.conventionalcommits.org/) specification:

### Format
```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Types
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

### Examples
```bash
feat: add new Twitter search functionality
fix: resolve authentication timeout issue
docs: update README with npm installation
chore: update dependencies
```

## Testing

Currently, the project focuses on TypeScript compilation and build validation. Future improvements may include:
- Unit tests for core functionality
- Integration tests for Twitter API interactions
- End-to-end testing for MCP server

## Troubleshooting

### Build Issues
```bash
# Clean build
rm -rf dist/
npm run build
```

### NPM Publishing Issues
```bash
# Check npm auth
npm whoami

# Login if needed
npm login

# Test publish (dry run)
npm publish --dry-run
```

### Release Issues
```bash
# Check git status
git status

# Ensure clean working directory
git add .
git commit -m "chore: prepare for release"

# Run release
npm run release
```

## Support

- Create an issue for bugs or feature requests
- Check existing issues before creating new ones
- Provide detailed reproduction steps for bugs 