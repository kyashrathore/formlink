#!/bin/bash

# Formlink Development Environment Setup

set -e  # Exit on any error

# Colors and emoji for better UX
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

ROCKET="🚀"
CHECK="✅"
CROSS="❌"
WARN="⚠️"
INFO="ℹ️"
GEAR="⚙️"

echo -e "${BLUE}${ROCKET} Formlink Development Environment Setup${NC}"
echo "=============================================="
echo ""

# Function to print section headers
print_section() {
    echo ""
    echo -e "${BLUE}${GEAR} $1${NC}"
    echo "----------------------------------------"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check version
check_version() {
    local cmd="$1"
    local version_flag="$2"
    local name="$3"
    
    if command_exists "$cmd"; then
        local version=$($cmd $version_flag 2>/dev/null | head -n1)
        echo -e "  ${GREEN}${CHECK} $name: $version${NC}"
        return 0
    else
        echo -e "  ${RED}${CROSS} $name: Not installed${NC}"
        return 1
    fi
}

# Function to run command with status
run_command() {
    local description="$1"
    local command="$2"
    
    echo -n "  $description... "
    
    if eval "$command" >/dev/null 2>&1; then
        echo -e "${GREEN}${CHECK}${NC}"
        return 0
    else
        echo -e "${RED}${CROSS}${NC}"
        echo -e "${RED}Failed: $command${NC}"
        return 1
    fi
}

# Check prerequisites
print_section "Checking Prerequisites"

echo "Checking required tools:"
NODE_OK=true
PNPM_OK=true
GIT_OK=true

if ! check_version "node" "--version" "Node.js"; then
    NODE_OK=false
    echo -e "${YELLOW}${WARN} Please install Node.js 18+ from https://nodejs.org${NC}"
fi

if ! check_version "pnpm" "--version" "pnpm"; then
    PNPM_OK=false
    echo -e "${YELLOW}${WARN} Installing pnpm...${NC}"
    if command_exists "npm"; then
        npm install -g pnpm
        PNPM_OK=true
        echo -e "  ${GREEN}${CHECK} pnpm installed successfully${NC}"
    else
        echo -e "${RED}${CROSS} Cannot install pnpm (npm not found)${NC}"
    fi
fi

if ! check_version "git" "--version" "Git"; then
    GIT_OK=false
    echo -e "${YELLOW}${WARN} Please install Git from https://git-scm.com${NC}"
fi

# Exit if critical tools are missing
if [[ "$NODE_OK" == false || "$PNPM_OK" == false || "$GIT_OK" == false ]]; then
    echo -e "${RED}${CROSS} Missing required tools. Please install them and run this script again.${NC}"
    exit 1
fi

# Check Node.js version
print_section "Validating Node.js Version"
NODE_VERSION=$(node --version | sed 's/v//')
NODE_MAJOR=$(echo $NODE_VERSION | cut -d. -f1)

if [ "$NODE_MAJOR" -lt 18 ]; then
    echo -e "${RED}${CROSS} Node.js version $NODE_VERSION is too old. Please upgrade to 18+${NC}"
    exit 1
else
    echo -e "  ${GREEN}${CHECK} Node.js version $NODE_VERSION is compatible${NC}"
fi

# Check if we're in the right directory
print_section "Validating Project Structure"

if [ ! -f "package.json" ]; then
    echo -e "${RED}${CROSS} package.json not found. Are you in the formlink root directory?${NC}"
    exit 1
fi

if [ ! -f "pnpm-workspace.yaml" ]; then
    echo -e "${RED}${CROSS} pnpm-workspace.yaml not found. This doesn't look like the formlink monorepo.${NC}"
    exit 1
fi

echo -e "  ${GREEN}${CHECK} Project structure validated${NC}"

# Install dependencies
print_section "Installing Dependencies"

echo "Installing workspace dependencies..."
if pnpm install; then
    echo -e "  ${GREEN}${CHECK} Dependencies installed successfully${NC}"
else
    echo -e "  ${RED}${CROSS} Failed to install dependencies${NC}"
    exit 1
fi

# Setup Git hooks
print_section "Setting up Git Hooks"

if [ ! -d ".husky" ]; then
    echo "Initializing Husky..."
    if pnpm exec husky install; then
        echo -e "  ${GREEN}${CHECK} Husky initialized${NC}"
    else
        echo -e "  ${YELLOW}${WARN} Husky initialization failed (continuing anyway)${NC}"
    fi
else
    echo -e "  ${GREEN}${CHECK} Husky already configured${NC}"
fi

# Environment setup
print_section "Environment Configuration"

# Check for .env files in apps
MISSING_ENV_FILES=()

for app_dir in apps/*/; do
    if [ -d "$app_dir" ]; then
        app_name=$(basename "$app_dir")
        env_file="${app_dir}.env.local"
        env_example="${app_dir}.env.example"
        
        if [ ! -f "$env_file" ] && [ -f "$env_example" ]; then
            MISSING_ENV_FILES+=("$app_name")
        fi
    fi
done

if [ ${#MISSING_ENV_FILES[@]} -gt 0 ]; then
    echo -e "${YELLOW}${WARN} Missing .env.local files for: ${MISSING_ENV_FILES[*]}${NC}"
    echo -e "${INFO} Copy .env.example to .env.local and configure your environment variables${NC}"
    
    for app in "${MISSING_ENV_FILES[@]}"; do
        echo "  cp apps/$app/.env.example apps/$app/.env.local"
    done
else
    echo -e "  ${GREEN}${CHECK} Environment files are configured${NC}"
fi

# Validate TypeScript setup
print_section "TypeScript Configuration"

run_command "Checking TypeScript compilation" "pnpm type-check"

# Run initial build
print_section "Initial Build Verification"

run_command "Building all packages and apps" "pnpm build"

# Setup complete
print_section "Setup Complete!"

echo -e "${GREEN}${ROCKET} Formlink development environment is ready!${NC}"
echo ""
echo "Available commands:"
echo -e "  ${BLUE}pnpm dev${NC}              # Start all development servers"
echo -e "  ${BLUE}pnpm dev:craft${NC}        # Start formcraft app only"
echo -e "  ${BLUE}pnpm dev:fill${NC}         # Start formfiller app only"
echo -e "  ${BLUE}pnpm quality-check${NC}    # Run comprehensive quality checks"
echo -e "  ${BLUE}pnpm test${NC}             # Run all tests"
echo -e "  ${BLUE}pnpm lint${NC}             # Lint all code"
echo -e "  ${BLUE}pnpm format${NC}           # Format all code"
echo ""
echo "Next steps:"
echo -e "  1. ${YELLOW}Configure your .env.local files${NC}"
echo -e "  2. ${YELLOW}Run 'pnpm dev' to start development${NC}"
echo -e "  3. ${YELLOW}Run 'pnpm quality-check' before commits${NC}"
echo ""
echo -e "${GREEN}Happy coding! 🎉${NC}"