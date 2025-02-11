#!/bin/bash

# Check if Homebrew is installed
if ! command -v brew &> /dev/null; then
    echo "Homebrew not found. Please install Homebrew first."
    exit 1
fi

# Install ttyd if not already installed
if ! command -v ttyd &> /dev/null; then
    echo "Installing ttyd..."
    brew install ttyd
fi

# Create a credentials file if it doesn't exist
if [ ! -f .web_credentials ]; then
    echo "Setting up web credentials..."
    echo "WEBAPP_USER=admin" > .web_credentials
    # Generate a random password
    RANDOM_PASSWORD=$(openssl rand -base64 12)
    echo "WEBAPP_PASSWORD=$RANDOM_PASSWORD" >> .web_credentials
    echo "Generated credentials:"
    echo "Username: admin"
    echo "Password: $RANDOM_PASSWORD"
    echo "These credentials are saved in .web_credentials"
fi

# Source the credentials
source .web_credentials

# Add .web_credentials to .gitignore if not already there
if ! grep -q ".web_credentials" .gitignore 2>/dev/null; then
    echo ".web_credentials" >> .gitignore
fi

echo "Setup complete! You can now run: ./start_web.sh" 