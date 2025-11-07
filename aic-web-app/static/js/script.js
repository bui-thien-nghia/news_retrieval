// Setup
const loadBatchSize = 200;
const numTags = 7;
const output_fields = ['img_link', 'vid_link', 'video_id', 'frame_id', 'time_order', 'frame_order', 'fps', 'answer_key', 'youtube_link', 'publish_date']
const popupImageDiv = `
    <div class="popup-container">
        <div class="box popup">
            <div class="image-layer">
                <video class="video-for-popup" src="" controls>
            </div>
            <div class="time-spec">
                <div class="current-time">Current time: </div>
                <div class="current-frame">Current frame: </div>
            </div>
            <div class="tag-layer"></div>
            <span class="image-close">ⴵ</span>
            <span class="popup-recheck">➡️</span>
        </div>
    </div>
`;
const default_dataset = 'aic_2025';

// Hard-coded because no other teams would use our program lolol
const username = "team075";
const password = "khRrKkZW2U";

var ws;
var isLoadingBatch = false;
var currentLoadIndex = 0;
var currentDataset = [];
var currentResult = [];
var currentDisplay = [];
var searchHistory = [];

// Call function from Flask back-end
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

// Load available .pt dataset files for preview & sortings
async function preloadDataset(filename) {
    const resultContainer = document.querySelector(".middle-panel");
    resultContainer.innerHTML = '<span>Loading dataset...</span>';
    const result = listDatasets[filename]
    currentDataset = [...Object.values(result)];
    currentDisplay = [...currentDataset];
    if (currentDataset.length === 0) {
        resultContainer.innerHTML = '<span>Nothing to load</span>';
        return;
    }
    resetContainer(resultContainer)
    loadImage(resultContainer, currentDisplay);
}

// Reset container for every new load request
function resetContainer(container) {
    currentLoadIndex = 0;
    container.innerHTML = popupImageDiv;
}

// Box template
function constructBox(entity) {
    const Box = document.createElement('div');
    Box.className = 'box';
    Box.innerHTML = `
        <div class="image-layer">
            <img class="image-for-display" src="${entity.img_link}" alt="Image broken:<" loading="lazy">
        </div>
        <div class="tag-layer">
            <div class="tag tag-video_id" id="tag_video_id">${entity.video_id}</div>
            <div class="tag tag-frame_id" id="tag_frame_id">${entity.frame_id}</div>
            <div class="tag tag-time_order" id="tag_time_order">${entity.time_order}</div>
            <div class="tag tag-frame_order" id="tag_frame_order">${entity.frame_order}</div>
            <div class="tag tag-answer_key" id="tag_answer_key">${entity.answer_key}</div>
            <div class="tag tag-youtube_link" id="tag_youtube_link"><a target="_blank" href=${entity.youtube_link}>YouTube link</a></div>
            <div class="tag tag-publish_date" id="tag_publish_date">${entity.publish_date}</div>
        </div>

        <div class="search-layer">
            <div class="button cont-search" data-img_src=${entity.img_link}>🔍</div>
            <div class="button send-recheck">➡️</div>
            <div class="button expand" 
                data-img_src="${entity.img_link}"
                data-vid_src="${entity.vid_link}#t=${parseFloat(entity.time_order) / 1000}" 
                data-video_id=${entity.video_id} 
                data-frame_id=${entity.frame_id} 
                data-time_order=${entity.time_order} 
                data-frame_order=${entity.frame_order} 
                data-fps=${entity.fps} 
                data-answer_key=${entity.answer_key} 
                data-youtube_link=${entity.youtube_link} 
                data-publish_date=${entity.publish_date} >&#x26F6;
            </div>
        </div>
    `;
    
    return Box;
}

// Web socket for recheck synchronization
function initWebSocket() {
    ws = new WebSocket(`ws://${window.location.hostname}:5000/ws`);

    ws.onopen = () => {
        console.log('Web socket opened');
        ws.send(JSON.stringify({
            type: 'recheck_preload'
        }));
    };

    ws.onmessage = async (e) => {
        try {
            const data = JSON.parse(e.data);
            const recheckContainer = document.getElementById('recheck');
            recheckContainer.innerHTML = '';

            for (const boxInfo of data.data) {
                let entity = await callPythonFunction('query', {
                    link: boxInfo.img_src,
                    collection_name: document.getElementById("collection_name").value
                }).catch(e => {
                    console.error('Error getting recheck\'s data: ', e);
                });
                entity.time_order = boxInfo.time_order;
                entity.frame_order = boxInfo.frame_order;

                let recheckBox = constructBox(entity);
                recheckBox = constructRecheckBox(recheckBox);
                recheckContainer.appendChild(recheckBox);
            }
        } catch (e) {
            console.error('Error handling web socket message:', e);
        }
    };

    ws.onerror = (e) => {console.error('Web socket error', e);};

    ws.onclose = () => {
        console.log('Connection failed, attempting to reconnect...');
        setTimeout(initWebSocket, 1000);
    }
}
document.addEventListener('DOMContentLoaded', () => initWebSocket());

// Construct recheck box
function constructRecheckBox(recheckBox) {
    const parentLayer = recheckBox.querySelector('.search-layer');
    const recheckRemove = document.createElement('div');
    const recheckMoveUp = document.createElement('div');
    const recheckMoveDown = document.createElement('div');
    const tags = recheckBox.querySelectorAll('.tag');
    const cont_button = parentLayer.querySelector('.cont-search');
    const expand_button = parentLayer.querySelector('.expand');
    const recheck_button = parentLayer.querySelector('.send-recheck');
    

    recheckMoveUp.textContent = '⬆️';
    recheckMoveUp.setAttribute('class', 'button up-recheck');
    recheckMoveUp.addEventListener('click', () => {
        if (recheckBox.previousSibling !== null) {
            recheckImgLinkPrev = recheckBox.previousSibling.querySelector('.search-layer .expand').getAttribute('data-img_src');
            recheckTimePrev = recheckBox.previousSibling.querySelector('.search-layer .expand').getAttribute('data-time_order');
            recheckFramePrev = recheckBox.previousSibling.querySelector('.search-layer .expand').getAttribute('data-frame_order');
            recheckImgLink = recheckBox.querySelector('.search-layer .expand').getAttribute('data-img_src');
            recheckTime = recheckBox.querySelector('.search-layer .expand').getAttribute('data-time_order');
            recheckFrame = recheckBox.querySelector('.search-layer .expand').getAttribute('data-frame_order');
            ws.send(JSON.stringify({
                data: {
                    box1: {
                        img_src: recheckImgLinkPrev,
                        time_order: recheckTimePrev,
                        frame_order: recheckFramePrev
                    },
                    box2: {
                        img_src: recheckImgLink,
                        time_order: recheckTime,
                        frame_order: recheckFrame,
                    }
                },
                type: 'recheck_swap'
            }));
    }});

    recheckMoveDown.textContent = '⬇️';
    recheckMoveDown.setAttribute('class', 'button down-recheck');
    recheckMoveDown.addEventListener('click', () => {
        if (recheckBox.nextSibling !== null) {
            recheckImgLinkNext = recheckBox.nextSibling.querySelector('.search-layer .expand').getAttribute('data-img_src');
            recheckTimeNext = recheckBox.nextSibling.querySelector('.search-layer .expand').getAttribute('data-time_order');
            recheckFrameNext = recheckBox.nextSibling.querySelector('.search-layer .expand').getAttribute('data-frame_order');
            recheckImgLink = recheckBox.querySelector('.search-layer .expand').getAttribute('data-img_src');
            recheckTime = recheckBox.querySelector('.search-layer .expand').getAttribute('data-time_order');
            recheckFrame = recheckBox.querySelector('.search-layer .expand').getAttribute('data-frame_order');
            ws.send(JSON.stringify({
                data: {
                    box1: {
                        img_src: recheckImgLinkNext,
                        time_order: recheckTimeNext,
                        frame_order: recheckFrameNext
                    },
                    box2: {
                        img_src: recheckImgLink,
                        time_order: recheckTime,
                        frame_order: recheckFrame,
                    }
                },
                type: 'recheck_swap'
            }));
    }});

    recheckRemove.textContent = '❌';
    recheckRemove.setAttribute('class', 'button remove-recheck');
    recheckRemove.addEventListener('click', () => {
        recheckImgLink = recheckBox.querySelector('.search-layer .expand').getAttribute('data-img_src');
        recheckTime = recheckBox.querySelector('.search-layer .expand').getAttribute('data-time_order');
        recheckFrame = recheckBox.querySelector('.search-layer .expand').getAttribute('data-frame_order');
        ws.send(JSON.stringify({
            data: {
                img_src: recheckImgLink,
                time_order: recheckTime,
                frame_order: recheckFrame
            },
            type: 'recheck_remove'
        }));
    });

    addListeners(tags, cont_button, expand_button, recheck_button);
    parentLayer.removeChild(recheck_button);
    parentLayer.appendChild(recheckMoveUp);
    parentLayer.appendChild(recheckMoveDown);
    parentLayer.appendChild(recheckRemove);

    return recheckBox;
}

// Event listener for expand pop up button
function addExpandTrigger(expand) {
    let popupContainer = document.querySelector('.popup-container');
    let popupClose = document.querySelector('.image-close');
    let popupVideo = document.querySelector('.video-for-popup');
    let curTime = null;
    let curFrame = null;
    let popupRecheck = document.querySelector('.popup-recheck');
    let tagLayer = popupContainer.querySelector('.popup').querySelector('.tag-layer');
    tagLayer.innerHTML = `
        <div class="tag tag-video_id" id="tag_video_id">${expand.getAttribute('data-video_id')}</div>
        <div class="tag tag-frame_id" id="tag_frame_id">${expand.getAttribute('data-frame_id')}</div>
        <div class="tag tag-time_order" id="tag_time_order">${expand.getAttribute('data-time_order')}</div>
        <div class="tag tag-frame_order" id="tag_frame_order">${expand.getAttribute('data-frame_order')}</div>
        <div class="tag tag-answer_key" id="tag_answer_key">${expand.getAttribute('data-answer_key')}</div>
        <div class="tag tag-youtube_link" id="tag_youtube_link"><a target="_blank" href=${expand.getAttribute('data-youtube_link')}>YouTube link</a></div>
        <div class="tag tag-publish_date" id="tag_publish_date">${expand.getAttribute('data-publish_date')}</div>
    `;

    popupVideo.src = expand.getAttribute('data-vid_src');
    popupVideo.addEventListener('timeupdate', () => {
        curTime = parseInt(popupVideo.currentTime * 1000)
        curFrame = parseInt(popupVideo.currentTime * parseFloat(expand.getAttribute('data-fps')));
        document.querySelector('.current-time').innerHTML = `Current time: ${curTime} (ms)`;
        document.querySelector('.current-frame').innerHTML = `Current frame: ${curFrame}`;
        tagLayer.querySelector('.tag-time_order').textContent = curTime;
        tagLayer.querySelector('.tag-frame_order').textContent = curFrame;
    });

    popupRecheck.addEventListener('click', () => {
        let cloneBox = expand.parentElement.parentElement.cloneNode(true);
        let recheckImgLink = cloneBox.querySelector('.search-layer .expand').getAttribute('data-img_src');
        let recheckTime = curTime;
        let recheckFrame = curFrame;
        ws.send(JSON.stringify({
            data: {
                img_src: recheckImgLink,
                time_order: recheckTime,
                frame_order: recheckFrame
            },
            type: 'recheck_add',
        }));
    });

    popupContainer.style.display = 'block';
    popupClose.addEventListener('click', () => {
        let popupRecheckClone = popupRecheck.cloneNode(true);
        popupRecheck.parentNode.replaceChild(popupRecheckClone, popupRecheck);

        popupVideo.pause();
        popupContainer.style.display = 'none';
    });
}

// Add continuous search trigger
async function addContinuousSearchTrigger(button) {
    let resultContainer = document.querySelector(".middle-panel");
    resultContainer.innerHTML = '<span>Getting image feature...</span>';
    let image_feature = await callPythonFunction('get_milvus_feature', {
        link: button.getAttribute('data-img_src'),
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
    if (currentResult.length === 0) {
        resultContainer.innerHTML = '<span>No results found</span>';
        return;
    }
    resetContainer(resultContainer);
    loadImage(resultContainer, currentDisplay);
}

// Add boxes' listeners
function addListeners(tags, cont_button, expand_button, recheck_button) {
    for (let i = 0; i < tags.length; i++) {
        let tag = tags[i];
        let tagSwitchId = tag.id;
        tagSwitchId = tagSwitchId.replace('tag_', '');
        let tagSwitch = document.getElementById(tagSwitchId);
        tagSwitch.addEventListener('change', () => {
            tag.style.display = tagSwitch.checked ? 'block' : 'none';
        });
        tag.style.display = tagSwitch.checked ? 'block' : 'none';
    }

    cont_button.addEventListener('click', async () => addContinuousSearchTrigger(cont_button));
    expand_button.addEventListener('click', () => addExpandTrigger(expand_button));
    recheck_button.addEventListener('click', () => {
        let recheckBox = recheck_button.parentElement.parentElement.cloneNode(true);
        recheckImgLink = recheckBox.querySelector('.search-layer .expand').getAttribute('data-img_src');
        recheckTime = recheckBox.querySelector('.search-layer .expand').getAttribute('data-time_order');
        recheckFrame = recheckBox.querySelector('.search-layer .expand').getAttribute('data-frame_order');
        ws.send(JSON.stringify({
            data: {
                img_src: recheckImgLink,
                time_order: recheckTime,
                frame_order: recheckFrame
            },
            type: 'recheck_add'
        }));
    }) 
}

// Load image with batches
function loadImage(container, listEntities) {
    if (isLoadingBatch) {
        return; // Prevent multiple concurrent loads
    }

    setTimeout(() => {
        const end = Math.min(currentLoadIndex + loadBatchSize, listEntities.length);
        for (let i = currentLoadIndex; i < end; i++) {
            try {
                const entity = listEntities[i];
                const resultItem = constructBox(entity);

                const tags = resultItem.querySelectorAll('.tag');
                const cont_button = resultItem.querySelector('.cont-search');
                const expand_button = resultItem.querySelector('.expand');
                const recheck_button = resultItem.querySelector('.send-recheck');
                addListeners(tags, cont_button, expand_button, recheck_button);
                container.appendChild(resultItem);
            } catch (error) {
                console.error('Error loading image:', error);
                return;
            }
        }

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
    } else {
        body.style.gridTemplateAreas =`
            "h h h"
            "l m m"
        `;
        recheckShown = false;
    }
});

// Scroll only appears a set number of images
document.querySelector('.middle-panel').addEventListener('scroll', function() {
    const container = this;
    const scrollHeight = container.scrollHeight;
    const scrollTop = container.scrollTop;
    const clientHeight = container.clientHeight;
    if (scrollTop + clientHeight >= scrollHeight - 150 && currentLoadIndex < currentDisplay.length && !isLoadingBatch) { // Allocate 150px for buffer
        loadImage(container, currentDisplay);
    }
});

//Pre-load images everytime collection name is changed
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById("collection_name").addEventListener('change', (event) => {
        preloadDataset(event.target.value);
    });
    preloadDataset(default_dataset);
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
    if (currentResult.length === 0) {
        resultContainer.innerHTML = '<span>No results found</span>';
        return;
    }
    resetContainer(resultContainer)
    loadImage(resultContainer, currentDisplay);

    const temp_array = [];
    temp_array.push(args.query, currentResult);
    searchHistory.unshift(temp_array);
    LichSuTimKiem();
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
        let result_list = [];

        switch (filter_name){
            case 'video_id':{
                entities.forEach(entity =>{
                    if (text_value === entity.video_id)
                        result_list.push(entity);
                });
                break;
            }
            case 'frame_id':{
                entities.forEach(entity =>{
                    if (text_value === entity.frame_id)
                        result_list.push(entity);
                });
                break;
            }
            case 'frame_order':{
                entities.forEach(entity =>{
                    if (text_value === entity.frame_order)
                        result_list.push(entity);
                });
                break;
            }
            case 'time_order':{
                entities.forEach(entity =>{
                    if (text_value === entity.time_order)
                        result_list.push(entity);
                });
                break;
            }
            case 'answer_key':{
                entities.forEach(entity =>{
                    if (text_value === entity.answer_key)
                        result_list.push(entity);
                });
                break;
            }
            case 'youtube_link':{
                entities.forEach(entity =>{
                    if (text_value === entity.youtube_link)
                        result_list.push(entity);
                });
                break;
            }
            case 'publish_date':{
                entities.forEach(entity =>{
                    if (text_value === entity.publish_date)
                        result_list.push(entity);
                });
                break;
            }
        };
        
        currentDisplay = [];
        currentDisplay = [...Object.values(result_list)];
        resetContainer(resultContainer);
        loadImage(resultContainer, currentDisplay);
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
    resetContainer(container);
    loadImage(container, currentDisplay);
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
    resetContainer(container);
    loadImage(container, currentDisplay);
});

//Search History
function LichSuTimKiem(){
    try {
        const search_history = document.querySelector(".search-history-area");
        const temp_container = document.querySelector(".middle-panel");
        search_history.innerHTML = '';
        searchHistory.forEach(box => {
            let div = document.createElement('div');
            div.className = 'history-box';
            div.textContent = box[0].length < 35 ? box[0] : box[0].slice(0,35) + '...';
            div.addEventListener('click', () => {
                resetContainer(temp_container);
                loadImage(temp_container, box[1]);
            });
            search_history.appendChild(div);
        });
    } catch (error) {
        alert("error", error);
    };
};

// Submit mode handler
modeSelection = document.querySelector('.mode-selection')
modeSelection.onchange = () => {
    const qaAnswer = document.getElementById('qa_answer');
    const val = modeSelection.value;
    if (val === "qa") {
        qaAnswer.style.display = 'block';
    } else {
        qaAnswer.style.display = 'none';
    }
};

// Submission handler
async function getId(username, password) {
    try {
        let response = await fetch('https://eventretrieval.oj.io.vn/api/v2/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: username,
                password: password
            })
        });
        let data = await response.json();

        if (!response.ok) {
            throw new Error(`Login failed, response with status ${response.status}`);
        }

        const sessionId = data.sessionId;

        response = await fetch(`https://eventretrieval.oj.io.vn/api/v2/client/evaluation/list?session=${sessionId}`, { method: 'GET' });
        data = await response.json();

        if (!response.ok) {
            throw new Error(`Login failed, response with status ${response.status}`);
        }

        const activeEvaluation = data.find(item => item.type === 'SYNCHRONOUS' && item.status === 'ACTIVE');
        if (!activeEvaluation) {
            throw new Error('No active evaluation found');
        }
        const evaluationId = activeEvaluation.id;

        return {sessionId, evaluationId};
    } catch (e){
        console.log(`Error while fetching IDs: ${e}`);
        return {};
    }
}

async function submitResult(submission, sessionId, evaluationId) {
    try {
        let response = await fetch(`https://eventretrieval.oj.io.vn/api/v2/submit/${evaluationId}?session=${sessionId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(submission)
        });
        let data = await response.json();
        console.log(data);
        if (!response.ok) {
            throw new Error(`Submission failed, response with status: ${response.status}`);
        }
        return data;
    } catch (e){
        console.log(`Error while submitting result: ${e}`);
        return {submission: 'ERROR'};
    }
}

submitButton = document.querySelector('.submit-button')
submitButton.onclick = async () => {
    const chosen = document.getElementById('recheck').querySelectorAll('.box .search-layer .expand');
    const ans = document.getElementById('qa_answer').value
    const mode = modeSelection.value;
    if (chosen.length < 1) {

        return;
    }

    submitButton.textContent = 'SUBMITTING...'
    const idKey = await getId(username, password);
    let submission = {};
    if (mode === 'kis') {
        submission = {
            answerSets: [{
                answers: [{
                    mediaItemName: chosen[0].getAttribute('data-video_id'),
                    start: parseInt(chosen[0].getAttribute('data-time_order')),
                    end: parseInt(chosen[0].getAttribute('data-time_order')),
                }]
            }]
        };
    } else if (mode === 'qa') {
        submission = {
            answerSets: [{
                answers: [{
                    text: `QA-${ans}-${chosen[0].getAttribute('data-video_id')}-${chosen[0].getAttribute('data-time_order')}`
                }]
            }]
        };
    } else if (mode === 'trake') {
        let text = `TR-${chosen[0].getAttribute('data-video_id')}-`;
        for (let i = 0; i < chosen.length; i++) {
            text += `${chosen[i].getAttribute('data-frame_order')},`;
        }
        submission = {
            answerSets: [{
                answers: [{
                    text: text.slice(0, -1)
                }]
            }]
        };
    }
    console.log(submission)
    result = await submitResult(submission, idKey.sessionId, idKey.evaluationId);
    submitButton.textContent = result.submission;
    setTimeout(() => {
        submitButton.textContent = 'SUBMIT';
    }, 2000);
}