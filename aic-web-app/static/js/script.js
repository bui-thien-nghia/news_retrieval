// Setting color
const open = document.getElementById('btn-open');
const close = document.getElementById('btn-close');
const modal_container = document.getElementById('modal-container');
const modal_demo = document.getElementById('modal-demo');
const saving = document.getElementById('sub_btn');
const loadBatchSize = 100;
const numTags = 7; // Number of tags to display
var isLoadingBatch = false;
var currentLoadIndex = 0;
var datasetNoFeature = [];
var currentResult = [];
var searchHistory = [];

async function callPythonFunction(f_name, args) {
    const response = await fetch('/api/app', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ f_name: f_name, args: args })
    });
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data;
}

// Metadata tag switch
function addTagSwitchEventListener() {
    const tags = document.querySelectorAll('.tag');
    for (var i = currentLoadIndex * numTags; i < tags.length; i++) {
        var tag = tags[i];
        var tagSwitchId = tag.id;
        tagSwitchId = tagSwitchId.replace('tag_', '');
        var tagSwitch = document.getElementById(tagSwitchId);
        tag.style.display = tagSwitch.checked ? 'block' : 'none';
        tagSwitch.addEventListener('change', function() {
            tag.style.display = tagSwitch.checked ? 'block' : 'none';
        });
    }
}

function loadImageFromS3(container, listEntities, bucket, region) {
    console.log('Loading images from S3...');
    if (isLoadingBatch) {
        console.log('Already loading a batch, skipping this call.');
        return; // Prevent multiple concurrent loads
    }

    setTimeout(() => {
        const end = Math.min(currentLoadIndex + loadBatchSize, listEntities.length);
        for (let i = currentLoadIndex; i < end; i++) {
            try {
                const entity = listEntities[i];
                const resultItem = document.createElement('div');
                resultItem.className = 'box';
                resultItem.style.backgroundImage = `url(\'https://${bucket}.s3.${region}.amazonaws.com/${entity.img_key}\')`;
                resultItem.innerHTML = `
                    <div class="image-layer">
                        <img src="https://${bucket}.s3.${region}.amazonaws.com/${entity.img_key}" alt="Image broken:<" loading="lazy">
                    </div>
                    <div class="tag-layer">
                        <div class="tag tag-video_id" id="tag_video_id">${entity.video_id}</div>
                        <div class="tag tag-frame_id" id="tag_frame_id">${entity.frame_id}</div>
                        <div class="tag tag-time_order" id="tag_time_order">${entity.time_order}</div>
                        <div class="tag tag-frame_order" id="tag_frame_order">${entity.frame_order}</div>
                        <div class="tag tag-answer_key" id="tag_answer_key">${entity.answer_key}</div>
                        <div class="tag tag-youtube_link" id="tag_youtube_link"><a target="_blank" href=${entity.youtube_link}>Click here</a></div>
                        <div class="tag tag-publish_date" id="tag_publish_date">${entity.publish_date}</div>
                    </div>
                `
                container.appendChild(resultItem);
            } catch (error) {
                console.error('Error loading image:', error);
                return; // Skip this entity if there's an error
            }
        }

        addTagSwitchEventListener();
        currentLoadIndex += loadBatchSize;
        isLoadingBatch = false;
    }, 0);
}
open.addEventListener('click', ()=>{
    modal_container.classList.add('show');
});
close.addEventListener('click', ()=>{
    modal_container.classList.remove('show');
});

modal_container.addEventListener('click', (e)=>{
    if(!modal_demo.contains(e.target)){
        close.click();
    }
});
            
saving.addEventListener('click', ()=>{
    const color_val = document.getElementById('mau').value;
    document.body.style.backgroundColor = color_val;
});

// Search bar
document.getElementById("search_button").addEventListener("click", async () => {
    const args = {
        query: document.getElementById("key_query").value,
        lang: document.getElementById("lang").value,
        collection_name: document.getElementById("collection_name").value,
        top_k: Number(document.getElementById("top_k").value),
        options: {
            ef: Number(document.getElementById("ef").value),
        }
    };
    
    var searchMode = document.getElementById("search_mode").value;
    if (searchMode === "range_search") {
        args.options.radius = Number(document.getElementById("radius").value);
        args.options.range_filter = Number(document.getElementById("range_filter").value);
    } else if (searchMode === "grouping_search") {
        args.options.group_by_field = document.getElementById("group_by_field").value;
        args.options.group_size = Number(document.getElementById("group_size").value);
        args.options.strict_group_size = document.getElementById("strict_group_size").checked;
    }

    const resultContainer = document.querySelector(".middle-panel");
    currentResult = []; // Reset current result
    resultContainer.innerHTML = '<span>Searching...</span>';
    const result = await callPythonFunction('search', args).catch(error => {
        console.error('Error fetching search results:', error);
        resultContainer.innerHTML = '<span>Error fetching results</span>';
        return {};
    });
    
    currentResult = [...Object.values(result)];
    currentLoadIndex = 0; // Reset preload index
    if (currentResult.length === 0) {
        resultContainer.innerHTML = '<span>No results found</span>';
        return;
    }
    resultContainer.innerHTML = ''; // Clear previous content
    loadImageFromS3(resultContainer, currentResult, 'aic24', 'ap-southeast-2');
});

// Search mode change handler
document.addEventListener('DOMContentLoaded', function() {
    const search_mode = document.getElementById('search_mode');
    const all_content = document.querySelectorAll('.hideable');

    function hideAllContent() {
        all_content.forEach(content => {
            content.style.display = 'none';
        });
    }
    hideAllContent();

    search_mode.addEventListener('change', function() {
        hideAllContent();

        const selectedValue = this.value;
        const targetContent = document.getElementById(selectedValue);

        if (targetContent) {
            targetContent.style.display = 'flex';
            targetContent.style.flexDirection = 'column';
        }
    });

    const initialSelectedValue = search_mode.value;
    const initialTargetContent = document.getElementById(initialSelectedValue);
    if (initialTargetContent) {
        initialTargetContent.style.display = 'flex';
        initialTargetContent.style.flexDirection = 'column';
    
    }
});

//Adjust column number
document.getElementById('num_columns').addEventListener('input', function() {
    document.documentElement.style.setProperty('--numcol', this.value);
});

// Pre-load images (currently pre-load last year's dataset)
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Pre-loading images...');
    args = {
        bucket_name: 'aic24',
        key: 'aic24/dataset-aic24-no-feature.pt'
    };
    const resultContainer = document.getElementsByClassName("middle-panel")[0];
    resultContainer.innerHTML = '<span>Loading dataset...</span>';
    if (datasetNoFeature.length == 0) {
        const result = await callPythonFunction('get_dataset_from_s3', args).catch(error => {
            console.error('Error fetching all entities:', error);
            return {};
        });
        datasetNoFeature = [...Object.values(result)];
    }

    currentResult = [...datasetNoFeature];
    currentLoadIndex = 0; // Reset preload index
    if (datasetNoFeature.length === 0) {
        resultContainer.innerHTML = '<span>Nothing to load</span>';
        return;
    }
    resultContainer.innerHTML = ''; // Clear previous content
    loadImageFromS3(resultContainer, datasetNoFeature, 'aic24', 'ap-southeast-2');
});

// Scroll only appears a set number of images
document.querySelector('.middle-panel').addEventListener('scroll', function() {
    const container = this;
    const scrollHeight = container.scrollHeight;
    const scrollTop = container.scrollTop;
    const clientHeight = container.clientHeight;
    if (scrollTop + clientHeight >= scrollHeight - 100 && currentLoadIndex < currentResult.length && !isLoadingBatch) {
        loadImageFromS3(container, currentResult, 'aic24', 'ap-southeast-2');
    }
});