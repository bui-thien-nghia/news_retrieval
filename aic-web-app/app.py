import json
from glob import glob
from utils.py_utils import *
from flask import Flask, request, jsonify, render_template
from flask_sock import Sock
from flask_socketio import SocketIO, send, emit, join_room, leave_room

app = Flask(__name__)
sock = Sock(app)
recheck_boxes = []
list_datasets = {}
ws_clients = set()

all_dataset_file_names = glob('datasets\\*.pt')
for filename in all_dataset_file_names:
    print(f'Found {filename.split('\\')[-1][:-3]}')
    list_datasets[filename.split('\\')[-1][:-3]] = get_dataset_from_local(filename)

def broadcast(clients, payload):
    payload = json.dumps(payload)
    failed_clients = set()
    for client in clients:
        try:
            client.send(payload)
        except Exception as e:
            print(f'Failed to send to client: {e}')
            failed_clients.add(client)
    ws_clients.difference_update(failed_clients)

@sock.route('/ws')
def handle_ws(ws):
    ws_clients.add(ws)
    try:
        while True:
            data = json.loads(ws.receive())
            payload = {}
            try:
                if data['type'] == 'recheck_add':
                    recheck_boxes.append(data['data'])
                    payload['data'] = recheck_boxes
                    print(f'Add recheck called. Recheck list length after call: {len(recheck_boxes)}')
                elif data['type'] == 'recheck_swap':
                    box1 = data['data']['box1']
                    box2 = data['data']['box2']
                    idx1 = recheck_boxes.index(box1)
                    idx2 = recheck_boxes.index(box2)
                    recheck_boxes[idx1], recheck_boxes[idx2] = recheck_boxes[idx2], recheck_boxes[idx1]
                    payload['data'] = recheck_boxes
                    print(f'Swap recheck called. Recheck list length after call: {len(recheck_boxes)}')
                elif data['type'] == 'recheck_remove':
                    recheck_boxes.remove(data['data'])
                    payload['data'] = recheck_boxes
                    print(f'Remove recheck called. Recheck list length after call: {len(recheck_boxes)}')
                elif data['type'] == 'recheck_preload':
                    payload['data'] = recheck_boxes
                    print(f'Preload recheck called.')

                broadcast(ws_clients, payload)
            except Exception as e:
                print(f'Error: {e}. Data received: {data['data']}')
    finally:
        ws_clients.discard(ws)


@app.route('/')
def index():
    return render_template('index.html', listDatasets=list_datasets)

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
            result = search(**args)
            return jsonify(result)
        elif f_name == 'get_dataset_from_local':
            result = get_dataset_from_local(**args)
            print(f"Result: {len(result)}")
            return jsonify(result)
        elif f_name == 'get_milvus_feature':
            result = get_milvus_feature(**args)
            return jsonify(result)
        elif f_name == 'query':
            result = query(**args)
            return jsonify(result)
        else:
            raise ValueError(f'Function {f_name} is not defined in this module.')
    except Exception as e:
        print(f"Error: {e}")
        return jsonify({'error': str(e)}), 500
    
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)