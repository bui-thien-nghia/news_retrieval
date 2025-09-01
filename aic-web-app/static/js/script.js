// Setup
const loadBatchSize = 200;
const numTags = 7;
const output_fields = ['img_key', 'video_id', 'frame_id', 'time_order', 'frame_order', 'answer_key', 'youtube_link', 'publish_date']
const region = "ap-southeast-2"
var bucket = "aic2025"
var isLoadingBatch = false;
var currentLoadIndex = 0;
var currentDataset = [];
var currentResult = [];
var currentDisplay = [];
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

async function getDataset(file_name) {
    const response = await fetch(file_name)
}

async function preloadDataset(filename) {
    const resultContainer = document.querySelector(".middle-panel");
    resultContainer.innerHTML = '<span>Loading dataset...</span>';
    // args = {
    //     file_name: `${filename}.pt`
    // };
    // const result = await callPythonFunction('get_dataset_from_local', args).catch(error => {
    //     console.error('Error fetching all entities:', error);
    //     return {};
    // });
    const result = listDatasets[filename]
    currentDataset = [...Object.values(result)];
    currentDisplay = [...currentDataset];
    currentLoadIndex = 0; // Reset preload index
    if (currentDataset.length === 0) {
        resultContainer.innerHTML = '<span>Nothing to load</span>';
        return;
    }
    resultContainer.innerHTML = ''; // Clear previous content
    loadImageFromS3(resultContainer, currentDisplay, bucket, region);
}

// Metadata tag switch
function addImageBoxEventListeners() {
    const tags = document.querySelectorAll('.tag');
    const cont_buttons = document.querySelectorAll('.cont-search');
    // Tag switch
    for (let i = currentLoadIndex * numTags; i < tags.length; i++) {
        let tag = tags[i];
        let tagSwitchId = tag.id;
        tagSwitchId = tagSwitchId.replace('tag_', '');
        let tagSwitch = document.getElementById(tagSwitchId);
        tagSwitch.addEventListener('change', () => {
            tag.style.display = tagSwitch.checked ? 'block' : 'none';
        });
        tag.style.display = tagSwitch.checked ? 'block' : 'none';
    }

    //Continue searching button
    for (let i = currentLoadIndex; i < cont_buttons.length; i++) {
        let button = cont_buttons[i];
        button.addEventListener('click', async () => {
            let resultContainer = document.querySelector(".middle-panel");
            resultContainer.innerHTML = '<span>Getting image feature...</span>';
            let image_feature = await callPythonFunction('get_milvus_feature', {
                key: button.getAttribute('data-img_key'),
                collection_name: document.getElementById("collection_name").value
            }).catch(error => {
                console.error(`Error fetching feature: ${error}`);
                return [];
            });

            let args = {
                query: image_feature,
                lang: document.getElementById("lang").value,
                collection_name: document.getElementById("collection_name").value,
                top_k: Number(document.getElementById("top_k").value),
                ef: Number(document.getElementById("ef").value),
                output_fields: output_fields
            };

            resultContainer.innerHTML = '<span>Searching...</span>';
            let result = await callPythonFunction('search', args).catch(error => {
                console.error('Error fetching search results:', error);
                resultContainer.innerHTML = '<span>Error fetching results</span>';
                return {};
            });
            
            currentResult = [...Object.values(result)];
            currentDisplay = [...Object.values(result)];
            currentLoadIndex = 0; // Reset preload index
            if (currentResult.length === 0) {
                resultContainer.innerHTML = '<span>No results found</span>';
                return;
            }
            resultContainer.innerHTML = ''; // Clear previous content
            loadImageFromS3(resultContainer, currentDisplay, bucket, region);
        });
    }
}

function loadImageFromS3(container, listEntities, bucket, region) {
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
                    <div class="search-layer">
                        <div class="button cont-search" data-img_key=${entity.img_key}>🔍</div>
                    </div>
                `
                container.appendChild(resultItem);
            } catch (error) {
                console.error('Error loading image:', error);
                return; // Skip this entity if there's an error
            }
        }

        addImageBoxEventListeners();
        currentLoadIndex += loadBatchSize;
        isLoadingBatch = false;
    }, 0);

    isLoadingBatch = true;
}

// Color settings
const modal_container = document.getElementById('modal_container');
const popupOpen = document.getElementById('color_open');
const popupSaving = document.querySelector('.modal-footer');
const popupClose = document.querySelector('.color-close')

popupOpen.addEventListener('click', ()=>{
    modal_container.classList.toggle('show');
});
            
popupSaving.addEventListener('click', ()=>{
    const color_val = document.getElementById('bg_color').value;
    document.body.style.backgroundColor = color_val;
});

popupClose.addEventListener('click', () => {
    modal_container.classList.toggle('show')
});


// Show/hide recheck panel
var recheckShown = false;
document.querySelector('.show-recheck').addEventListener('click', () => {
    const body = document.body;
    if (!recheckShown) {
        body.style.gridTemplateAreas =`
            "h h h"
            "l m r"
        `;
        recheckShown = true;
        console.log("Recheck shown");
    } else {
        body.style.gridTemplateAreas =`
            "h h h"
            "l m m"
        `;
        recheckShown = false;
        console.log("Recheck hidden");
    }
});

// Scroll only appears a set number of images
document.querySelector('.middle-panel').addEventListener('scroll', function() {
    const container = this;
    const scrollHeight = container.scrollHeight;
    const scrollTop = container.scrollTop;
    const clientHeight = container.clientHeight;
    if (scrollTop + clientHeight >= scrollHeight - 150 && currentLoadIndex < currentDisplay.length && !isLoadingBatch) { // Allocate 150px for buffer
        loadImageFromS3(container, currentDisplay, bucket, region);
    }
});

//Pre-load images everytime collection name is changed
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById("collection_name").addEventListener('change', (event) => {
        bucket = event.target.value; // Make sure the filename is THE SAME AS bucket's name
        preloadDataset(bucket);
    });
    preloadDataset(bucket);
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

// Search bar
document.getElementById("search_button").addEventListener("click", async () => {
    const args = {
        query: document.getElementById("key_query").value,
        lang: document.getElementById("lang").value,
        collection_name: document.getElementById("collection_name").value,
        top_k: Number(document.getElementById("top_k").value),
        ef: Number(document.getElementById("ef").value),
        output_fields: output_fields
    };
    
    var searchMode = document.getElementById("search_mode").value;
    if (searchMode === "range_search") {
        args.radius = Number(document.getElementById("radius").value);
        args.range_filter = Number(document.getElementById("range_filter").value);
    } else if (searchMode === "grouping_search") {
        args.group_by_field = document.getElementById("group_by_field").value;
        args.group_size = Number(document.getElementById("group_size").value);
        args.strict_group_size = document.getElementById("strict_group_size").checked;
    }

    const resultContainer = document.querySelector(".middle-panel");
    resultContainer.innerHTML = '<span>Searching...</span>';
    const result = await callPythonFunction('search', args).catch(error => {
        console.error('Error fetching search results:', error);
        resultContainer.innerHTML = '<span>Error fetching results</span>';
        return {};
    });
    
    currentResult = [...Object.values(result)];
    currentDisplay = [...Object.values(result)];
    currentLoadIndex = 0; // Reset preload index
    if (currentResult.length === 0) {
        resultContainer.innerHTML = '<span>No results found</span>';
        return;
    }
    resultContainer.innerHTML = ''; // Clear previous content
    loadImageFromS3(resultContainer, currentDisplay, bucket, region);
});

//Adjust column number
document.getElementById('num_columns').addEventListener('input', function() {
    document.documentElement.style.setProperty('--numcol', this.value);
});

//Filter Sorting
function sorting_handler(event, input_id, entities){
    if (event.key === 'Enter'){
        const resultContainer = document.querySelector(".middle-panel");
        const text_value = document.getElementById(input_id).value;
        const filter_name = input_id.replace('sort_', '');
        result_list = [];

        switch (filter_name){
            case 'video_id':{
                entities.forEach(entity =>{
                    if (text_value == entity.video_id)
                        result_list.push(entity);
                });
                break;
            }
            case 'frame_id':{
                entities.forEach(entity =>{
                    if (text_value == entity.frame_id)
                        result_list.push(entity);
                });
                break;
            }
            case 'frame_order':{
                entities.forEach(entity =>{
                    if (text_value == entity.frame_order)
                        result_list.push(entity);
                });
                break;
            }
            case 'time_order':{
                entities.forEach(entity =>{
                    if (text_value == entity.time_order)
                        result_list.push(entity);
                });
                break;
            }
            case 'answer_key':{
                entities.forEach(entity =>{
                    if (text_value == entity.answer_key)
                        result_list.push(entity);
                });
                break;
            }
            case 'youtube_linl':{
                entities.forEach(entity =>{
                    if (text_value == entity.youtube_link)
                        result_list.push(entity);
                });
                break;
            }
            case 'publish_date':{
                entities.forEach(entity =>{
                    if (text_value == entity.publish_date)
                        result_list.push(entity);
                });
                break;
            }
        };
        
        currentDisplay = [];
        currentDisplay = [...Object.values(result_list)];
        currentLoadIndex = 0;
        resultContainer.innerHTML ='';
        loadImageFromS3(resultContainer, currentDisplay, bucket, region);
    };
}

document.getElementById('sort_video_id').addEventListener('keydown', function(event){
    sorting_handler(event, 'sort_video_id',currentDisplay);
});
document.getElementById('sort_frame_id').addEventListener('keydown', function(event){
    sorting_handler(event, 'sort_frame_id',currentDisplay);
});
document.getElementById('sort_time_order').addEventListener('keydown', function(event){
    sorting_handler(event, 'sort_time_order',currentDisplay);
});
document.getElementById('sort_frame_order').addEventListener('keydown', function(event){
    sorting_handler(event, 'sort_frame_order',currentDisplay);
});
document.getElementById('sort_answer_key').addEventListener('keydown', function(event){
    sorting_handler(event, 'sort_answer_key',currentDisplay);
});
document.getElementById('sort_publish_date').addEventListener('keydown', function(event){
    sorting_handler(event, 'sort_publish_date',currentDisplay);
});

//Revert Searching
document.getElementById("revert_searching").addEventListener('mouseover', function(event){
    const obj1 = document.getElementById("btn_1");
    obj1.style.display = 'block';
    obj1.style.left = event.pageX + 'px';
    obj1.style.top = event.pageY + 'px';
});
document.getElementById("revert_searching").addEventListener('mouseout', function(){
    let obj1 = document.getElementById("btn_1");
    obj1.style.display = 'none';
});
document.getElementById("revert_searching").addEventListener('click', function(){
    let container = document.querySelector('.middle-panel');
    currentResult = [];
    currentDisplay = [...currentDataset];
    currentLoadIndex = 0;
    container.innerHTML = '';
    console.log(currentDisplay.length)
    loadImageFromS3(container, currentDisplay, bucket, region);
});

//Revert Sorting
document.getElementById("revert_sorting").addEventListener('mouseover', function(event){
    const obj = document.getElementById("btn_2");
    obj.style.display = 'block';
    obj.style.left = event.pageX + 'px';
    obj.style.top = event.pageY + 'px';
});
document.getElementById("revert_sorting").addEventListener('mouseout', function(){
    let obj = document.getElementById("btn_2");
    obj.style.display = 'none';
});
document.getElementById("revert_sorting").addEventListener('click', function(){
    let container = document.querySelector('.middle-panel');
    if (currentResult.length > 0) {
        currentDisplay = [...currentResult];
    } else {
        currentDisplay = [...currentDataset];
    }
    currentLoadIndex = 0;
    container.innerHTML = '';
    loadImageFromS3(container, currentDisplay, bucket, region);
});