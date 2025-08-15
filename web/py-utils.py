# Module setup
import torch
import torch.nn.functional as F
from open_clip import create_model_from_pretrained, get_tokenizer
from pymilvus import MilvusClient, connections, Collection
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

# Load essentials
model, preprocess = create_model_from_pretrained('hf-hub:apple/DFN5B-CLIP-ViT-H-14-384')
device = 'cuda' if torch.cuda.is_available() else 'cpu'
model.eval()
model.to(device)
tokenizer = get_tokenizer('ViT-H-14')

translator_name = 'VietAI/envit5-translation'
translate_tokenizer = AutoTokenizer.from_pretrained(translator_name)
translate_model = AutoModelForSeq2SeqLM.from_pretrained(translator_name)

uri = 'https://in03-cbdb10d1d199984.serverless.aws-eu-central-1.cloud.zilliz.com'
token ='6305ff67695e59bf211ca717cb68f74f7367ccfd56195824ba6aad7c07f5924cc6c9da8aadec4354aedc193a997225494903a9d7'
client = MilvusClient(
    uri=uri,
    token=token
)
connections.connect(
    uri=uri,
    token=token
)

# Function define
def get_all_entities(collection_name: str, batch_size: 1000):
    '''
    Kéo hết dataset về web để phục vụ hiển thị khi không có truy vấn.

    Arguments:
    -----
    :collection_name: Tên của bộ sưu tập dùng để truy vấn, được lưu trên Zilliz Cloud
    :batch_size: Số kết quả của mỗi trang của iterator. Mặc định là 1000

    Return:
    :all_entities (list[dict]): Danh sách của tất cả hình ảnh kèm metadata
    '''
    # Get iterator
    collection = Collection(collection_name)
    iterator = collection.query_iterator(
        batch_size=batch_size,
        expr="id >= 0",
        output_fields=["*"]
    )

    # Get all entities out of iterator
    all_entities = []
    while True:
        batch = iterator.next()
        if not batch:
            iterator.close()
            break
        all_entities.extend(batch)

    return all_entities


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

    text_feature = text_feature.squeeze().tolist()

    return text_feature


def search(query: str, lang: str, collection_name: str, top_k: int, **options):
    '''
    Trả về danh sách thứ tự truy vấn xếp theo thứ tự khoảng cách không tăng.
    Khi truy vấn, điền hết tất cả argument vào function. Nếu không điền ô nào, ô đó trả về None.

    Arguments (BẮT BUỘC):
    -----
    :query: Câu truy vấn
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
    # Prepare search parameters
    search_params = {
        'metric_type': 'COSINE',
        'params': {
            'ef': options['ef'] if 'ef' in options else 200
        }
    }
    if 'radius' in options and options['radius'] is not None:
        search_params['params']['radius'] = options['radius']
    if 'range_filter' in options and options['range_filter'] is not None:
        search_params['params']['range_filter'] = options['range_filter']

    # Initiate search
    if 'group_by_field' in options and options['radius_filter'] is not None:
        search_result = client.search(
            collection_name,
            data=[prepare_query(query, lang)],
            limit=top_k,
            group_by_field=options['group_by_field'],
            group_size=options['group_size'] if 'group_size' in options else 1,
            strict_group_size=options['strict_group_size'] if 'strict_group_size' in options else False,
            output_fields=['*'],
            search_params=search_params
        )
    else:
        search_result = client.search(
            collection_name,
            data=[prepare_query(query, lang)],
            limit=top_k,
            output_fields=['*'],
            search_params=search_params
        )
    
    # Group results into one list
    result_dicts = []
    for res in search_result:
        for hit in res:
            result_dicts.append(hit['entity'])
    
    return result_dicts


def get_keys(search_result: list[dict]):
    '''
    Trả về list chứa key của các hình -> list[str]
    '''
    if len(search_result) == 0:
        return []
    return [entity['img_key'] for entity in search_result]


def get_metadata_list_dict(search_result: list[dict]):
    '''
    Trả về dict chứa thông tin của tất cả metadata của các hình -> dict{'key': list[any]}
    '''
    # Create a new dict with empty lists
    if len(search_result) == 0:
        return {}
    
    # Add fields into dict
    all_fields = list(search_result[0].keys())
    metadata_list_dict = {}
    for field in all_fields:
        if field not in ['id', 'vector', 'img_key']:
            metadata_list_dict[field] = []

    # Add entities' metadata into lists
    for entity in search_result:
        for field in list[metadata_list_dict.keys()]:
            if entity[field] not in metadata_list_dict[field]:
                metadata_list_dict[field].append(entity[field])

    return metadata_list_dict