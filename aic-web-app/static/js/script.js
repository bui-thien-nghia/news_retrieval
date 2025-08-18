// Setting color
const open = document.getElementById('btn-open');
const close = document.getElementById('btn-close');
const modal_container = document.getElementById('modal-container');
const modal_demo = document.getElementById('modal-demo');
const saving = document.getElementById('sub_btn');
const currentResult = [];
const searchHistory = [];

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

function loadImageFromS3(container, entities, bucket, region) {
    container.innerHTML = ''; // Clear previous content
    entities.forEach(entity => {
        try {
            const resultItem = document.createElement('div');
            resultItem.className = 'box';
            resultItem.style.backgroundImage = `url(\'https://${bucket}.s3.${region}.amazonaws.com/${entity.img_key}\')`;
            resultItem.innerHTML = `` // Change metadata tags later;
            container.appendChild(resultItem);
        } catch (error) {
            console.error('Error loading image:', error);
            return; // Skip this entity if there's an error
        }
    });
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

// Thanh tìm kiếm
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

    const resultContainer = document.getElementsByClassName("middle-panel")[0];
    resultContainer.innerHTML = '<span>Loading result...</span>'; // Clear previous results
    const result = await callPythonFunction('search', args)
    const allEntities = Object.values(result);
    loadImageFromS3(resultContainer, allEntities, 'aic24', 'ap-southeast-2');
});

// Chọn kiểu tìm kiếm
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

//Pre-load images (currently pre-load last year's dataset)
document.addEventListener('DOMContentLoaded', async () => {
    args = {collection_name: 'aictestbatch'}
    const resultContainer = document.getElementsByClassName("middle-panel")[0];
    resultContainer.innerHTML = '<span>Loading dataset...</span>';
    const result = await callPythonFunction('get_all_entities', args)
    const allEntities = Object.values(result);
    loadImageFromS3(resultContainer, allEntities, 'aic24', 'ap-southeast-2');
});