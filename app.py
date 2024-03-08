import string
import random
from datetime import datetime
from flask import *
# from flask import Flask, g
from functools import wraps
import sqlite3

app = Flask(__name__)
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0

def get_db():
    db = getattr(g, '_database', None)

    if db is None:
        db = g._database = sqlite3.connect('db/watchparty.sqlite3')
        db.row_factory = sqlite3.Row
        setattr(g, '_database', db)
    return db

@app.teardown_appcontext
def close_connection(exception):
    db = getattr(g, '_database', None)
    if db is not None:
        db.close()

def query_db(query, args=(), one=False):
    db = get_db()
    cursor = db.execute(query, args)
    rows = cursor.fetchall()
    db.commit()
    cursor.close()
    if rows:
        if one: 
            return rows[0]
        return rows
    return None

# For debug
# ----------------------------------------------

def get_table_structure(table_name):
    query = f'PRAGMA table_info({table_name});'
    return query_db(query)

def print_table_structure(table_name):
    columns_info = get_table_structure(table_name)
    if columns_info:
        print(f"Structure of '{table_name}' table:")
        for col in columns_info:
            print(f"Column name: {col['name']}, Type: {col['type']}, Not Null: {col['notnull']}, Default Value: {col['dflt_value']}, Primary Key: {col['pk']}")
    else:
        print(f"No information found for table '{table_name}'.")

def print_table_name():
    print_table_structure('channelmessages')
    print_table_structure('channels')
    print_table_structure('users')
    print_table_structure('rooms')
    print_table_structure('messages')


def drop_table(table_name):
    query = f'DROP TABLE IF EXISTS {table_name};'
    query_db(query)

def create_table_channels():
    query = '''
CREATE TABLE IF NOT EXISTS channels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(40) NOT NULL
);
    '''
    query_db(query)

def create_table_channelmessages():
    query = '''
    CREATE TABLE IF NOT EXISTS channelmessages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    channel_id INTEGER NOT NULL,
    body VARCHAR(40) NOT NULL,
    replies_to INTEGER,
    FOREIGN KEY (channel_id) REFERENCES channels(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (replies_to) REFERENCES channelmessages(id)
);
    '''
    query_db(query)
# ----------------------------------------------

def new_user():
    name = "Unnamed User #" + ''.join(random.choices(string.digits, k=6))
    password = ''.join(random.choices(string.ascii_lowercase + string.digits, k=10))
    api_key = ''.join(random.choices(string.ascii_lowercase + string.digits, k=40))
    u = query_db('insert into users (name, password, api_key) ' + 
        'values (?, ?, ?) returning id, name, password, api_key',
        (name, password, api_key),
        one=True)
    return u

def create_channel(name=None):
    if name is None:
        name = "Unnamed Channel #" + ''.join(random.choices(string.digits, k=6))
    channel = query_db('INSERT INTO channels (name) VALUES (?) returning id, name', (name,), one=True)
    # Return the newly created channel's ID and name
    return channel

# check API decoration function
def api_key_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        api_key = request.headers.get('Authorization')
        user = query_db('SELECT * FROM users WHERE api_key = ?', [api_key], one=True)
        if api_key and user:
            return f(*args, **kwargs)
        else:
            # print(api_key, "\n", user)
            return jsonify({"error": "Authentication failed"}), 403
    return decorated_function

# TODO: If your app sends users to any other routes, include them here.
#       (This should not be necessary).
@app.route('/')
@app.route('/profile')
@app.route('/login')
@app.route('/room')
@app.route('/room/<chat_id>')
def index(chat_id=None):
#------------------------------------------------------------
#debug
    # create_table_channelmessages()
    # print_table_name()
#------------------------------------------------------------
    return app.send_static_file('index.html')

@app.errorhandler(404)
def page_not_found(e):
    return app.send_static_file('404.html'), 404

# -------------------------------- API ROUTES ----------------------------------

@app.route('/api/signup', methods=['POST'])
def api_signup():
    user = new_user()
    return {'id': user['id'], 'name': user['name'], 'api_key': user['api_key'], 'password': user['password']}

@app.route('/api/login',  methods=['POST'])
def api_login():
    username = request.json.get('username')
    password = request.json.get('password')
    user = query_db('SELECT * FROM users WHERE name = ? AND password = ?', [username, password], one=True)
    if user:
        return {'api_key': user['api_key']}
    else:
        return {'error': 'Invalid credentials'}, 401

# Profile
@app.route('/api/username', methods=['POST'])
@api_key_required
def update_username():
    data = request.get_json()
    username = data.get('username')
    api_key = request.headers.get('Authorization')
    try:
        query_db('UPDATE users SET name = ? WHERE api_key = ?', [username, api_key])
        return jsonify({"message": "Username updated successfully"}), 200
    except sqlite3.Error as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/password', methods=['POST'])
@api_key_required
def update_password():
    data = request.get_json()
    password = data.get('password')
    api_key = request.headers.get('Authorization')
    try:
        query_db('UPDATE users SET password = ? WHERE api_key = ?', [password, api_key])
        return jsonify({"message": "Password updated successfully"}), 200
    except sqlite3.Error as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/channel', methods=['POST'])
@api_key_required
def api_create_channel():
    # Get the name from the form data, default to None if not provided
    name = request.get_json().get('name', None)
    if name is not None and not name.strip():
        name = None
    channel = create_channel(name)
    return {'id': channel['id'], 'name': channel['name']}

@app.route('/api/channels', methods=['GET'])
@api_key_required
def get_channels():
    channels = query_db("SELECT id, name FROM channels;")
    channels_list = [{'id': channel['id'], 'name': channel['name']} for channel in channels]
    return jsonify(channels_list)