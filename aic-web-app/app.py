from utils.py_utils import *
from flask import Flask, request, jsonify, render_template

host = '0.0.0.0' #when preparing for production, change this to the EC2 public IP
app = Flask(__name__)

@app.route('/')
def home():
    return render_template(f'index.html')

@app.errorhandler(500)
def internal_error():
    return jsonify({'error': 'Internal Server Error'}), 500

@app.route('/api/app', methods=['POST'])
def handle_request():
    try:
        data = request.get_json()
        f_name = data.get('f_name')
        args = data.get('args', {})
        print(f"Function: {f_name}, Args: {args}")

        f_name = data.get('f_name')
        if f_name == 'search':
            print(f"Search called")
            result = search(**args)
            return jsonify(result)
        elif f_name == 'get_all_entities':
            print(f"Get all entities called")
            result = get_all_entities(**args)
            return jsonify(result)
        else:
            raise ValueError(f'Function {f_name} is not defined in this module.')
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    
if __name__ == '__main__':
    app.run(host=host)