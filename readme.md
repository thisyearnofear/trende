# Trend Finder Agent Guide

This guide provides detailed steps to create a Trend Finder agent that leverages Composio, ChatGPT to research and find trends in Twitter and Linkedin. Ensure you have Python 3.8 or higher installed.

## Environment Setup

1. Copy `.env.example` to `.env`:

```sh
cp .env.example .env
```

2. Fill in your API keys in `.env`:

- `COMPOSIO_API_KEY`: Get from [Composio](https://composio.dev)
- `OPENAI_API_KEY`: Get from [OpenAI](https://platform.openai.com/api-keys)
- `RAPIDAPI_KEY`: Get from [RapidAPI](https://rapidapi.com)
- `GEMINI_API_KEY`: Get from [Google AI Studio](https://makersuite.google.com/app/apikey)

**Important**: Never commit your `.env` file or any files containing API keys to version control!

## Steps to Run Locally

**Navigate to the Project Directory:**
Change to the directory where the `setup.sh`, `main.py`, `requirements.txt`, and `README.md` files are located. For example:

```sh
cd path/to/project/directory
```

### 1. Run the Setup File

Make the setup.sh Script Executable (if necessary):
On Linux or macOS, you might need to make the setup.sh script executable:

```shell
chmod +x setup.sh
```

Execute the setup.sh script to set up the environment, install dependencies, login to composio and
add necessary tools:

```shell
./setup.sh
```

Now, Fill in the .env file with your secrets.

### 2. Run the python script

```shell
python main.py
```

## Web Interface (Optional)

You can also run Trend Finder through a web interface, which allows you to share access with others securely.

### 1. Set up the Web Interface

Run the web setup script to install necessary components and set up authentication:

```shell
./setup_web.sh
```

This will:

- Install ttyd (requires Homebrew on macOS)
- Generate secure credentials for web access
- Save credentials in `.web_credentials` file

### 2. Start the Web Interface

Start the web interface with:

```shell
./start_web.sh
```

This will:

- Start a web server on http://localhost:8080
- Display login credentials
- Provide a secure terminal interface in your browser

### Security Notes

- The web interface uses basic authentication
- Credentials are stored locally in `.web_credentials`
- The `.web_credentials` file is automatically added to `.gitignore`
- All API keys and sensitive data remain secure on the server
