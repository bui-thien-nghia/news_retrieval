# Module setup
import os
import torch
import pandas as pd
import torch.nn.functional as F
from open_clip import create_model_from_pretrained, get_tokenizer
from pymilvus import MilvusClient
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

# Load essentials
model, preprocess = create_model_from_pretrained('hf-hub:apple/DFN5B-CLIP-ViT-H-14-384')
device = 'cuda' if torch.cuda.is_available() else 'cpu'
model = model.eval().to(device)
tokenizer = get_tokenizer('ViT-H-14')

translator_name = 'VietAI/envit5-translation'
translate_tokenizer = AutoTokenizer.from_pretrained(translator_name)
translate_model = AutoModelForSeq2SeqLM.from_pretrained(translator_name)
translate_model = translate_model.eval().to(device)

# Zilliz Cloud hosting
# client = MilvusClient(
#     uri='https://in03-cbdb10d1d199984.serverless.aws-eu-central-1.cloud.zilliz.com',
#     token='6305ff67695e59bf211ca717cb68f74f7367ccfd56195824ba6aad7c07f5924cc6c9da8aadec4354aedc193a997225494903a9d7',
# )

# Local hosting with Docker Desktop
client = MilvusClient('http://localhost:19530')

# Function define
def get_dataset_from_local(file_name: str):
    if os.path.exists(file_name):
        dataset = pd.read_parquet(file_name)
        dataset = dataset.drop(columns=['vector'], errors='ignore')
        dataset = dataset.to_dict(orient='records')
        return dataset
    else:
        print('No such dataset found.')
        return []

def prepare_query(query: str, lang: str):
    """
    Trả về đặt trưng câu truy vấn (và dịch Việt-Anh nếu cần)

    Arguments (BẮT BUỘC):
    -----
    :query: Câu truy vấn
    :lang: Ngôn ngữ truy vấn

    Return:
    -----
    :text_feature (list[float]): Đặc trưng của câu truy vấn
    """
    # Tranlate all to English (if needed)
    if lang == 'vie':
        output = translate_model.generate(translate_tokenizer(query, return_tensors='pt', padding=True).input_ids.to(device), max_length=1024)
        translated_query = translate_tokenizer.batch_decode(output, skip_special_tokens=True)
        used_query = translated_query[0][3:]
    elif lang == 'eng':
        used_query = query
    else:
        raise ValueError(f'{lang} is not supported. Supported language are: \'en\' and \'vie\'')

    # Compute text feature
    text = tokenizer(used_query, context_length=model.context_length).to(device)
    with torch.no_grad(), torch.amp.autocast(device):
        text_feature = model.encode_text(text)
        text_feature = F.normalize(text_feature, dim=-1)

    text_feature = text_feature.cpu().squeeze().tolist()

    return text_feature


def get_milvus_feature(link: str, collection_name: str):
    result = client.query(
        collection_name=collection_name,
        filter=f'img_link == \"{link}\"',
        output_fields=["vector"]
    )
    
    return result[0]['vector']


def query(link: str, collection_name: str):
    result = client.query(
        collection_name=collection_name,
        filter=f'img_link == \"{link}\"',
        output_fields=["*"]
    )
    
    return result[0]


def search(query: any, lang: str, collection_name: str, top_k: int, **options):
    '''
    Trả về danh sách thứ tự truy vấn xếp theo thứ tự khoảng cách không tăng.
    Khi truy vấn, điền hết tất cả argument vào function. Nếu không điền ô nào, ô đó trả về None.

    Arguments (BẮT BUỘC):
    -----
    :query: Câu truy vấn (str) HOẶC đặc trưng của hình có sẵn (list[float])
    :lang: Ngôn ngữ truy vấn
    :collection_name: Tên của bộ sưu tập dùng để truy vấn, được lưu trên Zilliz Cloud
    :top_k: Số lượng hình trả về

    Kwargs (Options) (TÙY CHỌN NÂNG CAO):
    -----
    :ef: Số đỉnh kề trong hàng đợi ưu tiên của mỗi đỉnh trong cấu trúc HNSW. Mặc định là 200. Càng tăng ef, tốc độ search chậm hơn nhưng kết quả chính xác hơn và ngược lại
    :radius: Cận dưới của % độ chính xác của dữ liệu các hình so với truy vấn
    :range-filter: Cận trên của % độ chính xác của dữ liệu các hình so với truy vấn
    :group-by-field: Metadata chọn để nhóm các dữ liệu để thực hiện search trên nhóm
    :group-size: Số kết quả tối đa trả về của từng nhóm
    :strict-group-size: Tùy chọn có bắt buộc trả về đúng [group-size] kết quả về ở từng nhóm hay không

    Return:
    ----
    :search_result (list[dict]): Danh sách kết quả truy vấn
    '''
    # Prepare search 
    args = {
        'collection_name': collection_name,
        'data': [prepare_query(query, lang)] if type(query) == str else [query],
        'limit': top_k,
        'output_fields': options['output_fields'] if 'output_fields' in options else ['*'],
        'search_params': {
            'metric_type': 'COSINE',
            'params': {
                'ef': options['ef'] if 'ef' in options and options['ef'] > 0 else top_k + 100
            }
        }
    }
    if 'group_by_field' in options and options['group_by_field'] != '':
        args['group_by_field'] = options['group_by_field']
    if 'group_size' in options and options['group_size'] != '':
        args['group_size'] = options['group_size']
    if 'strict_group_size' in options and options['strict_group_size'] != '':
        args['strict_group_size'] = options['strict_group_size']
    if 'radius' in options and options['radius'] != '':
        args['search_params']['params']['radius'] = options['radius']
    if 'range_filter' in options and options['range_filter'] != '':
        args['search_params']['params']['range_filter'] = options['range_filter']

    # Invoke search
    search_result = client.search(**args)
    
    # Group results into one list
    result_dict_list = []
    for res in search_result:
        for hit in res:
            result_dict_list.append(hit['entity'])
    
    return result_dict_list