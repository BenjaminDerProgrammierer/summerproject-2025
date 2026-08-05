#!/bin/bash
# Script to generate secure passwords and secrets for .env file
# Usage: ./generate-secrets.sh

# Define the source .env.example file and target .env file
ENV_EXAMPLE=".env.example"
ENV_TARGET=".env"

# Check if the example file exists
if [ ! -f "$ENV_EXAMPLE" ]; then
    echo "Error: $ENV_EXAMPLE file not found!"
    exit 1
fi

# Check if the target file exists
if [ -f "$ENV_TARGET" ]; then
    echo "Error: $ENV_TARGET file found! Skipping generation."
    exit 1
fi

# Create a copy of the example file
cp "$ENV_EXAMPLE" "$ENV_TARGET"

# Function to generate a 22-char password with digits, upper and lowercase
generate_mixed_password() {
    # Use tr to filter for alphanumeric characters only, then cut to desired length
    openssl rand -base64 48 | tr -dc 'a-zA-Z0-9' | head -c 22
}

# Generate secure values using openssl
JWT_SECRET=$(openssl rand -hex 256)
MASTER_SIGNUP_KEY=$(generate_mixed_password)

# Replace placeholder values with secure generated values
# Using alternate delimiter (|) to avoid issues with special characters in generated passwords
sed -i "s|JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|" "$ENV_TARGET"
sed -i "s|MASTER_SIGNUP_KEY=.*|MASTER_SIGNUP_KEY=$MASTER_SIGNUP_KEY|" "$ENV_TARGET"

echo "Success: Generated secure .env file with the following values:"
echo "JWT_SECRET: $JWT_SECRET"
echo "MASTER_SIGNUP_KEY: $MASTER_SIGNUP_KEY"
echo ""
echo "Your .env file is ready to use!"
