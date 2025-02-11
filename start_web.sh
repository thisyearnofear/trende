#!/bin/bash

# Source the credentials
if [ ! -f .web_credentials ]; then
    echo "Credentials not found. Please run setup_web.sh first."
    exit 1
fi
source .web_credentials

# Activate virtual environment
source ~/.venvs/trend_finder/bin/activate

# Install web requirements if needed
pip install -r requirements_web.txt

# Create templates directory if it doesn't exist
mkdir -p templates

# Start the Flask server
echo "Starting web interface on http://localhost:8080"
echo "Username: $WEBAPP_USER"
echo "Password: $WEBAPP_PASSWORD"

python server.py 