from flask import Flask, render_template, jsonify, send_file, Response, request
import os
from datetime import datetime
import subprocess
import signal
import atexit
import logging
from twitter_lists import TWITTER_LISTS

app = Flask(__name__)
ttyd_process = None
selected_categories = []
logging.basicConfig(level=logging.INFO)

def start_ttyd():
    """Start the ttyd process with selected categories."""
    global ttyd_process
    if ttyd_process:
        return ttyd_process
        
    if os.path.exists('.web_credentials'):
        with open('.web_credentials', 'r') as f:
            creds = dict(line.strip().split('=') for line in f)
        
        # Pass selected categories as environment variables
        env = os.environ.copy()
        env['TREND_CATEGORIES'] = ','.join(selected_categories)
        
        cmd = [
            'ttyd', '-p', '8081',  # Use a different port for the terminal
            '-c', f"{creds.get('WEBAPP_USER', 'admin')}:{creds.get('WEBAPP_PASSWORD', 'admin')}",
            '-t', 'fontSize=14',
            '-t', 'theme={"background":"#1a1b26"}',
            '-t', 'disableLeaveAlert=true',
            'python', 'main.py'
        ]
        try:
            ttyd_process = subprocess.Popen(cmd, env=env)
            logging.info(f"Started ttyd process with categories: {selected_categories}")
            return ttyd_process
        except Exception as e:
            logging.error(f"Failed to start ttyd: {e}")
            return None
    return None

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/twitter_lists')
def get_twitter_lists():
    return jsonify(TWITTER_LISTS)

@app.route('/api/start_analysis', methods=['POST'])
def start_analysis():
    global selected_categories
    data = request.json
    selected_categories = data.get('categories', [])
    logging.info(f"Selected categories: {selected_categories}")
    return jsonify({"status": "success"})

@app.route('/terminal')
def terminal():
    # Start ttyd when terminal is requested
    if not ttyd_process:
        start_ttyd()
    return render_template('terminal.html', ttyd_url="http://localhost:8081")

@app.route('/api/reports')
def list_reports():
    reports = []
    try:
        for filename in os.listdir('trends'):
            if filename.endswith('.md'):
                path = os.path.join('trends', filename)
                created_at = datetime.fromtimestamp(os.path.getctime(path))
                reports.append({
                    'filename': filename,
                    'created_at': created_at.strftime('%Y-%m-%d %H:%M:%S')
                })
    except FileNotFoundError:
        os.makedirs('trends', exist_ok=True)
    
    return jsonify(sorted(reports, key=lambda x: x['created_at'], reverse=True))

@app.route('/api/reports/<filename>/content')
def view_report(filename):
    try:
        with open(os.path.join('trends', filename), 'r') as f:
            content = f.read()
        return Response(content, mimetype='text/markdown')
    except Exception as e:
        return jsonify({'error': str(e)}), 404

@app.route('/api/reports/<filename>/download')
def download_report(filename):
    return send_file(
        os.path.join('trends', filename),
        as_attachment=True,
        download_name=filename
    )

def cleanup():
    """Cleanup function to kill ttyd process on exit"""
    if ttyd_process:
        logging.info("Cleaning up ttyd process")
        ttyd_process.send_signal(signal.SIGTERM)

if __name__ == '__main__':
    # Register cleanup
    atexit.register(cleanup)
    
    # Run Flask app
    app.run(port=8080, debug=True) 