# GitHub Pages Setup for Skills Distribution

This document describes how to set up GitHub Pages to host mcpGraph documentation and distribute the skills package as a downloadable zip file.

## Overview

We'll use GitHub Pages to create a static site that:
1. Hosts mcpGraph configuration documentation
2. Provides a download link for the Agent Skills zip file
3. Automatically updates when the skills directory changes

**Note:** The `/skills` directory follows the [Agent Skills specification](https://agentskills.io/), containing skill subdirectories with `SKILL.md` files that have YAML frontmatter and markdown content.

## Repository Structure

```
mcpGraph/
├── skills/                   # Agent Skills directory (https://agentskills.io/)
│   └── build-mcpgraph/       # Skill subdirectory
│       └── SKILL.md          # Skill file with YAML frontmatter + markdown content
├── docs/                     # Existing documentation source (markdown files)
│   ├── design.md
│   ├── implementation.md
│   ├── introspection-debugging.md
│   └── github-pages-setup.md
├── site/                     # Jekyll site source (all site files isolated here)
│   ├── _config.yml           # Jekyll configuration
│   ├── _layouts/             # Layout templates
│   ├── _includes/            # Partial templates
│   ├── _sass/                # Stylesheets
│   ├── assets/               # CSS, images, JS
│   ├── pages/                # Documentation pages (copied from /docs or written here)
│   ├── index.html            # Landing page
│   └── downloads/            # Agent Skills zip placed here by workflow
│       └── skills.zip        # Contains skills/ directory structure
├── .github/
│   └── workflows/
│       └── build-pages.yml   # GHA to build and deploy
└── package.json

# Generated output (not in repo):
# - Jekyll builds to site/_site/ (default, gitignored)
# - GitHub Actions copies _site/ contents to gh-pages branch
# - GitHub Pages serves from gh-pages branch
```

**Key Points:**
- `/docs` stays as source markdown (no generated files)
- `/site` contains all Jekyll source files (isolated)
- Jekyll builds to `site/_site/` (default output, gitignored)
- GitHub Actions copies `_site/` to `gh-pages` branch
- GitHub Pages serves from `gh-pages` branch (not `/docs`)

## GitHub Pages Configuration

We'll use the `gh-pages` branch for deployment:
- GitHub Pages serves from `gh-pages` branch
- Keeps source directories clean (no generated files in `/docs` or `/site`)
- Generated site is completely separate from source
- GitHub Actions builds and pushes to `gh-pages` branch automatically

## Build and Deploy Process

### Jekyll Build Process

**Local Development:**
```bash
cd site
bundle exec jekyll build    # Builds to site/_site/
bundle exec jekyll serve    # Serves locally at http://localhost:4000
```

**Production Build (via GitHub Actions):**
1. Jekyll builds from `/site` directory
2. Outputs to `site/_site/` (Jekyll default, gitignored)
3. Skills zip is created and placed in `site/downloads/`
4. Contents of `site/_site/` are copied to `gh-pages` branch
5. GitHub Pages automatically serves from `gh-pages` branch

### GitHub Actions Workflow: `build-pages.yml`

**Triggers:**
- Push to `main` branch when `/skills` directory changes
- Push to `main` branch when `/site` directory changes
- Manual workflow dispatch
- Scheduled (optional: daily check)

**Workflow Steps:**
1. **Checkout repository**
2. **Set up Ruby and Jekyll:**
   - Install Ruby
   - Install Bundler
   - Install Jekyll and dependencies
3. **Create skills zip:**
   - Zip entire `/skills` directory (preserving subdirectory structure)
   - Name it `skills.zip`
   - Place in `site/downloads/` (so it's included in Jekyll build)
4. **Build Jekyll site:**
   - Change to `/site` directory
   - Run `bundle exec jekyll build`
   - Output goes to `site/_site/` (includes skills.zip in downloads/)
5. **Deploy to gh-pages branch:**
   - Checkout or create `gh-pages` branch
   - Copy all contents from `site/_site/` to `gh-pages` branch root
   - Commit and push to `gh-pages` branch
   - GitHub Pages automatically deploys from `gh-pages` branch

**Note:** GitHub Pages will automatically rebuild and serve the site when `gh-pages` branch is updated.

### Workflow Details

**Path filtering for skills changes:**
```yaml
on:
  push:
    branches: [main]
    paths:
      - 'skills/**'              # Trigger on any changes to skills directory
      - '.github/workflows/build-pages.yml'
```

**Note:** This will trigger when any skill subdirectory or `SKILL.md` file changes.

**Zip creation:**
- Use `zip` command or Node.js script
- Include all files in `/skills` directory
- Preserve directory structure


## GitHub Pages Setup Steps

1. **Enable GitHub Pages:**
   - Go to repository Settings → Pages
   - Source: Deploy from a branch
   - Branch: `gh-pages` / folder: `/` (root)
   - GitHub Actions will create and maintain `gh-pages` branch

2. **Create initial Jekyll site structure:**
   - Set up `/site` directory with Jekyll
   - Create landing page with download link

3. **Set up workflow:**
   - Create `.github/workflows/build-pages.yml`
   - Configure to build and deploy on skills changes

4. **Test:**
   - Make a change to `/skills` directory
   - Push to trigger workflow
   - Verify site updates at `https://[username].github.io/mcpGraph/`

## Building the Jekyll Site

We'll build a proper website with Jekyll that includes:
- Navigation menu
- Styling and graphics
- Responsive design
- Professional appearance

### Jekyll Setup

**Why Jekyll:**
- Native GitHub Pages support
- Markdown to HTML conversion built-in
- Theme support (can use GitHub Pages themes or custom)
- Liquid templating for navigation, menus, etc.
- All site files isolated in `/site` directory

**Structure - Isolated in `/site` directory:**
```
mcpGraph/
├── site/                    # All Jekyll files isolated here
│   ├── _config.yml          # Jekyll configuration
│   ├── _layouts/
│   │   ├── default.html     # Base layout template
│   │   └── page.html        # Page layout
│   ├── _includes/
│   │   ├── header.html      # Site header/navigation
│   │   ├── footer.html      # Site footer
│   │   └── sidebar.html     # Optional sidebar
│   ├── _sass/             # SCSS stylesheets
│   │   └── main.scss
│   ├── assets/
│   │   ├── css/
│   │   │   └── style.css    # Compiled CSS
│   │   ├── images/          # Graphics, logos, etc.
│   │   └── js/             # JavaScript if needed
│   ├── index.html           # Landing page (front matter for Jekyll)
│   ├── pages/               # Documentation source
│   │   ├── configuration-guide.md
│   │   ├── design.md
│   │   └── ...
│   └── downloads/           # Skills zip will be placed here
│       └── skills.zip
├── skills/                  # Agent Skills directory (Agent Skills spec)
│   └── build-mcpgraph/     # Skill subdirectory
│       └── SKILL.md        # YAML frontmatter + markdown
└── ...                      # Rest of repo (clean, no Jekyll clutter)
```

**Key Configuration:**
- All Jekyll source files in `/site` directory
- Build output goes to `site/_site/` (Jekyll default, gitignored)
- GitHub Actions copies `_site/` to `gh-pages` branch
- Repository root stays clean
- Skills directory follows [Agent Skills specification](https://agentskills.io/)

**Jekyll Configuration (`site/_config.yml`):**
```yaml
title: mcpGraph
description: MCP server for executing directed graphs
theme: minima  # Or use custom theme
plugins:
  - jekyll-feed
  - jekyll-sitemap

# Source (relative to site/ directory)
source: .

# Destination (Jekyll default is _site/, which is fine)
# No need to specify - uses default _site/ output directory

# Base URL for GitHub Pages
baseurl: ""  # Or "/mcpGraph" if using project pages
url: "https://[username].github.io"

# Navigation
navigation:
  - title: Home
    url: /
  - title: Configuration Guide
    url: /pages/configuration-guide
  - title: Design
    url: /pages/design
  - title: Download Skills
    url: /downloads/skills.zip
```

**Build Process:**
1. Jekyll builds from `/site` directory
2. Output goes to `site/_site/` (Jekyll default, gitignored)
3. GitHub Actions workflow:
   - Builds Jekyll site
   - Creates skills zip
   - Copies `_site/` contents to `gh-pages` branch
4. GitHub Pages serves from `gh-pages` branch
5. Source directories (`/docs`, `/site`) remain clean - no generated files

**Benefits:**
- Repository root stays clean (no Jekyll clutter)
- All site files isolated in `/site`
- Markdown files become HTML pages automatically
- Easy to add navigation, menus, search
- Can use existing Jekyll themes or build custom
- Clear separation between site and project files


## Site Features to Include

### Navigation Menu
- Home
- Documentation sections
- Download Skills link
- GitHub repository link
- Search (if using Jekyll with search plugin)

### Landing Page
- Hero section with mcpGraph description
- Quick start guide
- Download section (prominent skills.zip link)
- Documentation overview
- Examples/use cases

### Documentation Pages
- Sidebar navigation
- Table of contents
- Code syntax highlighting
- Responsive design
- Print-friendly styles

### Styling
- Professional color scheme
- mcpGraph branding/logo
- Consistent typography
- Mobile-responsive
- Accessible design

## Assets to Include

- **Logo/Icon** - mcpGraph logo
- **Graphics** - Diagrams, flowcharts, architecture diagrams
- **Screenshots** - Example configurations, visualizations
- **Favicon** - Site favicon
- **CSS** - Custom stylesheets
- **Fonts** - Web fonts if desired

## Complete GitHub Actions Workflow Example

Here's a complete workflow file for building and deploying the Jekyll site:

**File: `.github/workflows/build-pages.yml`**
```yaml
name: Build and Deploy Site

on:
  push:
    branches: [main]
    paths:
      - 'skills/**'
      - 'site/**'
      - '.github/workflows/build-pages.yml'
  workflow_dispatch:  # Allow manual triggering

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: write  # Required to push to gh-pages branch
    
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
      
      - name: Set up Ruby
        uses: ruby/setup-ruby@v1
        with:
          ruby-version: '3.1'
          bundler-cache: true
          working-directory: ./site
      
      - name: Install Jekyll dependencies
        working-directory: ./site
        run: bundle install
      
      - name: Create skills zip
        run: |
          cd skills
          zip -r ../site/downloads/skills.zip .
          # Creates: site/downloads/skills.zip
          # This will be included in Jekyll build output
      
      - name: Build Jekyll site
        working-directory: ./site
        run: bundle exec jekyll build
        # Outputs to: site/_site/
      
      - name: Deploy to gh-pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./site/_site
          # Copies everything from _site/ to gh-pages branch root
          # GitHub Pages automatically serves from gh-pages branch
```

**What this workflow does:**
1. Triggers on changes to `/skills` or `/site` directories
2. Sets up Ruby and Jekyll environment
3. Creates skills zip and places it in `site/downloads/`
4. Builds Jekyll site (outputs to `site/_site/`)
5. Deploys `_site/` contents to `gh-pages` branch
6. GitHub Pages automatically serves the updated site

## Site Content

### Landing Page
- Hero section with title and description
- Feature highlights
- Quick start section
- Download call-to-action
- Documentation preview

### Agent Skills Zip Contents

The zip file contains the `/skills` directory structure following the [Agent Skills specification](https://agentskills.io/):

```
skills/
  build-mcpgraph/
    SKILL.md  # YAML frontmatter (name, description) + markdown content
```

Each `SKILL.md` file contains:
- YAML frontmatter with skill metadata (name, description, etc.)
- Markdown content with instructions for agents on how to create mcpGraph configurations

## Implementation Checklist

### Phase 1: Basic Setup
- [ ] Create `/skills` directory structure
- [ ] Create skill subdirectory (e.g., `build-mcpgraph/`) in `/skills`
- [ ] Create `SKILL.md` file with YAML frontmatter and markdown content
- [ ] Set up site structure (Jekyll config, layouts, etc.)
- [ ] Set up GitHub Pages (enable in settings)

### Phase 2: Site Development
- [ ] Create base layout with navigation
- [ ] Design and implement styling (CSS/theme)
- [ ] Create landing page (`index.html` or `index.md`)
- [ ] Convert existing docs to site format
- [ ] Add graphics/assets (logo, images, etc.)
- [ ] Set up navigation menu
- [ ] Test site locally (`bundle exec jekyll serve`)

### Phase 3: Automation
- [ ] Create GitHub Actions workflow for skills zip
- [ ] Configure workflow to integrate zip into site
- [ ] Test workflow with a skills directory change
- [ ] Verify site builds and deploys correctly
- [ ] Verify site is accessible at GitHub Pages URL

### Phase 4: Polish
- [ ] Add search functionality (if desired)
- [ ] Optimize images and assets
- [ ] Add analytics (optional)
- [ ] Test responsive design
- [ ] Review and refine content

## Notes

- GitHub Pages is free for public repositories
- Site will be available at: `https://[username].github.io/mcpGraph/`
- Custom domain can be configured if needed
- Workflow runs automatically on pushes (no manual steps)
- Skills zip will always be up-to-date with latest changes
- Jekyll sites can be tested locally with `bundle exec jekyll serve`
- **Source directories stay clean** - `/docs` and `/site` contain only source files
- Generated output goes to `site/_site/` (gitignored) and then to `gh-pages` branch
- `gh-pages` branch contains only the generated static site (not in main branch)

## Quick Start: Jekyll Setup (Isolated in `/site`)

1. **Create site directory:**
   ```bash
   mkdir site
   cd site
   ```

2. **Initialize Jekyll in site directory:**
   ```bash
   gem install bundler jekyll
   jekyll new . --force  # Creates Jekyll structure in site/
   ```

3. **Configure `site/_config.yml`:**
   ```yaml
   title: mcpGraph
   description: MCP server for executing directed graphs
   theme: minima  # Or use custom theme
   baseurl: ""  # Or "/mcpGraph" if using project pages
   url: "https://[username].github.io"
   ```
   - Set site title, description
   - Configure theme or custom styling
   - Set up navigation
   - Note: Uses default `_site/` output directory (no need to specify)

4. **Create layouts:**
   - Base layout with header/footer in `site/_layouts/`
   - Page layout for docs
   - Include navigation partial in `site/_includes/`

5. **Add content:**
   - Create `site/pages/` directory for documentation
   - Convert markdown docs to Jekyll format
   - Add front matter (YAML header) to each page
   - Copy existing docs to `site/pages/` or create new ones

6. **Style:**
   - Use existing theme or create custom CSS
   - Add assets (images, fonts, etc.) to `site/assets/`

7. **Test locally:**
   ```bash
   cd site
   bundle exec jekyll build  # Builds to _site/ (default)
   bundle exec jekyll serve  # Serves from _site/
   # Visit http://localhost:4000
   ```

8. **Set up GitHub Actions:**
   - Create workflow to:
     - Build Jekyll from `/site` (outputs to `site/_site/`)
     - Create skills zip and place in `site/downloads/`
     - Copy `site/_site/*` contents to `gh-pages` branch
     - Commit and push `gh-pages` branch

9. **Deploy:**
   - Push to repository
   - GitHub Actions builds and pushes to `gh-pages`
   - GitHub Pages automatically serves from `gh-pages` branch
   - Source directories (`/docs`, `/site`) remain clean

