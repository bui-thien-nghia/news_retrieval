from utils.py_utils import *
from flask import Flask, request, jsonify, render_template

app = Flask(__name__)
app.debug = False # Set to False in production

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
        elif f_name == 'get_dataset_from_local':
            print(f"Get dataset from S3 called")
            result = get_dataset_from_local(**args)
            print(f"Result: {len(result)}")
            return jsonify(result)
        elif f_name == 'get_milvus_feature':
            print(f"Get Milvus feature called")
            result = get_milvus_feature(**args)
            return jsonify(result)
        else:
            raise ValueError(f'Function {f_name} is not defined in this module.')
    except Exception as e:
        print(f"Error: {e}")
        return jsonify({'error': str(e)}), 500
    
if __name__ == '__main__':
    app.run(host="0.0.0.0")