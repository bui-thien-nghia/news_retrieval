import os
import json
import sys
import torch
from io import BytesIO
import boto3

s3 = boto3.client(
    's3',
    region_name='ap-southeast-2',
    aws_access_key_id='AKIAQDPHTGR3B5QJOU6M',
    aws_secret_access_key='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',
)

if __name__ == '__main__':
    bucket_name = sys.argv[1]
    key = sys.argv[2]
    if bucket_name == '' or key == '':
        print('Bucket name or key missing. Try again.')
        sys.exit(1)

    file_name = key.split('/')[-1]
    new_file_name = f'datasets\\{sys.argv[3] if len(sys.argv) > 3 else file_name}'
    if os.path.exists(new_file_name):
        print('Dataset already exists on your directory.')
        sys.exit(0)

    s3.put_bucket_accelerate_configuration(
        Bucket=bucket_name,
        AccelerateConfiguration={
            'Status': 'Enabled'
        }
    )

    print(f'Getting dataset from S3: {bucket_name}/{key}')
    response = s3.get_object(Bucket=bucket_name, Key=key)
    buffer = BytesIO(response['Body'].read())
    dataset = torch.load(buffer)

    print(f'Saving dataset with name: {new_file_name}')
    torch.save(dataset, new_file_name)
    print('Done!')
    sys.exit(0)